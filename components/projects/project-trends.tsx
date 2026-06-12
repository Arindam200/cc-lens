'use client'

import Link from 'next/link'
import type React from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { formatCost, formatDuration, formatTokens } from '@/lib/decode'
import type { ProjectTrend } from '@/types/claude'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Activity, Bot, DollarSign, MessageSquare, Search, TrendingDown, TrendingUp, Wrench } from 'lucide-react'

type MetricKey = 'sessions' | 'estimated_cost' | 'tool_calls' | 'agent_sessions'

const METRICS: Array<{ key: MetricKey; label: string; color: string }> = [
  { key: 'sessions', label: 'Sessions', color: '#34d399' },
  { key: 'estimated_cost', label: 'Cost', color: '#d97706' },
  { key: 'tool_calls', label: 'Tools', color: '#38bdf8' },
  { key: 'agent_sessions', label: 'Agents', color: '#a78bfa' },
]

function formatNumber(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`
  return value.toLocaleString()
}

function formatMetric(key: MetricKey, value: number): string {
  if (key === 'estimated_cost') return formatCost(value)
  return formatNumber(Math.round(value))
}

function formatDelta(value: number | null): string {
  if (value === null) return 'new'
  if (value === 0) return '0%'
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(0)}%`
}

function deltaClass(value: number | null): string {
  if (value === null) return 'text-blue-600 dark:text-sky-400'
  if (value > 0) return 'text-emerald-600 dark:text-emerald-400'
  if (value < 0) return 'text-muted-foreground'
  return 'text-muted-foreground/70'
}

function metricDelta(project: ProjectTrend, key: MetricKey): number | null {
  if (key === 'sessions') return project.delta.sessions_pct
  if (key === 'estimated_cost') return project.delta.estimated_cost_pct
  if (key === 'tool_calls') return project.delta.tool_calls_pct
  const current = project.current.agent_sessions
  const previous = project.previous.agent_sessions
  if (previous === 0) return current === 0 ? 0 : null
  return ((current - previous) / previous) * 100
}

function movementScore(value: number | null): number {
  return value === null ? 999 : value
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function TrendTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-[12px] shadow-sm">
      <p className="mb-1 text-muted-foreground">{label}</p>
      {payload.map((p: { name: string; value: number; color: string }) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: <span className="font-semibold">{p.name === 'Cost' ? formatCost(p.value) : formatNumber(p.value)}</span>
        </p>
      ))}
    </div>
  )
}

