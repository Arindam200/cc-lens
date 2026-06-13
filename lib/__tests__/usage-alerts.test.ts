import { describe, it, expect } from 'vitest'
import { computeActiveAlerts, WARN_FRACTION, URGENT_FRACTION } from '@/lib/usage-alerts'
import type { UsageResponse } from '@/app/usage/page'

const NOW = 1_800_000_000_000

function makeData(over: Partial<UsageResponse> = {}): UsageResponse {
  return {
    now: NOW,
    plan: 'pro',
    planAutoDetected: true,
    detectedPlan: 'pro',
    account: { organizationType: 'claude_pro', rateLimitTier: null, hasExtraUsageEnabled: null },
    caps: { cap5hUSD: 70, cap7dUSD: 1500, cap5hCalibrated: false, cap7dCalibrated: false },
    weeklyResetPinned: false,
    fiveHour: { costUSD: 0, totalTokens: 0, turnCount: 0, startMs: NOW - 60_000, resetMs: NOW + 60_000, capUSD: 70, fraction: 0 },
    weekly: { costUSD: 0, totalTokens: 0, turnCount: 0, startMs: NOW - 1000, resetMs: null, capUSD: 1500, fraction: 0 },
    pace: { usdPerMin: 0, projectedAtResetUSD: 0, capHitMs: null },
    ...over,
  }
}

describe('computeActiveAlerts', () => {
  it('stays quiet below the warn threshold', () => {
    const data = makeData()
    data.fiveHour.fraction = WARN_FRACTION - 0.01
    expect(computeActiveAlerts(data, NOW)).toEqual([])
  })

  it('warns at 80% and escalates to urgent at 95%', () => {
    const warn = makeData()
    warn.fiveHour.fraction = WARN_FRACTION
    const w = computeActiveAlerts(warn, NOW)
    expect(w).toHaveLength(1)
    expect(w[0].id).toMatch(/^cap5h-.*-w$/)
    expect(w[0].urgent).toBeUndefined()

    const urgent = makeData()
    urgent.fiveHour.fraction = URGENT_FRACTION
    const u = computeActiveAlerts(urgent, NOW)
    expect(u[0].id).toMatch(/^cap5h-.*-u$/)
    expect(u[0].urgent).toBe(true)
  })

  it('emits a pace alert only inside the horizon', () => {
    const soon = makeData()
    soon.pace.capHitMs = NOW + 30 * 60_000
    expect(computeActiveAlerts(soon, NOW).some(a => a.id.startsWith('pace5h-'))).toBe(true)

    const far = makeData()
    far.pace.capHitMs = NOW + 90 * 60_000
    expect(computeActiveAlerts(far, NOW).some(a => a.id.startsWith('pace5h-'))).toBe(false)
  })

  it('ignores the 5-hour window when no block is open', () => {
    const data = makeData()
    data.fiveHour.startMs = null
    data.fiveHour.resetMs = null
    data.fiveHour.fraction = 1.5
    expect(computeActiveAlerts(data, NOW).some(a => a.id.startsWith('cap5h-'))).toBe(false)
  })

  it('keys a rolling weekly alert by date so it can re-warn daily', () => {
    const data = makeData()
    data.weekly.fraction = URGENT_FRACTION
    const ids = computeActiveAlerts(data, NOW).map(a => a.id)
    expect(ids.some(id => id.startsWith('cap7d-') && id.includes(new Date(NOW).toISOString().slice(0, 10)))).toBe(true)
  })
})
