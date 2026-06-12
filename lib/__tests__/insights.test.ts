import { describe, it, expect } from 'vitest'
import { buildInsightsReport, detectSpendAnomalies, sessionCost } from '@/lib/insights'
import type { SessionMeta, ModelUsage } from '@/types/claude'

const NOW = new Date('2026-06-10T12:00:00.000Z')

function usage(overrides: Partial<ModelUsage> = {}): ModelUsage {
  return {
    inputTokens: 0,
    outputTokens: 0,
    cacheReadInputTokens: 0,
    cacheCreationInputTokens: 0,
    costUSD: 0,
    webSearchRequests: 0,
    ...overrides,
  }
}

function makeSession(overrides: Partial<SessionMeta & { has_compaction?: boolean }> = {}): SessionMeta & { has_compaction?: boolean } {
  return {
    session_id: `sess-${Math.random()}`,
    project_path: '/Users/alice/proj',
    start_time: '2026-06-05T10:00:00.000Z',
    last_activity: '2026-06-05T11:00:00.000Z',
    duration_minutes: 60,
    user_message_count: 10,
    assistant_message_count: 12,
    tool_counts: {},
    languages: {},
    git_commits: 0,
    git_pushes: 0,
    input_tokens: 0,
    output_tokens: 0,
    first_prompt: '',
    user_interruptions: 0,
    user_response_times: [],
    tool_errors: 0,
    tool_error_categories: {},
    uses_task_agent: false,
    uses_mcp: false,
    uses_web_search: false,
    uses_web_fetch: false,
    lines_added: 0,
    lines_removed: 0,
    files_modified: 0,
    message_hours: [],
    user_message_timestamps: [],
    ...overrides,
  }
}

describe('buildInsightsReport', () => {
  it('flags a low cache hit rate with a positive savings estimate', () => {
    // 10M input tokens, none cached, on Opus 4.8 — clearly below the 80% bar
    const s = makeSession({
      model_usage: { 'claude-opus-4-8': usage({ inputTokens: 10_000_000, outputTokens: 100_000 }) },
    })
    const report = buildInsightsReport([s], 30, NOW)
    const insight = report.insights.find(i => i.id === 'low-cache-hit-rate')
    expect(insight).toBeDefined()
    expect(insight!.severity).toBe('high')
    expect(insight!.monthly_savings_usd).toBeGreaterThan(0)
    expect(report.cache_hit_rate).toBe(0)
  })

  it('does not flag caching when the hit rate is healthy', () => {
    const s = makeSession({
      model_usage: {
        'claude-opus-4-8': usage({ inputTokens: 1_000_000, cacheReadInputTokens: 9_000_000 }),
      },
    })
    const report = buildInsightsReport([s], 30, NOW)
    expect(report.insights.find(i => i.id === 'low-cache-hit-rate')).toBeUndefined()
    expect(report.cache_hit_rate).toBeCloseTo(0.9)
  })

  it('flags premium models on short sessions and prices the Sonnet delta', () => {
    const light = makeSession({
      user_message_count: 2,
      duration_minutes: 5,
      model_usage: { 'claude-opus-4-8': usage({ inputTokens: 2_000_000, outputTokens: 200_000 }) },
    })
    const report = buildInsightsReport([light], 30, NOW)
    const insight = report.insights.find(i => i.id === 'premium-model-light-sessions')
    expect(insight).toBeDefined()
    expect(insight!.affected_sessions).toBe(1)
    // Opus 4.8: 2M*$5 + 0.2M*$25 = $15; Sonnet 4.6: 2M*$3 + 0.2M*$15 = $9 → $6 saved
    expect(insight!.monthly_savings_usd).toBeCloseTo(6, 0)
  })

  it('does not flag long or agentic sessions for model downgrade', () => {
    const heavy = makeSession({
      user_message_count: 30,
      duration_minutes: 120,
      uses_task_agent: true,
      model_usage: { 'claude-opus-4-8': usage({ inputTokens: 5_000_000, outputTokens: 500_000 }) },
    })
    const report = buildInsightsReport([heavy], 30, NOW)
    expect(report.insights.find(i => i.id === 'premium-model-light-sessions')).toBeUndefined()
  })

  it('flags compaction when a meaningful share of sessions compacted', () => {
    const sessions = [
      ...Array.from({ length: 4 }, () => makeSession({ has_compaction: true })),
      ...Array.from({ length: 6 }, () => makeSession({ has_compaction: false })),
    ]
    const report = buildInsightsReport(sessions, 30, NOW)
    const insight = report.insights.find(i => i.id === 'compaction-thrash')
    expect(insight).toBeDefined()
    expect(insight!.affected_sessions).toBe(4)
  })

  it('suggests a subscription tier when run rate is well above its price', () => {
    // ~$400 in 30 days
    const s = makeSession({
      model_usage: { 'claude-opus-4-8': usage({ inputTokens: 50_000_000, outputTokens: 6_000_000 }) },
    })
    const report = buildInsightsReport([s], 30, NOW)
    const insight = report.insights.find(i => i.id === 'plan-optimizer')
    expect(insight).toBeDefined()
    expect(insight!.title).toContain('Max 20x')
  })

  it('only counts sessions inside the window', () => {
    const old = makeSession({
      start_time: '2026-01-01T10:00:00.000Z',
      model_usage: { 'claude-opus-4-8': usage({ inputTokens: 50_000_000 }) },
    })
    const report = buildInsightsReport([old], 30, NOW)
    expect(report.window_cost).toBe(0)
    expect(report.insights).toHaveLength(0)
  })
})

describe('detectSpendAnomalies', () => {
  it('flags a recent day far above the trailing median', () => {
    const daily = [
      ...Array.from({ length: 10 }, (_, i) => ({ date: `2026-05-${20 + i}`, cost: 5 })),
      { date: '2026-06-09', cost: 60 },
    ]
    const anomalies = detectSpendAnomalies(daily, NOW)
    expect(anomalies).toHaveLength(1)
    expect(anomalies[0].date).toBe('2026-06-09')
    expect(anomalies[0].baseline).toBe(5)
  })

  it('ignores spikes older than 14 days and small absolute amounts', () => {
    const daily = [
      ...Array.from({ length: 10 }, (_, i) => ({ date: `2026-04-${String(10 + i)}`, cost: 1 })),
      { date: '2026-04-20', cost: 50 }, // old spike
      ...Array.from({ length: 8 }, (_, i) => ({ date: `2026-06-0${1 + i}`, cost: 1 })),
      { date: '2026-06-09', cost: 4 }, // 4x median but under the $5 floor
    ]
    expect(detectSpendAnomalies(daily, NOW)).toHaveLength(0)
  })
})

describe('sessionCost', () => {
  it('prices model usage with the per-model table', () => {
    const s = makeSession({
      model_usage: { 'claude-sonnet-4-6': usage({ inputTokens: 1_000_000, outputTokens: 1_000_000 }) },
    })
    expect(sessionCost(s)).toBeCloseTo(18) // $3 + $15
  })
})
