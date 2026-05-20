'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { BarChart3, PieChart, Clock, CalendarDays } from 'lucide-react'
import { UsageOverTimeChart } from '@/components/overview/usage-over-time-chart'
import { ModelBreakdownDonut } from '@/components/overview/model-breakdown-donut'
import { ProjectActivityDonut } from '@/components/overview/project-activity-donut'
import { PeakHoursChart } from '@/components/overview/peak-hours-chart'
import { OverviewConversationTable } from '@/components/overview/conversation-table'
import { StatCard } from '@/components/overview/stat-card'
import { formatTokens, formatBytes } from '@/lib/decode'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import type { StatsCache, DailyActivity, DailyTokens } from '@/types/claude'
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

function computeTrend(
  dailyActivity: DailyActivity[],
  field: 'messageCount' | 'sessionCount',
  days = 7,
): number | undefined {
  const sorted = [...dailyActivity].sort((a, b) => a.date.localeCompare(b.date))
  const recent = sorted.slice(-days)
  const previous = sorted.slice(-(days * 2), -days)
  if (!recent.length || !previous.length) return undefined
  const recentSum = recent.reduce((s, d) => s + (d[field] ?? 0), 0)
  const prevSum = previous.reduce((s, d) => s + (d[field] ?? 0), 0)
  if (prevSum === 0) return undefined
  return ((recentSum - prevSum) / prevSum) * 100
}

function getActivitySpark(dailyActivity: DailyActivity[], field: 'messageCount' | 'sessionCount', days = 14): number[] {
  return [...dailyActivity]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-days)
    .map(d => d[field] ?? 0)
}

function getTokenSpark(tokensByDate: DailyTokens[], days = 14): number[] {
  return [...tokensByDate]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-days)
    .map(d => Object.values(d.tokensByModel ?? {}).reduce((s, v) => s + v, 0))
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
  const chartDays = usingCustom
    ? Math.ceil((customRange.to!.getTime() - customRange.from!.getTime()) / (24 * 60 * 60 * 1000))
    : datePreset === '7d' ? 7 : datePreset === '30d' ? 30 : 90
  const effectiveDateFrom = usingCustom
    ? format(customRange.from!, 'MM/dd/yyyy')
    : format(subDays(new Date(), chartDays), 'MM/dd/yyyy')
  const effectiveDateTo = usingCustom
    ? format(customRange.to!, 'MM/dd/yyyy')
    : format(new Date(), 'MM/dd/yyyy')

  const pickerLabel = usingCustom
    ? `${format(customRange.from!, 'MMM d')} – ${format(customRange.to!, 'MMM d, yyyy')}`
    : 'Pick a date'

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

  if (error) {
    return (
      <div className="px-6 py-6 text-destructive text-sm font-mono">
        ✗ error loading data: {String(error)}
      </div>
    )
  }

  const { stats, computed } = data

  const inputBlue = theme === 'light' ? '#1d4ed8' : '#60a5fa'
  const tokenSegs = [
    { label: 'input',       value: computed.totalInputTokens,      color: inputBlue },
    { label: 'output',      value: computed.totalOutputTokens,     color: '#d97706' },
    { label: 'cache read',  value: computed.totalCacheReadTokens,  color: '#34d399' },
    { label: 'cache write', value: computed.totalCacheWriteTokens, color: '#a78bfa' },
  ]
  const totalTokens =
    computed.totalInputTokens +
    computed.totalOutputTokens +
    computed.totalCacheReadTokens +
    computed.totalCacheWriteTokens

  const tokensByDate = stats.dailyModelTokens ?? stats.tokensByDate ?? []

  // Trends compare last N days vs previous N days (capped at 30 to avoid sparse data)
  const trendWindow = Math.min(Math.max(chartDays, 7), 30)

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
          value={computed.sessionCount.toLocaleString()}
          description={`${computed.sessionsThisMonth} this month · ${computed.sessionsThisWeek} this week`}
          trend={computeTrend(stats.dailyActivity, 'sessionCount', trendWindow)}
          sparkData={getActivitySpark(stats.dailyActivity, 'sessionCount')}
          accentColor="var(--foreground)"
        />
        <StatCard
          title="Messages"
          value={stats.totalMessages.toLocaleString()}
          description={`${computed.activeDays} active days`}
          trend={computeTrend(stats.dailyActivity, 'messageCount', trendWindow)}
          sparkData={getActivitySpark(stats.dailyActivity, 'messageCount')}
          accentColor="#d97706"
        />
        <StatCard
          title="Tokens Used"
          value={formatTokens(computed.totalTokens)}
          description={`${formatTokens(computed.totalCacheReadTokens)} from cache`}
          sparkData={getTokenSpark(tokensByDate)}
          accentColor={inputBlue}
        />
        <StatCard
          title="Estimated Cost"
          value={`$${computed.totalCost.toFixed(2)}`}
          description={`$${computed.totalCacheSavings.toFixed(2)} saved via cache`}
          sparkData={getTokenSpark(tokensByDate)}
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
                <CardDescription>Token usage by model</CardDescription>
              </div>
              <PieChart className="w-4 h-4 text-muted-foreground mt-0.5" />
            </div>
          </CardHeader>
          <CardContent>
            <ModelBreakdownDonut modelUsage={stats.modelUsage} />
          </CardContent>
        </Card>
      </div>

      {/* ── Secondary charts row ──────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle>Peak Hours</CardTitle>
                <CardDescription>Activity by hour of day</CardDescription>
              </div>
              <Clock className="w-4 h-4 text-muted-foreground mt-0.5" />
            </div>
          </CardHeader>
          <CardContent>
            <PeakHoursChart hourCounts={stats.hourCounts ?? {}} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle>Project Activity</CardTitle>
                <CardDescription>Distribution across projects</CardDescription>
              </div>
              <PieChart className="w-4 h-4 text-muted-foreground mt-0.5" />
            </div>
          </CardHeader>
          <CardContent>
            <ProjectActivityDonut projects={projects} />
          </CardContent>
        </Card>
      </div>

      {/* ── Token breakdown ───────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Token Breakdown</CardTitle>
          <CardDescription>Distribution across token types (all time)</CardDescription>
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
          <CardDescription>Your latest Claude Code conversations</CardDescription>
        </CardHeader>
        <CardContent>
          <OverviewConversationTable sessions={sessions} />
        </CardContent>
      </Card>

    </div>
  )
}
