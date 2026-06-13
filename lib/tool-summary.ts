import type { ToolCall } from '@/types/claude'
import { parseMcpTool } from './tool-categories'

// ─── Action grouping ──────────────────────────────────────────────────────────
// Mirrors the Claude.ai conversation UI, which collapses consecutive tool calls
// into one summary chip ("Created 3 files, edited 4 files, ran 2 commands").

export type ActionKind =
  | 'create'
  | 'edit'
  | 'read'
  | 'search'
  | 'run'
  | 'web'
  | 'todo'
  | 'agent'
  | 'other'

export function toolAction(name: string): ActionKind {
  switch (name) {
    case 'Write':
      return 'create'
    case 'Edit':
    case 'MultiEdit':
      return 'edit'
    case 'Read':
    case 'NotebookRead':
      return 'read'
    case 'Grep':
    case 'Glob':
      return 'search'
    case 'Bash':
      return 'run'
    case 'WebSearch':
    case 'WebFetch':
      return 'web'
    case 'TodoWrite':
      return 'todo'
    case 'Task':
      return 'agent'
    default:
      return 'other'
  }
}

// Order in which action phrases appear in a combined summary.
const ACTION_ORDER: ActionKind[] = [
  'create',
  'edit',
  'read',
  'search',
  'web',
  'agent',
  'todo',
  'run',
  'other',
]

function actionPhrase(action: ActionKind, n: number): string {
  const one = n === 1
  switch (action) {
    case 'create':
      return one ? 'created a file' : `created ${n} files`
    case 'edit':
      return one ? 'edited a file' : `edited ${n} files`
    case 'read':
      return one ? 'read a file' : `read ${n} files`
    case 'search':
      return one ? 'ran a search' : `ran ${n} searches`
    case 'web':
      return one ? 'made a web request' : `made ${n} web requests`
    case 'agent':
      return one ? 'ran an agent' : `ran ${n} agents`
    case 'todo':
      return 'updated the to-do list'
    case 'run':
      return one ? 'ran a command' : `ran ${n} commands`
    case 'other':
      return one ? 'used a tool' : `used ${n} tools`
  }
}

/** Build the collapsed group label, e.g. "Created 3 files, edited 4 files, ran 2 commands". */
export function summarizeGroup(calls: ToolCall[]): string {
  const counts = new Map<ActionKind, number>()
  for (const c of calls) {
    const a = toolAction(c.name)
    counts.set(a, (counts.get(a) ?? 0) + 1)
  }
  const parts: string[] = []
  for (const action of ACTION_ORDER) {
    const n = counts.get(action)
    if (n) parts.push(actionPhrase(action, n))
  }
  const joined = parts.join(', ')
  return joined.charAt(0).toUpperCase() + joined.slice(1)
}

// ─── Per-row labels ─────────────────────────────────────────────────────────

function basename(path: string): string {
  const parts = path.split('/').filter(Boolean)
  return parts[parts.length - 1] ?? path
}

function firstLine(s: string): string {
  const line = s.split('\n')[0]?.trim() ?? ''
  return line
}

export interface RowLabel {
  /** Leading verb, e.g. "Ran", "Edited", "Created". */
  verb: string
  /** Primary subject text (filename, command description, pattern…). */
  text: string
  add?: number
  del?: number
}

