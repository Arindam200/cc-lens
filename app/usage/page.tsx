'use client'

import useSWR from 'swr'
import { TopBar } from '@/components/layout/top-bar'
import { UsageGauge, type GaugeWindow } from '@/components/usage/usage-gauge'
import { UsageControls } from '@/components/usage/usage-controls'
import { UsageAlerts } from '@/components/usage/usage-alerts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { formatCost } from '@/lib/decode'
import { cn } from '@/lib/utils'
import { AlertTriangle, Gauge, TrendingUp, Info, Map, Clock, CalendarDays, Bell } from 'lucide-react'

export interface UsageResponse {
  now: number
  plan: 'pro' | 'max5x' | 'max20x' | 'custom'
  planAutoDetected: boolean
  detectedPlan: 'pro' | 'max5x' | 'max20x'
  account: {
    organizationType: string | null
    rateLimitTier: string | null
    hasExtraUsageEnabled: boolean | null
  }
  caps: {
    cap5hUSD: number
    cap7dUSD: number
    cap5hCalibrated: boolean
    cap7dCalibrated: boolean
  }
  weeklyResetPinned: boolean
  fiveHour: GaugeWindow
  weekly: GaugeWindow
  pace: {
    usdPerMin: number
    projectedAtResetUSD: number
    capHitMs: number | null
  }
}

const fetcher = (url: string) =>
  fetch(url).then(r => { if (!r.ok) throw new Error(`API error ${r.status}`); return r.json() })

/** Small bordered icon box used in every section header. */
function IconChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border bg-muted/50 text-muted-foreground [&_svg]:size-4">
      {children}
    </span>
  )
}

