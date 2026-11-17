import { describe, it, expect } from 'vitest'
import { redactSession } from '@/lib/redact'
import type { SessionMeta } from '@/types/claude'

describe('redact: nested allowlist', () => {
  it('drops smuggled keys and non-numeric values in model_usage and maps', () => {
    const evil = {
      session_id: 'x', project_path: '/a/b', start_time: '2026-01-01T00:00:00Z',
      tool_counts: { Bash: 2, bad: 'secret' },
      model_usage: { 'claude-opus-4-8': { inputTokens: 5, private_note: 'leak', outputTokens: 'x' } },
    } as unknown as SessionMeta
    const out = redactSession(evil, 'metrics')
    expect(out.tool_counts).toEqual({ Bash: 2 })
    expect(out.model_usage?.['claude-opus-4-8']).toEqual({
      inputTokens: 5, outputTokens: 0, cacheReadInputTokens: 0,
      cacheCreationInputTokens: 0, cacheCreation1hInputTokens: 0, costUSD: 0, webSearchRequests: 0,
    })
  })
})
