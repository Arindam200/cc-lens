import { NextResponse } from 'next/server'
import {
  getAllParsedSessions,
  readAllSessionMeta,
  readAllFacets,
  type ParsedSession,
} from '@/lib/claude-reader'
import { estimateCostFromUsage } from '@/lib/pricing'
import type { SessionMeta, SessionWithFacet, Facet } from '@/types/claude'

export const dynamic = 'force-dynamic'

function toSessionWithFacet(
  s: SessionMeta,
  enrich: ParsedSession | undefined,
  facet: Facet | undefined,
): SessionWithFacet {
  const estimated_cost = estimateCostFromUsage('claude-opus-4-7', {
    input_tokens: s.input_tokens ?? 0,
    output_tokens: s.output_tokens ?? 0,
    cache_creation_input_tokens: s.cache_creation_input_tokens ?? 0,
    cache_read_input_tokens: s.cache_read_input_tokens ?? 0,
  })
  return {
    ...s,
    facet,
    estimated_cost,
    slug: enrich?.slug_name,
    version: enrich?.cc_version,
    git_branch: enrich?.git_branch,
    has_compaction: enrich?.has_compaction ?? false,
    has_thinking: enrich?.has_thinking ?? false,
  }
}

export async function GET() {
  const [parsed, metaSessions, facets] = await Promise.all([
    getAllParsedSessions(),
    readAllSessionMeta(),
    readAllFacets(),
  ])

  const metaMap = new Map(metaSessions.map((s) => [s.session_id, s]))
  const facetMap = new Map(facets.map(f => [f.session_id, f]))

  if (parsed.length === 0) {
    const result = metaSessions.map((s) =>
      toSessionWithFacet(s, undefined, facetMap.get(s.session_id))
    )
    return NextResponse.json({ sessions: result, total: result.length })
  }

  const result = parsed.map((p) => {
    const meta = metaMap.get(p.session_id)
    const merged: SessionMeta = meta ? { ...meta, ...p } : p
    return toSessionWithFacet(merged, p, facetMap.get(p.session_id))
  })

  return NextResponse.json({ sessions: result, total: result.length })
}
