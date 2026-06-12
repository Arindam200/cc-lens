'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { BarChart3, PieChart, Clock, CalendarDays } from 'lucide-react'
import { UsageOverTimeChart } from '@/components/overview/usage-over-time-chart'
import { ModelBreakdownDonut } from '@/components/overview/model-breakdown-donut'
import { ProjectActivityDonut } from '@/components/overview/project-activity-donut'
import { PeakHoursChart } from '@/components/overview/peak-hours-chart'
import { OverviewConversationTable } from '@/components/overview/conversation-table'
import { LiveSessionsPanel } from '@/components/overview/live-sessions-panel'
import { StatCard } from '@/components/overview/stat-card'
import { formatTokens, formatBytes } from '@/lib/decode'
import { estimateCostFromUsage, estimateTotalCostFromModel, getPricing } from '@/lib/pricing'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import type { StatsCache, DailyActivity } from '@/types/claude'
import type { SessionWithFacet, ProjectSummary } from '@/types/claude'
import { format, subDays } from 'date-fns'
import { useTheme } from '@/components/theme-provider'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ApiResponse {
  stats: StatsCache
  computed: {
    totalCost: number
    totalCacheSavings: number
    totalTokens: number
    totalInputTokens: number
    totalOutputTokens: number
    totalCacheReadTokens: number
    totalCacheWriteTokens: number
    totalToolCalls: number
    activeDays: number
    avgSessionMinutes: number
    sessionsThisMonth: number
    sessionsThisWeek: number
    storageBytes: number
    sessionCount: number
  }
}

type DatePreset = '7d' | '30d' | '90d'
type CustomRange = { from?: Date; to?: Date }

const fetcher = (url: string) =>
  fetch(url).then(r => {
    if (!r.ok) throw new Error(`API error ${r.status}`)
    return r.json()
  })

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function isoDay(date: Date): string {
  return toDay(date).toISOString().slice(0, 10)
}

function previousRange(from: Date, to: Date): { from: Date; to: Date } {
  const days = Math.max(1, Math.round((toDay(to).getTime() - toDay(from).getTime()) / 86_400_000) + 1)
  const prevTo = new Date(toDay(from))
  prevTo.setDate(prevTo.getDate() - 1)
  const prevFrom = new Date(prevTo)
  prevFrom.setDate(prevFrom.getDate() - (days - 1))
  return { from: prevFrom, to: prevTo }
}

function inRange(dateStr: string, from: Date, to: Date): boolean {
  const day = dateStr.slice(0, 10)
  return day >= isoDay(from) && day <= isoDay(to)
}

function filterActivityByRange(dailyActivity: DailyActivity[], from: Date, to: Date): DailyActivity[] {
  return dailyActivity.filter(d => inRange(d.date, from, to))
}

function sessionCost(session: SessionWithFacet): number {
  if (session.model_usage && Object.keys(session.model_usage).length > 0) {
    return Object.entries(session.model_usage).reduce(
      (sum, [model, usage]) => sum + estimateTotalCostFromModel(model, usage),
      0
    )
  }
  return estimateCostFromUsage('claude-opus-4-7', {
    input_tokens: session.input_tokens ?? 0,
    output_tokens: session.output_tokens ?? 0,
    cache_creation_input_tokens: session.cache_creation_input_tokens ?? 0,
    cache_read_input_tokens: session.cache_read_input_tokens ?? 0,
  })
}

function sessionCacheSavings(session: SessionWithFacet): number {
  if (session.model_usage && Object.keys(session.model_usage).length > 0) {
    return Object.entries(session.model_usage).reduce((sum, [model, usage]) => {
      const p = getPricing(model)
      return sum + ((usage.cacheReadInputTokens ?? 0) * (p.input - p.cacheRead))
    }, 0)
  }
  const p = getPricing('claude-opus-4-7')
  return (session.cache_read_input_tokens ?? 0) * (p.input - p.cacheRead)
}

// ─── Component ────────────────────────────────────────────────────────────────

