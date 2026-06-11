import { NextResponse } from 'next/server'
import { getAllParsedSessions } from '@/lib/claude-reader'
import { redactSessions } from '@/lib/redact'
import type { TeamExportPayload, RedactionLevel } from '@/types/claude'

export const dynamic = 'force-dynamic'

interface TeamExportRequest {
  memberName?: string
  memberEmail?: string
  machine?: string
  redaction?: RedactionLevel
  dateRange?: { from?: string; to?: string }
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as TeamExportRequest

  const name = (body.memberName ?? '').trim()
  if (!name) {
    return NextResponse.json({ error: 'memberName is required' }, { status: 400 })
  }
  const redaction: RedactionLevel = body.redaction === 'titles' ? 'titles' : 'metrics'

  const sessions = await getAllParsedSessions()

  const fromMs = body.dateRange?.from ? new Date(body.dateRange.from).getTime() : null
  const toMs = body.dateRange?.to ? new Date(body.dateRange.to + 'T23:59:59.999Z').getTime() : null
  const filtered = sessions.filter(s => {
    if (!s.start_time) return true
    const t = new Date(s.start_time).getTime()
    if (fromMs !== null && t < fromMs) return false
    if (toMs !== null && t > toMs) return false
    return true
  })

  const ccVersions = Array.from(
    new Set(filtered.map(s => s.cc_version).filter((v): v is string => Boolean(v)))
  ).sort()

  const payload: TeamExportPayload = {
    kind: 'cclens-team-export',
    version: '1.0.0',
    exportedAt: new Date().toISOString(),
    member: {
      name,
      ...(body.memberEmail?.trim() ? { email: body.memberEmail.trim() } : {}),
      ...(body.machine?.trim() ? { machine: body.machine.trim() } : {}),
    },
    redaction,
    cc_versions: ccVersions,
    sessions: redactSessions(filtered, redaction),
  }

  return NextResponse.json(payload)
}
