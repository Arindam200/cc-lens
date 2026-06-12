'use client'

import useSWR from 'swr'
import Link from 'next/link'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { formatCost } from '@/lib/decode'
import type { InsightsResponse } from '@/app/api/insights/route'
import { TrendingUp, Wallet } from 'lucide-react'

const fetcher = (url: string) =>
  fetch(url).then(r => { if (!r.ok) throw new Error(`API error ${r.status}`); return r.json() })

/**
 * Quiet by default: renders nothing unless the month is pacing over budget
 * or a recent day spiked well above the trailing median.
 */
export function BudgetAlertBanner() {
  const { data } = useSWR<InsightsResponse>('/api/insights?days=30', fetcher, { refreshInterval: 60_000 })
  if (!data) return null

  const overPace = data.budget && data.budget.projected_month_cost > data.budget.monthly_budget_usd
  const anomaly = data.anomalies[0]
  if (!overPace && !anomaly) return null

  return (
    <div className="space-y-3">
      {overPace && data.budget && (
        <Alert className="border-red-500/40">
          <Wallet className="h-4 w-4" />
          <AlertTitle>Pacing over budget</AlertTitle>
          <AlertDescription className="text-xs">
            {formatCost(data.budget.month_to_date_cost)} spent of a {formatCost(data.budget.monthly_budget_usd)} monthly budget —
            projected {formatCost(data.budget.projected_month_cost)} by month end.{' '}
            <Link href="/insights" className="underline underline-offset-2">See insights</Link>
          </AlertDescription>
        </Alert>
      )}
      {anomaly && (
        <Alert className="border-amber-500/40">
          <TrendingUp className="h-4 w-4" />
          <AlertTitle>Spend spike on {anomaly.date}</AlertTitle>
          <AlertDescription className="text-xs">
            {formatCost(anomaly.cost)} in one day, against a {formatCost(anomaly.baseline)} trailing daily median.{' '}
            <Link href="/insights" className="underline underline-offset-2">See insights</Link>
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}
