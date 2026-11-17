import { NextResponse } from 'next/server'
import { getSessionSnapshot } from '@/lib/claude-reader'
import { sessionCost } from '@/lib/insights'
import type { SessionWithFacet } from '@/types/claude'

export const dynamic = 'force-dynamic'

export async function GET() {
  const parsed = await getSessionSnapshot()

  // user_message_timestamps has one entry per user message (the bulk of this
  // payload) and no client of this route reads it; server routes use the parsed
  // sessions directly.
  const result: SessionWithFacet[] = parsed.map((p) => ({
    ...p,
    user_message_timestamps: [],
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
