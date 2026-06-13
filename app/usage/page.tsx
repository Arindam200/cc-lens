'use client'

import useSWR from 'swr'
import { TopBar } from '@/components/layout/top-bar'
import { UsageGauge, type GaugeWindow } from '@/components/usage/usage-gauge'
import { UsageControls } from '@/components/usage/usage-controls'
import { UsageAlerts } from '@/components/usage/usage-alerts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { formatCost } from '@/lib/decode'
import { AlertTriangle, Gauge, TrendingUp, Info, Map } from 'lucide-react'

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

function PaceCard({ data }: { data: UsageResponse }) {
  const { pace, fiveHour } = data
  const open = fiveHour.startMs !== null
  const capHit = pace.capHitMs
    ? new Date(pace.capHitMs).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    : null
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4" /> Pace (5-hour block)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-1.5">
        {open ? (
          <>
            <p className="text-2xl font-bold tabular-nums text-foreground">
              {formatCost(pace.usdPerMin * 60)}<span className="text-sm font-normal text-muted-foreground">/hr</span>
            </p>
            <p className="text-xs text-muted-foreground">
              At this rate: <span className="text-foreground font-medium tabular-nums">{formatCost(pace.projectedAtResetUSD)}</span> by reset
              {' '}(cap {formatCost(fiveHour.capUSD)}).
            </p>
            {capHit ? (
              <p className="text-xs text-red-500">⚠ On track to hit the cap around {capHit}.</p>
            ) : (
              <p className="text-xs text-emerald-500">✓ On track to stay under the cap.</p>
            )}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">No active block — your next message starts a fresh 5-hour window.</p>
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
      <div className="p-6 space-y-6">

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
              <Card>
                <CardContent className="pt-6">
                  <UsageGauge title="5-Hour Session" window={data.fiveHour} />
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <UsageGauge
                    title="7-Day Week"
                    window={data.weekly}
                    rollingLabel="rolling 7 days"
                  />
                </CardContent>
              </Card>
              <PaceCard data={data} />
            </div>

            {/* Controls */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Gauge className="w-4 h-4" /> Plan &amp; calibration</CardTitle>
                <CardDescription>
                  cc-board can&apos;t read your real limit — pick a plan for a rough cap, or calibrate against the exact percentage
                  Claude Code shows for numbers that track the official figure.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <UsageControls data={data} onChange={() => mutate()} />
              </CardContent>
            </Card>

            {/* Alerts */}
            <Card>
              <CardContent className="pt-6">
                <UsageAlerts data={data} />
              </CardContent>
            </Card>

            {/* Footnotes / pitfalls */}
            <Card className="border-amber-500/30">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base"><Info className="w-4 h-4 text-amber-500" /> Read this before trusting the numbers</CardTitle>
                <CardDescription>What this gauge can and can&apos;t know.</CardDescription>
              </CardHeader>
              <CardContent>
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
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base"><Map className="w-4 h-4 text-[#d97706]" /> Roadmap</CardTitle>
                <CardDescription>Where this goes next.</CardDescription>
              </CardHeader>
              <CardContent>
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
