'use client'

import Link from 'next/link'
import { formatCost, formatDuration, formatRelativeDate } from '@/lib/decode'
import { formatEnergy, formatWater, formatCo2 } from '@/lib/impact'
import { categoryColorMix, toolBarColor } from '@/lib/tool-categories'
import type { ProjectSummary } from '@/types/claude'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Clock, MessageSquare, GitBranch, Plug, Bot, Zap, Droplet, Cloud } from 'lucide-react'

// Nightshift: single-accent identity. Languages all wear the same neutral tag —
// the label carries the meaning, not the color.
const LANG_TAG_CLASS = 'bg-[var(--surface-2)] text-muted-foreground border-border'

export function ProjectCard({ project }: { project: ProjectSummary }) {
  const topTools = Object.entries(project.tool_counts ?? {})
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
  const maxToolCount = topTools[0]?.[1] ?? 1

  const topLangs = Object.entries(project.languages ?? {})
    .sort(([, a], [, b]) => b - a)
    .slice(0, 4)

  return (
    <Link href={`/projects/${project.slug}`} className="block group">
      <Card className="h-full gap-0 py-0 hover:border-primary/40 transition-colors overflow-hidden">
        <CardHeader className="px-4 pt-4 pb-3 gap-2">
          {/* Title row */}
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors truncate leading-snug">
              {project.display_name}
            </h3>
            <span className="text-xs text-muted-foreground/60 whitespace-nowrap shrink-0 mt-0.5">
              {formatRelativeDate(project.last_active)}
            </span>
          </div>

          {/* Path */}
          <p className="text-xs text-muted-foreground/50 font-mono truncate -mt-1">
            {project.project_path}
          </p>

          {/* Language + feature badges */}
          <div className="flex flex-wrap gap-1.5">
            {topLangs.map(([lang]) => (
              <Badge key={lang} variant="tag" className={`px-1.5 py-0 h-5 ${LANG_TAG_CLASS}`}>
                {lang}
              </Badge>
            ))}
            {project.uses_mcp && (
              <Badge variant="live" className="px-1.5 py-0 h-5 gap-1">
                <Plug className="w-2.5 h-2.5" /> MCP
              </Badge>
            )}
            {project.uses_task_agent && (
              <Badge variant="live" className="px-1.5 py-0 h-5 gap-1">
                <Bot className="w-2.5 h-2.5" /> Agent
              </Badge>
            )}
            {project.branches.length > 0 && (
              <>
                <span
                  className="h-4 w-px shrink-0 self-center bg-border/50"
                  aria-hidden
                />
                <GitBranch className="h-3 w-3 shrink-0 self-center text-muted-foreground/45" aria-hidden />
                {project.branches.slice(0, 3).map(b => (
                  <Badge
                    key={b}
                    variant="tag"
                    className="h-5 max-w-36 truncate px-1.5 py-0"
                    title={b}
                  >
                    {b}
                  </Badge>
                ))}
                {project.branches.length > 3 && (
                  <span className="self-center text-xs text-muted-foreground/45">
                    +{project.branches.length - 3}
                  </span>
                )}
              </>
            )}
          </div>
        </CardHeader>

        <CardContent className="px-4 pb-4 space-y-3">
          {/* Stats row */}
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <MessageSquare className="w-3 h-3" />
              {project.session_count} sessions
            </span>
            <span className="text-border">·</span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatDuration(project.total_duration_minutes)}
            </span>
            {(project.total_lines_added ?? 0) > 0 && (
              <>
                <span className="text-border">·</span>
                <span className="text-[var(--success)] font-mono tabular-nums">+{project.total_lines_added.toLocaleString()}</span>
                <span className="text-[var(--error)] font-mono tabular-nums">-{project.total_lines_removed.toLocaleString()}</span>
              </>
            )}
          </div>

          {/* Tool bar chart */}
          {topTools.length > 0 && (
            <div className="space-y-1">
              {topTools.map(([tool, count]) => {
                const color = toolBarColor(tool)
                const width = Math.max(8, Math.round((count / maxToolCount) * 100))
                return (
                  <div key={tool} className="flex items-center gap-2 text-xs">
                    <span className="text-muted-foreground/50 w-16 truncate">{tool}</span>
                    <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${width}%`, backgroundColor: categoryColorMix(color, 58) }}
                      />
                    </div>
                    <span className="text-muted-foreground/50 w-7 text-right tabular-nums font-mono">{count}</span>
                  </div>
                )
              })}
            </div>
          )}

          {/* Cost footer */}
          <div className="flex items-center justify-between pt-2 border-t border-border/60">
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground/60">Est. cost</span>
            <span className="text-sm font-bold text-primary tabular-nums font-mono">{formatCost(project.estimated_cost)}</span>
          </div>

          {/* Impact footer — energy / water / CO2 (US grid baseline) */}
          <div className="grid grid-cols-3 gap-2">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground/80" title="Énergie estimée · baseline Opus 4.6 · PUE AWS 1.14">
              <Zap className="w-3 h-3 shrink-0 text-[var(--warning)]" />
              <span className="tabular-nums font-mono truncate">{formatEnergy(project.energy_wh ?? 0)}</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground/80" title="Eau estimée · WUE 1.8 L/kWh">
              <Droplet className="w-3 h-3 shrink-0 text-primary" />
              <span className="tabular-nums font-mono truncate">{formatWater(project.water_ml ?? 0)}</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground/80" title="CO₂ estimé · grid US 0.287 kg/kWh">
              <Cloud className="w-3 h-3 shrink-0 text-[var(--error)]" />
              <span className="tabular-nums font-mono truncate">{formatCo2(project.co2_g ?? 0)}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
