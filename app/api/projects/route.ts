import { NextResponse } from 'next/server'
import { getSessions, listProjectSlugs, listProjectJSONLFiles, readJSONLLines, resolveProjectPath } from '@/lib/claude-reader'
import { estimateCostFromUsage } from '@/lib/pricing'
import { projectDisplayName } from '@/lib/decode'
import type { ProjectSummary } from '@/types/claude'

export const dynamic = 'force-dynamic'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyLine = Record<string, any>

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

  // Gather branches per slug from JSONL
  const slugBranches = new Map<string, Set<string>>()
  await Promise.all(
    slugDirs.map(async (slug) => {
      const files = await listProjectJSONLFiles(slug)
      const branches = new Set<string>()
      await Promise.all(
        files.map(async (f) => {
          await readJSONLLines(f, (line: AnyLine) => {
            if (line.gitBranch && line.gitBranch !== 'HEAD') {
              branches.add(line.gitBranch)
            }
          })
        })
      )
      slugBranches.set(slug, branches)
    })
  )

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

    const estimatedCost = sessionList.reduce((sum, s) => {
      return sum + estimateCostFromUsage('claude-opus-4-7', {
        input_tokens: s.input_tokens ?? 0,
        output_tokens: s.output_tokens ?? 0,
        cache_creation_input_tokens: s.cache_creation_input_tokens ?? 0,
        cache_read_input_tokens: s.cache_read_input_tokens ?? 0,
      })
    }, 0)

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
