import type {
  ReplayData,
  ReplayTurn,
  CompactionEvent,
  SummaryEvent,
  TurnUsage,
  ToolCall,
} from '@/types/claude'
import { estimateCostFromUsage } from '@/lib/pricing'
import { readJSONLLines } from '@/lib/claude-reader'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyLine = Record<string, any>

export async function parseSessionReplay(
  jsonlPath: string,
  sessionId: string,
): Promise<ReplayData> {
  const lines: AnyLine[] = []
  await readJSONLLines(jsonlPath, line => lines.push(line))

  const turns: ReplayTurn[] = []
  const compactions: CompactionEvent[] = []
  const summaries: SummaryEvent[] = []

  let slug: string | undefined
  let aiTitle: string | undefined
  let version: string | undefined
  let gitBranch: string | undefined
  let totalCost = 0

  // Build a map of turn_duration events keyed by parentUuid
  const turnDurations: Map<string, number> = new Map()
  for (const l of lines) {
    if (l.type === 'system' && l.subtype === 'turn_duration' && l.parentUuid) {
      turnDurations.set(l.parentUuid, l.durationMs ?? 0)
    }
    // Grab metadata from any line
    if (!slug && l.slug)       slug = l.slug
    // ai-title lines repeat as the title is refined; the last one wins
    if (l.type === 'ai-title' && l.aiTitle) aiTitle = l.aiTitle
    if (!version && l.version) version = l.version
    if (!gitBranch && l.gitBranch && l.gitBranch !== 'HEAD') gitBranch = l.gitBranch
  }

  // Track previous assistant timestamp for response-time calculation
  const timestamps: Map<string, number> = new Map()
  for (const l of lines) {
    if (l.uuid && l.timestamp) timestamps.set(l.uuid, new Date(l.timestamp).getTime())
  }

  let turnIndex = 0

  for (const l of lines) {
    // ─── Summary event
    if (l.type === 'summary') {
      summaries.push({ uuid: l.uuid ?? '', summary: l.summary ?? '', leaf_uuid: l.leafUuid ?? '' })
      continue
    }

    // ─── Compaction boundary
    if (l.type === 'system' && l.subtype === 'compact_boundary') {
      const meta = l.compactMetadata ?? {}
      compactions.push({
        uuid: l.uuid ?? '',
        timestamp: l.timestamp ?? '',
        trigger: meta.trigger ?? 'auto',
        pre_tokens: meta.preTokens ?? 0,
        turn_index: turnIndex,
        summary: summaries.length > 0 ? summaries[summaries.length - 1].summary : undefined,
      })
      continue
    }

    // ─── User turn
    if (l.type === 'user') {
      const msg = l.message ?? {}
      const content = msg.content
      let text = ''
      const tool_results: ReplayTurn['tool_results'] = []

      if (typeof content === 'string') {
        text = content
      } else if (Array.isArray(content)) {
        for (const c of content) {
          if (c.type === 'text') text += c.text ?? ''
          if (c.type === 'tool_result') {
            const resultContent = Array.isArray(c.content)
              ? c.content.map((x: AnyLine) => x.text ?? '').join('')
              : (typeof c.content === 'string' ? c.content : '')
            tool_results.push({
              tool_use_id: c.tool_use_id ?? '',
              content: resultContent.slice(0, 2000),
              is_error: c.is_error ?? false,
            })
          }
        }
      }

      turns.push({
        uuid:        l.uuid ?? '',
        parentUuid:  l.parentUuid ?? null,
        type:        'user',
        is_sidechain: l.isSidechain === true || undefined,
        timestamp:   l.timestamp ?? '',
        text:        text.trim(),
        tool_results: tool_results.length > 0 ? tool_results : undefined,
      })
      turnIndex++
      continue
    }

    // ─── Assistant turn
    if (l.type === 'assistant') {
      const msg = l.message ?? {}
      const usage = msg.usage as TurnUsage | undefined
      const model = msg.model as string | undefined
      const content = msg.content ?? []

      let text = ''
      let has_thinking = false
      let thinking_text = ''
      const tool_calls: ToolCall[] = []

      if (Array.isArray(content)) {
        for (const c of content) {
          if (c.type === 'text')    text += c.text ?? ''
          if (c.type === 'thinking') {
            has_thinking = true
            thinking_text += c.thinking ?? ''
          }
          if (c.type === 'tool_use') {
            tool_calls.push({
              id:    c.id ?? '',
              name:  c.name ?? '',
              input: c.input ?? {},
            })
          }
        }
      }

      const estimated_cost = model && usage
        ? estimateCostFromUsage(model, usage)
        : 0

      totalCost += estimated_cost

      const turn_duration_ms = l.uuid ? turnDurations.get(l.uuid) : undefined

      turns.push({
        uuid:             l.uuid ?? '',
        parentUuid:       l.parentUuid ?? null,
        type:             'assistant',
        is_sidechain:     l.isSidechain === true || undefined,
        timestamp:        l.timestamp ?? '',
        model,
        usage,
        text:             text.trim(),
        tool_calls:       tool_calls.length > 0 ? tool_calls : undefined,
        has_thinking,
        thinking_text:    thinking_text.trim() || undefined,
        estimated_cost,
        turn_duration_ms,
      })
      turnIndex++
    }
  }

  return { session_id: sessionId, slug, ai_title: aiTitle, version, git_branch: gitBranch, turns, compactions, summaries, total_cost: totalCost }
}
