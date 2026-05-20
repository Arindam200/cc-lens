import { NextResponse } from 'next/server'
import { getSessions, listProjectSlugs, resolveProjectPath } from '@/lib/claude-reader'
import { projectDisplayName } from '@/lib/decode'
import { aggregateSkillInvocations } from '@/lib/skill-analytics'
import type { SkillsAnalytics } from '@/types/claude'

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

  const dailyMap = new Map<string, Map<string, number>>() // date → (skill → count)
  const projectAgg = new Map<string, { display: string; total: number; counts: Map<string, number> }>()

  let sessionsWithSkills = 0

  const projectKey = (s: (typeof sessions)[number]) => {
    const slug = pathToSlug.get(s.project_path ?? '') ?? (s.project_path ?? '').replace(/\//g, '-')
    return s.project_path || slug
  }

  const { skills, totalSkillCalls } = aggregateSkillInvocations(sessions, { projectKey })

  for (const s of sessions) {
    const invs = s.skill_invocations ?? {}
    const names = Object.keys(invs)
    if (names.length === 0) continue
    sessionsWithSkills++

    const date = (s.start_time ?? '').slice(0, 10) // YYYY-MM-DD
    const slug = projectKey(s)

    if (!projectAgg.has(slug)) {
      projectAgg.set(slug, {
        display: projectDisplayName(s.project_path ?? slug),
        total: 0,
        counts: new Map(),
      })
    }
    const pa = projectAgg.get(slug)!

    for (const [name, count] of Object.entries(invs)) {
      if (date) {
        if (!dailyMap.has(date)) dailyMap.set(date, new Map())
        const d = dailyMap.get(date)!
        d.set(name, (d.get(name) ?? 0) + count)
      }

      pa.total += count
      pa.counts.set(name, (pa.counts.get(name) ?? 0) + count)
    }
  }

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
