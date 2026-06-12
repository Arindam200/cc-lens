import fs from 'fs/promises'
import path from 'path'
import os from 'os'
import type {
  TeamExportPayload,
  TeamAnalytics,
  TeamMemberSummary,
  TeamDailyPoint,
  TeamFeatureAdoption,
  SessionMeta,
  ModelUsage,
} from '@/types/claude'
import { estimateTotalCostFromModel, estimateCostFromUsage, cacheEfficiency } from '@/lib/pricing'

/**
 * Zero-infra team mode: every member drops a redacted .cclens-team.json into
 * a shared folder (git repo, Drive, NFS — anything that syncs files), and
 * this reader aggregates whatever is in that folder. No server, no accounts.
 */
export function teamDir(): string {
  return (
    process.env.CC_LENS_TEAM_DIR ??
    path.join(process.env.CC_LENS_CONFIG_DIR ?? path.join(os.homedir(), '.cc-lens'), 'team')
  )
}

function isTeamExport(obj: unknown): obj is TeamExportPayload {
  if (!obj || typeof obj !== 'object') return false
  const o = obj as Record<string, unknown>
  return (
    o.kind === 'cclens-team-export' &&
    typeof (o.member as Record<string, unknown> | undefined)?.name === 'string' &&
    Array.isArray(o.sessions)
  )
}

export async function readTeamExports(dir = teamDir()): Promise<{ exports: TeamExportPayload[]; errors: string[] }> {
  const exports: TeamExportPayload[] = []
  const errors: string[] = []
  let files: string[]
  try {
    files = (await fs.readdir(dir)).filter(f => f.endsWith('.json'))
  } catch {
    return { exports, errors }
  }
  await Promise.all(
    files.map(async f => {
      try {
        const raw = await fs.readFile(path.join(dir, f), 'utf-8')
        const json = JSON.parse(raw)
        if (isTeamExport(json)) exports.push(json)
        else errors.push(`${f}: not a cclens-team-export file`)
      } catch {
        errors.push(`${f}: unreadable or malformed JSON`)
      }
    })
  )
  return { exports, errors }
}

function sessionCost(s: SessionMeta): number {
  if (s.model_usage && Object.keys(s.model_usage).length > 0) {
    return Object.entries(s.model_usage).reduce(
      (sum, [model, usage]) => sum + estimateTotalCostFromModel(model, usage),
      0
    )
  }
  return estimateCostFromUsage('claude-opus-4-8', {
    input_tokens: s.input_tokens,
    output_tokens: s.output_tokens,
    cache_creation_input_tokens: s.cache_creation_input_tokens ?? 0,
    cache_read_input_tokens: s.cache_read_input_tokens ?? 0,
  })
}

function mergeModelUsage(target: Record<string, ModelUsage>, source?: Record<string, ModelUsage>) {
  if (!source) return
  for (const [model, u] of Object.entries(source)) {
    const t = target[model] ?? {
      inputTokens: 0,
      outputTokens: 0,
      cacheReadInputTokens: 0,
      cacheCreationInputTokens: 0,
      costUSD: 0,
      webSearchRequests: 0,
    }
    t.inputTokens += u.inputTokens
    t.outputTokens += u.outputTokens
    t.cacheReadInputTokens += u.cacheReadInputTokens
    t.cacheCreationInputTokens += u.cacheCreationInputTokens
    t.costUSD += u.costUSD ?? 0
    t.webSearchRequests += u.webSearchRequests ?? 0
    target[model] = t
  }
}

/** Identity key for deduping multiple exports from the same person/machine */
function memberKey(e: TeamExportPayload): string {
  return `${e.member.name}::${e.member.machine ?? ''}`
}

/** Server name from an MCP tool key: "mcp__linear__create_issue" → "linear" */
function mcpServerName(toolName: string): string | null {
  if (!toolName.startsWith('mcp__')) return null
  const rest = toolName.slice(5)
  const sep = rest.indexOf('__')
  return sep > 0 ? rest.slice(0, sep) : rest || null
}

