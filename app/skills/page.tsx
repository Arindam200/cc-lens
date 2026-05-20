'use client'

import useSWR from 'swr'
import Link from 'next/link'
import { TopBar } from '@/components/layout/top-bar'
import { SkillRankingPanel } from '@/components/skills/skill-ranking-panel'
import { SkillTimelineChart } from '@/components/skills/skill-timeline-chart'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { AlertTriangle, Sparkles, Target, FolderOpen } from 'lucide-react'
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
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4" /> Skill Invocations
                  </CardDescription>
                  <CardTitle className="text-3xl font-bold tabular-nums text-[var(--viz-tool-skill)]">
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
                  <CardDescription>Sessions w/ Skills</CardDescription>
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
                  <CardDescription>Top Skill</CardDescription>
                  <CardTitle className="text-xl font-semibold truncate" title={data.skills[0]?.name}>
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

            <Card>
              <CardHeader>
                <CardTitle>Skill Frequency</CardTitle>
                <CardDescription>All skills ranked by total invocations</CardDescription>
              </CardHeader>
              <CardContent>
                <SkillRankingPanel skills={data.skills} />
              </CardContent>
            </Card>

            {data.daily.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Skill Usage Over Time</CardTitle>
                  <CardDescription>Total skill invocations per day (bucketed by session start)</CardDescription>
                </CardHeader>
                <CardContent>
                  <SkillTimelineChart daily={data.daily} />
                </CardContent>
              </Card>
            )}

            {data.by_project.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><FolderOpen className="w-4 h-4" /> Per Project</CardTitle>
                  <CardDescription>Which workflows dominate each project</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {data.by_project.map(p => (
                      <div key={p.slug} className="flex items-start justify-between gap-4 py-2 border-b border-border last:border-0">
                        <div className="min-w-0 flex-1">
                          <Link
                            href={`/projects/${p.slug}`}
                            className="text-sm font-medium hover:underline truncate block"
                            title={p.display_name}
                          >
                            {p.display_name}
                          </Link>
                          <div className="flex flex-wrap gap-1.5 mt-1.5">
                            {p.top_skills.map(s => (
                              <Badge key={s.name} variant="outline" className="text-xs font-mono">
                                {s.name} <span className="ml-1 text-muted-foreground">× {s.calls}</span>
                              </Badge>
                            ))}
                          </div>
                        </div>
                        <span className="text-sm tabular-nums text-muted-foreground whitespace-nowrap pt-1">
                          {p.total_calls.toLocaleString()} calls
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle>Skill Details</CardTitle>
                <CardDescription>Sessions, projects, first and last seen for each skill</CardDescription>
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
                          <td className="py-2 font-mono text-xs">{s.name}</td>
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
