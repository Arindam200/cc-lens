'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { TopBar } from '@/components/layout/top-bar'
import { CostOverTimeChart, type CostWindow } from '@/components/costs/cost-over-time-chart'
import { CostByProjectChart } from '@/components/costs/cost-by-project-chart'
import { ModelTokenTable } from '@/components/costs/model-token-table'
import { CacheEfficiencyPanel } from '@/components/costs/cache-efficiency-panel'
import { BudgetAlertBanner } from '@/components/costs/budget-alert-banner'
import { formatCost } from '@/lib/decode'
import { PRICING } from '@/lib/pricing'
import type { CostAnalytics } from '@/types/claude'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { AlertTriangle, TrendingDown, DollarSign, Banknote } from 'lucide-react'

const fetcher = (url: string) =>
  fetch(url).then(r => { if (!r.ok) throw new Error(`API error ${r.status}`); return r.json() })

export default function CostsPage() {
  const [costWindow, setCostWindow] = useState<CostWindow>(90)
  const rangeKey = costWindow === 'all' ? 'all' : `${costWindow}d`
  const rangeLabel = costWindow === 'all' ? 'All time' : `Last ${costWindow} days`
  const { data, error, isLoading } = useSWR<CostAnalytics>(`/api/costs?range=${rangeKey}`, fetcher, { refreshInterval: 5_000 })

  return (
    <div className="flex flex-col min-h-screen">
      <TopBar title="Costs" subtitle="Estimated spend from ~/.claude/" />
      <div className="p-6 space-y-6">

        <BudgetAlertBanner />

        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>Error loading data: {String(error)}</AlertDescription>
          </Alert>
        )}

        {isLoading && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
            </div>
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-56 rounded-xl" />)}
          </div>
        )}

        {data && (
          <>
            {/* Hero stat cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4" /> Total Estimated Cost
                  </CardDescription>
                  <CardTitle className="text-3xl font-bold tabular-nums text-[#d97706]">
                    {formatCost(data.total_cost)}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">{rangeLabel} spend across all projects</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-2">
                    <TrendingDown className="w-4 h-4" /> Cache Savings
                  </CardDescription>
                  <CardTitle className="text-3xl font-bold tabular-nums text-[#34d399]">
                    {formatCost(data.total_savings)}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">Saved by prompt caching · {rangeLabel.toLowerCase()}</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-2">
                    <Banknote className="w-4 h-4" /> Without Cache
                  </CardDescription>
                  <CardTitle className="text-3xl font-bold tabular-nums text-red-400">
                    {formatCost(data.total_cost + data.total_savings)}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">What you would have spent · {rangeLabel.toLowerCase()}</p>
                </CardContent>
              </Card>
            </div>

            {/* Cost over time */}
            {data.daily.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Cost Over Time</CardTitle>
                  <CardDescription>Daily estimated spend · {rangeLabel}</CardDescription>
                </CardHeader>
                <CardContent>
                  <CostOverTimeChart daily={data.daily} window={costWindow} onWindowChange={setCostWindow} />
                </CardContent>
              </Card>
            )}

            {/* Cost by project */}
            {data.by_project.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Cost by Project</CardTitle>
                  <CardDescription>Spend breakdown across projects · {rangeLabel}</CardDescription>
                </CardHeader>
                <CardContent>
                  <CostByProjectChart projects={data.by_project} />
                </CardContent>
              </Card>
            )}

            {/* Per-model table */}
            <Card>
              <CardHeader>
                <CardTitle>Per-Model Token Breakdown</CardTitle>
                <CardDescription>Token usage and cost by model · {rangeLabel}</CardDescription>
              </CardHeader>
              <CardContent>
                <ModelTokenTable models={data.models} />
              </CardContent>
            </Card>

            {/* Cache efficiency */}
            <Card>
              <CardHeader>
                <CardTitle>Cache Efficiency</CardTitle>
                <CardDescription>How much caching is saving you · {rangeLabel}</CardDescription>
              </CardHeader>
              <CardContent>
                <CacheEfficiencyPanel models={data.models} totalSavings={data.total_savings} />
              </CardContent>
            </Card>

            {/* Pricing reference */}
            <Card>
              <CardHeader>
                <CardTitle>Pricing Reference</CardTitle>
                <CardDescription>
                  Estimates only — update rates in{' '}
                  <code className="text-xs bg-muted px-1 rounded">lib/pricing.ts</code>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Model</TableHead>
                      <TableHead className="text-right">Input /MTok</TableHead>
                      <TableHead className="text-right">Output /MTok</TableHead>
                      <TableHead className="text-right">Cache Write /MTok</TableHead>
                      <TableHead className="text-right">Cache Read /MTok</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Object.entries(PRICING).map(([model, p]) => (
                      <TableRow key={model}>
                        <TableCell className="font-mono text-sm">{model}</TableCell>
                        <TableCell className="text-right font-mono text-blue-700 dark:text-[#60a5fa]">${(p.input * 1_000_000).toFixed(2)}</TableCell>
                        <TableCell className="text-right font-mono text-[#d97706]">${(p.output * 1_000_000).toFixed(2)}</TableCell>
                        <TableCell className="text-right font-mono text-[#a78bfa]">${(p.cacheWrite * 1_000_000).toFixed(2)}</TableCell>
                        <TableCell className="text-right font-mono text-[#34d399]">${(p.cacheRead * 1_000_000).toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  )
}
