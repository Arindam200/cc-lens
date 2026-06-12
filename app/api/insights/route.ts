import { NextResponse } from 'next/server'
import { getAllParsedSessions } from '@/lib/claude-reader'
import { buildInsightsReport, sessionCost } from '@/lib/insights'
import { readConfig } from '@/lib/config'
import type { InsightsReport } from '@/lib/insights'

export const dynamic = 'force-dynamic'

export interface BudgetStatus {
  monthly_budget_usd: number
  month_to_date_cost: number
  /** Fraction of the calendar month elapsed, for pace comparison */
  month_elapsed: number
  projected_month_cost: number
}

export interface InsightsResponse extends InsightsReport {
  budget: BudgetStatus | null
}

export async function GET(req: Request) {
  const daysParam = Number(new URL(req.url).searchParams.get('days'))
  const windowDays = [7, 30, 90].includes(daysParam) ? daysParam : 30

  const sessions = await getAllParsedSessions()
  const report = buildInsightsReport(sessions, windowDays)

  const config = await readConfig()
  let budget: BudgetStatus | null = null
  if (config.monthly_budget_usd) {
    const now = new Date()
    const monthStart = `${now.toISOString().slice(0, 7)}-01`
    const mtd = sessions
      .filter(s => s.start_time && s.start_time.slice(0, 10) >= monthStart)
      .reduce((sum, s) => sum + sessionCost(s), 0)
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
    const elapsed = now.getDate() / daysInMonth
    budget = {
      monthly_budget_usd: config.monthly_budget_usd,
      month_to_date_cost: mtd,
      month_elapsed: elapsed,
      projected_month_cost: elapsed > 0 ? mtd / elapsed : mtd,
    }
  }

  const response: InsightsResponse = { ...report, budget }
  return NextResponse.json(response)
}
