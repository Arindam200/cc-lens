import { NextResponse } from 'next/server'
import { getAllParsedSessions } from '@/lib/claude-reader'
import { sessionCost } from '@/lib/insights'
import type { SessionWithFacet } from '@/types/claude'

export const dynamic = 'force-dynamic'

export async function GET() {
  const parsed = await getAllParsedSessions()

  const result: SessionWithFacet[] = parsed.map((p) => ({
    ...p,
    estimated_cost: sessionCost(p),
    slug: p.slug_name,
    ai_title: p.ai_title,
    version: p.cc_version,
    git_branch: p.git_branch,
    has_compaction: p.has_compaction,
    has_thinking: p.has_thinking,
  }))

  return NextResponse.json({ sessions: result, total: result.length })
}
