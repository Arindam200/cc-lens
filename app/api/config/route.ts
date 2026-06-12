import { NextResponse } from 'next/server'
import { readConfig, updateConfig } from '@/lib/config'

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
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'no recognized settings in body' }, { status: 400 })
  }
  return NextResponse.json(await updateConfig(updates))
}
