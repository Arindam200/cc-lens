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
  if ('monthly_budget_usd' in body) updates.monthly_budget_usd = body.monthly_budget_usd
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'no recognized settings in body' }, { status: 400 })
  }
  return NextResponse.json(await updateConfig(updates))
}
