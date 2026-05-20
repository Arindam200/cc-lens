'use client'

import useSWR from 'swr'
import { TopBar } from '@/components/layout/top-bar'
import { ToolRankingChart } from '@/components/tools/tool-ranking-chart'
import { McpServerPanel } from '@/components/tools/mcp-server-panel'
import { FeatureAdoptionTable } from '@/components/tools/feature-adoption-table'
import { VersionHistoryTable } from '@/components/tools/version-history-table'
import { CATEGORY_COLORS, CATEGORY_LABELS } from '@/lib/tool-categories'
import type { ToolsAnalytics } from '@/types/claude'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { AlertTriangle, Wrench, Server, Zap, GitBranch, Sparkles } from 'lucide-react'
import Link from 'next/link'
import { SkillRankingPanel } from '@/components/skills/skill-ranking-panel'

const fetcher = (url: string) =>
  fetch(url).then(r => { if (!r.ok) throw new Error(`API error ${r.status}`); return r.json() })

export default function ToolsPage() {
  const { data, error, isLoading } = useSWR<ToolsAnalytics>('/api/tools', fetcher, { refreshInterval: 5_000 })

  return (
    <div className="flex flex-col min-h-screen">
      <TopBar title="Tools & Features" subtitle="Every tool call, MCP server, and feature" />
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
                    <Zap className="w-4 h-4" /> Tool Calls
                  </CardDescription>
                  <CardTitle className="text-3xl font-bold tabular-nums text-[#d97706]">
                    {data.total_tool_calls.toLocaleString()}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">Total all time</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-2">
                    <Wrench className="w-4 h-4" /> Unique Tools
                  </CardDescription>
                  <CardTitle className="text-3xl font-bold tabular-nums">
                    {data.tools.length}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">Distinct tools used</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-2">
                    <Server className="w-4 h-4" /> MCP Servers
                  </CardDescription>
                  <CardTitle className="text-3xl font-bold tabular-nums text-[#34d399]">
                    {data.mcp_servers.length}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">Connected servers</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" /> Errors
                  </CardDescription>
                  <CardTitle className={`text-3xl font-bold tabular-nums ${data.total_errors > 0 ? 'text-red-400' : 'text-muted-foreground'}`}>
                    {data.total_errors}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">
                    {data.total_tool_calls > 0
                      ? `${((data.total_errors / data.total_tool_calls) * 100).toFixed(1)}% error rate`
                      : 'No errors'}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Category legend */}
            <div className="flex flex-wrap gap-2">
              {Object.entries(CATEGORY_COLORS).map(([cat, color]) => (
                <Badge key={cat} variant="outline" className="gap-1.5">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                  {CATEGORY_LABELS[cat as keyof typeof CATEGORY_LABELS]}
                </Badge>
              ))}
            </div>

            {/* Tool ranking */}
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle>Tool Ranking</CardTitle>
                    <CardDescription>All tools ranked by total calls</CardDescription>
                  </div>
                  <Wrench className="w-4 h-4 text-muted-foreground mt-0.5" />
                </div>
              </CardHeader>
              <CardContent>
                <ToolRankingChart tools={data.tools} />
              </CardContent>
            </Card>

            {/* Skill invocations */}
            {data.skills && data.skills.length > 0 && (
              <Card>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2"><Sparkles className="w-4 h-4" /> Skill Invocations</CardTitle>
                      <CardDescription>
                        Top slash-command workflows · {data.total_skill_calls?.toLocaleString() ?? 0} total calls ·{' '}
                        <Link href="/skills" className="underline hover:text-foreground">View all</Link>
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <SkillRankingPanel skills={data.skills} limit={10} />
                </CardContent>
              </Card>
            )}

            {/* MCP server details */}
            {data.mcp_servers.length > 0 && (
              <Card>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle>MCP Server Details</CardTitle>
                      <CardDescription>Connected MCP servers and their tools</CardDescription>
                    </div>
                    <Server className="w-4 h-4 text-muted-foreground mt-0.5" />
                  </div>
                </CardHeader>
                <CardContent>
                  <McpServerPanel servers={data.mcp_servers} />
                </CardContent>
              </Card>
            )}

            {/* Feature adoption */}
            <Card>
              <CardHeader>
                <CardTitle>Feature Adoption</CardTitle>
                <CardDescription>How often advanced features are used across sessions</CardDescription>
              </CardHeader>
              <CardContent>
                <FeatureAdoptionTable
                  adoption={data.feature_adoption}
                  totalSessions={(() => {
                    const first = Object.values(data.feature_adoption ?? {})[0]
                    return first ? Math.round(first.sessions / Math.max(0.001, first.pct)) : 0
                  })()}
                />
              </CardContent>
            </Card>

            {/* Error analysis */}
            {data.total_errors > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Tool Error Analysis</CardTitle>
                  <CardDescription>
                    {data.total_errors} errors ·{' '}
                    {((data.total_errors / data.total_tool_calls) * 100).toFixed(1)}% error rate
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2.5">
                    {Object.entries(data.error_categories).sort(([, a], [, b]) => b - a).map(([cat, count]) => {
                      const max = Math.max(...Object.values(data.error_categories))
                      const width = Math.max(4, Math.round((count / max) * 100))
                      return (
                        <div key={cat} className="flex items-center gap-3">
                          <span className="text-sm text-muted-foreground w-36 truncate">{cat}</span>
                          <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                            <div className="h-full rounded-full bg-red-400/50" style={{ width: `${width}%` }} />
                          </div>
                          <span className="text-sm text-red-400 tabular-nums w-8 text-right">{count}</span>
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Version history */}
            {data.versions.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Claude Code Version History</CardTitle>
                  <CardDescription>Versions seen across your sessions</CardDescription>
                </CardHeader>
                <CardContent>
                  <VersionHistoryTable versions={data.versions} />
                </CardContent>
              </Card>
            )}

            {/* Git branch analytics */}
            {data.branches.length > 0 && (
              <Card>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle>Git Branch Analytics</CardTitle>
                      <CardDescription>Most active branches by turn count</CardDescription>
                    </div>
                    <GitBranch className="w-4 h-4 text-muted-foreground mt-0.5" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {data.branches.map(({ branch, turns }) => {
                      const max = data.branches[0]?.turns ?? 1
                      const width = Math.max(4, Math.round((turns / max) * 100))
                      return (
                        <div key={branch} className="flex items-center gap-3">
                          <span className="text-sm text-muted-foreground w-28 truncate font-mono">{branch}</span>
                          <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                            <div className="h-full rounded-full bg-[#34d399]/50" style={{ width: `${width}%` }} />
                          </div>
                          <span className="text-xs text-muted-foreground tabular-nums w-24 text-right">{turns.toLocaleString()} turns</span>
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  )
}