export async function getTeamAnalytics(dir = teamDir()): Promise<TeamAnalytics> {
  const { exports, errors } = await readTeamExports(dir)

  // Latest export wins per member+machine; people re-export and old files linger
  const latest = new Map<string, TeamExportPayload>()
  for (const e of exports) {
    const key = memberKey(e)
    const existing = latest.get(key)
    if (!existing || e.exportedAt > existing.exportedAt) latest.set(key, e)
  }

  const members: TeamMemberSummary[] = []
  const dailyMap = new Map<string, TeamDailyPoint>()
  const teamModels: Record<string, ModelUsage> = {}
  const versionMembers = new Map<string, Set<string>>()
  const mcpServers = new Map<string, { total_calls: number; members: Set<string> }>()

  let totalCost = 0
  let totalSessions = 0
  let totalMessages = 0
  let totalCacheSavings = 0

  for (const exp of latest.values()) {
    // Dedupe sessions within one export defensively
    const seen = new Set<string>()
    const sessions = exp.sessions.filter(s => {
      if (seen.has(s.session_id)) return false
      seen.add(s.session_id)
      return true
    })

    const projectAgg = new Map<string, { sessions: number; cost: number }>()
    const memberModels: Record<string, ModelUsage> = {}
    let cost = 0
    let messages = 0
    let duration = 0
    let inputTok = 0
    let outputTok = 0
    let cacheRead = 0
    let cacheWrite = 0
    let toolErrors = 0
    let mcpSessions = 0
    let agentSessions = 0
    let firstActive = ''
    let lastActive = ''
    const adoption: TeamFeatureAdoption = { plan_mode: 0, agents: 0, mcp: 0, web: 0, skills: 0 }

    for (const s of sessions) {
      const c = sessionCost(s)
      cost += c
      messages += s.user_message_count + s.assistant_message_count
      duration += s.duration_minutes
      inputTok += s.input_tokens
      outputTok += s.output_tokens
      cacheRead += s.cache_read_input_tokens ?? 0
      cacheWrite += s.cache_creation_input_tokens ?? 0
      toolErrors += s.tool_errors
      if (s.uses_mcp) mcpSessions++
      if (s.uses_task_agent) agentSessions++

      if (s.uses_mcp) adoption.mcp++
      if (s.uses_task_agent) adoption.agents++
      if (s.uses_web_search || s.uses_web_fetch) adoption.web++
      if ((s.tool_counts['EnterPlanMode'] ?? 0) > 0) adoption.plan_mode++
      if ((s.tool_counts['Skill'] ?? 0) > 0) adoption.skills++
      for (const [tool, calls] of Object.entries(s.tool_counts)) {
        const server = mcpServerName(tool)
        if (!server) continue
        const entry = mcpServers.get(server) ?? { total_calls: 0, members: new Set<string>() }
        entry.total_calls += calls
        entry.members.add(exp.member.name)
        mcpServers.set(server, entry)
      }

      if (s.start_time && (!firstActive || s.start_time < firstActive)) firstActive = s.start_time
      const end = s.last_activity ?? s.start_time
      if (end && (!lastActive || end > lastActive)) lastActive = end

      const proj = s.project_path || 'unknown'
      const p = projectAgg.get(proj) ?? { sessions: 0, cost: 0 }
      p.sessions++
      p.cost += c
      projectAgg.set(proj, p)

      mergeModelUsage(memberModels, s.model_usage)

      const day = s.start_time?.slice(0, 10)
      if (day) {
        const point = dailyMap.get(day) ?? {
          date: day,
          cost_by_member: {},
          sessions_by_member: {},
          total_cost: 0,
          total_sessions: 0,
        }
        point.cost_by_member[exp.member.name] = (point.cost_by_member[exp.member.name] ?? 0) + c
        point.sessions_by_member[exp.member.name] = (point.sessions_by_member[exp.member.name] ?? 0) + 1
        point.total_cost += c
        point.total_sessions += 1
        dailyMap.set(day, point)
      }
    }

    const cacheSavings = Object.entries(memberModels).reduce(
      (sum, [model, usage]) => sum + cacheEfficiency(model, usage).savedUSD,
      0
    )
    const contextTotal = inputTok + cacheRead

    members.push({
      member: exp.member,
      exportedAt: exp.exportedAt,
      redaction: exp.redaction,
      session_count: sessions.length,
      total_messages: messages,
      total_duration_minutes: duration,
      estimated_cost: cost,
      input_tokens: inputTok,
      output_tokens: outputTok,
      cache_read_tokens: cacheRead,
      cache_write_tokens: cacheWrite,
      cache_hit_rate: contextTotal > 0 ? cacheRead / contextTotal : 0,
      tool_errors: toolErrors,
      uses_mcp_sessions: mcpSessions,
      uses_agent_sessions: agentSessions,
      last_active: lastActive,
      first_active: firstActive,
      cc_versions: exp.cc_versions ?? [],
      top_projects: Array.from(projectAgg.entries())
        .map(([name, v]) => ({ name, sessions: v.sessions, cost: v.cost }))
        .sort((a, b) => b.cost - a.cost)
        .slice(0, 5),
      models: memberModels,
      adoption,
      cost_per_session: sessions.length > 0 ? cost / sessions.length : 0,
    })

    totalCost += cost
    totalSessions += sessions.length
    totalMessages += messages
    totalCacheSavings += cacheSavings
    mergeModelUsage(teamModels, memberModels)

    for (const v of exp.cc_versions ?? []) {
      const set = versionMembers.get(v) ?? new Set<string>()
      set.add(exp.member.name)
      versionMembers.set(v, set)
    }
  }

  members.sort((a, b) => b.estimated_cost - a.estimated_cost)

  return {
    source_dir: dir,
    member_count: new Set(members.map(m => m.member.name)).size,
    export_count: latest.size,
    total_cost: totalCost,
    total_sessions: totalSessions,
    total_messages: totalMessages,
    total_cache_savings: totalCacheSavings,
    members,
    daily: Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date)),
    version_skew: Array.from(versionMembers.entries())
      .map(([version, set]) => ({ version, members: Array.from(set).sort() }))
      .sort((a, b) => b.version.localeCompare(a.version)),
    models: teamModels,
    mcp_servers: Array.from(mcpServers.entries())
      .map(([server, v]) => ({ server, total_calls: v.total_calls, members: Array.from(v.members).sort() }))
      .sort((a, b) => b.total_calls - a.total_calls),
    errors,
  }
}
