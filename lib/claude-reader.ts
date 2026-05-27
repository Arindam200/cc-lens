import fs from 'fs/promises'
import path from 'path'
import os from 'os'
import type {
  StatsCache,
  SessionMeta,
  Facet,
  HistoryEntry,
  ModelUsage,
} from '@/types/claude'
import { slugToPath } from '@/lib/decode'

function stripXmlTags(text: string): string {
  return text.replace(/<[^>]+>[\s\S]*?<\/[^>]+>/g, '').replace(/<[^>]+\/>/g, '').replace(/<[^>]+>/g, '').trim()
}

// Reading every JSONL on every request is the dominant cost at scale (thousands
// of files × hundreds of KB each). Cache parsed sessions by file path, keyed on
// mtime — completed sessions never change, so warm requests only re-parse files
// that were touched since the last scan.

export interface ParsedSession extends SessionMeta {
  cwd?: string
  slug_name?: string
  cc_version?: string
  git_branch?: string
  has_compaction: boolean
  has_thinking: boolean
}

interface CacheEntry {
  mtimeMs: number
  promise: Promise<ParsedSession | null>
}

const sessionCache = new Map<string, CacheEntry>()
const projectCwdCache = new Map<string, string>()

/** Resolve the real filesystem path for a project slug by reading `cwd` from its JSONL files */
export async function resolveProjectPath(slug: string): Promise<string> {
  const cached = projectCwdCache.get(slug)
  if (cached) return cached
  const files = await listProjectJSONLFiles(slug)
  for (const f of files) {
    try {
      const raw = await fs.readFile(f, 'utf-8')
      const lines = raw.split(/\r?\n/)
      for (const line of lines.slice(0, 50)) {
        if (!line.trim()) continue
        try {
          const obj = JSON.parse(line)
          if (obj.cwd && typeof obj.cwd === 'string') {
            projectCwdCache.set(slug, obj.cwd)
            return obj.cwd
          }
        } catch { /* skip malformed line */ }
      }
    } catch { /* try next file */ }
  }
  // No cwd recovered — drop any stale cache entry before falling back
  projectCwdCache.delete(slug)
  return slugToPath(slug)
}

const CLAUDE_DIR = process.env.CLAUDE_CONFIG_DIR ?? path.join(os.homedir(), '.claude')

export function claudePath(...segments: string[]): string {
  return path.join(CLAUDE_DIR, ...segments)
}

// ─── Stats Cache ─────────────────────────────────────────────────────────────

export async function readStatsCache(): Promise<StatsCache | null> {
  try {
    const raw = await fs.readFile(claudePath('stats-cache.json'), 'utf-8')
    return JSON.parse(raw) as StatsCache
  } catch {
    return null
  }
}

// ─── Sessions from Project JSONL (primary source) ──────────────────────────────

