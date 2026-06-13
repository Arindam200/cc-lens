'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { formatCost, formatTokens } from '@/lib/decode'

export interface GaugeWindow {
  costUSD: number
  totalTokens: number
  turnCount: number
  startMs: number | null
  resetMs: number | null
  capUSD: number
  fraction: number
}

function thresholdColor(fraction: number) {
  if (fraction >= 0.9) return { stroke: '#ef4444', text: 'text-red-500', glow: 'rgba(239,68,68,0.35)' }
  if (fraction >= 0.7) return { stroke: '#f59e0b', text: 'text-amber-500', glow: 'rgba(245,158,11,0.35)' }
  return { stroke: '#34d399', text: 'text-emerald-500', glow: 'rgba(52,211,153,0.30)' }
}

/** Ticking "Xh Ym Zs" until `resetMs`; returns null when there's no fixed reset. */
function useCountdown(resetMs: number | null): string | null {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (resetMs === null) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [resetMs])
  if (resetMs === null) return null
  const ms = Math.max(resetMs - now, 0)
  const s = Math.floor(ms / 1000)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${sec}s`
  return `${sec}s`
}

export function UsageGauge({
  title,
  window: w,
  rollingLabel,
}: {
  title: string
  window: GaugeWindow
  /** Shown under the gauge when there's no fixed reset (rolling 7-day). */
  rollingLabel?: string
}) {
  const open = w.startMs !== null
  const fraction = Math.min(w.fraction, 1)
  const over = w.fraction > 1
  const pct = over ? '100%+' : `${Math.round(w.fraction * 100)}%`
  const c = thresholdColor(w.fraction)
  const countdown = useCountdown(w.resetMs)

  const R = 52
  const STROKE = 11
  const C = 2 * Math.PI * R
  const offset = C * (1 - (open ? fraction : 0))

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="text-sm font-medium text-muted-foreground">{title}</div>

      <div className="relative h-[140px] w-[140px]">
        <svg viewBox="0 0 140 140" className="h-full w-full -rotate-90">
          <circle cx="70" cy="70" r={R} fill="none" strokeWidth={STROKE}
            className="stroke-muted/40" />
          {open && (
            <circle
              cx="70" cy="70" r={R} fill="none" strokeWidth={STROKE} strokeLinecap="round"
              stroke={c.stroke} strokeDasharray={C} strokeDashoffset={offset}
              style={{ transition: 'stroke-dashoffset 0.6s ease, stroke 0.3s', filter: `drop-shadow(0 0 6px ${c.glow})` }}
            />
          )}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {open ? (
            <>
              <span className={cn('text-3xl font-bold tabular-nums', c.text)}>{pct}</span>
              <span className="text-[11px] text-muted-foreground">{over ? 'over est. cap' : 'used'}</span>
            </>
          ) : (
            <>
              <span className="text-xl font-semibold text-emerald-500">Ready</span>
              <span className="text-[11px] text-muted-foreground">window idle</span>
            </>
          )}
        </div>
      </div>

      {/* Reset countdown */}
      <div className="text-center">
        {open && countdown !== null ? (
          <p className="text-sm">
            <span className="font-semibold tabular-nums">{countdown}</span>
            <span className="text-muted-foreground"> to reset</span>
          </p>
        ) : open && countdown === null ? (
          <p className="text-xs text-muted-foreground">{rollingLabel ?? 'trailing window'}</p>
        ) : (
          <p className="text-xs text-muted-foreground">no active window</p>
        )}
      </div>

      {/* Detail line */}
      <div className="flex items-center gap-3 text-xs text-muted-foreground tabular-nums">
        <span><span className="text-foreground font-medium">{formatCost(w.costUSD)}</span> / {formatCost(w.capUSD)}</span>
        <span className="opacity-40">·</span>
        <span>{formatTokens(w.totalTokens)} tok</span>
        <span className="opacity-40">·</span>
        <span>{w.turnCount} turns</span>
      </div>
    </div>
  )
}