export function rowLabel(call: ToolCall): RowLabel {
  const input = call.input ?? {}
  const action = toolAction(call.name)

  switch (action) {
    case 'create': {
      const path = String(input.file_path ?? input.path ?? '')
      const content = String(input.content ?? '')
      const add = content ? content.split('\n').length : 0
      return { verb: 'Created', text: basename(path) || 'file', add, del: 0 }
    }
    case 'edit': {
      const path = String(input.file_path ?? input.path ?? '')
      const { add, del } = countEditChanges(input)
      return { verb: 'Edited', text: basename(path) || 'file', add, del }
    }
    case 'read': {
      const path = String(input.file_path ?? input.path ?? '')
      return { verb: 'Read', text: basename(path) || 'file' }
    }
    case 'search': {
      const pat = String(input.pattern ?? input.query ?? input.glob ?? '')
      return { verb: 'Searched', text: pat || call.name }
    }
    case 'run': {
      const desc = input.description ? String(input.description) : firstLine(String(input.command ?? ''))
      return { verb: 'Ran', text: desc || 'command' }
    }
    case 'web': {
      const t = String(input.query ?? input.url ?? '')
      return { verb: call.name === 'WebFetch' ? 'Fetched' : 'Searched', text: t || call.name }
    }
    case 'agent': {
      const t = String(input.description ?? input.subagent_type ?? '')
      return { verb: 'Ran agent', text: t || 'task' }
    }
    case 'todo':
      return { verb: 'Updated', text: 'to-do list' }
    default: {
      const mcp = parseMcpTool(call.name)
      const name = mcp ? `${mcp.server} · ${mcp.tool}` : call.name
      const firstKey = Object.keys(input)[0]
      const arg = firstKey ? String(input[firstKey]) : ''
      return { verb: 'Ran', text: arg ? `${name} ${firstLine(arg)}` : name }
    }
  }
}

// ─── Edit / diff handling ─────────────────────────────────────────────────────

function countEditChanges(input: Record<string, unknown>): { add: number; del: number } {
  // MultiEdit: edits[] of { old_string, new_string }
  if (Array.isArray(input.edits)) {
    let add = 0
    let del = 0
    for (const e of input.edits as Array<Record<string, unknown>>) {
      const d = computeDiff(String(e.old_string ?? ''), String(e.new_string ?? ''))
      add += d.add
      del += d.del
    }
    return { add, del }
  }
  const d = computeDiff(String(input.old_string ?? ''), String(input.new_string ?? ''))
  return { add: d.add, del: d.del }
}

export interface DiffLine {
  type: 'add' | 'del' | 'ctx'
  text: string
  oldNo?: number
  newNo?: number
}

export interface DiffResult {
  lines: DiffLine[]
  add: number
  del: number
}

/** Line-based LCS diff. Small inputs (Edit snippets), so O(n*m) is fine. */
export function computeDiff(oldStr: string, newStr: string): DiffResult {
  const a = oldStr === '' ? [] : oldStr.split('\n')
  const b = newStr === '' ? [] : newStr.split('\n')
  const n = a.length
  const m = b.length

  // LCS length table
  const lcs: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0))
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1])
    }
  }

  const lines: DiffLine[] = []
  let add = 0
  let del = 0
  let i = 0
  let j = 0
  let oldNo = 1
  let newNo = 1
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      lines.push({ type: 'ctx', text: a[i], oldNo: oldNo++, newNo: newNo++ })
      i++
      j++
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      lines.push({ type: 'del', text: a[i], oldNo: oldNo++ })
      del++
      i++
    } else {
      lines.push({ type: 'add', text: b[j], newNo: newNo++ })
      add++
      j++
    }
  }
  while (i < n) {
    lines.push({ type: 'del', text: a[i++], oldNo: oldNo++ })
    del++
  }
  while (j < m) {
    lines.push({ type: 'add', text: b[j++], newNo: newNo++ })
    add++
  }

  return { lines, add, del }
}

/** Collect the diffs a single Edit / MultiEdit / Write call represents, for the detail view. */
export interface FileDiff {
  path: string
  diff: DiffResult
}

export function callFileDiffs(call: ToolCall): FileDiff[] {
  const input = call.input ?? {}
  const action = toolAction(call.name)
  const path = String(input.file_path ?? input.path ?? '')

  if (action === 'create') {
    return [{ path, diff: computeDiff('', String(input.content ?? '')) }]
  }
  if (action === 'edit') {
    if (Array.isArray(input.edits)) {
      return (input.edits as Array<Record<string, unknown>>).map(e => ({
        path,
        diff: computeDiff(String(e.old_string ?? ''), String(e.new_string ?? '')),
      }))
    }
    return [{ path, diff: computeDiff(String(input.old_string ?? ''), String(input.new_string ?? '')) }]
  }
  return []
}
