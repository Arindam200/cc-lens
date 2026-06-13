import { NextResponse } from 'next/server'
import { getRecentTurns, readAccountInfo } from '@/lib/claude-reader'
import { readConfig } from '@/lib/config'
import {
  computeFiveHourBlock,
  computeWeeklyWindow,
  computePace,
  planFromOrgType,
  PLAN_PRESETS,
  SEVEN_DAYS_MS,
} from '@/lib/usage-windows'

export const dynamic = 'force-dynamic'

export async function GET() {
  const now = Date.now()
  const [turns, config, account] = await Promise.all([
    // A small margin past 7 days covers a pinned weekly window that opened
    // slightly earlier than the trailing-7d cutoff.
    getRecentTurns(now - SEVEN_DAYS_MS - 36 * 60 * 60 * 1000),
    readConfig(),
    readAccountInfo(),
  ])

  const detectedPlan = planFromOrgType(account.organizationType)
  const plan = config.usage_plan ?? detectedPlan
  const planAutoDetected = !config.usage_plan

  const preset = plan === 'custom' ? PLAN_PRESETS[detectedPlan] : PLAN_PRESETS[plan]
  const cap5h = config.usage_cap_5h_usd ?? preset.cap5hUSD
  const cap7d = config.usage_cap_7d_usd ?? preset.cap7dUSD

  const fiveHour = computeFiveHourBlock(turns, now, cap5h)
  const weekly = computeWeeklyWindow(turns, now, cap7d, config.usage_weekly_reset_iso)
  const pace = computePace(fiveHour, now)

  return NextResponse.json({
    now,
    plan,
    planAutoDetected,
    detectedPlan,
    account: {
      organizationType: account.organizationType ?? null,
      rateLimitTier: account.rateLimitTier ?? null,
      hasExtraUsageEnabled: account.hasExtraUsageEnabled ?? null,
    },
    caps: {
      cap5hUSD: cap5h,
      cap7dUSD: cap7d,
      cap5hCalibrated: typeof config.usage_cap_5h_usd === 'number',
      cap7dCalibrated: typeof config.usage_cap_7d_usd === 'number',
    },
    weeklyResetPinned: typeof config.usage_weekly_reset_iso === 'string',
    fiveHour,
    weekly,
    pace,
  })
}
