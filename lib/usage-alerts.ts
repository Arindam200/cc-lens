import type { UsageResponse } from '@/app/usage/page'

// Pure alert logic for the usage gauge. Given the current /api/usage payload it
// returns the alerts whose conditions hold *right now*; the component layer is
// responsible for firing each one at most once (dedupe) and for reset pings,
// which are transitions rather than instantaneous conditions.

export interface AlertDef {
  /** Stable id embedding the window instance, so it fires once per window. */
  id: string
  title: string
  body: string
  urgent?: boolean
}

/** Warn at 80% of the (estimated) cap, escalate at 95%. */
export const WARN_FRACTION = 0.8
export const URGENT_FRACTION = 0.95
/** Pace ping fires when the cap is on track to be hit within this horizon. */
export const PACE_HORIZON_MS = 45 * 60 * 1000

function fmtTime(ms: number): string {
  return new Date(ms).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

function capAlert(prefix: string, label: string, fraction: number, instance: string): AlertDef | null {
  const pct = Math.round(fraction * 100)
  if (fraction >= URGENT_FRACTION) {
    return {
      id: `${prefix}-${instance}-u`,
      title: `${label} almost at cap`,
      body: `You've used ${pct}% of your estimated ${label.toLowerCase()} cap.`,
      urgent: true,
    }
  }
  if (fraction >= WARN_FRACTION) {
    return {
      id: `${prefix}-${instance}-w`,
      title: `${label} at ${pct}%`,
      body: `You've used ${pct}% of your estimated ${label.toLowerCase()} cap.`,
    }
  }
  return null
}

/** Cap-threshold and pace alerts implied by the current payload. */
export function computeActiveAlerts(data: UsageResponse, nowMs: number): AlertDef[] {
  const out: AlertDef[] = []

  const b = data.fiveHour
  if (b.startMs !== null && b.resetMs !== null) {
    const inst = String(b.resetMs)
    const cap = capAlert('cap5h', '5-hour window', b.fraction, inst)
    if (cap) out.push(cap)
    if (data.pace.capHitMs && data.pace.capHitMs > nowMs && data.pace.capHitMs - nowMs <= PACE_HORIZON_MS) {
      const mins = Math.max(Math.round((data.pace.capHitMs - nowMs) / 60_000), 1)
      out.push({
        id: `pace5h-${inst}`,
        title: 'On pace to hit your 5-hour cap',
        body: `At this rate you'll reach the cap around ${fmtTime(data.pace.capHitMs)} (~${mins} min).`,
        urgent: true,
      })
    }
  }

  const w = data.weekly
  // Pinned weekly window keys by its reset; a rolling window has no reset, so it
  // keys by date and can re-warn at most once a day.
  const inst = w.resetMs !== null ? String(w.resetMs) : new Date(nowMs).toISOString().slice(0, 10)
  const cap = capAlert('cap7d', 'Weekly window', w.fraction, inst)
  if (cap) out.push(cap)

  return out
}
