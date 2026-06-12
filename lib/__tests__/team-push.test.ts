import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest'
import fs from 'fs/promises'
import os from 'os'
import path from 'path'
import { POST } from '@/app/api/team/push/route'
import { getTeamAnalytics } from '@/lib/team-reader'
import type { TeamExportPayload } from '@/types/claude'

let dir: string

function makePayload(overrides: Partial<TeamExportPayload> = {}): TeamExportPayload {
  return {
    kind: 'cclens-team-export',
    version: '1.0.0',
    exportedAt: '2026-06-10T00:00:00.000Z',
    member: { name: 'Alice Smith', machine: 'laptop' },
    redaction: 'metrics',
    cc_versions: ['2.1.62'],
    sessions: [],
    ...overrides,
  }
}

function request(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request('http://localhost/api/team/push', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })
}

beforeAll(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cc-lens-push-'))
  process.env.CC_LENS_TEAM_DIR = dir
})

afterAll(async () => {
  delete process.env.CC_LENS_TEAM_DIR
  await fs.rm(dir, { recursive: true, force: true })
})

beforeEach(() => {
  // Most tests exercise the payload handling, not auth — opt into tokenless
  // mode so they don't trip the fail-closed default.
  process.env.CC_LENS_TEAM_INSECURE_LOCAL = '1'
})

afterEach(() => {
  delete process.env.CC_LENS_TEAM_TOKEN
  delete process.env.CC_LENS_TEAM_INSECURE_LOCAL
})

describe('POST /api/team/push', () => {
  it('stores a valid payload in the team dir', async () => {
    const res = await POST(request(makePayload()))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.stored_as).toBe('alice-smith--laptop.json')

    const analytics = await getTeamAnalytics(dir)
    expect(analytics.members.some(m => m.member.name === 'Alice Smith')).toBe(true)
  })

  it('rejects payloads that are not team exports', async () => {
    expect((await POST(request({ hello: 'world' }))).status).toBe(400)
    expect((await POST(request(makePayload({ member: { name: '' } })))).status).toBe(400)
  })

  it('re-redacts smuggled fields on the hub side', async () => {
    const sneaky = makePayload({
      sessions: [
        {
          session_id: 's1',
          project_path: '/Users/alice/secret-org/repo',
          start_time: '2026-06-01T10:00:00.000Z',
          duration_minutes: 1,
          user_message_count: 1,
          assistant_message_count: 1,
          tool_counts: {},
          languages: {},
          git_commits: 0,
          git_pushes: 0,
          input_tokens: 1,
          output_tokens: 1,
          first_prompt: 'super secret prompt',
          user_interruptions: 0,
          user_response_times: [1, 2, 3],
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
          user_message_timestamps: ['2026-06-01T10:00:00.000Z'],
          // @ts-expect-error deliberately smuggled field
          cwd: '/Users/alice/secret',
        },
      ],
    })
    const res = await POST(request(sneaky))
    expect(res.status).toBe(200)

    const stored = JSON.parse(await fs.readFile(path.join(dir, 'alice-smith--laptop.json'), 'utf-8'))
    const s = stored.sessions[0]
    expect(s.first_prompt).toBe('')
    expect(s.project_path).toBe('repo')
    expect(s.user_response_times).toEqual([])
    expect('cwd' in s).toBe(false)
  })

  it('enforces the bearer token when CC_LENS_TEAM_TOKEN is set', async () => {
    process.env.CC_LENS_TEAM_TOKEN = 'sekrit'
    expect((await POST(request(makePayload()))).status).toBe(401)
    expect((await POST(request(makePayload(), { Authorization: 'Bearer wrong' }))).status).toBe(401)
    expect((await POST(request(makePayload(), { Authorization: 'Bearer sekrit' }))).status).toBe(200)
  })

  it('fails closed when no token is configured and tokenless mode is not opted into', async () => {
    delete process.env.CC_LENS_TEAM_INSECURE_LOCAL
    expect((await POST(request(makePayload()))).status).toBe(401)
  })
})
