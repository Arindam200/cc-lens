import fs from 'fs/promises'
import { createReadStream } from 'fs'
import { createInterface } from 'readline'
import path from 'path'
import os from 'os'
import type {
  StatsCache,
  SessionMeta,
  HistoryEntry,
  ModelUsage,
  LiveSession,
} from '@/types/claude'
import { slugToPath } from '@/lib/decode'

function stripXmlTags(text: string): string {
  return text
    // Paired tags only when open/close names match, so mismatched angle
    // brackets in prose or code don't swallow unrelated text between them
    .replace(/<([a-zA-Z][\w-]*)\b[^>]*>[\s\S]*?<\/\1>/g, '')
    .replace(/<\/?[a-zA-Z][\w-]*\b[^>]*\/?>/g, '')
    .trim()
}

/** Map with a concurrency cap — keeps cold scans of large ~/.claude dirs from
 * holding hundreds of file streams and parse buffers in flight at once. */
async function mapPool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let next = 0
  async function worker() {
    while (next < items.length) {
      const i = next++
      results[i] = await fn(items[i])
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return results
}

// Reading every JSONL on every request is the dominant cost at scale (thousands
// of files × hundreds of KB each). Cache parsed sessions by file path, keyed on
// mtime — completed sessions never change, so warm requests only re-parse files
// that were touched since the last scan.

export interface ParsedSession extends SessionMeta {
  cwd?: string
  slug_name?: string
  ai_title?: string
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
  let aiTitle: string | undefined
  let ccVersion: string | undefined
  let gitBranch: string | undefined
  let hasCompaction = false
  let hasThinking = false
  const modelUsage: Record<string, ModelUsage> = {}

  try {
    // Stream line-by-line rather than buffering the whole file — session
    // JSONLs can be tens of MB each
    const rl = createInterface({
      input: createReadStream(filePath, { encoding: 'utf-8' }),
      crlfDelay: Infinity,
    })
    for await (const line of rl) {
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
        // ai-title lines repeat as the title is refined; the last one wins
        if (obj.type === 'ai-title' && typeof obj.aiTitle === 'string') aiTitle = obj.aiTitle
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
    ai_title: aiTitle,
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

  // Parse (or reuse cached) with bounded concurrency; cache stores the
  // in-flight promise so concurrent requests for the same file dedupe to one
  // parse.
  const parsed = await mapPool(fileEntries, 16, async (f) => {
    const cached = sessionCache.get(f.filePath)
    if (cached && cached.mtimeMs === f.mtimeMs) {
      return { slug: f.slug, session: await cached.promise }
    }
    // Failed parses are evicted so a transient read error doesn't hide the
    // session until the file's mtime happens to change again.
    const promise = parseSessionFile(f.filePath, f.sessionId).then(session => {
      if (!session) sessionCache.delete(f.filePath)
      return session
    }, err => {
      sessionCache.delete(f.filePath)
      throw err
    })
    sessionCache.set(f.filePath, { mtimeMs: f.mtimeMs, promise })
    return { slug: f.slug, session: await promise }
  })

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

/** Get all sessions derived from projects/*.jsonl */
export async function getSessions(): Promise<SessionMeta[]> {
  return getAllParsedSessions()
}

// ─── Live Sessions (~/.claude/sessions/*.json) ───────────────────────────────

function isPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

/**
 * Read currently running Claude Code processes from ~/.claude/sessions/*.json.
 * Files can linger after a process exits, so each entry is verified against a
 * live pid before being returned.
 */
export async function readLiveSessions(): Promise<LiveSession[]> {
  const dir = claudePath('sessions')
  try {
    const files = await fs.readdir(dir)
    const results: LiveSession[] = []
    await Promise.all(
      files
        .filter(f => f.endsWith('.json'))
        .map(async f => {
          try {
            const raw = await fs.readFile(path.join(dir, f), 'utf-8')
            const parsed = JSON.parse(raw) as LiveSession
            if (parsed.pid && parsed.sessionId && isPidAlive(parsed.pid)) {
              results.push(parsed)
            }
          } catch { /* skip malformed */ }
        })
    )
    return results.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))
  } catch {
    return []
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
    const rl = createInterface({
      input: createReadStream(filePath, { encoding: 'utf-8' }),
      crlfDelay: Infinity,
    })
    for await (const line of rl) {
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

// ─── Tasks ───────────────────────────────────────────────────────────────────

export interface TaskItem {
  id?: string
  content: string
  description?: string
  status?: string
  activeForm?: string
}

export interface TaskSession {
  sessionId: string
  path: string
  tasks: TaskItem[]
  mtime: string
}

interface RawTaskFile {
  id?: string
  subject?: string
  description?: string
  activeForm?: string
  status?: string
  [key: string]: unknown
}

/** Current task storage written by the TaskCreate / TaskUpdate tools that
 *  replaced TodoWrite: ~/.claude/tasks/<session-id>/<taskId>.json, one file
 *  per task with {id, subject, description, status, ...}. Each session
 *  directory is surfaced as one TaskSession; mtime is the latest task mtime
 *  in the session so recency sorting stays meaningful. */
export async function readTaskSessions(): Promise<TaskSession[]> {
  const results: TaskSession[] = []
  try {
    const dir = claudePath('tasks')
    const sessions = await fs.readdir(dir, { withFileTypes: true })
    await mapPool(sessions.filter((d) => d.isDirectory()), 8, async (session) => {
      try {
        const sessionDir = path.join(dir, session.name)
        const files = (await fs.readdir(sessionDir)).filter((x) => x.endsWith('.json'))
        if (!files.length) return

        const tasks: TaskItem[] = []
        let latestMtime = new Date(0)

        for (const f of files) {
          try {
            const fullPath = path.join(sessionDir, f)
            const [raw, stat] = await Promise.all([
              fs.readFile(fullPath, 'utf-8'),
              fs.stat(fullPath),
            ])
            const task = JSON.parse(raw) as RawTaskFile
            if (!task || task.status === 'deleted') continue
            tasks.push({
              id: task.id,
              content: task.subject ?? task.description ?? f,
              description: task.description,
              status: task.status,
              activeForm: task.activeForm,
            })
            if (stat.mtime > latestMtime) latestMtime = stat.mtime
          } catch { /* skip unreadable task */ }
        }
        if (!tasks.length) return

        tasks.sort((a, b) => {
          const an = parseInt(a.id ?? '', 10) || 0
          const bn = parseInt(b.id ?? '', 10) || 0
          if (an !== bn) return an - bn
          return (a.id ?? a.content).localeCompare(b.id ?? b.content)
        })
        results.push({
          sessionId: session.name,
          path: sessionDir,
          tasks,
          mtime: latestMtime.toISOString(),
        })
      } catch { /* skip unreadable session dir */ }
    })
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
  name: string
  marketplace: string
  scope: string
  version: string
  installedAt: string
  lastUpdated?: string
}

export async function readInstalledPlugins(): Promise<PluginInfo[]> {
  try {
    const raw = await fs.readFile(claudePath('plugins', 'installed_plugins.json'), 'utf-8')
    const json = JSON.parse(raw) as { plugins: Record<string, Array<{ scope: string; version: string; installedAt: string; lastUpdated?: string }>> }
    return Object.entries(json.plugins).flatMap(([id, installs]) => {
      const at = id.lastIndexOf('@')
      const name = at > 0 ? id.slice(0, at) : id
      const marketplace = at > 0 ? id.slice(at + 1) : ''
      return installs.map(inst => ({
        id,
        name,
        marketplace,
        scope: inst.scope,
        version: inst.version,
        installedAt: inst.installedAt,
        lastUpdated: inst.lastUpdated,
      }))
    })
  } catch {
    return []
  }
}

// ─── Config markdown dirs (agents, commands, rules, output-styles) ───────────

export interface ConfigFileInfo {
  name: string
  description: string
  mtime: string
}

/**
 * List the markdown entries of a ~/.claude config directory. Both single-file
 * entries (commands/foo.md) and directory entries with an entrypoint
 * (skills/foo/SKILL.md) are supported. The description comes from frontmatter
 * `description:` when present, otherwise the first heading or text line.
 */
export async function readConfigDir(dirName: string, entrypoint?: string): Promise<ConfigFileInfo[]> {
  const dir = claudePath(dirName)
  const results: ConfigFileInfo[] = []
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true })
    await Promise.all(entries.map(async e => {
      if (e.name.startsWith('.')) return
      let filePath: string
      let name: string
      if (e.isDirectory()) {
        if (!entrypoint) return
        filePath = path.join(dir, e.name, entrypoint)
        name = e.name
      } else if (e.name.endsWith('.md')) {
        filePath = path.join(dir, e.name)
        name = e.name.replace(/\.md$/, '')
      } else {
        return
      }
      try {
        const [raw, stat] = await Promise.all([fs.readFile(filePath, 'utf-8'), fs.stat(filePath)])
        const fmMatch = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/)
        let description = ''
        if (fmMatch) {
          const descMatch = fmMatch[1].match(/^description:\s*(.+)$/m)
          if (descMatch) description = descMatch[1].trim().replace(/^["']|["']$/g, '')
        }
        if (!description) {
          const body = fmMatch ? raw.slice(fmMatch[0].length) : raw
          const line = body.split(/\r?\n/).find(l => l.trim())
          description = line ? line.replace(/^#+\s*/, '').trim() : ''
        }
        results.push({ name, description: description.slice(0, 300), mtime: stat.mtime.toISOString() })
      } catch { /* no entrypoint file */ }
    }))
    return results.sort((a, b) => a.name.localeCompare(b.name))
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