async function parseSessionFile(filePath: string, sessionId: string): Promise<ParsedSession | null> {
  let startTime = ''
  let lastTime = ''
  let userCount = 0
  let assistantCount = 0
  const toolCounts: Record<string, number> = {}
  let inputTokens = 0
  let outputTokens = 0
  let cacheRead = 0
  let cacheWrite = 0
  let firstPrompt = ''
  let hasTaskAgent = false
  let hasMcp = false
  let hasWebSearch = false
  let hasWebFetch = false
  const messageHours: number[] = []
  const userMessageTimestamps: string[] = []
  let cwd: string | undefined
  let slugName: string | undefined
  let ccVersion: string | undefined
  let gitBranch: string | undefined
  let hasCompaction = false
  let hasThinking = false
  const modelUsage: Record<string, ModelUsage> = {}

  try {
    const raw = await fs.readFile(filePath, 'utf-8')
    const lines = raw.split(/\r?\n/)
    for (const line of lines) {
      if (!line) continue
      try {
        const obj = JSON.parse(line) as Record<string, unknown>
        const ts = obj.timestamp as string
        if (ts) {
          if (!startTime) startTime = ts
          lastTime = ts
        }
        if (!cwd && typeof obj.cwd === 'string') cwd = obj.cwd
        if (!slugName && typeof obj.slug === 'string') slugName = obj.slug
        if (!ccVersion && typeof obj.version === 'string') ccVersion = obj.version
        if (typeof obj.gitBranch === 'string' && obj.gitBranch !== 'HEAD' && !gitBranch) {
          gitBranch = obj.gitBranch
        }
        if (obj.type === 'system' && (obj as { subtype?: string }).subtype === 'compact_boundary') {
          hasCompaction = true
        }
        if (obj.type === 'user') {
          userCount++
          if (ts) {
            const d = new Date(ts)
            if (!isNaN(d.getTime())) {
              messageHours.push(d.getHours())
              userMessageTimestamps.push(ts)
            }
          }
          const content = (obj as { message?: { content?: string | unknown[] } }).message?.content
          if (typeof content === 'string' && !firstPrompt) firstPrompt = stripXmlTags(content).slice(0, 500)
          else if (Array.isArray(content)) {
            const text = content.find((c: unknown) => typeof c === 'object' && c !== null && (c as { type?: string }).type === 'text')
            if (text && typeof (text as { text?: string }).text === 'string' && !firstPrompt) {
              firstPrompt = stripXmlTags((text as { text: string }).text).slice(0, 500)
            }
          }
        }
        if (obj.type === 'assistant') {
          assistantCount++
          const msg = (obj as { message?: { model?: string; usage?: Record<string, number>; content?: unknown[] } }).message
          if (msg?.usage) {
            const turnInput = msg.usage.input_tokens ?? 0
            const turnOutput = msg.usage.output_tokens ?? 0
            const turnCacheRead = msg.usage.cache_read_input_tokens ?? 0
            const turnCacheWrite = msg.usage.cache_creation_input_tokens ?? 0
            inputTokens += turnInput
            outputTokens += turnOutput
            cacheRead += turnCacheRead
            cacheWrite += turnCacheWrite

            if (msg.model) {
              const existing = modelUsage[msg.model] ?? {
                inputTokens: 0,
                outputTokens: 0,
                cacheReadInputTokens: 0,
                cacheCreationInputTokens: 0,
                costUSD: 0,
                webSearchRequests: 0,
              }
              existing.inputTokens += turnInput
              existing.outputTokens += turnOutput
              existing.cacheReadInputTokens += turnCacheRead
              existing.cacheCreationInputTokens += turnCacheWrite
              modelUsage[msg.model] = existing
            }
          }
          const content = msg?.content
          if (Array.isArray(content)) {
            for (const c of content) {
              const item = c as { type?: string; name?: string }
              if (item.type === 'thinking') hasThinking = true
              if (item.type === 'tool_use' && item.name) {
                toolCounts[item.name] = (toolCounts[item.name] ?? 0) + 1
                if (item.name.startsWith('Task') || item.name === 'TodoWrite' || item.name === 'Agent') hasTaskAgent = true
                if (item.name.startsWith('mcp__')) hasMcp = true
                if (item.name === 'WebSearch') hasWebSearch = true
                if (item.name === 'WebFetch') hasWebFetch = true
              }
            }
          }
        }
      } catch { /* skip malformed line */ }
    }
  } catch {
    return null
  }

  if (!startTime) return null

  const start = new Date(startTime).getTime()
  const end = lastTime ? new Date(lastTime).getTime() : start
  const durationMinutes = (end - start) / 60_000

  return {
    session_id: sessionId,
    project_path: cwd ?? '',
    start_time: startTime,
    last_activity: lastTime || startTime,
    duration_minutes: durationMinutes,
    user_message_count: userCount,
    assistant_message_count: assistantCount,
    tool_counts: toolCounts,
    languages: {},
    git_commits: 0,
    git_pushes: 0,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    cache_creation_input_tokens: cacheWrite,
    cache_read_input_tokens: cacheRead,
    first_prompt: firstPrompt,
    user_interruptions: 0,
    user_response_times: [],
    tool_errors: 0,
    tool_error_categories: {},
    uses_task_agent: hasTaskAgent,
    uses_mcp: hasMcp,
    uses_web_search: hasWebSearch,
    uses_web_fetch: hasWebFetch,
    lines_added: 0,
    lines_removed: 0,
    files_modified: 0,
    message_hours: messageHours,
    user_message_timestamps: userMessageTimestamps,
    model_usage: modelUsage,
    cwd,
    slug_name: slugName,
    cc_version: ccVersion,
    git_branch: gitBranch,
    has_compaction: hasCompaction,
    has_thinking: hasThinking,
  }
}

