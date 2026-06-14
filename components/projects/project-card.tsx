'use client'

import Link from 'next/link'
import { formatCost, formatDuration, formatRelativeDate } from '@/lib/decode'
import { categoryColorMix, toolBarColor } from '@/lib/tool-categories'
import type { ProjectSummary } from '@/types/claude'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { GitBranch, Plug, Bot, ArrowUpRight } from 'lucide-react'

const LANG_COLORS: Record<string, string> = {
  TypeScript:  'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/25',
  JavaScript:  'bg-yellow-400/10 text-yellow-700 dark:text-yellow-400 border-yellow-400/30',
  Python:      'bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/25',
  Rust:        'bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/25',
  Go:          'bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border-cyan-500/25',
  Java:        'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/25',
  'C++':       'bg-pink-500/10 text-pink-700 dark:text-pink-400 border-pink-500/25',
  C:           'bg-slate-500/10 text-slate-700 dark:text-slate-400 border-slate-500/25',
  'C#':        'bg-violet-500/10 text-violet-700 dark:text-violet-400 border-violet-500/25',
  Ruby:        'bg-red-400/10 text-red-600 dark:text-red-400 border-red-400/25',
  PHP:         'bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-500/25',
  Swift:       'bg-orange-400/10 text-orange-600 dark:text-orange-400 border-orange-400/25',
  Kotlin:      'bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/25',
  CSS:         'bg-blue-700/10 dark:bg-sky-500/10 text-blue-700 dark:text-sky-400 border-blue-700/25 dark:border-sky-500/25',
  HTML:        'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/25',
  Shell:       'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/25',
  Bash:        'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/25',
  Markdown:    'bg-gray-400/10 text-gray-600 dark:text-gray-400 border-gray-400/25',
  JSON:        'bg-amber-400/10 text-amber-700 dark:text-amber-400 border-amber-400/25',
  YAML:        'bg-lime-500/10 text-lime-700 dark:text-lime-500 border-lime-500/25',
}

const FALLBACK_PALETTE = [
  'bg-teal-500/10 text-teal-700 dark:text-teal-400 border-teal-500/25',
  'bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-400 border-fuchsia-500/25',
  'bg-lime-500/10 text-lime-700 dark:text-lime-400 border-lime-500/25',
  'bg-blue-700/10 dark:bg-sky-600/10 text-blue-700 dark:text-sky-400 border-blue-700/25 dark:border-sky-600/25',
  'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/25',
  'bg-amber-600/10 text-amber-700 dark:text-amber-400 border-amber-600/25',
]

function langColor(lang: string): string {
  if (LANG_COLORS[lang]) return LANG_COLORS[lang]
  let hash = 0
  for (let i = 0; i < lang.length; i++) hash = (hash * 31 + lang.charCodeAt(i)) >>> 0
  return FALLBACK_PALETTE[hash % FALLBACK_PALETTE.length]
}

export function ProjectCard({ project }: { project: ProjectSummary }) {
  const topTools = Object.entries(project.tool_counts ?? {})
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
  const toolTotal = topTools.reduce((sum, [, c]) => sum + c, 0) || 1

  const topLangs = Object.entries(project.languages ?? {})
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)

  const linesAdded = project.total_lines_added ?? 0
  const linesRemoved = project.total_lines_removed ?? 0

  return (
    <Link href={`/projects/${project.slug}`} className="group block">
      <Card className="h-full gap-0 overflow-hidden py-0 transition-all duration-200 hover:border-primary/40 hover:shadow-md">
        <CardHeader className="gap-2.5 px-4 pt-4 pb-3">
          {/* Title row */}
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="flex items-center gap-1 truncate text-[15px] font-semibold leading-snug text-foreground transition-colors group-hover:text-primary">
                {project.display_name}
                <ArrowUpRight className="size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
              </h3>
              <p className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground/70">
                {project.project_path}
              </p>
            </div>
            <span className="shrink-0 whitespace-nowrap text-[11px] text-muted-foreground">
              {formatRelativeDate(project.last_active)}
            </span>
          </div>

          {/* Language + feature badges */}
          <div className="flex flex-wrap items-center gap-1.5">
            {topLangs.map(([lang]) => (
              <Badge key={lang} variant="outline" className={`h-5 px-1.5 py-0 text-[11px] font-medium ${langColor(lang)}`}>
                {lang}
              </Badge>
            ))}
            {project.uses_mcp && (
              <Badge variant="outline" className="h-5 gap-1 border-blue-500/20 bg-blue-500/10 px-1.5 py-0 text-[11px] text-blue-500">
                <Plug className="size-2.5" /> MCP
              </Badge>
            )}
            {project.uses_task_agent && (
              <Badge variant="outline" className="h-5 gap-1 border-purple-500/20 bg-purple-500/10 px-1.5 py-0 text-[11px] text-purple-500">
                <Bot className="size-2.5" /> Agent
              </Badge>
            )}
            {project.branches.length > 0 && (
              <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                <GitBranch className="size-3 shrink-0" aria-hidden />
                <span className="max-w-28 truncate font-mono" title={project.branches.join(', ')}>
                  {project.branches[0]}
                </span>
                {project.branches.length > 1 && (
                  <span className="text-muted-foreground/60">+{project.branches.length - 1}</span>
                )}
              </span>
            )}
          </div>
        </CardHeader>

        <CardContent className="flex flex-col gap-3 px-4 pb-4">
          {/* Key metrics strip */}
          <div className="grid grid-cols-3 divide-x divide-border rounded-lg border border-border bg-muted/30">
            <Metric label="Sessions" value={project.session_count.toLocaleString()} />
            <Metric label="Time" value={formatDuration(project.total_duration_minutes)} />
            <Metric label="Est. cost" value={formatCost(project.estimated_cost)} accent />
          </div>

          {/* Tool distribution — single stacked bar + legend */}
          {topTools.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-muted">
                {topTools.map(([tool, count]) => (
                  <div
                    key={tool}
                    title={`${tool}: ${count.toLocaleString()}`}
                    style={{
                      width: `${(count / toolTotal) * 100}%`,
                      backgroundColor: categoryColorMix(toolBarColor(tool), 60),
                    }}
                  />
                ))}
              </div>
              <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                <span className="truncate">{topTools.map(([t]) => t).join(' · ')}</span>
                {linesAdded + linesRemoved > 0 && (
                  <span className="shrink-0 font-mono tabular-nums">
                    <span className="text-emerald-500">+{linesAdded.toLocaleString()}</span>{' '}
                    <span className="text-rose-400">−{linesRemoved.toLocaleString()}</span>
                  </span>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  )
}

function Metric({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5 px-3 py-2">
      <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className={`truncate text-sm font-semibold tabular-nums ${accent ? 'text-primary' : 'text-foreground'}`}>
        {value}
      </span>
    </div>
  )
}
