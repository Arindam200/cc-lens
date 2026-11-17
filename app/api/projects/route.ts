import { NextResponse } from 'next/server'
import { getSessions, listProjectSlugs, resolveProjectPath, type ParsedSession } from '@/lib/claude-reader'
import { sessionCost } from '@/lib/insights'
import { projectDisplayName } from '@/lib/decode'
import type { ProjectSummary } from '@/types/claude'

export const dynamic = 'force-dynamic'

export async function GET() {
  const [sessions, slugDirs] = await Promise.all([getSessions(), listProjectSlugs()])

  // Build path→slug lookup from actual project directories
  const pathToSlugMap = new Map<string, string>()
  await Promise.all(
    slugDirs.map(async (slug) => {
      const resolved = await resolveProjectPath(slug)
      pathToSlugMap.set(resolved, slug)
    })
  )

  // Group sessions by project_path
  const byPath = new Map<string, typeof sessions>()
  for (const s of sessions) {
    const pp = s.project_path ?? ''
    if (!byPath.has(pp)) byPath.set(pp, [])
    byPath.get(pp)!.push(s)
  }

  // Branches come from the shared session parse (no second JSONL scan)
  const slugBranches = new Map<string, Set<string>>()
  for (const s of sessions as ParsedSession[]) {
    if (!s.project_slug || !s.git_branches?.length) continue
    const set = slugBranches.get(s.project_slug) ?? new Set<string>()
    for (const b of s.git_branches) set.add(b)
    slugBranches.set(s.project_slug, set)
  }

  const projects: ProjectSummary[] = []

  for (const [projectPath, sessionList] of byPath.entries()) {
    const slug = pathToSlugMap.get(projectPath) ?? projectPath.replace(/\//g, '-')

    const totalMessages = sessionList.reduce(
      (s, m) => s + (m.user_message_count ?? 0) + (m.assistant_message_count ?? 0), 0
    )
    const totalDuration = sessionList.reduce((s, m) => s + (m.duration_minutes ?? 0), 0)
    const totalLinesAdded = sessionList.reduce((s, m) => s + (m.lines_added ?? 0), 0)
    const totalLinesRemoved = sessionList.reduce((s, m) => s + (m.lines_removed ?? 0), 0)
    const totalFilesModified = sessionList.reduce((s, m) => s + (m.files_modified ?? 0), 0)
    const gitCommits = sessionList.reduce((s, m) => s + (m.git_commits ?? 0), 0)
    const gitPushes = sessionList.reduce((s, m) => s + (m.git_pushes ?? 0), 0)
    const inputTokens = sessionList.reduce((s, m) => s + (m.input_tokens ?? 0), 0)
    const outputTokens = sessionList.reduce((s, m) => s + (m.output_tokens ?? 0), 0)

    const estimatedCost = sessionList.reduce((sum, s) => sum + sessionCost(s), 0)

    const languages: Record<string, number> = {}
    for (const s of sessionList) {
      for (const [lang, count] of Object.entries(s.languages ?? {})) {
        languages[lang] = (languages[lang] ?? 0) + count
      }
    }

    const toolCounts: Record<string, number> = {}
    for (const s of sessionList) {
      for (const [tool, count] of Object.entries(s.tool_counts ?? {})) {
        toolCounts[tool] = (toolCounts[tool] ?? 0) + count
      }
    }

    const sortedDates = sessionList.map(s => s.start_time).sort()

    projects.push({
      slug,
      project_path: projectPath,
      display_name: projectDisplayName(projectPath),
      session_count: sessionList.length,
      total_messages: totalMessages,
      total_duration_minutes: totalDuration,
      total_lines_added: totalLinesAdded,
      total_lines_removed: totalLinesRemoved,
      total_files_modified: totalFilesModified,
      git_commits: gitCommits,
      git_pushes: gitPushes,
      estimated_cost: estimatedCost,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      languages,
      tool_counts: toolCounts,
      last_active: sortedDates[sortedDates.length - 1] ?? '',
      first_active: sortedDates[0] ?? '',
      uses_mcp: sessionList.some(s => s.uses_mcp),
      uses_task_agent: sessionList.some(s => s.uses_task_agent),
      branches: [...(slugBranches.get(slug) ?? new Set())].slice(0, 10),
    })
  }

  return NextResponse.json({
    projects: projects.sort((a, b) => b.last_active.localeCompare(a.last_active)),
  })
}
