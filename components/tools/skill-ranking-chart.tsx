'use client'

import { CATEGORY_COLORS, categoryColorMix } from '@/lib/tool-categories'
import type { SkillSummary } from '@/types/claude'

const SKILL_COLOR = CATEGORY_COLORS['skill']

export function SkillRankingChart({ skills }: { skills: SkillSummary[] }) {
  if (skills.length === 0) {
    return <p className="text-sm text-muted-foreground">No skills invoked yet.</p>
  }

  const max = Math.max(1, skills[0]?.total_calls ?? 1)

  return (
    <div className="space-y-2">
      {skills.map(({ name, total_calls, session_count }) => {
        const width = Math.max(4, Math.round((total_calls / max) * 100))
        return (
          <div key={name} className="flex items-center gap-3">
            <span className="text-sm w-40 truncate font-mono" title={name}>/{name}</span>
            <div className="flex-1 h-2.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{ width: `${width}%`, backgroundColor: categoryColorMix(SKILL_COLOR, 60) }}
              />
            </div>
            <span className="text-sm tabular-nums w-10 text-right" style={{ color: SKILL_COLOR }}>
              {total_calls.toLocaleString()}
            </span>
            <span className="text-xs text-muted-foreground tabular-nums w-24 text-right">
              {session_count} {session_count === 1 ? 'session' : 'sessions'}
            </span>
          </div>
        )
      })}
    </div>
  )
}
