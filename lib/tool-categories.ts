export type ToolCategory =
  | 'file-io'
  | 'shell'
  | 'agent'
  | 'web'
  | 'planning'
  | 'todo'
  | 'skill'
  | 'mcp'
  | 'other'

export const TOOL_CATEGORIES: Record<string, ToolCategory> = {
  Read:           'file-io',
  Write:          'file-io',
  Edit:           'file-io',
  Glob:           'file-io',
  Grep:           'file-io',
  NotebookEdit:   'file-io',

  Bash:           'shell',

  Task:           'agent',
  TaskCreate:     'agent',
  TaskUpdate:     'agent',
  TaskList:       'agent',
  TaskOutput:     'agent',
  TaskStop:       'agent',
  TaskGet:        'agent',

  WebSearch:      'web',
  WebFetch:       'web',

  EnterPlanMode:  'planning',
  ExitPlanMode:   'planning',
  AskUserQuestion:'planning',

  TodoWrite:      'todo',

  Skill:          'skill',
  ToolSearch:     'skill',
  ListMcpResourcesTool: 'skill',
  ReadMcpResourceTool:  'skill',
}

/** Theme tokens from app/globals.css — work in light & dark */
export const CATEGORY_COLORS: Record<ToolCategory, string> = {
  'file-io':  'var(--viz-tool-file-io)',
  'shell':    'var(--viz-tool-shell)',
  'agent':    'var(--viz-tool-agent)',
  'web':      'var(--viz-tool-web)',
  'planning': 'var(--viz-tool-planning)',
  'todo':     'var(--viz-tool-todo)',
  'skill':    'var(--viz-tool-skill)',
  'mcp':      'var(--viz-tool-mcp)',
  'other':    'var(--viz-tool-other)',
}

/** Per-tool bar colors so Read / Write / Edit / … stay distinct on project cards */
const TOOL_BAR_OVERRIDES: Record<string, string> = {
  Read:         'var(--viz-tool-read)',
  Write:        'var(--viz-tool-write)',
  Edit:         'var(--viz-tool-edit)',
  Grep:         'var(--viz-tool-grep)',
  Glob:         'var(--viz-tool-glob)',
  NotebookEdit: 'var(--viz-tool-edit)',
}

export function categorizeTool(name: string): ToolCategory {
  if (name.startsWith('mcp__')) return 'mcp'
  return TOOL_CATEGORIES[name] ?? 'other'
}

export function toolBarColor(toolName: string): string {
  return TOOL_BAR_OVERRIDES[toolName] ?? CATEGORY_COLORS[categorizeTool(toolName)]
}

/** Rotating palette of theme tokens for distinguishing items that share a category (e.g. skills). */
const SKILL_PALETTE = [
  'var(--viz-tool-skill)',
  'var(--viz-tool-read)',
  'var(--viz-tool-edit)',
  'var(--viz-tool-grep)',
  'var(--viz-tool-agent)',
  'var(--viz-tool-web)',
  'var(--viz-tool-planning)',
  'var(--viz-tool-todo)',
  'var(--viz-tool-mcp)',
  'var(--viz-tool-glob)',
  'var(--viz-tool-write)',
  'var(--viz-tool-shell)',
]

export function skillColor(name: string): string {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  return SKILL_PALETTE[h % SKILL_PALETTE.length]
}

/**
 * Alpha that works for both hex and `var(--…)` (unlike string concatenation).
 * @param opacityPercent 0–100 portion of the base color
 */
export function categoryColorMix(base: string, opacityPercent: number): string {
  return `color-mix(in srgb, ${base} ${opacityPercent}%, transparent)`
}

export const CATEGORY_LABELS: Record<ToolCategory, string> = {
  'file-io':  'File I/O',
  'shell':    'Shell',
  'agent':    'Agents',
  'web':      'Web',
  'planning': 'Planning',
  'todo':     'Todo',
  'skill':    'Skills',
  'mcp':      'MCP',
  'other':    'Other',
}

export function isMcpTool(name: string): boolean {
  return name.startsWith('mcp__')
}

export function parseMcpTool(name: string): { server: string; tool: string } | null {
  if (!name.startsWith('mcp__')) return null
  const parts = name.split('__')
  if (parts.length < 3) return null
  return {
    server: parts[1],
    tool:   parts.slice(2).join('__'),
  }
}

export function toolDisplayName(name: string): string {
  const mcp = parseMcpTool(name)
  if (mcp) return `${mcp.server} · ${mcp.tool}`
  return name
}

export const TOOL_ICONS: Record<ToolCategory, string> = {
  'file-io':  '📄',
  'shell':    '⚡',
  'agent':    '🤖',
  'web':      '🌐',
  'planning': '📋',
  'todo':     '✅',
  'skill':    '🎯',
  'mcp':      '🔌',
  'other':    '🔧',
}
