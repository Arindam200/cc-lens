import type { SessionMeta, ModelUsage } from '@/types/claude'
import { getPricing, estimateTotalCostFromModel, cacheEfficiency } from '@/lib/pricing'

// Savings insights: each detector looks at a window of sessions and, where it
// can, attaches a dollar figure. Estimates are deliberately conservative —
// an insight that overpromises savings destroys trust in all the others.

export type InsightSeverity = 'high' | 'medium' | 'info'

export interface Insight {
  id: string
  severity: InsightSeverity
  title: string
  detail: string
  /** Estimated savings per 30 days; 0 for purely informational findings */
  monthly_savings_usd: number
  affected_sessions: number
}

export interface SpendAnomaly {
  date: string
  cost: number
  /** Trailing median daily cost the spike is measured against */
  baseline: number
}

export interface InsightsReport {
  window_days: number
  window_cost: number
  /** Window cost scaled to 30 days */
  monthly_run_rate: number
  cache_hit_rate: number
  total_monthly_savings: number
  insights: Insight[]
  anomalies: SpendAnomaly[]
}

type SessionLike = SessionMeta & { has_compaction?: boolean }

export function sessionCost(s: SessionMeta): number {
  if (s.model_usage && Object.keys(s.model_usage).length > 0) {
    return Object.entries(s.model_usage).reduce(
      (sum, [model, usage]) => sum + estimateTotalCostFromModel(model, usage),
      0
    )
  }
  // Legacy sessions only carry top-level token counters; price them the same
  // way the costs API does so the two endpoints agree.
  return estimateTotalCostFromModel('claude-opus-4-7', {
    inputTokens: s.input_tokens ?? 0,
    outputTokens: s.output_tokens ?? 0,
    cacheCreationInputTokens: s.cache_creation_input_tokens ?? 0,
    cacheReadInputTokens: s.cache_read_input_tokens ?? 0,
    costUSD: 0,
    webSearchRequests: 0,
  })
}

function mergeUsage(target: Record<string, ModelUsage>, source?: Record<string, ModelUsage>) {
  if (!source) return
  for (const [model, u] of Object.entries(source)) {
    if (model === '<synthetic>') continue
    const t = target[model] ?? {
      inputTokens: 0,
      outputTokens: 0,
      cacheReadInputTokens: 0,
      cacheCreationInputTokens: 0,
      costUSD: 0,
      webSearchRequests: 0,
    }
    t.inputTokens += u.inputTokens
    t.outputTokens += u.outputTokens
    t.cacheReadInputTokens += u.cacheReadInputTokens
    t.cacheCreationInputTokens += u.cacheCreationInputTokens
    target[model] = t
  }
}

/** Input-token price per MTok, used to classify premium vs economy models */
function inputPricePerMTok(model: string): number {
  return getPricing(model).input * 1_000_000
}

const PREMIUM_INPUT_THRESHOLD = 5 // $/MTok — Opus 4.x and up
const ECONOMY_MODEL = 'claude-sonnet-4-6'
const TARGET_CACHE_HIT_RATE = 0.9

// ─── Detectors ───────────────────────────────────────────────────────────────

function detectLowCacheHitRate(byModel: Record<string, ModelUsage>, monthlyFactor: number): Insight | null {
  let extraSavings = 0
  let context = 0
  let cacheRead = 0
  for (const [model, usage] of Object.entries(byModel)) {
    const total = usage.inputTokens + usage.cacheReadInputTokens
    context += total
    cacheRead += usage.cacheReadInputTokens
    const targetReads = total * TARGET_CACHE_HIT_RATE
    const missedReads = Math.max(0, targetReads - usage.cacheReadInputTokens)
    const p = getPricing(model)
    extraSavings += missedReads * (p.input - p.cacheRead)
  }
  const hitRate = context > 0 ? cacheRead / context : 0
  if (hitRate >= 0.8 || extraSavings * monthlyFactor < 1) return null
  return {
    id: 'low-cache-hit-rate',
    severity: hitRate < 0.5 ? 'high' : 'medium',
    title: `Cache hit rate is ${(hitRate * 100).toFixed(0)}% — caching is leaving money on the table`,
    detail:
      `${(hitRate * 100).toFixed(0)}% of context tokens were served from cache; well-structured sessions reach ${TARGET_CACHE_HIT_RATE * 100}%. ` +
      `Long gaps between messages (cache expires after 5 minutes) and frequent context resets are the usual causes. ` +
      `Reaching ${TARGET_CACHE_HIT_RATE * 100}% would save about ${fmtUsd(extraSavings * monthlyFactor)}/month at current volume.`,
    monthly_savings_usd: extraSavings * monthlyFactor,
    affected_sessions: 0,
  }
}

