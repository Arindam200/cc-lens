import path from 'path'
import { NextResponse } from 'next/server'
import { getSessions, listProjectJSONLFiles, readJSONLLines, resolveProjectPath } from '@/lib/claude-reader'
import { estimateCostFromUsage } from '@/lib/pricing'
import { projectDisplayName } from '@/lib/decode'
import type { SessionWithFacet } from '@/types/claude'

export const dynamic = 'force-dynamic'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyLine = Record<string, any>

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const projectPath = await resolveProjectPath(slug)
  const allSessions = await getSessions()
  let sessions = allSessions.filter(s => s.project_path === projectPath)

  if (sessions.length === 0) {
    const lastSegment = projectPath.split('/').filter(Boolean).pop() ?? ''
    sessions = allSessions.filter(s =>
      s.project_path?.endsWith('/' + lastSegment)
    )
  }

  // Gather per-session branch data from JSONL
  const files = await listProjectJSONLFiles(slug)
  const branchTurns = new Map<string, number>()
  const sessionMeta = new Map<string, { slug?: string; version?: string; has_compaction?: boolean }>()

  await Promise.all(
    files.map(async (f) => {
      const sessionId = path.basename(f, '.jsonl')
      const meta: { slug?: string; version?: string; has_compaction?: boolean } = {}

      await readJSONLLines(f, (line: AnyLine) => {
        if (!meta.slug && line.slug) meta.slug = line.slug
        if (!meta.version && line.version) meta.version = line.version
        if (line.type === 'system' && line.subtype === 'compact_boundary') meta.has_compaction = true
        if (line.gitBranch && line.gitBranch !== 'HEAD') {
          branchTurns.set(line.gitBranch, (branchTurns.get(line.gitBranch) ?? 0) + 1)
        }
      })

      sessionMeta.set(sessionId, meta)
    })
  )

  const enrichedSessions: SessionWithFacet[] = sessions.map(s => {
    const enrich = sessionMeta.get(s.session_id) ?? {}
    return {
      ...s,
      estimated_cost: estimateCostFromUsage('claude-opus-4-7', {
        input_tokens: s.input_tokens ?? 0,
        output_tokens: s.output_tokens ?? 0,
        cache_creation_input_tokens: s.cache_creation_input_tokens ?? 0,
        cache_read_input_tokens: s.cache_read_input_tokens ?? 0,
      }),
      slug: enrich.slug,
      version: enrich.version,
      has_compaction: enrich.has_compaction,
    }
  })

  // Aggregate tools
  const toolCounts: Record<string, number> = {}
  for (const s of sessions) {
    for (const [t, c] of Object.entries(s.tool_counts ?? {})) {
      toolCounts[t] = (toolCounts[t] ?? 0) + c
    }
  }

  // Cost per session (for chart)
  const costBySession = enrichedSessions.map(s => ({
    session_id: s.session_id,
    start_time: s.start_time,
    cost: s.estimated_cost,
    messages: (s.user_message_count ?? 0) + (s.assistant_message_count ?? 0),
  }))

  const branches = [...branchTurns.entries()]
    .map(([branch, turns]) => ({ branch, turns }))
    .sort((a, b) => b.turns - a.turns)

  return NextResponse.json({
    project_path: projectPath,
    display_name: projectDisplayName(projectPath),
    sessions: enrichedSessions.sort((a, b) => b.start_time.localeCompare(a.start_time)),
    tool_counts: toolCounts,
    cost_by_session: costBySession,
    branches,
  })
}
