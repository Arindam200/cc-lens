'use client'

import useSWR from 'swr'
import { TopBar } from '@/components/layout/top-bar'
import { ActivityHeatmap } from '@/components/overview/activity-heatmap'
import { PeakHoursChart } from '@/components/overview/peak-hours-chart'
import { DayOfWeekChart } from '@/components/activity/day-of-week-chart'
import { UsageOverTimeChart } from '@/components/overview/usage-over-time-chart'
import type { DailyActivity } from '@/types/claude'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertTriangle, Flame, CalendarDays, BarChart3, Clock, Zap, TrendingUp, Star } from 'lucide-react'

const fetcher = (url: string) =>
  fetch(url).then(r => { if (!r.ok) throw new Error(`API error ${r.status}`); return r.json() })

interface ActivityData {
  daily_activity: DailyActivity[]
  hour_counts: Array<{ hour: number; count: number }>
  dow_counts: Array<{ day: string; count: number }>
  streaks: { current: number; longest: number }
  most_active_day: string
  most_active_day_msgs: number
  total_active_days: number
}

function StatTile({
  label,
  value,
  sub,
  icon: Icon,
  color,
}: {
  label: string
  value: string | number
  sub: string
  icon: React.ElementType
  color: string
}) {
  return (
    <Card className="gap-0">
      <CardHeader className="pb-2">
        <CardDescription className="flex items-center gap-2 text-sm font-medium">
          <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
          {label}
        </CardDescription>
        <CardTitle className="text-3xl font-bold tabular-nums leading-none" style={{ color }}>
          {value}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <p className="text-xs text-muted-foreground">{sub}</p>
      </CardContent>
    </Card>
  )
}

export default function ActivityPage() {
  const { data, error, isLoading } = useSWR<ActivityData>('/api/activity', fetcher, { refreshInterval: 5_000 })

  const hourCounts = data
    ? Object.fromEntries(data.hour_counts.map(h => [String(h.hour), h.count]))
    : {}

  return (
    <div className="flex flex-col min-h-screen">
      <TopBar title="Activity" subtitle="Patterns, streaks, and peak hours" />
      <div className="t-stagger-group w-full space-y-4 p-4 md:p-6">

        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>Error loading data: {String(error)}</AlertDescription>
          </Alert>
        )}

        {isLoading && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:items-stretch">
              <Skeleton className="h-72 min-h-72 rounded-xl md:min-h-80" />
              <Skeleton className="h-56 min-h-56 rounded-xl md:min-h-80" />
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:items-stretch">
              <Skeleton className="h-64 rounded-xl md:min-h-72" />
              <Skeleton className="h-56 rounded-xl md:min-h-72" />
            </div>
          </>
        )}

        {data && (
          <>
            {/* Stat tiles */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatTile
                label="Current Streak"
                value={data.streaks.current}
                sub="consecutive days"
                icon={Flame}
                color="#f97316"
              />
              <StatTile
                label="Longest Streak"
                value={data.streaks.longest}
                sub="personal best"
                icon={Zap}
                color="var(--viz-sky)"
              />
              <StatTile
                label="Active Days"
                value={data.total_active_days}
                sub="total days with activity"
                icon={TrendingUp}
                color="#a78bfa"
              />
              <StatTile
                label="Most Active Day"
                value={data.most_active_day ? data.most_active_day.slice(5) : '—'}
                sub={data.most_active_day_msgs ? `${data.most_active_day_msgs.toLocaleString()} messages` : 'no data'}
                icon={Star}
                color="#34d399"
              />
            </div>

            {/* Row 1: Activity calendar | Peak hours */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:items-stretch">
              <Card className="flex h-full min-h-0 min-w-0 flex-col gap-2 py-4">
                <CardHeader className="space-y-1 pb-0">
                  <CardTitle className="flex items-center gap-2 text-base font-semibold">
                    <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" />
                    Activity Calendar
                  </CardTitle>
                  <CardDescription>GitHub-style contribution heatmap</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col pt-3 pb-0">
                  <ActivityHeatmap data={data.daily_activity} />
                </CardContent>
              </Card>

              <Card className="flex h-full min-h-0 min-w-0 flex-col gap-2 py-4">
                <CardHeader className="space-y-1 pb-0">
                  <CardTitle className="flex items-center gap-2 text-base font-semibold">
                    <Clock className="h-4 w-4 shrink-0 text-muted-foreground" />
                    Peak Hours
                  </CardTitle>
                  <CardDescription>Activity by hour of day</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col justify-between pt-3 pb-0">
                  <PeakHoursChart hourCounts={hourCounts} />
                </CardContent>
              </Card>
            </div>

            {/* Row 2: Usage over time | Day of week */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:items-stretch">
              <Card className="flex h-full min-h-0 min-w-0 flex-col gap-2 py-4">
                <CardHeader className="space-y-1 pb-0">
                  <CardTitle className="flex items-center gap-2 text-base font-semibold">
                    <BarChart3 className="h-4 w-4 shrink-0 text-muted-foreground" />
                    Usage Over Time
                  </CardTitle>
                  <CardDescription>Messages and sessions over the last 90 days</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col pt-3 pb-0">
                  <UsageOverTimeChart data={data.daily_activity} days={90} />
                </CardContent>
              </Card>

              <Card className="flex h-full min-h-0 min-w-0 flex-col gap-2 py-4">
                <CardHeader className="space-y-1 pb-0">
                  <CardTitle className="flex items-center gap-2 text-base font-semibold">
                    <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" />
                    Day of Week
                  </CardTitle>
                  <CardDescription>Which days you use Claude Code most</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col justify-between pt-3 pb-0">
                  <DayOfWeekChart data={data.dow_counts} />
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