function detectPremiumModelOnLightSessions(sessions: SessionLike[], monthlyFactor: number): Insight | null {
  let savings = 0
  let count = 0
  for (const s of sessions) {
    if (!s.model_usage) continue
    const light = s.user_message_count <= 3 && s.duration_minutes < 15 && !s.uses_task_agent
    if (!light) continue
    let premiumCost = 0
    let economyCost = 0
    for (const [model, usage] of Object.entries(s.model_usage)) {
      if (model === '<synthetic>') continue
      if (inputPricePerMTok(model) < PREMIUM_INPUT_THRESHOLD) continue
      premiumCost += estimateTotalCostFromModel(model, usage)
      economyCost += estimateTotalCostFromModel(ECONOMY_MODEL, usage)
    }
    if (premiumCost > economyCost) {
      savings += premiumCost - economyCost
      count++
    }
  }
  const monthly = savings * monthlyFactor
  if (count === 0 || monthly < 1) return null
  return {
    id: 'premium-model-light-sessions',
    severity: monthly > 20 ? 'high' : 'medium',
    title: `${count} short sessions ran on a premium model`,
    detail:
      `Sessions with three or fewer prompts, under 15 minutes, and no agent work usually do fine on Sonnet. ` +
      `Running these on Sonnet instead would save about ${fmtUsd(monthly)}/month. ` +
      `Switch per session with /model, or keep a cheaper default and escalate when a task needs it.`,
    monthly_savings_usd: monthly,
    affected_sessions: count,
  }
}

function detectCompactionThrash(sessions: SessionLike[]): Insight | null {
  const tracked = sessions.filter(s => s.has_compaction !== undefined)
  if (tracked.length === 0) return null
  const compacted = tracked.filter(s => s.has_compaction)
  const share = compacted.length / tracked.length
  if (compacted.length < 3 || share < 0.15) return null
  return {
    id: 'compaction-thrash',
    severity: share > 0.3 ? 'medium' : 'info',
    title: `${(share * 100).toFixed(0)}% of sessions hit context compaction`,
    detail:
      `${compacted.length} of ${tracked.length} sessions ran long enough to compact their context. ` +
      `Each compaction re-summarizes the conversation and re-writes the cache, and quality degrades as detail is squeezed out. ` +
      `Splitting work into smaller sessions, or starting fresh with /clear after a milestone, avoids most of it.`,
    monthly_savings_usd: 0,
    affected_sessions: compacted.length,
  }
}

const SUBSCRIPTION_TIERS = [
  { name: 'Max 20x', monthly: 200 },
  { name: 'Max 5x', monthly: 100 },
] as const

function detectPlanOptimizer(monthlyRunRate: number): Insight | null {
  const tier = SUBSCRIPTION_TIERS.find(t => monthlyRunRate > t.monthly * 1.5)
  if (!tier) return null
  return {
    id: 'plan-optimizer',
    severity: 'info',
    title: `API-equivalent run rate is ${fmtUsd(monthlyRunRate)}/month — a ${tier.name} subscription costs ${fmtUsd(tier.monthly)}`,
    detail:
      `If this usage is billed through an API key, a ${tier.name} plan (${fmtUsd(tier.monthly)}/month) would cover it for roughly ` +
      `${fmtUsd(monthlyRunRate - tier.monthly)}/month less, subject to its rate limits. ` +
      `Already on a subscription? Then this number is what your plan is worth at API prices.`,
    monthly_savings_usd: monthlyRunRate - tier.monthly,
    affected_sessions: 0,
  }
}

