import { NextResponse } from 'next/server'
import { readStatsCache, getSessions } from '@/lib/claude-reader'
import { estimateTotalCostFromModel, cacheEfficiency, getPricing } from '@/lib/pricing'
import { projectDisplayName } from '@/lib/decode'
import type { CostAnalytics, ModelCostBreakdown, DailyCost, ProjectCost } from '@/types/claude'

export const dynamic = 'force-dynamic'

export async function GET() {
  const [stats, sessions] = await Promise.all([readStatsCache(), getSessions()])

  if (!stats) {
    return NextResponse.json({ error: 'stats-cache.json not found' }, { status: 404 })
  }

  // ── Per-model breakdown ────────────────────────────────────────────────────
  let totalCost = 0
  let totalSavings = 0
  const models: ModelCostBreakdown[] = Object.entries(stats.modelUsage ?? {}).map(([model, usage]) => {
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
  // stats-cache.json uses "dailyModelTokens" in newer CC versions; "tokensByDate" in older ones
  const daily: DailyCost[] = (stats.dailyModelTokens ?? stats.tokensByDate ?? []).map(d => {
    const costs: Record<string, number> = {}
    let dayTotal = 0
    for (const [model, tokens] of Object.entries(d.tokensByModel ?? {})) {
      const p = getPricing(model)
      // tokensByDate only has total tokens, approximate as input+output split 50/50
      const cost = tokens * p.input * 0.5 + tokens * p.output * 0.5
      costs[model] = cost
      dayTotal += cost
    }
    return { date: d.date, costs, total: dayTotal }
  })

  // ── Cost by project ────────────────────────────────────────────────────────
  const projectMap = new Map<string, { cost: number; input: number; output: number }>()
  for (const s of sessions) {
    const pp = s.project_path ?? ''
    const slug = pp
    const existing = projectMap.get(slug) ?? { cost: 0, input: 0, output: 0 }
    const cost = estimateTotalCostFromModel('claude-opus-4-7', {
      inputTokens: s.input_tokens ?? 0,
      outputTokens: s.output_tokens ?? 0,
      cacheCreationInputTokens: s.cache_creation_input_tokens ?? 0,
      cacheReadInputTokens: s.cache_read_input_tokens ?? 0,
      costUSD: 0,
      webSearchRequests: 0,
    })
    projectMap.set(slug, {
      cost: existing.cost + cost,
      input: existing.input + (s.input_tokens ?? 0),
      output: existing.output + (s.output_tokens ?? 0),
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
