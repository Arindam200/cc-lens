import { NextResponse } from 'next/server'
import { readStatsCache, getSessions, readHistory } from '@/lib/claude-reader'
import type { ExportPayload, SessionMeta } from '@/types/claude'

export const dynamic = 'force-dynamic'

function filterSessionsByDateRange(
  sessions: SessionMeta[],
  dateRange?: { from?: string; to?: string }
) {
  const fromMs = dateRange?.from ? new Date(dateRange.from).getTime() : null
  const toMs = dateRange?.to ? new Date(dateRange.to + 'T23:59:59.999Z').getTime() : null
  return sessions.filter(s => {
    if (!s.start_time) return true
    const t = new Date(s.start_time).getTime()
    if (fromMs !== null && t < fromMs) return false
    if (toMs !== null && t > toMs) return false
    return true
  })
}

/** Preview counts for the export UI (optional date filter via query params). */
export async function GET(req: Request) {
  const url = new URL(req.url)
  const from = url.searchParams.get('from') || undefined
  const to = url.searchParams.get('to') || undefined
  const dateRange = from || to ? { from, to } : undefined

  const [stats, sessions, history] = await Promise.all([
    readStatsCache(),
    getSessions(),
    readHistory(10_000),
  ])

  const filteredSessions = filterSessionsByDateRange(sessions, dateRange)

  return NextResponse.json({
    sessionCount: filteredSessions.length,
    historyEntries: history.length,
    hasStatsCache: stats !== null,
    totalSessionsIndexed: sessions.length,
  })
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const { dateRange } = body as { dateRange?: { from?: string; to?: string } }

  const [stats, sessions, history] = await Promise.all([
    readStatsCache(),
    getSessions(),
    readHistory(10_000),
  ])

  const filteredSessions = filterSessionsByDateRange(sessions, dateRange)

  // facets stays in the payload (empty) so older importers keep working
  const payload: ExportPayload = {
    exportedAt: new Date().toISOString(),
    version: '1.0.0',
    stats,
    sessions: filteredSessions,
    facets: [],
    history,
  }

  return NextResponse.json(payload)
}
