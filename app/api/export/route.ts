import { NextResponse } from 'next/server'
import { readStatsCache, getSessions, readHistory } from '@/lib/claude-reader'
import { sessionCost } from '@/lib/insights'
import { estimateTotalCostFromModel, cacheEfficiency, unpricedModels } from '@/lib/pricing'
import type { ExportPayload, SessionMeta, ExportCostSummary } from '@/types/claude'

export const dynamic = 'force-dynamic'

type DateRange = { from?: string; to?: string }

/** Date-only strings from the UI are the user's local calendar days — same
 * boundaries as the team export, so both exports select the same sessions. */
function rangeToMs(dateRange?: DateRange): { fromMs: number | null; toMs: number | null } | null {
  const fromMs = dateRange?.from ? new Date(dateRange.from + 'T00:00:00').getTime() : null
  const toMs = dateRange?.to ? new Date(dateRange.to + 'T23:59:59.999').getTime() : null
  if ((fromMs !== null && Number.isNaN(fromMs)) || (toMs !== null && Number.isNaN(toMs))) return null
  if (fromMs !== null && toMs !== null && fromMs > toMs) return null
  return { fromMs, toMs }
}

function inRange(t: number, r: { fromMs: number | null; toMs: number | null }): boolean {
  if (r.fromMs !== null && t < r.fromMs) return false
  if (r.toMs !== null && t > r.toMs) return false
  return true
}

function filterSessionsByDateRange(sessions: SessionMeta[], r: { fromMs: number | null; toMs: number | null }) {
  return sessions.filter(s => !s.start_time || inRange(new Date(s.start_time).getTime(), r))
}

