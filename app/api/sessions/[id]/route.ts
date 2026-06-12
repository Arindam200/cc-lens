import { NextResponse } from 'next/server'
import { getAllParsedSessions } from '@/lib/claude-reader'
import { sessionCost } from '@/lib/insights'

export const dynamic = 'force-dynamic'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const resolved = (await getAllParsedSessions()).find(s => s.session_id === id) ?? null

  if (!resolved) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 })
  }

  const estimated_cost = sessionCost(resolved)

  return NextResponse.json({
    session: {
      ...resolved,
      estimated_cost,
      slug: resolved.slug_name,
      ai_title: resolved.ai_title,
      version: resolved.cc_version,
      git_branch: resolved.git_branch,
    },
  })
}
