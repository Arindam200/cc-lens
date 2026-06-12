import { NextResponse } from 'next/server'
import { getAllParsedSessions } from '@/lib/claude-reader'
import { sessionCost } from '@/lib/insights'
import { projectDisplayName } from '@/lib/decode'

export const dynamic = 'force-dynamic'

// Personal share-card stats. Sessions only — nothing here exposes prompts,
// paths beyond a folder name, or anything a screenshot shouldn't contain.

export interface WrappedStats {
  year: number
  sessions: number
  messages: number
  total_cost: number
  total_tokens: number
  output_tokens: number
  active_days: number
  longest_streak_days: number
  top_project: { name: string; sessions: number } | null
  top_tool: { name: string; calls: number } | null
  top_model: string | null
  busiest_hour: number | null
  cache_hit_rate: number
}

/** Days since epoch for a yyyy-MM-dd string; avoids local/UTC mixing around DST. */
function epochDay(day: string): number {
  return Math.floor(new Date(day + 'T00:00:00Z').getTime() / 86_400_000)
}

function longestStreak(days: string[]): number {
  const sorted = Array.from(new Set(days)).sort()
  let best = 0
  let run = 0
  let prev: number | null = null
  for (const day of sorted) {
    const d = epochDay(day)
    run = prev !== null && d === prev + 1 ? run + 1 : 1
    best = Math.max(best, run)
    prev = d
  }
  return best
}

export async function GET(req: Request) {
  const yearParam = Number(new URL(req.url).searchParams.get('year'))
  const year = yearParam >= 2020 && yearParam <= 2100 ? yearParam : new Date().getFullYear()

  const sessions = (await getAllParsedSessions()).filter(
    s => s.start_time && s.start_time.startsWith(String(year))
  )

  const days: string[] = []
  const projects = new Map<string, number>()
  const tools = new Map<string, number>()
  const modelCost = new Map<string, number>()
  const hours = new Array(24).fill(0) as number[]
  let cost = 0
  let messages = 0
  let inputTok = 0
  let outputTok = 0
  let cacheRead = 0
  let cacheWrite = 0

  for (const s of sessions) {
    days.push(s.start_time.slice(0, 10))
    cost += sessionCost(s)
    messages += s.user_message_count + s.assistant_message_count
    inputTok += s.input_tokens
    outputTok += s.output_tokens
    cacheRead += s.cache_read_input_tokens ?? 0
    cacheWrite += s.cache_creation_input_tokens ?? 0

    const proj = projectDisplayName(s.project_path)
    projects.set(proj, (projects.get(proj) ?? 0) + 1)
    for (const [tool, calls] of Object.entries(s.tool_counts)) {
      tools.set(tool, (tools.get(tool) ?? 0) + calls)
    }
    for (const [model, usage] of Object.entries(s.model_usage ?? {})) {
      if (model === '<synthetic>') continue
      modelCost.set(model, (modelCost.get(model) ?? 0) + sessionCost({ ...s, model_usage: { [model]: usage } }))
    }
    for (const h of s.message_hours) hours[h] = (hours[h] ?? 0) + 1
  }

  const topEntry = <K,>(m: Map<K, number>): [K, number] | null =>
    m.size === 0 ? null : Array.from(m.entries()).sort((a, b) => b[1] - a[1])[0]

  const topProject = topEntry(projects)
  const topTool = topEntry(tools)
  const topModel = topEntry(modelCost)
  const busiest = hours.some(h => h > 0) ? hours.indexOf(Math.max(...hours)) : null
  const context = inputTok + cacheRead

  const stats: WrappedStats = {
    year,
    sessions: sessions.length,
    messages,
    total_cost: cost,
    total_tokens: inputTok + outputTok + cacheRead + cacheWrite,
    output_tokens: outputTok,
    active_days: new Set(days).size,
    longest_streak_days: longestStreak(days),
    top_project: topProject ? { name: topProject[0], sessions: topProject[1] } : null,
    top_tool: topTool ? { name: topTool[0], calls: topTool[1] } : null,
    top_model: topModel ? topModel[0] : null,
    busiest_hour: busiest,
    cache_hit_rate: context > 0 ? cacheRead / context : 0,
  }
  return NextResponse.json(stats)
}
