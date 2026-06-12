import { NextResponse } from 'next/server'
import { getSessions, listProjectSlugs, resolveProjectPath } from '@/lib/claude-reader'
import { projectDisplayName } from '@/lib/decode'
import { sessionCost } from '@/lib/insights'
import type { ProjectTrend, ProjectTrendPoint, SessionMeta } from '@/types/claude'

export const dynamic = 'force-dynamic'

type RangeDays = 7 | 30 | 90

function parseRange(value: string | null): RangeDays {
  if (value === '7d') return 7
  if (value === '90d') return 90
  return 30
}

function emptyPoint(date: string): ProjectTrendPoint {
  return {
    date,
    sessions: 0,
    messages: 0,
    duration_minutes: 0,
    estimated_cost: 0,
    input_tokens: 0,
    output_tokens: 0,
    tool_calls: 0,
    agent_sessions: 0,
    mcp_sessions: 0,
    web_search_sessions: 0,
    tool_errors: 0,
  }
}

function addSession(point: ProjectTrendPoint, session: SessionMeta) {
  point.sessions += 1
  point.messages += (session.user_message_count ?? 0) + (session.assistant_message_count ?? 0)
  point.duration_minutes += session.duration_minutes ?? 0
  point.input_tokens += session.input_tokens ?? 0
  point.output_tokens += session.output_tokens ?? 0
  point.tool_calls += Object.values(session.tool_counts ?? {}).reduce((sum, count) => sum + count, 0)
  point.tool_errors += session.tool_errors ?? 0
  point.agent_sessions += session.uses_task_agent ? 1 : 0
  point.mcp_sessions += session.uses_mcp ? 1 : 0
  point.web_search_sessions += session.uses_web_search ? 1 : 0
  point.estimated_cost += sessionCost(session)
}

function addPoint(target: ProjectTrendPoint, point: ProjectTrendPoint) {
  target.sessions += point.sessions
  target.messages += point.messages
  target.duration_minutes += point.duration_minutes
  target.estimated_cost += point.estimated_cost
  target.input_tokens += point.input_tokens
  target.output_tokens += point.output_tokens
  target.tool_calls += point.tool_calls
  target.agent_sessions += point.agent_sessions
  target.mcp_sessions += point.mcp_sessions
  target.web_search_sessions += point.web_search_sessions
  target.tool_errors += point.tool_errors
}

function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null
  return ((current - previous) / previous) * 100
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function startOfDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setUTCDate(next.getUTCDate() + days)
  return next
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const rangeDays = parseRange(url.searchParams.get('range'))
  const today = startOfDay(new Date())
  const currentStart = addDays(today, -(rangeDays - 1))
  const previousStart = addDays(currentStart, -rangeDays)

  const [sessions, slugDirs] = await Promise.all([getSessions(), listProjectSlugs()])

  const pathToSlugMap = new Map<string, string>()
  await Promise.all(
    slugDirs.map(async (slug) => {
      const resolved = await resolveProjectPath(slug)
      pathToSlugMap.set(resolved, slug)
    })
  )

  const byProject = new Map<string, Map<string, ProjectTrendPoint>>()

  for (const session of sessions) {
    const startedAt = new Date(session.start_time)
    if (Number.isNaN(startedAt.getTime())) continue
    const day = startOfDay(startedAt)
    if (day < previousStart || day > today) continue

    const projectPath = session.project_path || 'Unknown'
    const date = toIsoDate(day)
    if (!byProject.has(projectPath)) byProject.set(projectPath, new Map())

    const bucketMap = byProject.get(projectPath)!
    const bucket = bucketMap.get(date) ?? emptyPoint(date)
    addSession(bucket, session)
    bucketMap.set(date, bucket)
  }

  const trends: ProjectTrend[] = []

  for (const [projectPath, bucketMap] of byProject.entries()) {
    const current = emptyPoint('current')
    const previous = emptyPoint('previous')
    const series: ProjectTrendPoint[] = []

    for (let i = 0; i < rangeDays; i++) {
      const date = toIsoDate(addDays(currentStart, i))
      const point = bucketMap.get(date) ?? emptyPoint(date)
      series.push(point)
      addPoint(current, point)
    }

    for (let i = 0; i < rangeDays; i++) {
      const date = toIsoDate(addDays(previousStart, i))
      addPoint(previous, bucketMap.get(date) ?? emptyPoint(date))
    }

    // Fallback mirrors Claude Code's own slug convention: every
    // non-alphanumeric character (including \ and : on Windows) becomes a dash.
    const slug = pathToSlugMap.get(projectPath) ?? projectPath.replace(/[^a-zA-Z0-9-]/g, '-')

    trends.push({
      slug,
      project_path: projectPath,
      display_name: projectDisplayName(projectPath),
      current,
      previous,
      delta: {
        sessions_pct: pctChange(current.sessions, previous.sessions),
        estimated_cost_pct: pctChange(current.estimated_cost, previous.estimated_cost),
        duration_pct: pctChange(current.duration_minutes, previous.duration_minutes),
        tool_calls_pct: pctChange(current.tool_calls, previous.tool_calls),
      },
      series,
    })
  }

  return NextResponse.json({
    range_days: rangeDays,
    current_start: toIsoDate(currentStart),
    current_end: toIsoDate(today),
    previous_start: toIsoDate(previousStart),
    previous_end: toIsoDate(addDays(currentStart, -1)),
    trends: trends.sort((a, b) => b.current.sessions - a.current.sessions || b.current.estimated_cost - a.current.estimated_cost),
  })
}
