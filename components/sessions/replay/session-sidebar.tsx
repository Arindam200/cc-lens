'use client'

import { formatCost, formatTokens, formatDuration, projectDisplayName } from '@/lib/decode'
import type { ReplayData, SessionMeta } from '@/types/claude'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { GitBranch, Clock, FileCode2, Zap, Cpu } from 'lucide-react'

interface Props {
  replay: ReplayData
  meta?: SessionMeta
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
      {children}
    </h3>
  )
}

export function SessionSidebar({ replay, meta }: Props) {
  let totalInput = 0,
    totalOutput = 0,
    totalCacheWrite = 0,
    totalCacheRead = 0
  for (const t of replay.turns) {
    if (t.usage) {
      totalInput += t.usage.input_tokens ?? 0
      totalOutput += t.usage.output_tokens ?? 0
      totalCacheWrite += t.usage.cache_creation_input_tokens ?? 0
      totalCacheRead += t.usage.cache_read_input_tokens ?? 0
    }
  }
  const totalTokens = totalInput + totalOutput + totalCacheWrite + totalCacheRead
  const pct = (n: number) => (totalTokens > 0 ? (n / totalTokens) * 100 : 0)

  const toolCounts = new Map<string, number>()
  for (const t of replay.turns) {
    for (const tc of t.tool_calls ?? []) {
      toolCounts.set(tc.name, (toolCounts.get(tc.name) ?? 0) + 1)
    }
  }
  const topTools = [...toolCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
  const maxToolCount = topTools[0]?.[1] ?? 1

  const assistantTurns = replay.turns.filter(t => t.type === 'assistant')
  const sidechainTurns = replay.turns.filter(t => t.is_sidechain).length

  const tokenBreakdown = [
    { label: 'Input', val: totalInput, color: 'var(--viz-sky)', bg: 'bg-blue-700 dark:bg-blue-400' },
    { label: 'Output', val: totalOutput, color: '#d97706', bg: 'bg-amber-500' },
    { label: 'Cache Write', val: totalCacheWrite, color: '#a78bfa', bg: 'bg-violet-400' },
    { label: 'Cache Read', val: totalCacheRead, color: '#34d399', bg: 'bg-emerald-400' },
  ]

  const showTools = topTools.length > 0
  const showCompactions = replay.compactions.length > 0

  return (
    <div className="text-sm">
      {/* Token breakdown */}
      <section>
        <SectionTitle>
          <span className="inline-flex items-center gap-1.5">
            <Cpu className="h-3.5 w-3.5" /> Token breakdown
          </span>
        </SectionTitle>
        <div className="space-y-3">
          {tokenBreakdown.map(({ label, val, color, bg }) => (
            <div key={label} className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{label}</span>
                <span className="font-mono text-xs font-semibold" style={{ color }}>
                  {formatTokens(val)}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className={`h-full rounded-full ${bg} opacity-70 transition-all`}
                  style={{ width: `${Math.max(2, pct(val))}%` }}
                />
              </div>
            </div>
          ))}
          <div className="flex items-center justify-between border-t border-border/50 pt-3">
            <span className="text-xs font-semibold text-muted-foreground">Total</span>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-foreground">{formatTokens(totalTokens)}</span>
              <span className="font-mono text-xs font-bold text-[#d97706]">{formatCost(replay.total_cost)}</span>
            </div>
          </div>
        </div>
      </section>

      {showTools && (
        <>
          <Separator className="my-5" />
          <section>
            <SectionTitle>Tools used</SectionTitle>
            <div className="space-y-2">
              {topTools.map(([name, count]) => {
                const shortName = name.startsWith('mcp__') ? name.split('__').slice(1).join(' · ') : name
                const width = Math.round((count / maxToolCount) * 100)
                return (
                  <div key={name} className="flex items-center gap-2">
                    <span className="w-24 truncate text-xs text-muted-foreground" title={name}>
                      {shortName}
                    </span>
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-[#d97706]/60" style={{ width: `${width}%` }} />
                    </div>
                    <span className="w-5 text-right text-xs tabular-nums text-muted-foreground/60">{count}</span>
                  </div>
                )
              })}
            </div>
          </section>
        </>
      )}

      {showCompactions && (
        <>
          <Separator className="my-5" />
          <section>
            <SectionTitle>
              <span className="inline-flex items-center gap-1.5">
                <Zap className="h-3.5 w-3.5 text-amber-500" /> Compactions
              </span>
            </SectionTitle>
            <div className="space-y-2.5">
              {replay.compactions.map(c => (
                <div
                  key={c.uuid}
                  className="flex items-start gap-2 rounded-lg border border-amber-500/15 bg-amber-500/5 px-2.5 py-2"
                >
                  <Zap className="mt-0.5 h-3 w-3 shrink-0 text-amber-400" />
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-medium text-amber-300/80">Turn {c.turn_index}</span>
                      <Badge
                        variant="outline"
                        className="h-4 border-amber-500/30 px-1 py-0 text-[11px] text-amber-400/70"
                      >
                        {c.trigger}
                      </Badge>
                    </div>
                    <span className="text-xs text-muted-foreground/60">{formatTokens(c.pre_tokens)} tok before</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </>
      )}

      <Separator className="my-5" />

      <section>
        <SectionTitle>Session info</SectionTitle>
        <div className="space-y-2">
          {replay.slug && (
            <div className="flex items-start gap-2">
              <span className="w-16 shrink-0 text-xs text-muted-foreground/50">Slug</span>
              <span className="break-all text-xs text-foreground/80">{replay.slug}</span>
            </div>
          )}
          {replay.version && (
            <div className="flex items-center gap-2">
              <span className="w-16 shrink-0 text-xs text-muted-foreground/50">Version</span>
              <Badge variant="outline" className="h-4 px-1.5 py-0 font-mono text-[11px]">
                v{replay.version}
              </Badge>
            </div>
          )}
          {replay.git_branch && (
            <div className="flex items-center gap-2">
              <span className="w-16 shrink-0 text-xs text-muted-foreground/50">Branch</span>
              <div className="flex min-w-0 items-center gap-1">
                <GitBranch className="h-3 w-3 shrink-0 text-muted-foreground/40" />
                <span className="truncate font-mono text-xs text-foreground/70">{replay.git_branch}</span>
              </div>
            </div>
          )}
          <div className="flex items-center gap-2">
            <span className="w-16 shrink-0 text-xs text-muted-foreground/50">Turns</span>
            <span className="text-xs font-semibold text-foreground/80">{assistantTurns.length}</span>
          </div>
          {sidechainTurns > 0 && (
            <div className="flex items-center gap-2">
              <span className="w-16 shrink-0 text-xs text-muted-foreground/50">Subagent</span>
              <span className="text-xs font-semibold text-purple-700 dark:text-purple-300">{sidechainTurns} turns</span>
            </div>
          )}
          {meta && (
            <>
              {meta.duration_minutes > 0 && (
                <div className="flex items-center gap-2">
                  <span className="w-16 shrink-0 text-xs text-muted-foreground/50">Duration</span>
                  <span className="flex items-center gap-1 text-xs text-foreground/80">
                    <Clock className="h-3 w-3 text-muted-foreground/40" />
                    {formatDuration(meta.duration_minutes)}
                  </span>
                </div>
              )}
              {meta.project_path && (
                <div className="flex items-start gap-2">
                  <span className="w-16 shrink-0 text-xs text-muted-foreground/50">Project</span>
                  <span className="truncate text-xs text-foreground/70">{projectDisplayName(meta.project_path)}</span>
                </div>
              )}
              {(meta.lines_added ?? 0) > 0 && (
                <div className="flex items-center gap-2">
                  <span className="w-16 shrink-0 text-xs text-muted-foreground/50">Lines</span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-xs text-emerald-400">+{meta.lines_added}</span>
                    <span className="font-mono text-xs text-red-400">-{meta.lines_removed}</span>
                  </div>
                </div>
              )}
              {meta.files_modified > 0 && (
                <div className="flex items-center gap-2">
                  <span className="w-16 shrink-0 text-xs text-muted-foreground/50">Files</span>
                  <span className="flex items-center gap-1 text-xs text-foreground/80">
                    <FileCode2 className="h-3 w-3 text-muted-foreground/40" />
                    {meta.files_modified} modified
                  </span>
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </div>
  )
}
