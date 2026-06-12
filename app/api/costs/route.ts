import { NextResponse } from 'next/server'
import { getSessions } from '@/lib/claude-reader'
import { estimateTotalCostFromModel, cacheEfficiency } from '@/lib/pricing'
import { projectDisplayName } from '@/lib/decode'
import type { CostAnalytics, ModelCostBreakdown, DailyCost, ProjectCost, ModelUsage, SessionMeta } from '@/types/claude'

export const dynamic = 'force-dynamic'

type CostRange = '30d' | '90d' | 'all'

function parseRange(value: string | null): CostRange {
  if (value === '30d' || value === '90d' || value === 'all') return value
  return '90d'
}

function rangeCutoff(range: CostRange): string | null {
  if (range === 'all') return null
  const days = range === '30d' ? 30 : 90
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  date.setDate(date.getDate() - (days - 1))
  return date.toISOString().slice(0, 10)
}

function emptyUsage(): ModelUsage {
  return {
    inputTokens: 0,
    outputTokens: 0,
    cacheReadInputTokens: 0,
    cacheCreationInputTokens: 0,
    costUSD: 0,
    webSearchRequests: 0,
  }
}

function addUsage(target: ModelUsage, usage: ModelUsage) {
  target.inputTokens += usage.inputTokens ?? 0
  target.outputTokens += usage.outputTokens ?? 0
  target.cacheReadInputTokens += usage.cacheReadInputTokens ?? 0
  target.cacheCreationInputTokens += usage.cacheCreationInputTokens ?? 0
  target.costUSD += usage.costUSD ?? 0
  target.webSearchRequests += usage.webSearchRequests ?? 0
}

function sessionModelUsage(session: SessionMeta): Record<string, ModelUsage> {
  if (session.model_usage && Object.keys(session.model_usage).length > 0) {
    return session.model_usage
  }
  return {
    'claude-opus-4-7': {
      inputTokens: session.input_tokens ?? 0,
      outputTokens: session.output_tokens ?? 0,
      cacheCreationInputTokens: session.cache_creation_input_tokens ?? 0,
      cacheReadInputTokens: session.cache_read_input_tokens ?? 0,
      costUSD: 0,
      webSearchRequests: 0,
    },
  }
}

export async function GET(req: Request) {
  const range = parseRange(new URL(req.url).searchParams.get('range'))
  const cutoff = rangeCutoff(range)
  const sessions = await getSessions()

  const filteredSessions = cutoff
    ? sessions.filter(s => s.start_time.slice(0, 10) >= cutoff)
    : sessions

  const modelUsage: Record<string, ModelUsage> = {}
  for (const session of filteredSessions) {
    for (const [model, usage] of Object.entries(sessionModelUsage(session))) {
      const tokenTotal =
        (usage.inputTokens ?? 0) +
        (usage.outputTokens ?? 0) +
        (usage.cacheReadInputTokens ?? 0) +
        (usage.cacheCreationInputTokens ?? 0)
      if (model === '<synthetic>' || tokenTotal === 0) continue
      const existing = modelUsage[model] ?? emptyUsage()
      addUsage(existing, usage)
      modelUsage[model] = existing
    }
  }

  // ── Per-model breakdown ────────────────────────────────────────────────────
  let totalCost = 0
  let totalSavings = 0
  const models: ModelCostBreakdown[] = Object.entries(modelUsage).map(([model, usage]) => {
    const cost = estimateTotalCostFromModel(model, usage)
    const eff = cacheEfficiency(model, usage)
    totalCost += cost
    totalSavings += eff.savedUSD
    return {
      model,
      input_tokens: usage.inputTokens ?? 0,
      output_tokens: usage.outputTokens ?? 0,
      cache_write_tokens: usage.cacheCreationInputTokens ?? 0,
      cache_read_tokens: usage.cacheReadInputTokens ?? 0,
      estimated_cost: cost,
      cache_savings: eff.savedUSD ?? 0,
      cache_hit_rate: eff.hitRate ?? 0,
    }
  }).sort((a, b) => b.estimated_cost - a.estimated_cost)

  // ── Daily cost by model ────────────────────────────────────────────────────
  const dailyUsage = new Map<string, Record<string, ModelUsage>>()
  for (const session of filteredSessions) {
    const date = session.start_time.slice(0, 10)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue
    const day = dailyUsage.get(date) ?? {}
    for (const [model, usage] of Object.entries(sessionModelUsage(session))) {
      const tokenTotal =
        (usage.inputTokens ?? 0) +
        (usage.outputTokens ?? 0) +
        (usage.cacheReadInputTokens ?? 0) +
        (usage.cacheCreationInputTokens ?? 0)
      if (model === '<synthetic>' || tokenTotal === 0) continue
      const existing = day[model] ?? emptyUsage()
      addUsage(existing, usage)
      day[model] = existing
    }
    dailyUsage.set(date, day)
  }

  const daily: DailyCost[] = [...dailyUsage.entries()]
    .map(([date, usageByModel]) => {
      const costs: Record<string, number> = {}
      let dayTotal = 0
      for (const [model, usage] of Object.entries(usageByModel)) {
        const cost = estimateTotalCostFromModel(model, usage)
        costs[model] = cost
        dayTotal += cost
      }
      return { date, costs, total: dayTotal }
    })
    .sort((a, b) => a.date.localeCompare(b.date))

  // ── Cost by project ────────────────────────────────────────────────────────
  const projectMap = new Map<string, { cost: number; input: number; output: number }>()
  for (const s of filteredSessions) {
    const slug = s.project_path ?? ''
    const existing = projectMap.get(slug) ?? { cost: 0, input: 0, output: 0 }
    let cost = 0
    let input = 0
    let output = 0
    for (const [model, usage] of Object.entries(sessionModelUsage(s))) {
      if (model === '<synthetic>') continue
      cost += estimateTotalCostFromModel(model, usage)
      input += usage.inputTokens ?? 0
      output += usage.outputTokens ?? 0
    }
    projectMap.set(slug, {
      cost: existing.cost + cost,
      input: existing.input + input,
      output: existing.output + output,
    })
  }

  const by_project: ProjectCost[] = [...projectMap.entries()]
    .map(([slug, data]) => {
      const projectPath = slug
      return {
        slug,
        display_name: projectDisplayName(projectPath),
        estimated_cost: data.cost,
        input_tokens: data.input,
        output_tokens: data.output,
      }
    })
    .sort((a, b) => b.estimated_cost - a.estimated_cost)
    .slice(0, 20)

  const result: CostAnalytics = { total_cost: totalCost, total_savings: totalSavings, models, daily, by_project }
  return NextResponse.json(result)
}
