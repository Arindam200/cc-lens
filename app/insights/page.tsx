'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { TopBar } from '@/components/layout/top-bar'
import { formatCost } from '@/lib/decode'
import type { InsightsResponse } from '@/app/api/insights/route'
import type { Insight } from '@/lib/insights'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  AlertTriangle, PiggyBank, Gauge, Lightbulb, TrendingUp, Wallet, CheckCircle2,
} from 'lucide-react'

const fetcher = (url: string) =>
  fetch(url).then(r => { if (!r.ok) throw new Error(`API error ${r.status}`); return r.json() })

const SEVERITY_STYLES: Record<Insight['severity'], { badge: string; label: string }> = {
  high:   { badge: 'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30',          label: 'High impact' },
  medium: { badge: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30',  label: 'Medium' },
  info:   { badge: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30',      label: 'Info' },
}

function BudgetCard({ budget, onSaved }: {
  budget: InsightsResponse['budget']
  onSaved: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(budget ? String(budget.monthly_budget_usd) : '')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  async function save(amount: number | null) {
    setSaving(true)
    setSaveError('')
    try {
      const res = await fetch('/api/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ monthly_budget_usd: amount }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => null)
        throw new Error(err?.error ?? `Failed to save budget (${res.status})`)
      }
      setEditing(false)
      onSaved()
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  const overPace = budget && budget.projected_month_cost > budget.monthly_budget_usd
  const pct = budget ? Math.min(100, (budget.month_to_date_cost / budget.monthly_budget_usd) * 100) : 0

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription className="flex items-center gap-2"><Wallet className="w-4 h-4" /> Monthly budget</CardDescription>
        {budget && !editing ? (
          <CardTitle className={`text-3xl font-bold tabular-nums ${overPace ? 'text-red-500' : ''}`}>
            {formatCost(budget.month_to_date_cost)}
            <span className="text-base font-normal text-muted-foreground"> / {formatCost(budget.monthly_budget_usd)}</span>
          </CardTitle>
        ) : (
          <CardTitle className="text-xl font-medium text-muted-foreground">{editing ? 'Set budget' : 'Not set'}</CardTitle>
        )}
      </CardHeader>
      <CardContent className="space-y-2">
        {budget && !editing && (
          <>
            <Progress value={pct} className={overPace ? '[&>div]:bg-red-500' : ''} />
            <p className="text-xs text-muted-foreground">
              Projected {formatCost(budget.projected_month_cost)} this month
              {overPace ? ' — over budget at this pace' : ' — on track'}
            </p>
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setEditing(true)}>Edit</Button>
          </>
        )}
        {(editing || !budget) && (
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min="1"
              placeholder="e.g. 300"
              value={value}
              onChange={e => setValue(e.target.value)}
              className="h-8 w-28 text-sm"
            />
            <Button size="sm" className="h-8" disabled={saving || !Number(value)} onClick={() => save(Number(value))}>
              Save
            </Button>
            {budget && (
              <Button size="sm" variant="ghost" className="h-8 text-xs" disabled={saving} onClick={() => save(null)}>
                Remove
              </Button>
            )}
          </div>
        )}
        {saveError && <p className="text-xs text-red-500">{saveError}</p>}
        {!budget && !editing && (
          <p className="text-xs text-muted-foreground">Soft limit on API-equivalent spend; cc-lens warns when the month is pacing over.</p>
        )}
      </CardContent>
    </Card>
  )
}

export default function InsightsPage() {
  const [days, setDays] = useState(30)
  const { data, error, isLoading, mutate } = useSWR<InsightsResponse>(`/api/insights?days=${days}`, fetcher)

  return (
    <div className="flex flex-col min-h-screen">
      <TopBar title="Insights" subtitle="Where your Claude Code spend can work harder" />
      <div className="p-6 space-y-6">

        <Tabs value={String(days)} onValueChange={v => setDays(Number(v))}>
          <TabsList>
            <TabsTrigger value="7">7 days</TabsTrigger>
            <TabsTrigger value="30">30 days</TabsTrigger>
            <TabsTrigger value="90">90 days</TabsTrigger>
          </TabsList>
        </Tabs>

        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>Error loading insights: {String(error)}</AlertDescription>
          </Alert>
        )}

        {isLoading && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
            </div>
            <Skeleton className="h-40 rounded-xl" />
          </div>
        )}

        {data && (
          <>
            {data.anomalies.length > 0 && (
              <Alert className="border-amber-500/40">
                <TrendingUp className="h-4 w-4" />
                <AlertTitle>Unusual spend detected</AlertTitle>
                <AlertDescription>
                  {data.anomalies.map(a => (
                    <span key={a.date} className="block text-xs">
                      {a.date}: {formatCost(a.cost)} — {a.baseline > 0 ? `${(a.cost / a.baseline).toFixed(1)}x` : 'far above'} the trailing daily median ({formatCost(a.baseline)})
                    </span>
                  ))}
                </AlertDescription>
              </Alert>
            )}

            {/* Hero cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-2"><TrendingUp className="w-4 h-4" /> Monthly run rate</CardDescription>
                  <CardTitle className="text-3xl font-bold tabular-nums text-[#d97706]">{formatCost(data.monthly_run_rate)}</CardTitle>
                </CardHeader>
                <CardContent><p className="text-xs text-muted-foreground">{formatCost(data.window_cost)} in the last {data.window_days} days, scaled to 30</p></CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-2"><PiggyBank className="w-4 h-4" /> Potential savings</CardDescription>
                  <CardTitle className="text-3xl font-bold tabular-nums text-[#34d399]">{formatCost(data.total_monthly_savings)}</CardTitle>
                </CardHeader>
                <CardContent><p className="text-xs text-muted-foreground">Per month, if every insight below is acted on</p></CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-2"><Gauge className="w-4 h-4" /> Cache hit rate</CardDescription>
                  <CardTitle className="text-3xl font-bold tabular-nums">{(data.cache_hit_rate * 100).toFixed(0)}%</CardTitle>
                </CardHeader>
                <CardContent><p className="text-xs text-muted-foreground">Context tokens served from prompt cache</p></CardContent>
              </Card>
              <BudgetCard budget={data.budget} onSaved={() => mutate()} />
            </div>

            {/* Insight cards */}
            {data.insights.length === 0 ? (
              <Card>
                <CardContent className="flex items-center gap-3 py-8 justify-center text-muted-foreground">
                  <CheckCircle2 className="size-5 text-[#34d399]" />
                  <span className="text-sm">Nothing to flag — usage in this window looks efficient.</span>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {data.insights.map(insight => (
                  <Card key={insight.id}>
                    <CardHeader className="pb-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Lightbulb className="size-4 text-[#d97706] shrink-0" />
                        <CardTitle className="text-base">{insight.title}</CardTitle>
                      </div>
                      <div className="flex items-center gap-2 pt-1">
                        <Badge variant="outline" className={`text-[10px] ${SEVERITY_STYLES[insight.severity].badge}`}>
                          {SEVERITY_STYLES[insight.severity].label}
                        </Badge>
                        {insight.monthly_savings_usd > 0 && (
                          <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30">
                            ~{formatCost(insight.monthly_savings_usd)}/mo
                          </Badge>
                        )}
                        {insight.affected_sessions > 0 && (
                          <span className="text-xs text-muted-foreground">{insight.affected_sessions} sessions</span>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground leading-relaxed">{insight.detail}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              Savings are estimates against published API prices and assume usage patterns hold. Treat them as direction, not invoices.
            </p>
          </>
        )}
      </div>
    </div>
  )
}
