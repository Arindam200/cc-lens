'use client'

import { useMemo } from 'react'
import useSWR from 'swr'
import Link from 'next/link'
import { AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from 'recharts'
import { TopBar } from '@/components/layout/top-bar'
import { formatCost, formatTokens, formatDuration, formatRelativeDate } from '@/lib/decode'
import type { TeamAnalytics } from '@/types/claude'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Users, DollarSign, MessageSquare, TrendingDown, AlertTriangle, FolderOpen, GitBranch } from 'lucide-react'

const fetcher = (url: string) =>
  fetch(url).then(r => { if (!r.ok) throw new Error(`API error ${r.status}`); return r.json() })

const MEMBER_COLORS = ['#d97706', '#60a5fa', '#34d399', '#a78bfa', '#f472b6', '#fbbf24', '#22d3ee', '#fb7185']

export default function TeamPage() {
  const { data, error, isLoading } = useSWR<TeamAnalytics>('/api/team', fetcher, { refreshInterval: 30_000 })

  const memberNames = useMemo(
    () => (data ? Array.from(new Set(data.members.map(m => m.member.name))) : []),
    [data]
  )
  const colorFor = (name: string) => MEMBER_COLORS[memberNames.indexOf(name) % MEMBER_COLORS.length]

  const chartData = useMemo(() => {
    if (!data) return []
    return data.daily.map(d => ({
      date: d.date.slice(5),
      ...Object.fromEntries(memberNames.map(n => [n, d.cost_by_member[n] ?? 0])),
    }))
  }, [data, memberNames])

  const empty = data && data.members.length === 0

  return (
    <div className="flex flex-col min-h-screen">
      <TopBar title="Team" subtitle="Aggregated from member exports — no server, no accounts" />
      <div className="p-6 space-y-6">

        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>Error loading team data: {String(error)}</AlertDescription>
          </Alert>
        )}

        {isLoading && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
            </div>
            <Skeleton className="h-64 rounded-xl" />
          </div>
        )}

        {empty && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Users className="size-5" /> Set up team mode</CardTitle>
              <CardDescription>Aggregate Claude Code usage across your team without any server.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
                <li>
                  Each member opens <Link href="/export" className="text-primary underline underline-offset-2">Export</Link>{' '}
                  and downloads a <code className="rounded bg-muted px-1 py-0.5 text-xs">.cclens-team.json</code> (redacted: metrics only, no prompts or paths).
                </li>
                <li>
                  Drop all files into one shared folder — a git repo, Drive folder, or network share.
                </li>
                <li>
                  Point cc-lens at it and reload this page:
                  <pre className="mt-1.5 rounded-md bg-muted px-3 py-2 text-xs font-mono">CC_LENS_TEAM_DIR=/path/to/team-exports npx cc-lens</pre>
                </li>
              </ol>
              <p className="text-xs text-muted-foreground pt-1">
                Currently watching: <code className="rounded bg-muted px-1 py-0.5">{data?.source_dir}</code>
              </p>
            </CardContent>
          </Card>
        )}

        {data && !empty && (
          <>
            {data.errors.length > 0 && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Some files were skipped</AlertTitle>
                <AlertDescription className="font-mono text-xs">{data.errors.join(' · ')}</AlertDescription>
              </Alert>
            )}

            {/* Hero cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-2"><Users className="w-4 h-4" /> Members</CardDescription>
                  <CardTitle className="text-3xl font-bold tabular-nums">{data.member_count}</CardTitle>
                </CardHeader>
                <CardContent><p className="text-xs text-muted-foreground">{data.export_count} export file{data.export_count === 1 ? '' : 's'}</p></CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-2"><DollarSign className="w-4 h-4" /> Team Cost</CardDescription>
                  <CardTitle className="text-3xl font-bold tabular-nums text-[#d97706]">{formatCost(data.total_cost)}</CardTitle>
                </CardHeader>
                <CardContent><p className="text-xs text-muted-foreground">Estimated API-equivalent spend</p></CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-2"><MessageSquare className="w-4 h-4" /> Sessions</CardDescription>
                  <CardTitle className="text-3xl font-bold tabular-nums">{data.total_sessions.toLocaleString()}</CardTitle>
                </CardHeader>
                <CardContent><p className="text-xs text-muted-foreground">{data.total_messages.toLocaleString()} messages</p></CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-2"><TrendingDown className="w-4 h-4" /> Cache Savings</CardDescription>
                  <CardTitle className="text-3xl font-bold tabular-nums text-[#34d399]">{formatCost(data.total_cache_savings)}</CardTitle>
                </CardHeader>
                <CardContent><p className="text-xs text-muted-foreground">Saved by prompt caching, team-wide</p></CardContent>
              </Card>
            </div>

            {/* Cost over time by member */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Cost over time by member</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => formatCost(v)} width={70} />
                      <Tooltip
                        contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 4, fontSize: 12 }}
                        formatter={(val: number | undefined, name?: string) => [formatCost(val ?? 0), name ?? '']}
                      />
                      {memberNames.map(name => (
                        <Area
                          key={name}
                          type="monotone"
                          dataKey={name}
                          stackId="1"
                          stroke={colorFor(name)}
                          fill={colorFor(name)}
                          fillOpacity={0.45}
                        />
                      ))}
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-wrap gap-3 mt-3">
                  {memberNames.map(name => (
                    <span key={name} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span className="size-2.5 rounded-full" style={{ backgroundColor: colorFor(name) }} />
                      {name}
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Member table */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Members</CardTitle>
                <CardDescription>Sorted by estimated cost · latest export per member wins</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Member</TableHead>
                      <TableHead className="text-right">Sessions</TableHead>
                      <TableHead className="text-right">Cost</TableHead>
                      <TableHead className="text-right">Tokens in/out</TableHead>
                      <TableHead className="text-right">Cache hit</TableHead>
                      <TableHead className="text-right">Time</TableHead>
                      <TableHead>Top project</TableHead>
                      <TableHead className="text-right">Last active</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.members.map(m => (
                      <TableRow key={`${m.member.name}-${m.member.machine ?? ''}`}>
                        <TableCell>
                          <span className="flex items-center gap-2 font-medium">
                            <span className="size-2.5 rounded-full shrink-0" style={{ backgroundColor: colorFor(m.member.name) }} />
                            {m.member.name}
                            {m.member.machine && <Badge variant="outline" className="text-[10px]">{m.member.machine}</Badge>}
                          </span>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{m.session_count}</TableCell>
                        <TableCell className="text-right tabular-nums font-medium text-[#d97706]">{formatCost(m.estimated_cost)}</TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">
                          {formatTokens(m.input_tokens + m.cache_read_tokens)} / {formatTokens(m.output_tokens)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{(m.cache_hit_rate * 100).toFixed(0)}%</TableCell>
                        <TableCell className="text-right tabular-nums">{formatDuration(m.total_duration_minutes)}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {m.top_projects[0] ? (
                            <span className="flex items-center gap-1.5 text-xs">
                              <FolderOpen className="size-3.5 shrink-0 opacity-60" />
                              {m.top_projects[0].name}
                            </span>
                          ) : '—'}
                        </TableCell>
                        <TableCell className="text-right text-xs text-muted-foreground">
                          {m.last_active ? formatRelativeDate(m.last_active) : '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Version skew */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <GitBranch className="size-4" /> Claude Code version skew
                </CardTitle>
                <CardDescription>Who runs what — flag members far behind the latest</CardDescription>
              </CardHeader>
              <CardContent>
                {data.version_skew.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No version info in exports.</p>
                ) : (
                  <div className="space-y-2">
                    {data.version_skew.map(({ version, members }, i) => (
                      <div key={version} className="flex items-center gap-3 text-sm">
                        <Badge variant={i === 0 ? 'default' : 'outline'} className="font-mono tabular-nums w-20 justify-center">
                          {version}
                        </Badge>
                        <span className="text-muted-foreground">{members.join(', ')}</span>
                      </div>
                    ))}
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
