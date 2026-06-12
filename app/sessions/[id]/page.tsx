'use client'

import { use } from 'react'
import useSWR from 'swr'
import { TopBar } from '@/components/layout/top-bar'
import { SessionSidebar } from '@/components/sessions/replay/session-sidebar'
import { UserTurnCard, AssistantTurnCard } from '@/components/sessions/replay/turn-cards'
import { TokenAccumulationChart } from '@/components/sessions/replay/token-accumulation-chart'
import { SessionBadges } from '@/components/sessions/session-badges'
import { formatCost, formatTokens, formatDuration, projectDisplayName } from '@/lib/decode'
import type { ReplayData, SessionWithFacet } from '@/types/claude'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertTriangle, MessageSquare, Coins, DollarSign, Clock, Zap } from 'lucide-react'

const fetcher = (url: string) =>
  fetch(url).then(r => { if (!r.ok) throw new Error(`API error ${r.status}`); return r.json() })

type ReplayResponse = ReplayData

export default function SessionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)

  const { data: replayData, error: replayError, isLoading: replayLoading } =
    useSWR<ReplayResponse>(`/api/sessions/${id}/replay`, fetcher)

  const { data: metaData } =
    useSWR<{ session: SessionWithFacet }>(`/api/sessions/${id}`, fetcher)

  const meta = metaData?.session

  if (replayError) {
    return (
      <div className="flex flex-col min-h-screen">
        <TopBar title="Session Replay" subtitle="Error" />
        <div className="p-6">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>Error loading session: {String(replayError)}</AlertDescription>
          </Alert>
        </div>
      </div>
    )
  }

  if (replayLoading || !replayData) {
    return (
      <div className="flex flex-col min-h-screen">
        <TopBar title="Session Replay" subtitle="Loading…" />
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
          </div>
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className={`h-${i % 2 === 0 ? '16' : '28'} rounded-xl`} />
            ))}
          </div>
        </div>
      </div>
    )
  }

  const replay = replayData
  const projectName = meta ? projectDisplayName(meta.project_path ?? '') : id.slice(0, 8)

  // Total token counts from replay
  let totalInput = 0, totalOutput = 0, totalCacheRead = 0, totalCacheWrite = 0
  for (const t of replay.turns) {
    if (t.usage) {
      totalInput      += t.usage.input_tokens ?? 0
      totalOutput     += t.usage.output_tokens ?? 0
      totalCacheWrite += t.usage.cache_creation_input_tokens ?? 0
      totalCacheRead  += t.usage.cache_read_input_tokens ?? 0
    }
  }
  const totalTokens = totalInput + totalOutput + totalCacheWrite + totalCacheRead

  // Build tool results map: tool_use_id -> result (from user turns)
  const toolResults = new Map<string, { content: string; is_error: boolean }>()
  for (const t of replay.turns) {
    if (t.type === 'user' && t.tool_results) {
      for (const r of t.tool_results) {
        toolResults.set(r.tool_use_id, { content: r.content, is_error: r.is_error })
      }
    }
  }

  // Build compaction map: index of turn before which a compaction occurred
  const compactionByTurnIndex = new Map(replay.compactions.map(c => [c.turn_index, c]))

  let assistantTurnNum = 0

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <TopBar
        title={replay.ai_title ?? `${projectName} · ${replay.slug ?? id.slice(0, 8)}`}
        subtitle={`${projectName} · ${replay.git_branch ?? '?'} · v${replay.version ?? '?'} · ${formatCost(replay.total_cost ?? 0)}`}
      />

      {/* Stats cards — match project detail page */}
      <div className="border-b border-border bg-muted/30 px-4 py-4 md:px-6">
        <div
          className={
            3 + (meta ? 1 : 0) + (replay.compactions.length > 0 ? 1 : 0) >= 5
              ? 'grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5'
              : 'grid grid-cols-2 gap-4 sm:grid-cols-4'
          }
        >
          <Card className="gap-0">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4" /> Turns
              </CardDescription>
              <CardTitle className="text-3xl font-bold tabular-nums">
                {replay.turns.filter(t => t.type === 'assistant').length}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">Assistant messages</p>
            </CardContent>
          </Card>

          <Card className="gap-0">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <Coins className="h-4 w-4" /> Tokens
              </CardDescription>
              <CardTitle className="text-3xl font-bold tabular-nums text-blue-700 dark:text-[#60a5fa]">{formatTokens(totalTokens)}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">Input + output + cache</p>
            </CardContent>
          </Card>

          <Card className="gap-0">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <DollarSign className="h-4 w-4" /> Cost
              </CardDescription>
              <CardTitle className="text-3xl font-bold tabular-nums text-[#d97706]">
                {formatCost(replay.total_cost ?? 0)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">Estimated spend</p>
            </CardContent>
          </Card>

          {meta && (
            <Card className="gap-0">
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-2">
                  <Clock className="h-4 w-4" /> Duration
                </CardDescription>
                <CardTitle className="text-3xl font-bold tabular-nums">
                  {formatDuration(meta.duration_minutes ?? 0)}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">Session span</p>
              </CardContent>
            </Card>
          )}

          {replay.compactions.length > 0 && (
            <Card className="gap-0 border-amber-500/25">
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-amber-500" /> Compactions
                </CardDescription>
                <CardTitle className="text-3xl font-bold tabular-nums text-amber-500">
                  {replay.compactions.length}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">Context window events</p>
              </CardContent>
            </Card>
          )}
        </div>

        {meta && (
          <div className="mt-4 flex flex-wrap gap-2">
            <SessionBadges
              has_compaction={replay.compactions.length > 0}
              uses_task_agent={meta.uses_task_agent}
              uses_mcp={meta.uses_mcp}
              uses_web_search={meta.uses_web_search}
              uses_web_fetch={meta.uses_web_fetch}
              has_thinking={meta.has_thinking}
            />
          </div>
        )}
      </div>

      {/* Two-column layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Conversation replay */}
        <div className="flex-1 min-w-0 overflow-y-auto px-4 py-6 max-w-6xl">
          {replay.turns.map((turn, i) => {
            const compactionBefore = compactionByTurnIndex.get(i)

            if (turn.type === 'user') {
              return (
                <UserTurnCard
                  key={turn.uuid || i}
                  turn={turn}
                  turnNumber={i + 1}
                  compactionBefore={compactionBefore}
                  toolResults={toolResults}
                />
              )
            }

            assistantTurnNum++
            return (
              <AssistantTurnCard
                key={turn.uuid || i}
                turn={turn}
                turnNumber={assistantTurnNum}
                compactionBefore={compactionBefore}
                toolResults={toolResults}
              />
            )
          })}
        </div>

        {/* Sidebar */}
        <div className="w-64 shrink-0 overflow-y-auto border-l border-border px-4 py-6">
          <SessionSidebar replay={replay} meta={meta} />
        </div>
      </div>

      {/* Token accumulation chart */}
      <div className="border-t border-border px-4 py-4">
        <TokenAccumulationChart turns={replay.turns} compactions={replay.compactions} />
      </div>
    </div>
  )
}
