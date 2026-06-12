import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import fs from 'fs/promises'
import os from 'os'
import path from 'path'

// Fixture-driven test against a fake ~/.claude dir. CLAUDE_CONFIG_DIR is read
// at module load, so the reader is imported dynamically after env setup.
let tmpDir: string
let reader: typeof import('@/lib/claude-reader')
let previousClaudeConfigDir: string | undefined

const SESSION_ID = 'abc12345-0000-0000-0000-000000000000'

const jsonlLines = [
  JSON.stringify({
    type: 'user',
    timestamp: '2026-06-01T10:00:00.000Z',
    cwd: '/Users/test/proj',
    slug: 'happy-otter',
    version: '2.1.62',
    gitBranch: 'main',
    sessionId: SESSION_ID,
    message: { content: '<system-reminder>injected noise</system-reminder>Hello world' },
  }),
  JSON.stringify({
    type: 'assistant',
    timestamp: '2026-06-01T10:01:00.000Z',
    message: {
      model: 'claude-opus-4-8',
      usage: {
        input_tokens: 100,
        output_tokens: 50,
        cache_read_input_tokens: 1000,
        cache_creation_input_tokens: 200,
      },
      content: [
        { type: 'thinking', thinking: '...' },
        { type: 'tool_use', name: 'Bash', input: {} },
        { type: 'tool_use', name: 'mcp__foo__bar', input: {} },
      ],
    },
  }),
  JSON.stringify({
    type: 'system',
    subtype: 'compact_boundary',
    timestamp: '2026-06-01T10:02:00.000Z',
  }),
  '{this line is malformed json',
]

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cc-lens-test-'))
  const projectDir = path.join(tmpDir, 'projects', '-Users-test-proj')
  await fs.mkdir(projectDir, { recursive: true })
  await fs.writeFile(path.join(projectDir, `${SESSION_ID}.jsonl`), jsonlLines.join('\n'))

  previousClaudeConfigDir = process.env.CLAUDE_CONFIG_DIR
  process.env.CLAUDE_CONFIG_DIR = tmpDir
  vi.resetModules()
  reader = await import('@/lib/claude-reader')
})

afterAll(async () => {
  if (previousClaudeConfigDir === undefined) delete process.env.CLAUDE_CONFIG_DIR
  else process.env.CLAUDE_CONFIG_DIR = previousClaudeConfigDir
  vi.resetModules()
  await fs.rm(tmpDir, { recursive: true, force: true })
})

describe('getAllParsedSessions', () => {
  it('parses a session JSONL into metadata', async () => {
    const sessions = await reader.getAllParsedSessions()
    expect(sessions).toHaveLength(1)

    const s = sessions[0]
    expect(s.session_id).toBe(SESSION_ID)
    expect(s.project_path).toBe('/Users/test/proj')
    expect(s.user_message_count).toBe(1)
    expect(s.assistant_message_count).toBe(1)
    expect(s.duration_minutes).toBeCloseTo(2)

    expect(s.input_tokens).toBe(100)
    expect(s.output_tokens).toBe(50)
    expect(s.cache_read_input_tokens).toBe(1000)
    expect(s.cache_creation_input_tokens).toBe(200)
    expect(s.model_usage['claude-opus-4-8'].inputTokens).toBe(100)

    expect(s.tool_counts).toEqual({ Bash: 1, mcp__foo__bar: 1 })
    expect(s.uses_mcp).toBe(true)
    expect(s.has_thinking).toBe(true)
    expect(s.has_compaction).toBe(true)

    expect(s.slug_name).toBe('happy-otter')
    expect(s.cc_version).toBe('2.1.62')
    expect(s.git_branch).toBe('main')
  })

  it('strips wrapper tags from the first prompt without eating surrounding text', async () => {
    const sessions = await reader.getAllParsedSessions()
    expect(sessions[0].first_prompt).toBe('Hello world')
  })

  it('serves repeat calls from the mtime cache', async () => {
    const first = await reader.getAllParsedSessions()
    const second = await reader.getAllParsedSessions()
    expect(second).toHaveLength(first.length)
    expect(second[0].session_id).toBe(first[0].session_id)
  })
})

describe('findSessionJSONL', () => {
  it('locates the file for a session id', async () => {
    const file = await reader.findSessionJSONL(SESSION_ID)
    expect(file).toContain(`${SESSION_ID}.jsonl`)
  })

  it('returns null for unknown ids', async () => {
    expect(await reader.findSessionJSONL('does-not-exist')).toBeNull()
  })
})