/** Threshold status derived from a window's consumed fraction. */
function statusOf(open: boolean, fraction: number) {
  if (!open) return { label: 'Idle', cls: 'border-border bg-muted text-muted-foreground' }
  if (fraction >= 0.9) return { label: 'Critical', cls: 'border-red-500/20 bg-red-500/10 text-red-500' }
  if (fraction >= 0.7) return { label: 'Watch', cls: 'border-amber-500/20 bg-amber-500/10 text-amber-500' }
  return { label: 'Healthy', cls: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-500' }
}

/** Header used across all section cards: icon chip + title/subtitle + optional trailing slot. */
function SectionHeader({
  icon, title, subtitle, trailing,
}: {
  icon: React.ReactNode; title: React.ReactNode; subtitle?: React.ReactNode; trailing?: React.ReactNode
}) {
  return (
    <CardHeader className="border-b pt-5 [.border-b]:pb-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <IconChip>{icon}</IconChip>
          <div className="space-y-0.5">
            <CardTitle className="text-sm">{title}</CardTitle>
            {subtitle && <CardDescription className="text-xs">{subtitle}</CardDescription>}
          </div>
        </div>
        {trailing}
      </div>
    </CardHeader>
  )
}

function GaugeCard({
  icon, title, subtitle, window: w, rollingLabel,
}: {
  icon: React.ReactNode; title: string; subtitle: React.ReactNode; window: GaugeWindow; rollingLabel?: string
}) {
  const open = w.startMs !== null
  const status = statusOf(open, w.fraction)
  return (
    <Card className="gap-0 py-0">
      <SectionHeader
        icon={icon}
        title={title}
        subtitle={subtitle}
        trailing={
          <Badge variant="outline" className={cn('h-5 shrink-0 px-2 text-[11px] font-medium', status.cls)}>
            {status.label}
          </Badge>
        }
      />
      <CardContent className="flex justify-center py-6">
        <UsageGauge title={title} window={w} rollingLabel={rollingLabel} showTitle={false} />
      </CardContent>
    </Card>
  )
}

function PaceCard({ data }: { data: UsageResponse }) {
  const { pace, fiveHour } = data
  const open = fiveHour.startMs !== null
  const capHit = pace.capHitMs
    ? new Date(pace.capHitMs).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    : null
  const onTrack = !capHit
  const projFrac = fiveHour.capUSD > 0
    ? Math.min(pace.projectedAtResetUSD / fiveHour.capUSD, 1)
    : 0

  return (
    <Card className="gap-0 py-0">
      <SectionHeader
        icon={<TrendingUp />}
        title="Burn Pace"
        subtitle="Current 5-hour block"
        trailing={open && (
          <Badge
            variant="outline"
            className={cn(
              'h-5 shrink-0 px-2 text-[11px] font-medium',
              onTrack ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-500' : 'border-red-500/20 bg-red-500/10 text-red-500',
            )}
          >
            {onTrack ? 'On track' : 'At risk'}
          </Badge>
        )}
      />
      <CardContent className="py-6">
        {open ? (
          <div className="space-y-5">
            <div>
              <p className="text-4xl font-bold tabular-nums tracking-tight text-foreground">
                {formatCost(pace.usdPerMin * 60)}
                <span className="text-base font-normal text-muted-foreground">/hr</span>
              </p>
              <p className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">current burn rate</p>
            </div>

            <div className="space-y-2">
              <div className="flex items-baseline justify-between text-xs">
                <span className="text-muted-foreground">Projected at reset</span>
                <span className="font-medium tabular-nums text-foreground">
                  {formatCost(pace.projectedAtResetUSD)} <span className="text-muted-foreground">/ {formatCost(fiveHour.capUSD)}</span>
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${projFrac * 100}%`, backgroundColor: onTrack ? '#34d399' : '#ef4444' }}
                />
              </div>
            </div>

            <p className={cn('text-xs', capHit ? 'text-red-500' : 'text-emerald-500')}>
              {capHit
                ? `On track to hit the cap around ${capHit}.`
                : 'On track to stay under the cap.'}
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No active block — your next message starts a fresh 5-hour window.
          </p>
        )}
      </CardContent>
    </Card>
  )
}

export default function UsagePage() {
  const { data, error, isLoading, mutate } = useSWR<UsageResponse>('/api/usage', fetcher, { refreshInterval: 5_000 })

  return (
    <div className="flex flex-col min-h-screen">
      <TopBar title="Usage" subtitle="Local headroom gauge — estimated, from ~/.claude/" />
      <div className="t-stagger-group p-6 space-y-6">

        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>Error loading usage: {String(error)}</AlertDescription>
          </Alert>
        )}

        {isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-64 rounded-xl" />)}
          </div>
        )}

        {data && (
          <>
            {/* Gauges + pace */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <GaugeCard
                icon={<Clock />}
                title="5-Hour Session"
                subtitle="Rolling session window"
                window={data.fiveHour}
              />
              <GaugeCard
                icon={<CalendarDays />}
                title="7-Day Week"
                subtitle="Weekly allowance"
                window={data.weekly}
                rollingLabel="rolling 7 days"
              />
              <PaceCard data={data} />
            </div>

            {/* Controls */}
            <Card className="gap-0 py-0">
              <SectionHeader
                icon={<Gauge />}
                title="Plan & calibration"
                subtitle="cc-board can't read your real limit — pick a plan for a rough cap, or calibrate against the exact percentage Claude Code shows for numbers that track the official figure."
              />
              <CardContent className="pt-5 pb-6">
                <UsageControls data={data} onChange={() => mutate()} />
              </CardContent>
            </Card>

            {/* Alerts */}
            <Card className="gap-0 py-0">
              <SectionHeader
                icon={<Bell />}
                title="Reset & cap alerts"
                subtitle="Browser notifications while this tab is open."
              />
              <CardContent className="pt-5 pb-6">
                <UsageAlerts data={data} />
              </CardContent>
            </Card>

            {/* Footnotes / pitfalls */}
            <Card className="gap-0 py-0">
              <SectionHeader
                icon={<Info className="text-amber-500" />}
                title="Read this before trusting the numbers"
                subtitle="What this gauge can and can't know."
              />
              <CardContent className="pt-5 pb-6">
                <ul className="space-y-2.5 text-sm text-muted-foreground leading-relaxed">
                  <li><span className="text-foreground font-medium">Estimates, not official limits.</span> Anthropic never writes your plan&apos;s real token/message cap to disk. The percentage is your measured consumption divided by a cap you pick or calibrate — it is not the number Anthropic enforces.</li>
                  <li><span className="text-foreground font-medium">This machine only.</span> Like Claude Code&apos;s own <code className="bg-muted px-1 rounded">/usage</code>, this reads local <code className="bg-muted px-1 rounded">~/.claude/</code> history. Usage from other devices, the web app, or claude.ai is not counted.</li>
                  <li><span className="text-foreground font-medium">Consumption is measured as API-equivalent cost.</span> Cache-read tokens dominate raw token counts and are nearly free, so a cost-weighted proxy tracks &ldquo;how much of your plan you&apos;ve burned&rdquo; far better than a token sum. It still won&apos;t match Anthropic&apos;s opaque internal metering exactly.</li>
                  <li><span className="text-foreground font-medium">The 5-hour reset is computed; the weekly reset is not.</span> The session window opens on your first message and resets 5h later — derivable from timestamps. The weekly reset is a fixed time Anthropic assigns your account and lives only on their servers, so you must pin it once from <code className="bg-muted px-1 rounded">/usage</code>; otherwise the week shows a trailing rolling 7 days.</li>
                  <li><span className="text-foreground font-medium">Calibration drifts.</span> Backing the cap out of a shown percentage is only as fresh as your last calibration, and rounding in the displayed percent adds error. Re-calibrate occasionally, especially after Anthropic changes limits (the 5-hour caps doubled on 2026-05-06).</li>
                </ul>
              </CardContent>
            </Card>

            {/* Roadmap */}
            <Card className="gap-0 py-0">
              <SectionHeader
                icon={<Map className="text-primary" />}
                title="Roadmap"
                subtitle="Where this goes next."
              />
              <CardContent className="pt-5 pb-6">
                <ul className="space-y-2.5 text-sm text-muted-foreground leading-relaxed">
                  <li><span className="inline-block rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-[10px] font-semibold px-1.5 py-0.5 mr-1.5 align-middle">NOW</span> Local, estimate-based gauge with computed 5-hour reset, pinnable weekly reset, calibration, and reset/cap alerts (browser notifications while the tab is open). No account, nothing leaves your machine.</li>
                  <li><span className="inline-block rounded bg-blue-500/15 text-blue-600 dark:text-blue-400 text-[10px] font-semibold px-1.5 py-0.5 mr-1.5 align-middle">NEXT</span> Background pings via a service worker, so resets notify even when the tab is closed; plus usage history and burn-pattern charts.</li>
                  <li><span className="inline-block rounded bg-purple-500/15 text-purple-600 dark:text-purple-400 text-[10px] font-semibold px-1.5 py-0.5 mr-1.5 align-middle">MANAGED</span> Authenticated mode — sign in to read Anthropic&apos;s <span className="text-foreground">official</span> remaining usage and exact reset times via API, replacing the estimate and calibration entirely. Opt-in, off by default.</li>
                </ul>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  )
}
