import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import fs from 'fs/promises'
import os from 'os'
import path from 'path'
import { redactSession } from '@/lib/redact'
import { getTeamAnalytics } from '@/lib/team-reader'
import type { SessionMeta, TeamExportPayload } from '@/types/claude'

function makeSession(overrides: Partial<SessionMeta> = {}): SessionMeta {
  return {
    session_id: 'sess-1',
    project_path: '/Users/alice/Developer/secret-org/payments-api',
    start_time: '2026-06-01T10:00:00.000Z',
    last_activity: '2026-06-01T11:00:00.000Z',
    duration_minutes: 60,
    user_message_count: 10,
    assistant_message_count: 12,
    tool_counts: { Bash: 5 },
    languages: {},
    git_commits: 1,
    git_pushes: 0,
    input_tokens: 1_000_000,
    output_tokens: 100_000,
    cache_creation_input_tokens: 0,
    cache_read_input_tokens: 0,
    first_prompt: 'fix the payment race condition in checkout',
    user_interruptions: 0,
    user_response_times: [1.2, 3.4],
    tool_errors: 2,
    tool_error_categories: {},
    uses_task_agent: true,
    uses_mcp: false,
    uses_web_search: false,
    uses_web_fetch: false,
    lines_added: 100,
    lines_removed: 20,
    files_modified: 4,
    message_hours: [10, 10, 11],
    user_message_timestamps: ['2026-06-01T10:00:00.000Z'],
    model_usage: {
      'claude-opus-4-8': {
        inputTokens: 1_000_000,
        outputTokens: 100_000,
        cacheReadInputTokens: 0,
        cacheCreationInputTokens: 0,
        costUSD: 0,
        webSearchRequests: 0,
      },
    },
    ...overrides,
  }
}

describe('redactSession', () => {
  it('strips prompts, paths, and timing series at metrics level', () => {
    const r = redactSession(makeSession(), 'metrics')
    expect(r.first_prompt).toBe('')
    expect(r.project_path).toBe('payments-api')
    expect(r.user_response_times).toEqual([])
    expect(r.user_message_timestamps).toEqual([])
    // Aggregates survive
    expect(r.input_tokens).toBe(1_000_000)
    expect(r.tool_counts).toEqual({ Bash: 5 })
  })

  it('keeps the first prompt at titles level', () => {
    const r = redactSession(makeSession(), 'titles')
    expect(r.first_prompt).toBe('fix the payment race condition in checkout')
    expect(r.project_path).toBe('payments-api')
  })

  it('does not carry enrichment fields through the allowlist', () => {
    const enriched = { ...makeSession(), cwd: '/Users/alice/secret', slug_name: 'happy-otter' }
    const r = redactSession(enriched as SessionMeta, 'metrics')
    expect('cwd' in r).toBe(false)
    expect('slug_name' in r).toBe(false)
  })
})

