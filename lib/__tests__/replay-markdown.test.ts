import { describe, it, expect } from 'vitest'
import { replayToMarkdown, replayMarkdownFilename } from '@/lib/replay-markdown'
import type { ReplayData } from '@/types/claude'

const replay: ReplayData = {
  session_id: 'abc123def456',
  slug: 'fix-auth-bug',
  ai_title: 'Fix auth token refresh',
  turns: [
    {
      uuid: '1',
      parentUuid: null,
      type: 'user',
      timestamp: '2026-01-15T10:00:00Z',
      text: 'The token refresh is failing',
    },
    {
      uuid: '2',
      parentUuid: '1',
      type: 'assistant',
      timestamp: '2026-01-15T10:00:05Z',
      text: "I'll take a look.",
      tool_calls: [
        { id: 't1', name: 'Edit', input: { file_path: 'src/auth.ts' } },
        { id: 't2', name: 'Bash', input: { command: 'npm test' } },
      ],
    },
    {
      uuid: '3',
      parentUuid: '2',
      type: 'user',
      timestamp: '2026-01-15T10:01:00Z',
      text: '',
      tool_results: [{ tool_use_id: 't1', content: 'RAW_TOOL_RESULT_PAYLOAD', is_error: false }],
    },
  ],
  compactions: [],
  summaries: [],
  total_cost: 0,
}

describe('replayToMarkdown', () => {
  it('includes the title and both turn roles', () => {
    const md = replayToMarkdown(replay)
    expect(md).toContain('# Fix auth token refresh')
    expect(md).toContain('## User')
    expect(md).toContain('The token refresh is failing')
    expect(md).toContain('## Assistant')
    expect(md).toContain("I'll take a look.")
  })

  it('renders tool calls compactly, not raw tool output', () => {
    const md = replayToMarkdown(replay)
    expect(md).toContain('- Edit: src/auth.ts')
    expect(md).toContain('- Bash: npm test')
    expect(md).not.toContain('RAW_TOOL_RESULT_PAYLOAD') // tool_result content must not leak into the export
  })

  it('skips empty user turns (tool-result-only)', () => {
    const md = replayToMarkdown(replay)
    // Only two "## User" sections should exist: the real prompt, none for the empty tool-result turn
    expect(md.match(/## User/g)?.length).toBe(1)
  })

  it('falls back to slug when there is no ai_title', () => {
    const md = replayToMarkdown({ ...replay, ai_title: undefined })
    expect(md.startsWith('# fix-auth-bug')).toBe(true)
  })
})

describe('replayMarkdownFilename', () => {
  it('uses the slug when present', () => {
    expect(replayMarkdownFilename(replay)).toBe('fix-auth-bug.md')
  })

  it('falls back to a short session id', () => {
    expect(replayMarkdownFilename({ ...replay, slug: undefined })).toBe('abc123de.md')
  })
})
