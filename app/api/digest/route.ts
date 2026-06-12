import { NextResponse } from 'next/server'
import { getAllParsedSessions } from '@/lib/claude-reader'
import { getTeamAnalytics } from '@/lib/team-reader'
import { buildInsightsReport, sessionCost } from '@/lib/insights'
import { projectDisplayName } from '@/lib/decode'
import { readConfig } from '@/lib/config'
import type { SpendAnomaly } from '@/lib/insights'

export const dynamic = 'force-dynamic'

// Compact summary rendered by `cc-lens digest` in the terminal.
// One shape for both scopes: `top` holds projects locally, members for teams.

export interface DigestResponse {
  scope: 'local' | 'team'
  period_days: number
  since: string
  total_cost: number
  prev_cost: number
  sessions: number
  top: Array<{ name: string; cost: number }>
  potential_monthly_savings: number
  cache_hit_rate: number | null
  budget: { monthly_budget_usd: number; month_to_date_cost: number } | null
  anomalies: SpendAnomaly[]
}

function dayCutoff(daysAgo: number, now: Date): string {
  // Stay in UTC throughout: toISOString() converts back to UTC, so mixing in
  // local setters would shift the cutoff by a day in non-UTC timezones.
  const d = new Date(now)
  d.setUTCHours(0, 0, 0, 0)
  d.setUTCDate(d.getUTCDate() - (daysAgo - 1))
  return d.toISOString().slice(0, 10)
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const daysParam = Number(url.searchParams.get('days'))
  const days = daysParam >= 1 && daysParam <= 90 ? Math.floor(daysParam) : 7
  const scope = url.searchParams.get('scope') === 'team' ? 'team' : 'local'
  const now = new Date()
  const since = dayCutoff(days, now)
  const prevSince = dayCutoff(days * 2, now)

  if (scope === 'team') {
    const team = await getTeamAnalytics()
    const inWindow = team.daily.filter(d => d.date >= since)
    const inPrev = team.daily.filter(d => d.date >= prevSince && d.date < since)
    const byMember = new Map<string, number>()
    for (const d of inWindow) {
      for (const [name, cost] of Object.entries(d.cost_by_member)) {
        byMember.set(name, (byMember.get(name) ?? 0) + cost)
      }
    }
    const response: DigestResponse = {
      scope,
      period_days: days,
      since,
      total_cost: inWindow.reduce((s, d) => s + d.total_cost, 0),
      prev_cost: inPrev.reduce((s, d) => s + d.total_cost, 0),
      sessions: inWindow.reduce((s, d) => s + d.total_sessions, 0),
      top: Array.from(byMember.entries())
        .map(([name, cost]) => ({ name, cost }))
        .sort((a, b) => b.cost - a.cost)
        .slice(0, 3),
      potential_monthly_savings: 0,
      cache_hit_rate: null,
      budget: null,
      anomalies: [],
    }
    return NextResponse.json(response)
  }

  const sessions = await getAllParsedSessions()
  const inWindow = sessions.filter(s => s.start_time && s.start_time.slice(0, 10) >= since)
  const inPrev = sessions.filter(s => {
    if (!s.start_time) return false
    const d = s.start_time.slice(0, 10)
    return d >= prevSince && d < since
  })

  const byProject = new Map<string, number>()
  for (const s of inWindow) {
    const name = projectDisplayName(s.project_path)
    byProject.set(name, (byProject.get(name) ?? 0) + sessionCost(s))
  }

  const report = buildInsightsReport(sessions, days, now)
  const config = await readConfig()
  let budget: DigestResponse['budget'] = null
  if (config.monthly_budget_usd) {
    const monthStart = `${now.toISOString().slice(0, 7)}-01`
    budget = {
      monthly_budget_usd: config.monthly_budget_usd,
      month_to_date_cost: sessions
        .filter(s => s.start_time && s.start_time.slice(0, 10) >= monthStart)
        .reduce((sum, s) => sum + sessionCost(s), 0),
    }
  }

  const response: DigestResponse = {
    scope,
    period_days: days,
    since,
    total_cost: report.window_cost,
    prev_cost: inPrev.reduce((sum, s) => sum + sessionCost(s), 0),
    sessions: inWindow.length,
    top: Array.from(byProject.entries())
      .map(([name, cost]) => ({ name, cost }))
      .sort((a, b) => b.cost - a.cost)
      .slice(0, 3),
    potential_monthly_savings: report.total_monthly_savings,
    cache_hit_rate: report.cache_hit_rate,
    budget,
    anomalies: report.anomalies,
  }
  return NextResponse.json(response)
}
