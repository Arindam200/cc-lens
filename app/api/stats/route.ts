import { NextResponse } from 'next/server'
import { readStatsCache, getSessions, getClaudeStorageBytes } from '@/lib/claude-reader'
import { estimateTotalCostFromModel, getPricing } from '@/lib/pricing'
import type { DailyActivity, ModelUsage, SessionMeta } from '@/types/claude'

export const dynamic = 'force-dynamic'

/** Compute daily activity from session JSONL — fresher than stats-cache */
function computeDailyActivityFromSessions(sessions: SessionMeta[]): DailyActivity[] {
  const byDate = new Map<string, { messages: number; sessions: number; tools: number }>()
  for (const s of sessions) {
    const date = s.start_time.slice(0, 10)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue
    const existing = byDate.get(date) ?? { messages: 0, sessions: 0, tools: 0 }
    existing.messages += (s.user_message_count ?? 0) + (s.assistant_message_count ?? 0)
    existing.sessions += 1
    existing.tools += Object.values(s.tool_counts ?? {}).reduce((a, b) => a + b, 0)
    byDate.set(date, existing)
  }
  return Array.from(byDate.entries())
    .map(([date, { messages, sessions: count, tools }]) => ({
      date,
      messageCount: messages,
      sessionCount: count,
      toolCallCount: tools,
    }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

/** Merge stats dailyActivity with session-derived data; session data overrides for same dates */
function mergeDailyActivity(
  fromStats: DailyActivity[],
  fromSessions: DailyActivity[]
): DailyActivity[] {
  const map = new Map<string, DailyActivity>()
  for (const d of fromStats) map.set(d.date, d)
  for (const d of fromSessions) map.set(d.date, d)
  return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date))
}

function computeModelUsageFromSessions(sessions: SessionMeta[]): Record<string, ModelUsage> {
  const byModel: Record<string, ModelUsage> = {}

  for (const session of sessions) {
    for (const [model, usage] of Object.entries(session.model_usage ?? {})) {
      const existing = byModel[model] ?? {
        inputTokens: 0,
        outputTokens: 0,
        cacheReadInputTokens: 0,
        cacheCreationInputTokens: 0,
        costUSD: 0,
        webSearchRequests: 0,
      }
      existing.inputTokens += usage.inputTokens ?? 0
      existing.outputTokens += usage.outputTokens ?? 0
      existing.cacheReadInputTokens += usage.cacheReadInputTokens ?? 0
      existing.cacheCreationInputTokens += usage.cacheCreationInputTokens ?? 0
      existing.costUSD += usage.costUSD ?? 0
      existing.webSearchRequests += usage.webSearchRequests ?? 0
      byModel[model] = existing
    }
  }

  return byModel
}

function mergeModelUsage(
  fromStats: Record<string, ModelUsage>,
  fromSessions: Record<string, ModelUsage>,
): Record<string, ModelUsage> {
  if (Object.keys(fromSessions).length === 0) return fromStats
  return { ...fromStats, ...fromSessions }
}

export async function GET() {
  const [stats, sessions, storageBytes] = await Promise.all([
    readStatsCache(),
    getSessions(),
    getClaudeStorageBytes(),
  ])

  const dailyFromSessions = computeDailyActivityFromSessions(sessions)
  const dailyActivity = stats
    ? mergeDailyActivity(stats.dailyActivity ?? [], dailyFromSessions)
    : dailyFromSessions

  const sessionModelUsage = computeModelUsageFromSessions(sessions)
  const modelUsage = mergeModelUsage(stats?.modelUsage ?? {}, sessionModelUsage)

  // Compute estimated total cost from modelUsage
  let totalCost = 0
  let totalCacheSavings = 0
  for (const [model, usage] of Object.entries(modelUsage)) {
    const cost = estimateTotalCostFromModel(model, usage)
    totalCost += cost
    const p = getPricing(model)
    totalCacheSavings += (usage.cacheReadInputTokens ?? 0) * (p.input - p.cacheRead)
  }

  // Compute total tokens
  let totalInputTokens = 0
  let totalOutputTokens = 0
  let totalCacheReadTokens = 0
  let totalCacheWriteTokens = 0
  for (const usage of Object.values(modelUsage)) {
    totalInputTokens += usage.inputTokens ?? 0
    totalOutputTokens += usage.outputTokens ?? 0
    totalCacheReadTokens += usage.cacheReadInputTokens ?? 0
    totalCacheWriteTokens += usage.cacheCreationInputTokens ?? 0
  }
  const totalTokens = totalInputTokens + totalOutputTokens + totalCacheReadTokens + totalCacheWriteTokens

  // Aggregate tool calls total
  let totalToolCalls = 0
  for (const s of sessions) {
    for (const count of Object.values(s.tool_counts ?? {})) {
      totalToolCalls += count
    }
  }

  // Active days (days with at least 1 session)
  const activeDays = dailyActivity.filter(d => d.sessionCount > 0).length

  // Average session length
  const avgSessionMinutes =
    sessions.length > 0
      ? sessions.reduce((sum, s) => sum + (s.duration_minutes ?? 0), 0) / sessions.length
      : 0

  // Sessions this month & week
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const weekStart = new Date(now)
  weekStart.setDate(now.getDate() - 7)

  const sessionsThisMonth = sessions.filter(
    s => new Date(s.start_time) >= monthStart
  ).length
  const sessionsThisWeek = sessions.filter(
    s => new Date(s.start_time) >= weekStart
  ).length

  const statsOut = stats
    ? { ...stats, dailyActivity, modelUsage }
    : {
        version: 0,
        lastComputedDate: '',
        dailyActivity,
        tokensByDate: [],
        modelUsage,
        totalSessions: sessions.length,
        totalMessages: sessions.reduce((s, m) => s + (m.user_message_count ?? 0) + (m.assistant_message_count ?? 0), 0),
        longestSession: { sessionId: '', duration: 0, messageCount: 0, timestamp: '' },
        firstSessionDate: sessions[sessions.length - 1]?.start_time ?? '',
        hourCounts: {},
        totalSpeculationTimeSavedMs: 0,
      }

  return NextResponse.json({
    stats: statsOut,
    computed: {
      totalCost,
      totalCacheSavings,
      totalTokens,
      totalInputTokens,
      totalOutputTokens,
      totalCacheReadTokens,
      totalCacheWriteTokens,
      totalToolCalls,
      activeDays,
      avgSessionMinutes,
      sessionsThisMonth,
      sessionsThisWeek,
      storageBytes,
      sessionCount: sessions.length,
    },
  })
}
