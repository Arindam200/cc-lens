'use client'

import { useParams } from 'next/navigation'
import useSWR from 'swr'
import Link from 'next/link'
import { TopBar } from '@/components/layout/top-bar'
import { formatCost, formatDuration, formatDate, formatTokens } from '@/lib/decode'
import { categoryColorMix, toolBarColor } from '@/lib/tool-categories'
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import type { SessionWithFacet } from '@/types/claude'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink,
  BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import {
  MessageSquare, Clock, DollarSign, GitBranch,
  Wrench, TrendingUp, AlertTriangle, Code2,
  Zap, Droplet, Cloud,
} from 'lucide-react'
import { computeImpact, formatEnergy, formatWater, formatCo2 } from '@/lib/impact'

const fetcher = (url: string) =>
  fetch(url).then(r => { if (!r.ok) throw new Error(`API error ${r.status}`); return r.json() })

interface ProjectDetail {
  project_path: string
  display_name: string
  sessions: SessionWithFacet[]
  tool_counts: Record<string, number>
  cost_by_session: Array<{ session_id: string; start_time: string; cost: number; messages: number }>
  branches: Array<{ branch: string; turns: number }>
}

const LANG_CHART_COLORS = ['#6366F1', '#14B8A6', '#9CA3AF', '#6B7280', '#4B5563', '#D1D5DB']

