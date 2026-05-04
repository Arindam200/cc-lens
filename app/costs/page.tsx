'use client'

import { useMemo, useState } from 'react'
import useSWR from 'swr'
import { TopBar } from '@/components/layout/top-bar'
import { CostOverTimeChart } from '@/components/costs/cost-over-time-chart'
import { CostByProjectChart } from '@/components/costs/cost-by-project-chart'
import { ModelTokenTable } from '@/components/costs/model-token-table'
import { CacheEfficiencyPanel } from '@/components/costs/cache-efficiency-panel'
import { DateRangeSelector, DEFAULT_DATE_RANGE } from '@/components/layout/date-range-selector'
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
  const [range, setRange] = useState(DEFAULT_DATE_RANGE)
  const { data, error, isLoading } = useSWR<CostAnalytics>('/api/costs', fetcher, { refreshInterval: 60_000 })

  // Filter daily data to selected range + recompute windowed cost.
  const windowed = useMemo(() => {
    if (!data) return null
    const fromISO = range.from.toISOString().slice(0, 10)
    const toISO = range.to.toISOString().slice(0, 10)
    const filteredDaily = data.daily.filter(d => d.date >= fromISO && d.date <= toISO)
    const windowCost = filteredDaily.reduce((sum, d) => sum + (d.total ?? 0), 0)
    return { filteredDaily, windowCost }
  }, [data, range])

  return (
    <div className="flex flex-col min-h-screen">
      <TopBar title="Costs" subtitle="Estimated spend · calculated locally from token counts in ~/.claude/" />
      <div className="p-6 space-y-6">

        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>Error loading data: {String(error)}</AlertDescription>
          </Alert>
        )}

        {/* Date range selector */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <p className="text-xs text-muted-foreground">
            {range.usingCustom
              ? `Fenêtre custom · ${range.days} jours`
              : range.preset === 'all'
                ? 'Toutes les données disponibles'
                : `Derniers ${range.days} jours`}
          </p>
          <DateRangeSelector value={range} onChange={setRange} />
        </div>

        {isLoading && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
            </div>
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-56 rounded-xl" />)}
          </div>
        )}

        {data && windowed && (
          <>
            {/* Hero stat cards — KPI = windowed, subtitle = all-time reference */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4" /> Estimated Cost
                  </CardDescription>
                  <CardTitle className="text-3xl font-bold tabular-nums font-mono text-primary tracking-[-0.02em]">
                    {formatCost(windowed.windowCost)}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">
                    Sur la période · {formatCost(data.total_cost)} all-time
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-2">
                    <TrendingDown className="w-4 h-4" /> Cache Savings (all-time)
                  </CardDescription>
                  <CardTitle className="text-3xl font-bold tabular-nums font-mono text-[var(--success)] tracking-[-0.02em]">
                    {formatCost(data.total_savings)}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">Saved by prompt caching · cache reads cost 10× less</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-2">
                    <Banknote className="w-4 h-4" /> Without Cache (all-time)
                  </CardDescription>
                  <CardTitle className="text-3xl font-bold tabular-nums font-mono text-[var(--error)]">
                    {formatCost(data.total_cost + data.total_savings)}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">What you would have paid without prompt caching</p>
                </CardContent>
              </Card>
            </div>

            {/* Cost over time — filtered by range */}
            {windowed.filteredDaily.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Cost Over Time</CardTitle>
                  <CardDescription>
                    Daily estimated spend · {range.usingCustom ? `${range.days} jours (custom)` : range.preset === 'all' ? 'toute la période' : `derniers ${range.days} jours`}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <CostOverTimeChart daily={windowed.filteredDaily} />
                </CardContent>
              </Card>
            )}

            {/* Cost by project */}
            {data.by_project.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Cost by Project</CardTitle>
                  <CardDescription>Spend breakdown across projects · all-time</CardDescription>
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
                <CardDescription>Token usage and cost by model · all-time</CardDescription>
              </CardHeader>
              <CardContent>
                <ModelTokenTable models={data.models} />
              </CardContent>
            </Card>

            {/* Cache efficiency */}
            <Card>
              <CardHeader>
                <CardTitle>Cache Efficiency</CardTitle>
                <CardDescription>How much caching is saving you</CardDescription>
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
                        <TableCell className="text-right font-mono text-foreground/70">${(p.input * 1_000_000).toFixed(2)}</TableCell>
                        <TableCell className="text-right font-mono text-primary">${(p.output * 1_000_000).toFixed(2)}</TableCell>
                        <TableCell className="text-right font-mono text-foreground/60">${(p.cacheWrite * 1_000_000).toFixed(2)}</TableCell>
                        <TableCell className="text-right font-mono text-[var(--success)]">${(p.cacheRead * 1_000_000).toFixed(2)}</TableCell>
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