export function OverviewClient() {
  const { theme } = useTheme()
  const [datePreset, setDatePreset] = useState<DatePreset>('30d')
  const [customRange, setCustomRange] = useState<CustomRange>({})
  const [pickerOpen, setPickerOpen] = useState(false)

  const { data, error, isLoading } = useSWR<ApiResponse>('/api/stats', fetcher, {
    refreshInterval: 5_000,
  })
  const { data: sessionsData } = useSWR<{ sessions: SessionWithFacet[] }>('/api/sessions', fetcher, {
    refreshInterval: 5_000,
  })
  const { data: projectsData } = useSWR<{ projects: ProjectSummary[] }>('/api/projects', fetcher, {
    refreshInterval: 5_000,
  })

  const sessions = sessionsData?.sessions ?? []
  const projects = projectsData?.projects ?? []
  const projectCount = projects.length

  const usingCustom = !!(customRange.from && customRange.to)
  // +1 so the range is inclusive of both endpoints (same-day selection = 1 day)
  const chartDays = usingCustom
    ? Math.ceil((customRange.to!.getTime() - customRange.from!.getTime()) / (24 * 60 * 60 * 1000)) + 1
    : datePreset === '7d' ? 7 : datePreset === '30d' ? 30 : 90
  const effectiveDateFrom = usingCustom
    ? format(customRange.from!, 'MM/dd/yyyy')
    : format(subDays(new Date(), chartDays - 1), 'MM/dd/yyyy')
  const effectiveDateTo = usingCustom
    ? format(customRange.to!, 'MM/dd/yyyy')
    : format(new Date(), 'MM/dd/yyyy')

  const pickerLabel = usingCustom
    ? `${format(customRange.from!, 'MMM d')} – ${format(customRange.to!, 'MMM d, yyyy')}`
    : 'Pick a date'

  // Error has to be checked before the loading skeleton: on a failed first
  // load `data` stays undefined forever, which would pin us on the skeleton.
  if (error) {
    return (
      <div className="px-6 py-6 text-destructive text-sm font-mono">
        ✗ error loading data: {String(error)}
      </div>
    )
  }

  // ── Loading ──────────────────────────────────────────────────────────────
  if (isLoading || !data || !data.computed) {
    return (
      <div className="px-6 py-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-7 w-32" />
            <Skeleton className="h-4 w-56" />
          </div>
          <Skeleton className="h-9 w-48" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
          <Skeleton className="h-72 rounded-xl" />
          <Skeleton className="h-72 rounded-xl" />
        </div>
      </div>
    )
  }

  const { stats, computed } = data
  const rangeFrom = usingCustom ? toDay(customRange.from!) : toDay(subDays(new Date(), chartDays - 1))
  const rangeTo = usingCustom ? toDay(customRange.to!) : toDay(new Date())
  const prevRange = previousRange(rangeFrom, rangeTo)
  const tokensByDate = stats.dailyModelTokens ?? stats.tokensByDate ?? []

  const rangeMetrics = (() => {
    const rangeSessions = sessions.filter(s => inRange(s.start_time, rangeFrom, rangeTo))
    const previousSessions = sessions.filter(s => inRange(s.start_time, prevRange.from, prevRange.to))
    const rangeActivity = filterActivityByRange(stats.dailyActivity, rangeFrom, rangeTo)

    const messages = rangeSessions.reduce(
      (sum, s) => sum + (s.user_message_count ?? 0) + (s.assistant_message_count ?? 0),
      0
    )
    const previousMessages = previousSessions.reduce(
      (sum, s) => sum + (s.user_message_count ?? 0) + (s.assistant_message_count ?? 0),
      0
    )

    const totalInputTokens = rangeSessions.reduce((sum, s) => sum + (s.input_tokens ?? 0), 0)
    const totalOutputTokens = rangeSessions.reduce((sum, s) => sum + (s.output_tokens ?? 0), 0)
    const totalCacheReadTokens = rangeSessions.reduce((sum, s) => sum + (s.cache_read_input_tokens ?? 0), 0)
    const totalCacheWriteTokens = rangeSessions.reduce((sum, s) => sum + (s.cache_creation_input_tokens ?? 0), 0)
    const totalTokens = totalInputTokens + totalOutputTokens + totalCacheReadTokens + totalCacheWriteTokens

    const previousTokens = previousSessions.reduce(
      (sum, s) =>
        sum +
        (s.input_tokens ?? 0) +
        (s.output_tokens ?? 0) +
        (s.cache_read_input_tokens ?? 0) +
        (s.cache_creation_input_tokens ?? 0),
      0
    )

    const totalCost = rangeSessions.reduce((sum, s) => sum + sessionCost(s), 0)
    const previousCost = previousSessions.reduce((sum, s) => sum + sessionCost(s), 0)
    const totalCacheSavings = rangeSessions.reduce((sum, s) => sum + sessionCacheSavings(s), 0)
    const modelUsage = rangeSessions.reduce<Record<string, NonNullable<SessionWithFacet['model_usage']>[string]>>((acc, session) => {
      for (const [model, usage] of Object.entries(session.model_usage ?? {})) {
        const existing = acc[model] ?? {
          inputTokens: 0,
          outputTokens: 0,
          cacheReadInputTokens: 0,
          cacheCreationInputTokens: 0,
          costUSD: 0,
          webSearchRequests: 0,
        }
        existing.inputTokens += usage.inputTokens ?? 0
        existing.outputTokens += usage.outputTokens ?? 0
        existing.cacheReadInputTokens += usage.cacheReadInputTokens ?? 0
        existing.cacheCreationInputTokens += usage.cacheCreationInputTokens ?? 0
        existing.costUSD += usage.costUSD ?? 0
        existing.webSearchRequests += usage.webSearchRequests ?? 0
        acc[model] = existing
      }
      return acc
    }, {})
    const hourCounts = rangeSessions.reduce<Record<string, number>>((acc, session) => {
      for (const hour of session.message_hours ?? []) {
        const key = String(hour)
        acc[key] = (acc[key] ?? 0) + 1
      }
      return acc
    }, {})
    const projects = Array.from(
      rangeSessions.reduce((acc, session) => {
        const projectPath = session.project_path || 'Unknown'
        const existing = acc.get(projectPath) ?? {
          slug: projectPath.replace(/\//g, '-'),
          project_path: projectPath,
          display_name: projectPath.split(/[\\/]/).filter(Boolean).pop() || 'Unknown',
          session_count: 0,
          total_messages: 0,
          total_duration_minutes: 0,
          total_lines_added: 0,
          total_lines_removed: 0,
          total_files_modified: 0,
          git_commits: 0,
          git_pushes: 0,
          estimated_cost: 0,
          input_tokens: 0,
          output_tokens: 0,
          languages: {},
          tool_counts: {},
          last_active: '',
          first_active: '',
          uses_mcp: false,
          uses_task_agent: false,
          branches: [],
        } satisfies ProjectSummary
        existing.session_count += 1
        existing.total_messages += (session.user_message_count ?? 0) + (session.assistant_message_count ?? 0)
        existing.total_duration_minutes += session.duration_minutes ?? 0
        existing.estimated_cost += sessionCost(session)
        existing.input_tokens += session.input_tokens ?? 0
        existing.output_tokens += session.output_tokens ?? 0
        existing.uses_mcp = existing.uses_mcp || session.uses_mcp
        existing.uses_task_agent = existing.uses_task_agent || session.uses_task_agent
        if (!existing.first_active || session.start_time < existing.first_active) existing.first_active = session.start_time
        if (!existing.last_active || session.start_time > existing.last_active) existing.last_active = session.start_time
        acc.set(projectPath, existing)
        return acc
      }, new Map<string, ProjectSummary>()).values()
    ).sort((a, b) => b.input_tokens + b.output_tokens - (a.input_tokens + a.output_tokens))

    const trend = (current: number, previous: number) => {
      if (previous === 0) return current === 0 ? undefined : 100
      return ((current - previous) / previous) * 100
    }

    const tokenSpark = tokensByDate
      .filter(d => inRange(d.date, rangeFrom, rangeTo))
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(d => Object.values(d.tokensByModel ?? {}).reduce((sum, value) => sum + value, 0))

    const fallbackTokenSpark = rangeActivity.map(d => {
      const daySessions = rangeSessions.filter(s => s.start_time.slice(0, 10) === d.date.slice(0, 10))
      return daySessions.reduce(
        (sum, s) =>
          sum +
          (s.input_tokens ?? 0) +
          (s.output_tokens ?? 0) +
          (s.cache_read_input_tokens ?? 0) +
          (s.cache_creation_input_tokens ?? 0),
        0
      )
    })

    return {
      sessionCount: rangeSessions.length,
      messages,
      activeDays: rangeActivity.filter(d => d.sessionCount > 0).length,
      totalInputTokens,
      totalOutputTokens,
      totalCacheReadTokens,
      totalCacheWriteTokens,
      totalTokens,
      totalCost,
      totalCacheSavings,
      sessionTrend: trend(rangeSessions.length, previousSessions.length),
      messageTrend: trend(messages, previousMessages),
      tokenTrend: trend(totalTokens, previousTokens),
      costTrend: trend(totalCost, previousCost),
      sessionSpark: rangeActivity.map(d => d.sessionCount ?? 0),
      messageSpark: rangeActivity.map(d => d.messageCount ?? 0),
      tokenSpark: tokenSpark.length > 0 ? tokenSpark : fallbackTokenSpark,
      costSpark: rangeActivity.map(d => {
        const day = d.date.slice(0, 10)
        return rangeSessions
          .filter(s => s.start_time.slice(0, 10) === day)
          .reduce((sum, s) => sum + sessionCost(s), 0)
      }),
      modelUsage,
      hourCounts,
      projects,
      sessions: rangeSessions,
    }
  })()

  const inputBlue = theme === 'light' ? '#1d4ed8' : '#60a5fa'
  const tokenSegs = [
    { label: 'input',       value: rangeMetrics.totalInputTokens,      color: inputBlue },
    { label: 'output',      value: rangeMetrics.totalOutputTokens,     color: '#d97706' },
    { label: 'cache read',  value: rangeMetrics.totalCacheReadTokens,  color: '#34d399' },
    { label: 'cache write', value: rangeMetrics.totalCacheWriteTokens, color: '#a78bfa' },
  ]
  const totalTokens =
    rangeMetrics.totalInputTokens +
    rangeMetrics.totalOutputTokens +
    rangeMetrics.totalCacheReadTokens +
    rangeMetrics.totalCacheWriteTokens

  return (
    <div className="px-6 py-6 space-y-6 bg-background">

      {/* ── Page header ───────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Overview</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {projectCount} projects · {formatBytes(computed.storageBytes)} stored
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Tabs
            value={usingCustom ? '' : datePreset}
            onValueChange={v => {
              setDatePreset(v as DatePreset)
              setCustomRange({})
            }}
          >
            <TabsList>
              <TabsTrigger value="7d">7d</TabsTrigger>
              <TabsTrigger value="30d">30d</TabsTrigger>
              <TabsTrigger value="90d">90d</TabsTrigger>
            </TabsList>
          </Tabs>

          <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
            <PopoverTrigger asChild>
              <Button
                variant={usingCustom ? 'default' : 'outline'}
                size="sm"
                className="gap-2"
              >
                <CalendarDays className="w-3.5 h-3.5" />
                {pickerLabel}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="range"
                selected={{ from: customRange.from, to: customRange.to }}
                onSelect={range => {
                  setCustomRange({ from: range?.from, to: range?.to })
                  if (range?.from && range?.to) setPickerOpen(false)
                }}
                disabled={{ after: new Date() }}
                initialFocus
              />
            </PopoverContent>
          </Popover>

        </div>
      </div>

      

      {/* ── Stat cards ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Sessions"
          value={rangeMetrics.sessionCount.toLocaleString()}
          description={`${rangeMetrics.activeDays} active days in range`}
          trend={rangeMetrics.sessionTrend}
          sparkData={rangeMetrics.sessionSpark}
          accentColor="var(--foreground)"
        />
        <StatCard
          title="Messages"
          value={rangeMetrics.messages.toLocaleString()}
          description={`${rangeMetrics.activeDays} active days`}
          trend={rangeMetrics.messageTrend}
          sparkData={rangeMetrics.messageSpark}
          accentColor="#d97706"
        />
        <StatCard
          title="Tokens Used"
          value={formatTokens(rangeMetrics.totalTokens)}
          description={`${formatTokens(rangeMetrics.totalCacheReadTokens)} from cache`}
          trend={rangeMetrics.tokenTrend}
          sparkData={rangeMetrics.tokenSpark}
          accentColor={inputBlue}
        />
        <StatCard
          title="Estimated Cost"
          value={`$${rangeMetrics.totalCost.toFixed(2)}`}
          description={`$${rangeMetrics.totalCacheSavings.toFixed(2)} saved via cache`}
          trend={rangeMetrics.costTrend}
          sparkData={rangeMetrics.costSpark}
          accentColor="#34d399"
        />
      </div>
      

      {/* ── Main charts row ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle>Usage Over Time</CardTitle>
                <CardDescription>
                  Messages and sessions — last {chartDays} days
                </CardDescription>
              </div>
              <BarChart3 className="w-4 h-4 text-muted-foreground mt-0.5" />
            </div>
          </CardHeader>
          <CardContent>
            <UsageOverTimeChart
              data={stats.dailyActivity}
              days={chartDays}
              dateFrom={effectiveDateFrom}
              dateTo={effectiveDateTo}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle>Model Distribution</CardTitle>
                <CardDescription>Token usage by model in selected range</CardDescription>
              </div>
              <PieChart className="w-4 h-4 text-muted-foreground mt-0.5" />
            </div>
          </CardHeader>
          <CardContent>
            <ModelBreakdownDonut modelUsage={rangeMetrics.modelUsage} />
          </CardContent>
        </Card>
      </div>
      
      {/* ── Live sessions ─────────────────────────────────────────────────── */}
      <LiveSessionsPanel />
      
      {/* ── Secondary charts row ──────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle>Peak Hours</CardTitle>
                <CardDescription>Activity by hour of day in selected range</CardDescription>
              </div>
              <Clock className="w-4 h-4 text-muted-foreground mt-0.5" />
            </div>
          </CardHeader>
          <CardContent>
            <PeakHoursChart hourCounts={rangeMetrics.hourCounts} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle>Project Activity</CardTitle>
                <CardDescription>Distribution across projects in selected range</CardDescription>
              </div>
              <PieChart className="w-4 h-4 text-muted-foreground mt-0.5" />
            </div>
          </CardHeader>
          <CardContent>
            <ProjectActivityDonut projects={rangeMetrics.projects} />
          </CardContent>
        </Card>
      </div>

      {/* ── Token breakdown ───────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Token Breakdown</CardTitle>
          <CardDescription>Distribution across token types in selected range</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {totalTokens > 0 ? (
            <>
              <div className="flex h-2 rounded-full overflow-hidden w-full bg-muted/40">
                {tokenSegs.map(({ label, value, color }) => (
                  <div
                    key={label}
                    title={`${label}: ${formatTokens(value)}`}
                    style={{
                      width: `${(value / totalTokens) * 100}%`,
                      minWidth: value > 0 ? 2 : 0,
                      backgroundColor: color,
                    }}
                  />
                ))}
              </div>
              <div className="flex flex-wrap gap-x-8 gap-y-2">
                {tokenSegs.map(({ label, value, color }) => (
                  <span key={label} className="inline-flex items-center gap-2">
                    <span
                      className="inline-block w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: color }}
                    />
                    <span className="text-[12px] text-muted-foreground">{label}</span>
                    <span className="text-[13px] font-bold tabular-nums font-mono" style={{ color }}>
                      {formatTokens(value)}
                    </span>
                    <span className="text-[12px] text-muted-foreground/60">
                      {Math.round((value / totalTokens) * 100)}%
                    </span>
                  </span>
                ))}
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">No token usage recorded yet.</p>
          )}
        </CardContent>
      </Card>

      {/* ── Recent sessions ───────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Sessions</CardTitle>
          <CardDescription>Your latest Claude Code conversations in selected range</CardDescription>
        </CardHeader>
        <CardContent>
          <OverviewConversationTable sessions={rangeMetrics.sessions} />
        </CardContent>
      </Card>

    </div>
  )
}