export default function ProjectDetailPage() {
  const params = useParams()
  const slug = params?.slug as string

  const { data, error, isLoading } = useSWR<ProjectDetail>(
    slug ? `/api/projects/${slug}` : null, fetcher
  )

  if (error) {
    return (
      <div className="flex flex-col min-h-screen">
        <TopBar title="Project" />
        <div className="p-6">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>Error loading project: {String(error)}</AlertDescription>
          </Alert>
        </div>
      </div>
    )
  }

  if (isLoading || !data) {
    return (
      <div className="flex flex-col min-h-screen">
        <TopBar title="Project" subtitle="Loading…" />
        <div className="p-6 space-y-4">
          <Skeleton className="h-5 w-48" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
          </div>
          <Skeleton className="h-64 rounded-xl" />
          <div className="grid grid-cols-2 gap-4">
            <Skeleton className="h-48 rounded-xl" />
            <Skeleton className="h-48 rounded-xl" />
          </div>
        </div>
      </div>
    )
  }

  // ── Derived data ────────────────────────────────────────────────────────────
  const sessions = data.sessions ?? []
  const costBySessions = data.cost_by_session ?? []
  const branches = data.branches ?? []

  const totalCost     = sessions.reduce((s, x) => s + (x.estimated_cost ?? 0), 0)
  const totalMsgs     = sessions.reduce((s, x) => s + (x.user_message_count ?? 0) + (x.assistant_message_count ?? 0), 0)
  const totalDuration = sessions.reduce((s, x) => s + (x.duration_minutes ?? 0), 0)
  const totalTokens   = sessions.reduce((s, x) => s + (x.input_tokens ?? 0) + (x.output_tokens ?? 0), 0)

  // Impact (énergie, eau, CO₂) — same Opus-4-6 assumption as the cost calc
  // in /api/projects (model per-session isn't tracked, Opus is worst-case upper bound).
  const impact = sessions.reduce(
    (acc, x) => {
      const r = computeImpact('claude-opus-4-6', {
        input: x.input_tokens ?? 0,
        output: x.output_tokens ?? 0,
        cacheWrite: x.cache_creation_input_tokens ?? 0,
        cacheRead: x.cache_read_input_tokens ?? 0,
      }, 'us')
      return {
        energy_wh: acc.energy_wh + r.energy_wh,
        water_ml: acc.water_ml + r.water_ml,
        co2_g: acc.co2_g + r.co2_g,
      }
    },
    { energy_wh: 0, water_ml: 0, co2_g: 0 },
  )

  const topTools = Object.entries(data.tool_counts ?? {})
    .sort(([, a], [, b]) => b - a).slice(0, 12)
  const maxToolCount = topTools[0]?.[1] ?? 1

  const langMap: Record<string, number> = {}
  for (const s of sessions) {
    for (const [lang, count] of Object.entries(s.languages ?? {})) {
      langMap[lang] = (langMap[lang] ?? 0) + count
    }
  }
  const topLangs = Object.entries(langMap).sort(([, a], [, b]) => b - a).slice(0, 6)
  const maxBranchTurns = branches[0]?.turns ?? 1

  return (
    <div className="flex flex-col min-h-screen">
      <TopBar title={data.display_name} subtitle={data.project_path} />

      <div className="p-6 space-y-6">
        {/* Breadcrumb */}
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href="/projects">Projects</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{data.display_name}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        {/* Stat cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4" /> Sessions
              </CardDescription>
              <CardTitle className="text-3xl font-bold tabular-nums">{sessions.length}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">{totalMsgs.toLocaleString()} messages</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <Clock className="w-4 h-4" /> Duration
              </CardDescription>
              <CardTitle className="text-3xl font-bold tabular-nums">{formatDuration(totalDuration)}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">Total time</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4" /> Tokens
              </CardDescription>
              <CardTitle className="text-3xl font-bold tabular-nums font-mono text-foreground tracking-[-0.02em]">
                {formatTokens(totalTokens)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">Input + output</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <DollarSign className="w-4 h-4" /> Est. Cost
              </CardDescription>
              <CardTitle className="text-3xl font-bold tabular-nums text-[#d97706]">
                {formatCost(totalCost)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">All sessions</p>
            </CardContent>
          </Card>
        </div>

        {/* Impact stat cards — énergie, eau, CO₂ */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <Zap className="w-4 h-4" /> Énergie
              </CardDescription>
              <CardTitle className="text-3xl font-bold tabular-nums font-mono text-[#f59e0b]">
                {formatEnergy(impact.energy_wh)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">Estimé sur base Opus · incl. PUE 1.14</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <Droplet className="w-4 h-4" /> Eau
              </CardDescription>
              <CardTitle className="text-3xl font-bold tabular-nums font-mono text-[#60a5fa]">
                {formatWater(impact.water_ml)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">Refroidissement datacenter · WUE 1.8 L/kWh</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <Cloud className="w-4 h-4" /> CO₂
              </CardDescription>
              <CardTitle className="text-3xl font-bold tabular-nums font-mono text-[#dc2626]">
                {formatCo2(impact.co2_g)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">Grid US (défaut) · ajuster dans /impact</p>
            </CardContent>
          </Card>
        </div>

        {/* Sessions table + Tool sidebar */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">
          <Card className="gap-0 py-8">
            <CardHeader className="space-y-1.5 px-8 pb-5 pt-2">
              <CardTitle>Sessions</CardTitle>
              <CardDescription>{sessions.length} conversations in this project</CardDescription>
            </CardHeader>
            <CardContent className="px-8 pb-2 pt-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Slug</TableHead>
                    <TableHead className="text-right">Msgs</TableHead>
                    <TableHead className="text-right">Cost</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sessions.map(s => {
                    const msgs = (s.user_message_count ?? 0) + (s.assistant_message_count ?? 0)
                    return (
                      <TableRow key={s.session_id}>
                        <TableCell className="text-muted-foreground whitespace-nowrap text-sm">
                          {formatDate(s.start_time)}
                        </TableCell>
                        <TableCell>
                          <Link
                            href={`/sessions/${s.session_id}`}
                            className="text-foreground hover:text-primary transition-colors font-medium text-sm"
                          >
                            {s.slug ?? s.session_id.slice(0, 8) + '…'}
                          </Link>
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">{msgs}</TableCell>
                        <TableCell className="text-right tabular-nums text-[#d97706] font-mono font-medium">
                          {formatCost(s.estimated_cost)}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                  {sessions.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-8">No sessions yet</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle>Most-Used Tools</CardTitle>
                  <CardDescription>Top {topTools.length} tools</CardDescription>
                </div>
                <Wrench className="w-4 h-4 text-muted-foreground mt-0.5" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {topTools.map(([tool, count]) => {
                  const color = toolBarColor(tool)
                  const width = Math.max(4, Math.round((count / maxToolCount) * 100))
                  return (
                    <div key={tool} className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground w-20 truncate">{tool}</span>
                      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${width}%`, backgroundColor: categoryColorMix(color, 58) }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground/60 w-7 text-right tabular-nums">{count}</span>
                    </div>
                  )
                })}
                {topTools.length === 0 && (
                  <p className="text-sm text-muted-foreground">No tool data</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Cost per session chart */}
        {costBySessions.length > 1 && (
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle>Cost Per Session</CardTitle>
                  <CardDescription>Estimated spend over time</CardDescription>
                </div>
                <DollarSign className="w-4 h-4 text-muted-foreground mt-0.5" />
              </div>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart
                  data={costBySessions.map(s => ({ date: s.start_time.slice(0, 10), cost: s.cost }))}
                  margin={{ top: 8, right: 16, bottom: 24, left: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                    tickLine={false}
                    axisLine={false}
                    interval="preserveStartEnd"
                    height={36}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={v => `$${v.toFixed(2)}`}
                    width={52}
                  />
                  <Tooltip
                    contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                    formatter={(v: unknown) => [formatCost(v as number), 'Cost']}
                  />
                  <Line type="monotone" dataKey="cost" stroke="#d97706" strokeWidth={2} dot={{ r: 3, fill: '#d97706' }} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Languages + Branches — two columns only when both exist; otherwise full width so one card isn’t stranded half-row */}
        <div
          className={
            topLangs.length > 0 && branches.length > 0
              ? 'grid grid-cols-1 gap-6 md:grid-cols-2'
              : 'grid grid-cols-1 gap-6'
          }
        >
          {topLangs.length > 0 && (
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle>Languages</CardTitle>
                    <CardDescription>Files touched across sessions</CardDescription>
                  </div>
                  <Code2 className="w-4 h-4 text-muted-foreground mt-0.5" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-6">
                  <ResponsiveContainer width={100} height={100}>
                    <PieChart>
                      <Pie
                        data={topLangs.map(([name, value]) => ({ name, value }))}
                        cx="50%" cy="50%"
                        innerRadius={28} outerRadius={46}
                        dataKey="value" strokeWidth={0}
                      >
                        {topLangs.map((_, i) => (
                          <Cell key={i} fill={LANG_CHART_COLORS[i % LANG_CHART_COLORS.length]} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-1.5">
                    {topLangs.map(([lang], i) => (
                      <div key={lang} className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: LANG_CHART_COLORS[i % LANG_CHART_COLORS.length] }} />
                        <Badge variant="outline" className="text-xs py-0">{lang}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {branches.length > 0 && (
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle>Git Branches</CardTitle>
                    <CardDescription>Activity by branch</CardDescription>
                  </div>
                  <GitBranch className="w-4 h-4 text-muted-foreground mt-0.5" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2.5">
                  {branches.map(({ branch, turns }) => {
                    const width = Math.max(4, Math.round((turns / maxBranchTurns) * 100))
                    return (
                      <div key={branch} className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground/70 w-24 truncate font-mono">{branch}</span>
                        <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
                          <div className="h-full rounded-full bg-primary/60" style={{ width: `${width}%` }} />
                        </div>
                        <span className="text-xs text-muted-foreground/50 w-16 text-right tabular-nums">{turns} turns</span>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
