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

  // Parsed-JSONL sessions emit placeholder zeros/empties for fields they don't
  // compute (languages, git stats, line counts, tool errors, response times).
  // Keep `p` for JSONL-fresh fields and overlay only the meta-only fields when
  // present, so real meta values aren't clobbered by placeholders.
  const result = parsed.map((p) => {
    const meta = metaMap.get(p.session_id)
    const merged: SessionMeta = meta
      ? {
          ...p,
          languages:             Object.keys(meta.languages ?? {}).length ? meta.languages : p.languages,
          git_commits:           meta.git_commits           || p.git_commits,
          git_pushes:            meta.git_pushes            || p.git_pushes,
          user_interruptions:    meta.user_interruptions    || p.user_interruptions,
          user_response_times:   meta.user_response_times?.length ? meta.user_response_times : p.user_response_times,
          tool_errors:           meta.tool_errors           || p.tool_errors,
          tool_error_categories: Object.keys(meta.tool_error_categories ?? {}).length ? meta.tool_error_categories : p.tool_error_categories,
          lines_added:           meta.lines_added           || p.lines_added,
          lines_removed:         meta.lines_removed         || p.lines_removed,
          files_modified:        meta.files_modified        || p.files_modified,
        }
      : p
    return toSessionWithFacet(merged, p, facetMap.get(p.session_id))
  })

  return NextResponse.json({ sessions: result, total: result.length })
}