function TrendSparkline({ project, metric }: { project: ProjectTrend; metric: MetricKey }) {
  const config = METRICS.find(m => m.key === metric)!
  const chartData = project.series.map(point => ({
    date: point.date.slice(5),
    value: point[metric],
  }))

  return (
    <ResponsiveContainer width="100%" height={58}>
      <AreaChart data={chartData} margin={{ top: 6, right: 0, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id={`grad-${project.slug}-${metric}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={config.color} stopOpacity={0.24} />
            <stop offset="95%" stopColor={config.color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area
          type="monotone"
          dataKey="value"
          stroke={config.color}
          strokeWidth={1.8}
          fill={`url(#grad-${project.slug}-${metric})`}
          dot={false}
          activeDot={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

function TopMoverCard({
  title,
  description,
  icon,
  projects,
  metric,
}: {
  title: string
  description: string
  icon: React.ReactNode
  projects: ProjectTrend[]
  metric: MetricKey
}) {
  const rows = [...projects]
    .filter(p => p.current[metric] > 0)
    .sort((a, b) => movementScore(metricDelta(b, metric)) - movementScore(metricDelta(a, metric)))
    .slice(0, 5)

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-base">{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          <div className="text-muted-foreground">{icon}</div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {rows.map(project => {
          const delta = metricDelta(project, metric)
          return (
            <Link
              key={project.project_path}
              href={`/projects/${project.slug}`}
              className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 transition-colors hover:bg-muted/60"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{project.display_name}</p>
                <p className="truncate text-[11px] text-muted-foreground/60 font-mono">{project.project_path}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-sm font-semibold tabular-nums">{formatMetric(metric, project.current[metric])}</p>
                <p className={`text-[11px] font-medium tabular-nums ${deltaClass(delta)}`}>{formatDelta(delta)}</p>
              </div>
            </Link>
          )
        })}
        {rows.length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">No activity in this range</p>
        )}
      </CardContent>
    </Card>
  )
}

export function ProjectTrends({ trends, rangeDays }: { trends: ProjectTrend[]; rangeDays: number }) {
  const activeProjects = trends.filter(t => t.current.sessions > 0)
  const totals = activeProjects.reduce(
    (acc, project) => {
      acc.sessions += project.current.sessions
      acc.cost += project.current.estimated_cost
      acc.duration += project.current.duration_minutes
      acc.tools += project.current.tool_calls
      acc.agents += project.current.agent_sessions
      acc.webSearch += project.current.web_search_sessions
      return acc
    },
    { sessions: 0, cost: 0, duration: 0, tools: 0, agents: 0, webSearch: 0 }
  )

  const combinedSeries = activeProjects[0]?.series.map((point, index) => ({
    date: point.date.slice(5),
    Sessions: activeProjects.reduce((sum, project) => sum + project.series[index].sessions, 0),
    Tools: activeProjects.reduce((sum, project) => sum + project.series[index].tool_calls, 0),
  })) ?? []

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        <Card>
          <CardHeader className="pb-1">
            <CardDescription>Active Projects</CardDescription>
            <CardTitle className="text-2xl tabular-nums">{activeProjects.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardDescription>Sessions</CardDescription>
            <CardTitle className="text-2xl tabular-nums">{totals.sessions}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardDescription>Cost</CardDescription>
            <CardTitle className="text-2xl tabular-nums text-[#d97706]">{formatCost(totals.cost)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardDescription>Duration</CardDescription>
            <CardTitle className="text-2xl tabular-nums">{formatDuration(totals.duration)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardDescription>Tool Calls</CardDescription>
            <CardTitle className="text-2xl tabular-nums text-blue-700 dark:text-sky-400">{formatTokens(totals.tools)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardDescription>Agent Sessions</CardDescription>
            <CardTitle className="text-2xl tabular-nums text-violet-600 dark:text-violet-400">{totals.agents}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle>All Project Activity</CardTitle>
              <CardDescription>Sessions and tool calls over the last {rangeDays} days</CardDescription>
            </div>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </div>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={combinedSeries} margin={{ top: 8, right: 12, bottom: 0, left: -10 }}>
              <defs>
                <linearGradient id="project-trends-sessions" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#34d399" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#34d399" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="project-trends-tools" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#38bdf8" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} />
              <Tooltip content={<TrendTooltip />} />
              <Area type="monotone" dataKey="Tools" stroke="#38bdf8" strokeWidth={1.5} fill="url(#project-trends-tools)" dot={false} />
              <Area type="monotone" dataKey="Sessions" stroke="#34d399" strokeWidth={2} fill="url(#project-trends-sessions)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <TopMoverCard
          title="Fastest Growing"
          description="Session growth vs previous period"
          icon={<TrendingUp className="h-4 w-4" />}
          projects={trends}
          metric="sessions"
        />
        <TopMoverCard
          title="Cost Movers"
          description="Estimated spend growth vs previous period"
          icon={<DollarSign className="h-4 w-4" />}
          projects={trends}
          metric="estimated_cost"
        />
        <TopMoverCard
          title="Tool-Heavy"
          description="Projects with rising tool activity"
          icon={<Wrench className="h-4 w-4" />}
          projects={trends}
          metric="tool_calls"
        />
        <TopMoverCard
          title="Agent-Heavy"
          description="Projects leaning more on agents"
          icon={<Bot className="h-4 w-4" />}
          projects={trends}
          metric="agent_sessions"
        />
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle>Project Trend Table</CardTitle>
              <CardDescription>Current period compared with the previous {rangeDays} days</CardDescription>
            </div>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1040px] table-fixed text-sm">
              <colgroup>
                <col className="w-[34%]" />
                <col className="w-[10%]" />
                <col className="w-[10%]" />
                <col className="w-[11%]" />
                <col className="w-[8%]" />
                <col className="w-[8%]" />
                <col className="w-[8%]" />
                <col className="w-[11%]" />
              </colgroup>
              <thead>
                <tr className="border-b text-left text-[11px] uppercase text-muted-foreground">
                  <th className="pb-2 pr-4 font-semibold">Project</th>
                  <th className="px-3 pb-2 text-right font-semibold">Sessions</th>
                  <th className="px-3 pb-2 text-right font-semibold">Cost</th>
                  <th className="px-3 pb-2 text-right font-semibold">Duration</th>
                  <th className="px-3 pb-2 text-right font-semibold">Tools</th>
                  <th className="px-3 pb-2 text-right font-semibold">Agents</th>
                  <th className="px-3 pb-2 text-right font-semibold">Search</th>
                  <th className="pl-4 pb-2 text-left font-semibold">Trend</th>
                </tr>
              </thead>
              <tbody>
                {activeProjects.map(project => (
                  <tr key={project.project_path} className="border-b border-border/60">
                    <td className="py-3 pr-4">
                      <Link href={`/projects/${project.slug}`} className="block truncate font-medium hover:text-primary">
                        {project.display_name}
                      </Link>
                      <p className="truncate text-[11px] text-muted-foreground/60 font-mono">{project.project_path}</p>
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      <span>{project.current.sessions}</span>
                      <Badge variant="outline" className={`ml-2 h-5 max-w-14 px-1.5 text-[10px] ${deltaClass(project.delta.sessions_pct)}`}>
                        <span className="truncate">{formatDelta(project.delta.sessions_pct)}</span>
                      </Badge>
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">{formatCost(project.current.estimated_cost)}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{formatDuration(project.current.duration_minutes)}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{project.current.tool_calls.toLocaleString()}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{project.current.agent_sessions}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{project.current.web_search_sessions}</td>
                    <td className="py-3 pl-4">
                      <TrendSparkline project={project} metric="sessions" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {activeProjects.length === 0 && (
              <div className="flex flex-col items-center justify-center gap-1 py-12 text-sm text-muted-foreground">
                <Search className="h-4 w-4" />
                <span>No project activity in this range</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {trends.some(t => t.current.sessions === 0 && t.previous.sessions > 0) && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-base">Cooling Down</CardTitle>
                <CardDescription>Active in the previous period, quiet now</CardDescription>
              </div>
              <TrendingDown className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {trends
              .filter(t => t.current.sessions === 0 && t.previous.sessions > 0)
              .slice(0, 12)
              .map(project => (
                <Link key={project.project_path} href={`/projects/${project.slug}`}>
                  <Badge variant="outline" className="h-7 gap-1.5 px-2">
                    {project.display_name}
                    <span className="text-muted-foreground/60">{project.previous.sessions} prev</span>
                  </Badge>
                </Link>
              ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