/**
 * Read all sessions from ~/.claude/projects/<slug>/<session>.jsonl, with an
 * mtime-keyed cache. Completed JSONLs never change, so warm calls only re-parse
 * the file(s) actively being written. The returned objects include enrichment
 * fields (slug_name, cc_version, git_branch, has_compaction, has_thinking) so
 * callers don't need a separate second pass.
 */
export async function getAllParsedSessions(): Promise<ParsedSession[]> {
  let slugs: string[]
  try {
    slugs = await listProjectSlugs()
  } catch {
    return []
  }

  type FileEntry = { slug: string; filePath: string; sessionId: string; mtimeMs: number }
  const fileEntries: FileEntry[] = []

  await Promise.all(slugs.map(async (slug) => {
    const files = await listProjectJSONLFiles(slug)
    await Promise.all(files.map(async (filePath) => {
      try {
        const stat = await fs.stat(filePath)
        fileEntries.push({
          slug,
          filePath,
          sessionId: path.basename(filePath, '.jsonl'),
          mtimeMs: stat.mtimeMs,
        })
      } catch { /* file vanished between readdir and stat */ }
    }))
  }))

  // Evict cache entries for files that no longer exist
  const seen = new Set(fileEntries.map(f => f.filePath))
  for (const key of sessionCache.keys()) {
    if (!seen.has(key)) sessionCache.delete(key)
  }

  // Parse (or reuse cached) in parallel; cache stores the in-flight promise so
  // concurrent requests for the same file dedupe to one parse.
  const parsed = await Promise.all(fileEntries.map(async (f) => {
    const cached = sessionCache.get(f.filePath)
    if (cached && cached.mtimeMs === f.mtimeMs) {
      return { slug: f.slug, session: await cached.promise }
    }
    const promise = parseSessionFile(f.filePath, f.sessionId)
    sessionCache.set(f.filePath, { mtimeMs: f.mtimeMs, promise })
    return { slug: f.slug, session: await promise }
  }))

  // Build slug → cwd map from any session that captured one
  const slugCwd = new Map<string, string>()
  for (const { slug, session } of parsed) {
    if (session?.cwd && !slugCwd.has(slug)) slugCwd.set(slug, session.cwd)
  }
  // Keep the cross-call cache warm for resolveProjectPath callers, and evict
  // entries for slugs that vanished or whose scan yielded no cwd this pass.
  const knownSlugs = new Set(slugs)
  for (const slug of projectCwdCache.keys()) {
    if (!knownSlugs.has(slug) || !slugCwd.has(slug)) projectCwdCache.delete(slug)
  }
  for (const [slug, cwd] of slugCwd) projectCwdCache.set(slug, cwd)

  const results: ParsedSession[] = []
  for (const { slug, session } of parsed) {
    if (!session) continue
    results.push({
      ...session,
      project_path: slugCwd.get(slug) ?? slugToPath(slug),
    })
  }

  results.sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime())
  return results
}

/** Derive session metadata directly from ~/.claude/projects/<project>/<session>.jsonl */
export async function readSessionsFromProjectJSONL(): Promise<SessionMeta[]> {
  return getAllParsedSessions()
}

