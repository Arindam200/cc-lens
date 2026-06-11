import { NextResponse } from 'next/server'
import { getTeamAnalytics } from '@/lib/team-reader'

export const dynamic = 'force-dynamic'

export async function GET() {
  const analytics = await getTeamAnalytics()
  return NextResponse.json(analytics)
}
