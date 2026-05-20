import type { SessionMeta, SkillSummary } from '@/types/claude'

export function aggregateSkillInvocations(
  sessions: SessionMeta[],
  options: { projectKey?: (session: SessionMeta) => string | undefined } = {}
): { skills: SkillSummary[]; totalSkillCalls: number } {
  const skillTotals = new Map<string, number>()
  const skillSessions = new Map<string, Set<string>>()
  const skillProjects = new Map<string, Set<string>>()
  const skillFirstSeen = new Map<string, string>()
  const skillLastSeen = new Map<string, string>()
  let totalSkillCalls = 0

  for (const s of sessions) {
    const invs = s.skill_invocations ?? {}
    for (const [name, count] of Object.entries(invs)) {
      skillTotals.set(name, (skillTotals.get(name) ?? 0) + count)
      if (!skillSessions.has(name)) skillSessions.set(name, new Set())
      skillSessions.get(name)!.add(s.session_id)
      if (!skillProjects.has(name)) skillProjects.set(name, new Set())
      const projectKey = options.projectKey?.(s) ?? s.project_path
      if (projectKey) skillProjects.get(name)!.add(projectKey)
      totalSkillCalls += count

      const ts = s.start_time
      if (ts) {
        if (!skillFirstSeen.has(name) || ts < skillFirstSeen.get(name)!) skillFirstSeen.set(name, ts)
        if (!skillLastSeen.has(name) || ts > skillLastSeen.get(name)!) skillLastSeen.set(name, ts)
      }
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

  return { skills, totalSkillCalls }
}