/** Get sessions: prefers JSONL (projects/*.jsonl), falls back to usage-data/session-meta */
export async function getSessions(): Promise<SessionMeta[]> {
  const jsonl = await getAllParsedSessions()
  if (jsonl.length > 0) return jsonl
  return readAllSessionMeta()
}

// ─── Session Meta (usage-data/session-meta — fallback) ────────────────────────

export async function readAllSessionMeta(): Promise<SessionMeta[]> {
  const dir = claudePath('usage-data', 'session-meta')
  try {
    const files = await fs.readdir(dir)
    const results: SessionMeta[] = []
    await Promise.all(
      files
        .filter(f => f.endsWith('.json'))
        .map(async f => {
          try {
            const raw = await fs.readFile(path.join(dir, f), 'utf-8')
            const parsed = JSON.parse(raw) as SessionMeta
            results.push(parsed)
          } catch { /* skip malformed */ }
        })
    )
    return results.sort(
      (a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime()
    )
  } catch {
    return []
  }
}

export async function readSessionMeta(sessionId: string): Promise<SessionMeta | null> {
  try {
    const raw = await fs.readFile(
      claudePath('usage-data', 'session-meta', `${sessionId}.json`),
      'utf-8'
    )
    return JSON.parse(raw) as SessionMeta
  } catch {
    return null
  }
}

// ─── Facets ──────────────────────────────────────────────────────────────────

export async function readAllFacets(): Promise<Facet[]> {
  const dir = claudePath('usage-data', 'facets')
  try {
    const files = await fs.readdir(dir)
    const results: Facet[] = []
    await Promise.all(
      files
        .filter(f => f.endsWith('.json'))
        .map(async f => {
          try {
            const raw = await fs.readFile(path.join(dir, f), 'utf-8')
            results.push(JSON.parse(raw) as Facet)
          } catch { /* skip */ }
        })
    )
    return results
  } catch {
    return []
  }
}

export async function readFacet(sessionId: string): Promise<Facet | null> {
  try {
    const raw = await fs.readFile(
      claudePath('usage-data', 'facets', `${sessionId}.json`),
      'utf-8'
    )
    return JSON.parse(raw) as Facet
  } catch {
    return null
  }
}

// ─── Projects ─────────────────────────────────────────────────────────────────

export async function listProjectSlugs(): Promise<string[]> {
  try {
    const entries = await fs.readdir(claudePath('projects'), { withFileTypes: true })
    return entries
      .filter(e => e.isDirectory())
      .map(e => e.name)
  } catch {
    return []
  }
}

export async function listProjectJSONLFiles(slug: string): Promise<string[]> {
  try {
    const dir = claudePath('projects', slug)
    const files = await fs.readdir(dir)
    return files
      .filter(f => f.endsWith('.jsonl'))
      .map(f => path.join(dir, f))
  } catch {
    return []
  }
}

/** Stream a JSONL file line by line, calling cb for each parsed line */
export async function readJSONLLines(
  filePath: string,
  cb: (line: Record<string, unknown>) => void
): Promise<void> {
  try {
    const raw = await fs.readFile(filePath, 'utf-8')
    for (const line of raw.split(/\r?\n/)) {
      if (!line.trim()) continue
      try {
        cb(JSON.parse(line))
      } catch { /* skip malformed */ }
    }
  } catch { /* file missing */ }
}

/** Find which project slug contains a given session ID */
export async function findSessionSlug(sessionId: string): Promise<string | null> {
  const slugs = await listProjectSlugs()
  for (const slug of slugs) {
    const files = await listProjectJSONLFiles(slug)
    for (const f of files) {
      if (path.basename(f).startsWith(sessionId)) return slug
    }
  }
  return null
}

/** Find the JSONL file path for a given session ID */
export async function findSessionJSONL(sessionId: string): Promise<string | null> {
  const slugs = await listProjectSlugs()
  for (const slug of slugs) {
    const files = await listProjectJSONLFiles(slug)
    for (const f of files) {
      if (path.basename(f, '.jsonl') === sessionId) return f
    }
  }
  return null
}

// ─── Plans ───────────────────────────────────────────────────────────────────

export interface PlanFile {
  path: string
  name: string
  content: string
  mtime: string
}

export async function readPlans(): Promise<PlanFile[]> {
  const results: PlanFile[] = []
  try {
    const dir = claudePath('plans')
    const files = await fs.readdir(dir)
    for (const f of files.filter((x) => x.endsWith('.md'))) {
      try {
        const fullPath = path.join(dir, f)
        const [raw, stat] = await Promise.all([
          fs.readFile(fullPath, 'utf-8'),
          fs.stat(fullPath),
        ])
        results.push({
          path: fullPath,
          name: f.replace(/\.md$/, ''),
          content: raw,
          mtime: stat.mtime.toISOString(),
        })
      } catch { /* skip */ }
    }
    return results.sort((a, b) => b.mtime.localeCompare(a.mtime))
  } catch {
    return []
  }
}

// ─── Todos ───────────────────────────────────────────────────────────────────

export interface TodoFile {
  path: string
  name: string
  data: unknown
  mtime: string
}

export async function readTodos(): Promise<TodoFile[]> {
  const results: TodoFile[] = []
  try {
    const dir = claudePath('todos')
    const files = await fs.readdir(dir)
    for (const f of files.filter((x) => x.endsWith('.json'))) {
      try {
        const fullPath = path.join(dir, f)
        const [raw, stat] = await Promise.all([
          fs.readFile(fullPath, 'utf-8'),
          fs.stat(fullPath),
        ])
        results.push({
          path: fullPath,
          name: f.replace(/\.json$/, ''),
          data: JSON.parse(raw),
          mtime: stat.mtime.toISOString(),
        })
      } catch { /* skip */ }
    }
    return results.sort((a, b) => b.mtime.localeCompare(a.mtime))
  } catch {
    return []
  }
}

// ─── History ─────────────────────────────────────────────────────────────────

export async function readHistory(limit = 200): Promise<HistoryEntry[]> {
  const entries: HistoryEntry[] = []
  try {
    const raw = await fs.readFile(claudePath('history.jsonl'), 'utf-8')
    const lines = raw.split(/\r?\n/).filter(Boolean)
    for (const line of lines.slice(-limit)) {
      try {
        entries.push(JSON.parse(line) as HistoryEntry)
      } catch { /* skip */ }
    }
  } catch { /* file missing */ }
  return entries
}

// ─── Skills ───────────────────────────────────────────────────────────────────

export interface SkillInfo {
  name: string
  description: string
  triggers: string
  hasSkillMd: boolean
}

export async function readSkills(): Promise<SkillInfo[]> {
  const skillsDir = claudePath('skills')
  try {
    const entries = await fs.readdir(skillsDir, { withFileTypes: true })
    const dirs = entries.filter(e => e.isDirectory() && !e.name.startsWith('.') && e.name !== 'nebius-skills-workspace')
    const results: SkillInfo[] = []
    for (const dir of dirs) {
      const skillMdPath = path.join(skillsDir, dir.name, 'SKILL.md')
      let description = ''
      let triggers = ''
      let hasSkillMd = false
      try {
        const raw = await fs.readFile(skillMdPath, 'utf-8')
        hasSkillMd = true
        const descMatch = raw.match(/^#\s+(.+)$/m)
        if (descMatch) description = descMatch[1].trim()
        const triggerMatch = raw.match(/(?:TRIGGER|trigger)[^\n]*\n([\s\S]*?)(?:\n#{1,3}\s|\n---|\n\*\*DO NOT|$)/m)
        if (triggerMatch) triggers = triggerMatch[1].replace(/\s+/g, ' ').trim().slice(0, 200)
      } catch { /* no SKILL.md */ }
      results.push({ name: dir.name, description, triggers, hasSkillMd })
    }
    return results.sort((a, b) => a.name.localeCompare(b.name))
  } catch {
    return []
  }
}

// ─── Plugins ──────────────────────────────────────────────────────────────────

export interface PluginInfo {
  id: string
  scope: string
  version: string
  installedAt: string
}

export async function readInstalledPlugins(): Promise<PluginInfo[]> {
  try {
    const raw = await fs.readFile(claudePath('plugins', 'installed_plugins.json'), 'utf-8')
    const json = JSON.parse(raw) as { plugins: Record<string, Array<{ scope: string; version: string; installedAt: string }>> }
    return Object.entries(json.plugins).flatMap(([id, installs]) =>
      installs.map(inst => ({ id, scope: inst.scope, version: inst.version, installedAt: inst.installedAt }))
    )
  } catch {
    return []
  }
}

// ─── Settings ─────────────────────────────────────────────────────────────────

export async function readSettings(): Promise<Record<string, unknown>> {
  try {
    const raw = await fs.readFile(claudePath('settings.json'), 'utf-8')
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

// ─── Memory ───────────────────────────────────────────────────────────────────

export type MemoryType = 'user' | 'feedback' | 'project' | 'reference' | 'index' | 'unknown'

export interface MemoryEntry {
  file: string
  projectSlug: string
  projectPath: string
  name: string
  type: MemoryType
  description: string
  body: string
  mtime: string
  isIndex: boolean
}

function parseFrontmatter(raw: string): { meta: Record<string, string>; body: string } {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/)
  if (!match) return { meta: {}, body: raw }
  const meta: Record<string, string> = {}
  for (const line of match[1].split('\n')) {
    const colon = line.indexOf(':')
    if (colon === -1) continue
    const key = line.slice(0, colon).trim()
    const val = line.slice(colon + 1).trim()
    if (key) meta[key] = val
  }
  return { meta, body: match[2].trim() }
}

export async function readMemories(): Promise<MemoryEntry[]> {
  const results: MemoryEntry[] = []
  try {
    const slugs = await listProjectSlugs()
    await Promise.all(
      slugs.map(async slug => {
        const memDir = claudePath('projects', slug, 'memory')
        try {
          const files = await fs.readdir(memDir)
          const mdFiles = files.filter(f => f.endsWith('.md'))
          await Promise.all(
            mdFiles.map(async file => {
              try {
                const fullPath = path.join(memDir, file)
                const [raw, stat] = await Promise.all([
                  fs.readFile(fullPath, 'utf-8'),
                  fs.stat(fullPath),
                ])
                const isIndex = file === 'MEMORY.md'
                const { meta, body } = parseFrontmatter(raw)
                const projectPath = slugToPath(slug)
                const h1Match = body.match(/^#\s+(.+)$/m)
                const titleFromBody = h1Match ? h1Match[1].trim() : null
                results.push({
                  file,
                  projectSlug: slug,
                  projectPath,
                  name: meta.name ?? titleFromBody ?? (isIndex ? 'Memory Index' : file.replace(/\.md$/, '')),
                  type: (meta.type as MemoryType) ?? (isIndex ? 'index' : 'unknown'),
                  description: meta.description ?? '',
                  body,
                  mtime: stat.mtime.toISOString(),
                  isIndex,
                })
              } catch { /* skip */ }
            })
          )
        } catch { /* no memory dir */ }
      })
    )
  } catch { /* skip */ }
  return results.sort((a, b) => b.mtime.localeCompare(a.mtime))
}

// ─── Storage size ─────────────────────────────────────────────────────────────

export async function getClaudeStorageBytes(): Promise<number> {
  async function dirSize(dirPath: string): Promise<number> {
    let total = 0
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true })
      await Promise.all(
        entries.map(async e => {
          const full = path.join(dirPath, e.name)
          if (e.isDirectory()) {
            total += await dirSize(full)
          } else {
            try {
              const stat = await fs.stat(full)
              total += stat.size
            } catch { /* skip */ }
          }
        })
      )
    } catch { /* skip inaccessible dirs */ }
    return total
  }
  return dirSize(CLAUDE_DIR)
}
