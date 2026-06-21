import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import fs from 'fs/promises'
import os from 'os'
import path from 'path'
import { parseSessionReplay } from '@/lib/replay-parser'

// Claude Code splits one assistant message across multiple JSONL lines (one per
// content block: thinking / text / tool_use), and every one of those lines
// repeats the same cumulative message.usage. total_cost must therefore count a
// message once (by message.id), not once per content-block line.
describe('parseSessionReplay total_cost', () => {
  let tmpDir: string

  beforeAll(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cclens-replay-'))
  })

  afterAll(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true })
  })

  const usage = {
    input_tokens: 100,
    output_tokens: 200,
    cache_read_input_tokens: 0,
    cache_creation_input_tokens: 0,
  }

  function assistantLine(uuid: string, messageId: string, block: object): string {
    return JSON.stringify({
      type: 'assistant',
      uuid,
      timestamp: '2026-06-01T10:00:00.000Z',
      message: { id: messageId, model: 'claude-opus-4-8', usage, content: [block] },
    })
  }

  async function write(sessionId: string, lines: string[]): Promise<string> {
    const p = path.join(tmpDir, `${sessionId}.jsonl`)
    await fs.writeFile(p, lines.join('\n') + '\n')
    return p
  }

  it('counts a message once when it is split across content-block lines', async () => {
    const sessionId = 'split-0000-0000-0000-000000000000'
    const jsonlPath = await write(sessionId, [
      assistantLine('u1', 'msg_a', { type: 'thinking', thinking: 'reasoning' }),
      assistantLine('u2', 'msg_a', { type: 'text', text: 'answer' }),
      assistantLine('u3', 'msg_a', { type: 'tool_use', id: 't1', name: 'Read', input: {} }),
    ])

    const result = await parseSessionReplay(jsonlPath, sessionId)

    expect(result.turns).toHaveLength(3)
    const perMessageCost = result.turns[0].estimated_cost
    expect(perMessageCost).toBeGreaterThan(0)
    // One logical message => counted once, not 3x.
    expect(result.total_cost).toBeCloseTo(perMessageCost)
  })

  it('counts distinct messages separately', async () => {
    const sessionId = 'distinct-0000-0000-0000-000000000000'
    const jsonlPath = await write(sessionId, [
      assistantLine('u1', 'msg_a', { type: 'text', text: 'first' }),
      assistantLine('u2', 'msg_b', { type: 'text', text: 'second' }),
    ])

    const result = await parseSessionReplay(jsonlPath, sessionId)

    const perMessageCost = result.turns[0].estimated_cost
    expect(result.total_cost).toBeCloseTo(perMessageCost * 2)
  })
})
