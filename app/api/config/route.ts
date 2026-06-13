import { NextResponse } from 'next/server'
import { readConfig, updateConfig, isCanonicalUtcIso } from '@/lib/config'

export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json(await readConfig())
}

export async function PUT(req: Request) {
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 })
  }
  const updates: Record<string, unknown> = {}
  if ('monthly_budget_usd' in body) {
    const value = body.monthly_budget_usd
    if (value !== null && (typeof value !== 'number' || !Number.isFinite(value) || value < 0)) {
      return NextResponse.json(
        { error: 'monthly_budget_usd must be a non-negative number or null' },
        { status: 400 }
      )
    }
    updates.monthly_budget_usd = value
  }
  if ('usage_plan' in body) {
    const value = body.usage_plan
    if (value !== null && !['pro', 'max5x', 'max20x', 'custom'].includes(value as string)) {
      return NextResponse.json(
        { error: 'usage_plan must be one of pro, max5x, max20x, custom, or null' },
        { status: 400 }
      )
    }
    updates.usage_plan = value
  }
  for (const key of ['usage_cap_5h_usd', 'usage_cap_7d_usd'] as const) {
    if (key in body) {
      const value = body[key]
      if (value !== null && (typeof value !== 'number' || !Number.isFinite(value) || value <= 0)) {
        return NextResponse.json(
          { error: `${key} must be a positive number or null` },
          { status: 400 }
        )
      }
      updates[key] = value
    }
  }
  if ('usage_weekly_reset_iso' in body) {
    const value = body.usage_weekly_reset_iso
    if (value !== null && !isCanonicalUtcIso(value)) {
      return NextResponse.json(
        { error: 'usage_weekly_reset_iso must be a canonical UTC ISO-8601 string (e.g. 2026-06-17T01:29:00.000Z) or null' },
        { status: 400 }
      )
    }
    updates.usage_weekly_reset_iso = value
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'no recognized settings in body' }, { status: 400 })
  }
  return NextResponse.json(await updateConfig(updates))
}
