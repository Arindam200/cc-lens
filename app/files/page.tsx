'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { TopBar } from '@/components/layout/top-bar'
import { ChurnOverTimeChart } from '@/components/files/churn-over-time-chart'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AnimatedNumber } from '@/components/ui/animated-number'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { AlertTriangle, FileCode2, FilePlus2, Pencil, Plus, Minus } from 'lucide-react'
import { projectDisplayName } from '@/lib/decode'
import type { FilesAnalytics } from '@/types/claude'

const fetcher = (url: string) =>
  fetch(url).then(r => { if (!r.ok) throw new Error(`API error ${r.status}`); return r.json() })

function StatCard({
  title, value, icon: Icon, accent,
}: {
  title: string; value: number; icon: React.ElementType; accent?: string
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription className="flex items-center gap-2">
          <Icon className="w-4 h-4" /> {title}
        </CardDescription>
        <CardTitle className={`text-3xl font-bold tabular-nums ${accent ?? ''}`}>
          <AnimatedNumber value={value} />
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground">across all sessions</p>
      </CardContent>
    </Card>
  )
}

function RollupBar({
  label, value, max, sub,
}: {
  label: string; value: number; max: number; sub: string
}) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div className="flex items-center gap-3">
      <div className="w-16 shrink-0 text-right font-mono text-xs text-muted-foreground truncate" title={label}>
        {label}
      </div>
      <div className="flex-1 h-5 rounded bg-muted overflow-hidden">
        <div className="h-full rounded bg-primary/80" style={{ width: `${pct}%` }} />
      </div>
      <div className="w-28 shrink-0 font-mono text-[11px] text-muted-foreground/70">{sub}</div>
    </div>
  )
}

export default function FilesPage() {
  const { data, error, isLoading } = useSWR<FilesAnalytics>('/api/files', fetcher, { refreshInterval: 10_000 })
  const [search, setSearch] = useState('')

  const files = data?.files ?? []
  const filtered = search
    ? files.filter(f =>
        f.path.toLowerCase().includes(search.toLowerCase()) ||
        f.project.toLowerCase().includes(search.toLowerCase()))
    : files

  const langMax = Math.max(1, ...(data?.by_language ?? []).map(l => l.churn))
  const projMax = Math.max(1, ...(data?.by_project ?? []).map(p => p.churn))

  return (
    <div className="flex flex-col min-h-screen">
      <TopBar title="Files & Code Churn" subtitle="What Claude Code edited — from Edit/Write calls in your sessions" />
      <div className="t-stagger-group p-4 md:p-6 space-y-6">

        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>Error loading data: {String(error)}</AlertDescription>
          </Alert>
        )}

        {isLoading && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
            </div>
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-48 rounded-xl" />)}
          </div>
        )}

        {data && (
          <>
            {/* Hero stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <StatCard title="Files Touched" value={data.total_files} icon={FileCode2} accent="text-[#d97706]" />
              <StatCard title="Edits" value={data.total_edits} icon={Pencil} />
              <StatCard title="Lines Added" value={data.total_lines_added} icon={Plus} accent="text-emerald-500" />
              <StatCard title="Lines Removed" value={data.total_lines_removed} icon={Minus} accent="text-red-400" />
            </div>

            {/* Churn over time */}
            <Card>
              <CardHeader>
                <CardTitle>Churn Over Time</CardTitle>
                <CardDescription>Approx. lines added vs. removed per day</CardDescription>
              </CardHeader>
              <CardContent>
                <ChurnOverTimeChart data={data.daily} />
              </CardContent>
            </Card>

            {/* Rollups */}
            {(data.by_language.length > 0 || data.by_project.length > 0) && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>By Language</CardTitle>
                    <CardDescription>Churn by file extension</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {data.by_language.slice(0, 10).map(l => (
                      <RollupBar
                        key={l.ext}
                        label={`.${l.ext}`}
                        value={l.churn}
                        max={langMax}
                        sub={`${l.files} file${l.files === 1 ? '' : 's'} · ${l.churn.toLocaleString()}`}
                      />
                    ))}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>By Project</CardTitle>
                    <CardDescription>Churn by project</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {data.by_project.slice(0, 10).map(p => (
                      <RollupBar
                        key={p.project}
                        label={projectDisplayName(p.project)}
                        value={p.churn}
                        max={projMax}
                        sub={`${p.files} file${p.files === 1 ? '' : 's'} · ${p.churn.toLocaleString()}`}
                      />
                    ))}
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Files table */}
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <CardTitle>Most-Edited Files</CardTitle>
                    <CardDescription>Top {files.length} by churn (lines added + removed)</CardDescription>
                  </div>
                  <input
                    className="w-full sm:w-64 rounded-lg border border-border bg-card px-3 py-2 text-sm font-mono outline-none focus:border-primary/40 transition-colors"
                    placeholder="filter by path or project…"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                  />
                </div>
              </CardHeader>
              <CardContent>
                {filtered.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">
                    {files.length === 0
                      ? 'No Edit/Write activity found in ~/.claude/projects/'
                      : 'No files match your filter.'}
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs text-muted-foreground border-b border-border">
                          <th className="py-2 pr-4 font-medium">File</th>
                          <th className="py-2 px-3 font-medium text-right">Edits</th>
                          <th className="py-2 px-3 font-medium text-right">Writes</th>
                          <th className="py-2 px-3 font-medium text-right">+/−</th>
                          <th className="py-2 px-3 font-medium text-right">Sessions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filtered.map(f => (
                          <tr key={f.project + ' ' + f.path} className="border-b border-border/40 hover:bg-muted/30 transition-colors">
                            <td className="py-2 pr-4 min-w-0">
                              <div className="font-mono text-[13px] text-foreground truncate max-w-[360px]" title={f.path}>
                                {f.path}
                              </div>
                              <div className="text-[11px] text-muted-foreground/60 truncate max-w-[360px]" title={f.project}>
                                {projectDisplayName(f.project)}
                              </div>
                            </td>
                            <td className="py-2 px-3 text-right font-mono tabular-nums">{f.edits || ''}</td>
                            <td className="py-2 px-3 text-right font-mono tabular-nums">
                              {f.writes ? <Badge variant="outline" className="font-mono text-[10px]"><FilePlus2 className="h-3 w-3 mr-0.5" />{f.writes}</Badge> : ''}
                            </td>
                            <td className="py-2 px-3 text-right font-mono tabular-nums whitespace-nowrap">
                              <span className="text-emerald-500">+{f.lines_added.toLocaleString()}</span>{' '}
                              <span className="text-red-400">−{f.lines_removed.toLocaleString()}</span>
                            </td>
                            <td className="py-2 px-3 text-right font-mono tabular-nums text-muted-foreground">{f.session_count}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  )
}