describe('getTeamAnalytics', () => {
  let dir: string

  function makeExport(name: string, overrides: Partial<TeamExportPayload> = {}): TeamExportPayload {
    return {
      kind: 'cclens-team-export',
      version: '1.0.0',
      exportedAt: '2026-06-10T00:00:00.000Z',
      member: { name },
      redaction: 'metrics',
      cc_versions: ['2.1.62'],
      sessions: [redactSession(makeSession({ session_id: `${name}-s1` }), 'metrics')],
      ...overrides,
    }
  }

  beforeAll(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cc-lens-team-'))
    await fs.writeFile(path.join(dir, 'alice.json'), JSON.stringify(makeExport('Alice')))
    await fs.writeFile(path.join(dir, 'bob.json'), JSON.stringify(makeExport('Bob', { cc_versions: ['2.1.55'] })))
    // Older duplicate export from Alice — must lose to the newer one
    await fs.writeFile(
      path.join(dir, 'alice-old.json'),
      JSON.stringify(makeExport('Alice', { exportedAt: '2026-05-01T00:00:00.000Z', sessions: [] }))
    )
    await fs.writeFile(path.join(dir, 'junk.json'), '{"hello": "world"}')
    await fs.writeFile(path.join(dir, 'broken.json'), '{not json')
  })

  afterAll(async () => {
    await fs.rm(dir, { recursive: true, force: true })
  })

  it('aggregates members, deduping to the latest export per member', async () => {
    const t = await getTeamAnalytics(dir)
    expect(t.member_count).toBe(2)
    expect(t.total_sessions).toBe(2)

    const alice = t.members.find(m => m.member.name === 'Alice')!
    expect(alice.session_count).toBe(1) // newer export won over the empty old one
    expect(alice.estimated_cost).toBeCloseTo(7.5) // 1M in ($5) + 100K out ($2.50)
    expect(alice.top_projects[0].name).toBe('payments-api')
  })

  it('reports version skew across members', async () => {
    const t = await getTeamAnalytics(dir)
    const versions = Object.fromEntries(t.version_skew.map(v => [v.version, v.members]))
    expect(versions['2.1.62']).toEqual(['Alice'])
    expect(versions['2.1.55']).toEqual(['Bob'])
  })

  it('builds the daily series with per-member cost', async () => {
    const t = await getTeamAnalytics(dir)
    expect(t.daily).toHaveLength(1)
    expect(t.daily[0].date).toBe('2026-06-01')
    expect(t.daily[0].total_sessions).toBe(2)
    expect(t.daily[0].cost_by_member.Alice).toBeCloseTo(7.5)
  })

  it('skips malformed files and reports them as errors', async () => {
    const t = await getTeamAnalytics(dir)
    expect(t.errors.some(e => e.includes('junk.json'))).toBe(true)
    expect(t.errors.some(e => e.includes('broken.json'))).toBe(true)
  })

  it('returns an empty result for a missing directory', async () => {
    const t = await getTeamAnalytics('/nonexistent-team-dir')
    expect(t.member_count).toBe(0)
    expect(t.members).toEqual([])
  })
})

describe('getTeamAnalytics adoption and MCP inventory', () => {
  let dir: string

  beforeAll(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cc-lens-team-adoption-'))
    const carol: TeamExportPayload = {
      kind: 'cclens-team-export',
      version: '1.0.0',
      exportedAt: '2026-06-10T00:00:00.000Z',
      member: { name: 'Carol' },
      redaction: 'metrics',
      cc_versions: ['2.1.62'],
      sessions: [
        redactSession(makeSession({
          session_id: 'carol-s1',
          tool_counts: { Bash: 2, EnterPlanMode: 1, Skill: 3, mcp__linear__create_issue: 4, mcp__linear__search: 2 },
          uses_mcp: true,
          uses_task_agent: false,
          uses_web_search: true,
        }), 'metrics'),
        redactSession(makeSession({
          session_id: 'carol-s2',
          tool_counts: { Edit: 5, mcp__github__get_pr: 1 },
          uses_mcp: true,
          uses_task_agent: true,
          uses_web_search: false,
        }), 'metrics'),
      ],
    }
    await fs.writeFile(path.join(dir, 'carol.json'), JSON.stringify(carol))
  })

  afterAll(async () => {
    await fs.rm(dir, { recursive: true, force: true })
  })

  it('counts feature adoption per member', async () => {
    const t = await getTeamAnalytics(dir)
    const carol = t.members.find(m => m.member.name === 'Carol')!
    expect(carol.adoption).toEqual({ plan_mode: 1, agents: 1, mcp: 2, web: 1, skills: 1 })
    expect(carol.cost_per_session).toBeCloseTo(carol.estimated_cost / 2)
  })

  it('builds the MCP server inventory from tool counts', async () => {
    const t = await getTeamAnalytics(dir)
    const servers = Object.fromEntries(t.mcp_servers.map(s => [s.server, s]))
    expect(servers.linear.total_calls).toBe(6)
    expect(servers.linear.members).toEqual(['Carol'])
    expect(servers.github.total_calls).toBe(1)
    expect(t.mcp_servers[0].server).toBe('linear') // most-used first
  })
})