// ─── Anomaly detection ───────────────────────────────────────────────────────

/**
 * Flag days whose spend is far above the trailing 7-day median. Returns
 * anomalies within the most recent 14 days so old spikes don't linger as
 * alerts forever.
 */
export function detectSpendAnomalies(dailyCosts: Array<{ date: string; cost: number }>, today = new Date()): SpendAnomaly[] {
  const sorted = [...dailyCosts].sort((a, b) => a.date.localeCompare(b.date))
  const recentCutoff = new Date(today)
  recentCutoff.setDate(recentCutoff.getDate() - 14)
  const cutoffStr = recentCutoff.toISOString().slice(0, 10)

  const anomalies: SpendAnomaly[] = []
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i].date < cutoffStr) continue
    const trailing = sorted.slice(Math.max(0, i - 7), i).map(d => d.cost).sort((a, b) => a - b)
    if (trailing.length < 3) continue
    const median = trailing[Math.floor(trailing.length / 2)]
    if (sorted[i].cost > Math.max(median * 3, 5)) {
      anomalies.push({ date: sorted[i].date, cost: sorted[i].cost, baseline: median })
    }
  }
  return anomalies.sort((a, b) => b.date.localeCompare(a.date))
}

// ─── Report ──────────────────────────────────────────────────────────────────

function fmtUsd(n: number): string {
  return `$${n < 10 ? n.toFixed(2) : Math.round(n).toLocaleString()}`
}

export function buildInsightsReport(sessions: SessionLike[], windowDays = 30, now = new Date()): InsightsReport {
  const cutoff = new Date(now)
  cutoff.setHours(0, 0, 0, 0)
  cutoff.setDate(cutoff.getDate() - (windowDays - 1))
  const cutoffStr = cutoff.toISOString().slice(0, 10)
  const windowed = sessions.filter(s => s.start_time && s.start_time.slice(0, 10) >= cutoffStr)

  const byModel: Record<string, ModelUsage> = {}
  const dailyCostMap = new Map<string, number>()
  let windowCost = 0
  for (const s of windowed) {
    mergeUsage(byModel, s.model_usage)
    const c = sessionCost(s)
    windowCost += c
    const day = s.start_time.slice(0, 10)
    dailyCostMap.set(day, (dailyCostMap.get(day) ?? 0) + c)
  }
  const monthlyFactor = 30 / windowDays
  const monthlyRunRate = windowCost * monthlyFactor

  let context = 0
  let cacheRead = 0
  for (const usage of Object.values(byModel)) {
    context += usage.inputTokens + usage.cacheReadInputTokens
    cacheRead += usage.cacheReadInputTokens
  }

  const insights = [
    detectLowCacheHitRate(byModel, monthlyFactor),
    detectPremiumModelOnLightSessions(windowed, monthlyFactor),
    detectCompactionThrash(windowed),
    detectPlanOptimizer(monthlyRunRate),
  ].filter((i): i is Insight => i !== null)

  const severityRank = { high: 0, medium: 1, info: 2 }
  insights.sort(
    (a, b) => severityRank[a.severity] - severityRank[b.severity] || b.monthly_savings_usd - a.monthly_savings_usd
  )

  return {
    window_days: windowDays,
    window_cost: windowCost,
    monthly_run_rate: monthlyRunRate,
    cache_hit_rate: context > 0 ? cacheRead / context : 0,
    total_monthly_savings: insights.reduce((sum, i) => sum + i.monthly_savings_usd, 0),
    insights,
    anomalies: detectSpendAnomalies(
      Array.from(dailyCostMap.entries()).map(([date, cost]) => ({ date, cost })),
      now
    ),
  }
}

/** Sum of cacheEfficiency savings across a usage map — what caching already saved */
export function totalCacheSavings(byModel: Record<string, ModelUsage>): number {
  return Object.entries(byModel).reduce((sum, [model, usage]) => sum + cacheEfficiency(model, usage).savedUSD, 0)
}