/** Preview counts for the export UI (optional date filter via query params). */
export async function GET(req: Request) {
  const url = new URL(req.url)
  const from = url.searchParams.get('from') || undefined
  const to = url.searchParams.get('to') || undefined
  const dateRange = from || to ? { from, to } : undefined

  const [stats, sessions, history] = await Promise.all([
    readStatsCache(),
    getSessions(),
    readHistory(10_000),
  ])

  const range = rangeToMs(dateRange)
  if (!range) return NextResponse.json({ error: 'invalid date range' }, { status: 400 })
  const filteredSessions = filterSessionsByDateRange(sessions, range)

  return NextResponse.json({
    sessionCount: filteredSessions.length,
    historyEntries: history.filter(h => inRange(h.timestamp, range)).length,
    hasStatsCache: stats !== null,
    totalSessionsIndexed: sessions.length,
  })
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const { dateRange } = body as { dateRange?: { from?: string; to?: string } }

  const [stats, sessions, history] = await Promise.all([
    readStatsCache(),
    getSessions(),
    readHistory(10_000),
  ])

  const range = rangeToMs(dateRange)
  if (!range) return NextResponse.json({ error: 'invalid date range' }, { status: 400 })
  const filteredSessions = filterSessionsByDateRange(sessions, range)
  const filteredHistory = history.filter(h => inRange(h.timestamp, range))

  let totalCostUSD = 0
  let totalSavingsUSD = 0
  let totalInputTokens = 0
  let totalOutputTokens = 0
  let totalCacheReadTokens = 0
  let totalCacheWriteTokens = 0

  const modelBreakdown: Record<
    string,
    {
      costUSD: number
      savedUSD: number
      inputTokens: number
      outputTokens: number
      cacheReadTokens: number
      cacheWriteTokens: number
      sessions: number
    }
  > = {}
  const projectBreakdown: Record<string, { sessions: number; costUSD: number }> = {}
  const dailyCosts: Record<string, number> = {}

  const enrichedSessions = filteredSessions.map(s => {
    const cost = sessionCost(s)
    totalCostUSD += cost

    totalInputTokens += s.input_tokens || 0
    totalOutputTokens += s.output_tokens || 0
    totalCacheReadTokens += s.cache_read_input_tokens || 0
    totalCacheWriteTokens += s.cache_creation_input_tokens || 0

    const proj = s.project_path || 'Unknown'
    if (!projectBreakdown[proj]) projectBreakdown[proj] = { sessions: 0, costUSD: 0 }
    projectBreakdown[proj].sessions += 1
    projectBreakdown[proj].costUSD += cost

    const date = s.start_time ? s.start_time.slice(0, 10) : 'unknown'
    dailyCosts[date] = (dailyCosts[date] || 0) + cost

    const enrichedModelUsage = s.model_usage ? { ...s.model_usage } : {}
    if (s.model_usage) {
      for (const [model, u] of Object.entries(s.model_usage)) {
        if (model === '<synthetic>') continue
        const mCost = estimateTotalCostFromModel(model, u)
        const eff = cacheEfficiency(model, u)
        totalSavingsUSD += eff.savedUSD

        enrichedModelUsage[model] = {
          ...u,
          costUSD: Number(mCost.toFixed(6)),
        }

        const b = modelBreakdown[model] ?? {
          costUSD: 0,
          savedUSD: 0,
          inputTokens: 0,
          outputTokens: 0,
          cacheReadTokens: 0,
          cacheWriteTokens: 0,
          sessions: 0,
        }
        b.costUSD += mCost
        b.savedUSD += eff.savedUSD
        b.inputTokens += u.inputTokens ?? 0
        b.outputTokens += u.outputTokens ?? 0
        b.cacheReadTokens += u.cacheReadInputTokens ?? 0
        b.cacheWriteTokens += u.cacheCreationInputTokens ?? 0
        b.sessions += 1
        modelBreakdown[model] = b
      }
    }

    return {
      ...s,
      estimated_cost: Number(cost.toFixed(6)),
      model_usage: enrichedModelUsage,
    }
  })

  const costSummary: ExportCostSummary = {
    unpricedModels: unpricedModels(Object.keys(modelBreakdown)),
    totalEstimatedCostUSD: Number(totalCostUSD.toFixed(4)),
    totalCacheSavingsUSD: Number(totalSavingsUSD.toFixed(4)),
    totalTokens: {
      input: totalInputTokens,
      output: totalOutputTokens,
      cacheRead: totalCacheReadTokens,
      cacheWrite: totalCacheWriteTokens,
      total: totalInputTokens + totalOutputTokens + totalCacheReadTokens + totalCacheWriteTokens,
    },
    models: Object.fromEntries(
      Object.entries(modelBreakdown).map(([m, b]) => [
        m,
        {
          costUSD: Number(b.costUSD.toFixed(4)),
          savedUSD: Number(b.savedUSD.toFixed(4)),
          inputTokens: b.inputTokens,
          outputTokens: b.outputTokens,
          cacheReadTokens: b.cacheReadTokens,
          cacheWriteTokens: b.cacheWriteTokens,
          sessions: b.sessions,
        },
      ])
    ),
    topProjects: Object.entries(projectBreakdown)
      .map(([project, d]) => ({
        project,
        sessions: d.sessions,
        costUSD: Number(d.costUSD.toFixed(4)),
      }))
      .sort((a, b) => b.costUSD - a.costUSD),
    dailyCosts: Object.fromEntries(
      Object.entries(dailyCosts)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([d, c]) => [d, Number(c.toFixed(4))])
    ),
  }

  // facets stays in the payload (empty) so older importers keep working
  const payload: ExportPayload = {
    exportedAt: new Date().toISOString(),
    version: '1.1.0',
    stats,
    sessions: enrichedSessions,
    facets: [],
    history: filteredHistory,
    costSummary,
    scope: {
      sessions: dateRange?.from || dateRange?.to ? 'date-range' : 'all',
      history: dateRange?.from || dateRange?.to ? 'date-range' : 'all',
      stats: 'all-time',
    },
  }

  return NextResponse.json(payload)
}
