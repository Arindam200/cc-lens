import type { ReplayData, ReplayTurn } from '@/types/claude'
import { formatDate } from '@/lib/decode'

function toolCallLine(tc: NonNullable<ReplayTurn['tool_calls']>[number]): string {
  const input = tc.input as Record<string, unknown>
  const detail =
    (typeof input.file_path === 'string' && input.file_path) ||
    (typeof input.command === 'string' && input.command) ||
    (typeof input.pattern === 'string' && input.pattern) ||
    ''
  return detail ? `- ${tc.name}: ${detail}` : `- ${tc.name}`
}

/** Serializes a parsed session replay into a compact, shareable Markdown transcript. */
export function replayToMarkdown(replay: ReplayData): string {
  const title = replay.ai_title ?? replay.slug ?? replay.session_id
  const lines: string[] = [`# ${title}`, '']

  const meta: string[] = []
  if (replay.slug) meta.push(replay.slug)
  const firstTimestamp = replay.turns[0]?.timestamp
  if (firstTimestamp) meta.push(formatDate(firstTimestamp))
  if (meta.length > 0) lines.push(meta.join(' · '), '')

  for (const turn of replay.turns) {
    if (turn.type === 'user') {
      if (!turn.text) continue
      lines.push('## User', '', turn.text.trim(), '')
    } else {
      if (turn.text?.trim()) {
        lines.push('## Assistant', '', turn.text.trim(), '')
      }
      if (turn.tool_calls && turn.tool_calls.length > 0) {
        lines.push(...turn.tool_calls.map(toolCallLine), '')
      }
    }
  }

  return lines.join('\n').trim() + '\n'
}

/** Filename-safe slug for the exported .md file, e.g. `2026-08-09-fix-auth-bug.md`. */
export function replayMarkdownFilename(replay: ReplayData): string {
  const base = replay.slug ?? replay.session_id.slice(0, 8)
  return `${base}.md`
}
