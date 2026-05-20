'use client'

import useSWR from 'swr'
import Link from 'next/link'
import { TopBar } from '@/components/layout/top-bar'
import { SkillRankingPanel } from '@/components/skills/skill-ranking-panel'
import { SkillTimelineChart } from '@/components/skills/skill-timeline-chart'
import { CATEGORY_COLORS, skillColor } from '@/lib/tool-categories'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertTriangle, Sparkles, Target, FolderOpen, Activity, TrendingUp } from 'lucide-react'
import type { SkillsAnalytics } from '@/types/claude'

const fetcher = (url: string) =>
  fetch(url).then(r => { if (!r.ok) throw new Error(`API error ${r.status}`); return r.json() })

export default function SkillsPage() {
  const { data, error, isLoading } = useSWR<SkillsAnalytics>('/api/skills', fetcher, { refreshInterval: 10_000 })

  return (
    <div className="flex flex-col min-h-screen">
      <TopBar title="Skills" subtitle="Slash-command workflows invoked across your sessions" />
      <div className="p-6 space-y-6">

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
            {/* Hero stat cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4" /> Skill Invocations
                  </CardDescription>
                  <CardTitle className="text-3xl font-bold tabular-nums" style={{ color: CATEGORY_COLORS.skill }}>
                    {data.total_skill_calls.toLocaleString()}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">Total slash-command runs</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-2">
                    <Target className="w-4 h-4" /> Unique Skills
                  </CardDescription>
                  <CardTitle className="text-3xl font-bold tabular-nums">
                    {data.skills.length}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">Distinct workflows used</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-2">
                    <Activity className="w-4 h-4" /> Sessions w/ Skills
                  </CardDescription>
                  <CardTitle className="text-3xl font-bold tabular-nums">
                    {data.total_sessions_with_skills.toLocaleString()}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">Sessions that ran ≥1 skill</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4" /> Top Skill
                  </CardDescription>
                  <CardTitle
                    className="text-xl font-semibold truncate font-mono"
                    title={data.skills[0]?.name}
                    style={data.skills[0] ? { color: skillColor(data.skills[0].name) } : undefined}
                  >
                    {data.skills[0]?.name ?? '—'}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">
                    {data.skills[0] ? `${data.skills[0].total_calls.toLocaleString()} calls` : 'No skills yet'}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Skill ranking */}
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle>Skill Frequency</CardTitle>
                    <CardDescription>All skills ranked by total invocations</CardDescription>
                  </div>
                  <Sparkles className="w-4 h-4 text-muted-foreground mt-0.5" />
                </div>
              </CardHeader>
              <CardContent>
                <SkillRankingPanel skills={data.skills} />
              </CardContent>
            </Card>

            {/* Timeline */}
            {data.daily.length > 0 && (
              <Card>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle>Skill Usage Over Time</CardTitle>
                      <CardDescription>Total skill invocations per day (bucketed by session start)</CardDescription>
                    </div>
                    <Activity className="w-4 h-4 text-muted-foreground mt-0.5" />
                  </div>
                </CardHeader>
                <CardContent>
                  <SkillTimelineChart daily={data.daily} />
                </CardContent>
              </Card>
            )}

            {/* Per project — bar style matching /tools Git Branch Analytics */}
            {data.by_project.length > 0 && (
              <Card>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle>Per Project</CardTitle>
                      <CardDescription>Which workflows dominate each project</CardDescription>
                    </div>
                    <FolderOpen className="w-4 h-4 text-muted-foreground mt-0.5" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {data.by_project.map(p => {
                      const max = data.by_project[0]?.total_calls ?? 1
                      const width = Math.max(4, Math.round((p.total_calls / max) * 100))
                      const accent = p.top_skills[0] ? skillColor(p.top_skills[0].name) : CATEGORY_COLORS.skill
                      return (
                        <div key={p.slug} className="space-y-1.5">
                          <div className="flex items-center gap-3">
                            <Link
                              href={`/projects/${p.slug}`}
                              className="text-sm font-medium hover:underline truncate flex-1 min-w-0"
                              title={p.display_name}
                            >
                              {p.display_name}
                            </Link>
                            <span className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                              {p.total_calls.toLocaleString()} calls
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${width}%`,
                                  background: `color-mix(in srgb, ${accent} 70%, transparent)`,
                                }}
                              />
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-1.5 text-xs font-mono">
                            {p.top_skills.map(s => (
                              <span
                                key={s.name}
                                className="inline-flex items-center gap-1.5 rounded-md border px-1.5 py-0.5"
                                style={{
                                  borderColor: `color-mix(in srgb, ${skillColor(s.name)} 40%, transparent)`,
                                  color: skillColor(s.name),
                                }}
                              >
                                <span
                                  className="w-1.5 h-1.5 rounded-full"
                                  style={{ background: skillColor(s.name) }}
                                />
                                {s.name}
                                <span className="text-muted-foreground">×{s.calls}</span>
                              </span>
                            ))}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Detail table */}
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle>Skill Details</CardTitle>
                    <CardDescription>Sessions, projects, first and last seen for each skill</CardDescription>
                  </div>
                  <Target className="w-4 h-4 text-muted-foreground mt-0.5" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-muted-foreground uppercase tracking-wider border-b border-border">
                        <th className="py-2 font-medium">Skill</th>
                        <th className="py-2 font-medium text-right">Calls</th>
                        <th className="py-2 font-medium text-right">Sessions</th>
                        <th className="py-2 font-medium text-right">Projects</th>
                        <th className="py-2 font-medium">First seen</th>
                        <th className="py-2 font-medium">Last seen</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.skills.map(s => (
                        <tr key={s.name} className="border-b border-border last:border-0">
                          <td className="py-2 font-mono text-xs">
                            <span className="inline-flex items-center gap-2">
                              <span
                                className="w-2 h-2 rounded-full shrink-0"
                                style={{ background: skillColor(s.name) }}
                              />
                              {s.name}
                            </span>
                          </td>
                          <td className="py-2 text-right tabular-nums">{s.total_calls.toLocaleString()}</td>
                          <td className="py-2 text-right tabular-nums">{s.session_count}</td>
                          <td className="py-2 text-right tabular-nums">{s.project_count}</td>
                          <td className="py-2 text-xs text-muted-foreground">{s.first_seen.slice(0, 10) || '—'}</td>
                          <td className="py-2 text-xs text-muted-foreground">{s.last_seen.slice(0, 10) || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  )
}
