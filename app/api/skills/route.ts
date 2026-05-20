import { NextResponse } from 'next/server'
import { getSessions, listProjectSlugs, resolveProjectPath } from '@/lib/claude-reader'
import { projectDisplayName } from '@/lib/decode'
import type { SkillsAnalytics, SkillSummary } from '@/types/claude'

export const dynamic = 'force-dynamic'

export async function GET() {
  const [sessions, slugDirs] = await Promise.all([getSessions(), listProjectSlugs()])

  const pathToSlug = new Map<string, string>()
  await Promise.all(
    slugDirs.map(async (slug) => {
      const resolved = await resolveProjectPath(slug)
      pathToSlug.set(resolved, slug)
    })
  )

  const skillTotals = new Map<string, number>()
  const skillSessions = new Map<string, Set<string>>()
  const skillProjects = new Map<string, Set<string>>()
  const skillFirstSeen = new Map<string, string>()
  const skillLastSeen = new Map<string, string>()

  const dailyMap = new Map<string, Map<string, number>>() // date → (skill → count)
  const projectAgg = new Map<string, { display: string; total: number; counts: Map<string, number> }>()

  let totalSkillCalls = 0
  let sessionsWithSkills = 0

  for (const s of sessions) {
    const invs = s.skill_invocations ?? {}
    const names = Object.keys(invs)
    if (names.length === 0) continue
    sessionsWithSkills++

    const date = (s.start_time ?? '').slice(0, 10) // YYYY-MM-DD
    const slug = pathToSlug.get(s.project_path ?? '') ?? (s.project_path ?? '').replace(/\//g, '-')

    if (!projectAgg.has(slug)) {
      projectAgg.set(slug, {
        display: projectDisplayName(s.project_path ?? slug),
        total: 0,
        counts: new Map(),
      })
    }
    const pa = projectAgg.get(slug)!

    for (const [name, count] of Object.entries(invs)) {
      skillTotals.set(name, (skillTotals.get(name) ?? 0) + count)
      if (!skillSessions.has(name)) skillSessions.set(name, new Set())
      skillSessions.get(name)!.add(s.session_id)
      if (!skillProjects.has(name)) skillProjects.set(name, new Set())
      if (s.project_path) skillProjects.get(name)!.add(s.project_path)
      totalSkillCalls += count

      const ts = s.start_time
      if (ts) {
        if (!skillFirstSeen.has(name) || ts < skillFirstSeen.get(name)!) skillFirstSeen.set(name, ts)
        if (!skillLastSeen.has(name) || ts > skillLastSeen.get(name)!) skillLastSeen.set(name, ts)
      }

      if (date) {
        if (!dailyMap.has(date)) dailyMap.set(date, new Map())
        const d = dailyMap.get(date)!
        d.set(name, (d.get(name) ?? 0) + count)
      }

      pa.total += count
      pa.counts.set(name, (pa.counts.get(name) ?? 0) + count)
    }
  }

  const skills: SkillSummary[] = [...skillTotals.entries()]
    .map(([name, total_calls]) => ({
      name,
      total_calls,
      session_count: skillSessions.get(name)?.size ?? 0,
      project_count: skillProjects.get(name)?.size ?? 0,
      first_seen: skillFirstSeen.get(name) ?? '',
      last_seen: skillLastSeen.get(name) ?? '',
    }))
    .sort((a, b) => b.total_calls - a.total_calls)

  const daily = [...dailyMap.entries()]
    .map(([date, counts]) => {
      const obj: Record<string, number> = {}
      let total = 0
      for (const [name, n] of counts) {
        obj[name] = n
        total += n
      }
      return { date, counts: obj, total }
    })
    .sort((a, b) => a.date.localeCompare(b.date))

  const by_project = [...projectAgg.entries()]
    .map(([slug, p]) => ({
      slug,
      display_name: p.display,
      total_calls: p.total,
      top_skills: [...p.counts.entries()]
        .map(([name, calls]) => ({ name, calls }))
        .sort((a, b) => b.calls - a.calls)
        .slice(0, 5),
    }))
    .sort((a, b) => b.total_calls - a.total_calls)

  const result: SkillsAnalytics = {
    skills,
    total_skill_calls: totalSkillCalls,
    total_sessions_with_skills: sessionsWithSkills,
    daily,
    by_project,
  }

  return NextResponse.json(result)
}
