'use client'

import { useMemo, useState, useEffect } from 'react'
import useSWR from 'swr'
import { Zap, Droplet, Cloud, AlertTriangle, Leaf } from 'lucide-react'
import { TopBar } from '@/components/layout/top-bar'
import { RegionToggle } from '@/components/impact/region-toggle'
import { ImpactOverTimeChart } from '@/components/impact/impact-over-time-chart'
import { ImpactByModelChart } from '@/components/impact/impact-by-model-chart'
import { ImpactBreakdownDonut } from '@/components/impact/impact-breakdown-donut'
import { EquivalencesPanel } from '@/components/impact/equivalences-panel'
import { ImpactFactorsTable } from '@/components/impact/impact-factors-table'
import { DateRangeSelector, DEFAULT_DATE_RANGE } from '@/components/layout/date-range-selector'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { formatEnergy, formatWater, formatCo2, type Region } from '@/lib/impact'
import type { ImpactAnalytics } from '@/types/claude'

const fetcher = (url: string) =>
  fetch(url).then(r => { if (!r.ok) throw new Error(`API error ${r.status}`); return r.json() })

const REGION_KEY = 'impact_region'

function isValidRegion(r: string | null): r is Region {
  return r === 'us' || r === 'eu' || r === 'fr'
}

export default function ImpactPage() {
  // Region persists in localStorage. Default "us" matches academic studies.
  const [region, setRegion] = useState<Region>('us')
  const [mounted, setMounted] = useState(false)
  const [range, setRange] = useState(DEFAULT_DATE_RANGE)

  useEffect(() => {
    const saved = typeof window !== 'undefined' ? window.localStorage.getItem(REGION_KEY) : null
    if (isValidRegion(saved)) setRegion(saved)
    setMounted(true)
  }, [])

  function handleRegionChange(r: Region) {
    setRegion(r)
    window.localStorage.setItem(REGION_KEY, r)
  }

  const { data, error, isLoading } = useSWR<ImpactAnalytics>(
    mounted ? `/api/impact?region=${region}` : null,
    fetcher,
  )

  // Filter daily impact to selected window + windowed totals.
  const windowed = useMemo(() => {
    if (!data) return null
    const fromISO = range.from.toISOString().slice(0, 10)
    const toISO = range.to.toISOString().slice(0, 10)
    const filteredDaily = data.daily.filter(d => d.date >= fromISO && d.date <= toISO)
    const windowEnergy = filteredDaily.reduce((s, d) => s + d.energy_wh, 0)
    const windowWater = filteredDaily.reduce((s, d) => s + d.water_ml, 0)
    const windowCo2 = filteredDaily.reduce((s, d) => s + d.co2_g, 0)
    return { filteredDaily, windowEnergy, windowWater, windowCo2 }
  }, [data, range])

  return (
    <div className="flex flex-col min-h-screen">
      <TopBar title="Impact" subtitle="Empreinte énergétique & écologique estimée de tes tokens" />
      <div className="p-6 space-y-6">

        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>Error loading data: {String(error)}</AlertDescription>
          </Alert>
        )}

        {/* Meta row: intro + region toggle + date range */}
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Leaf className="w-4 h-4 text-[var(--success)]" />
            <span>Estimations basées sur la recherche publique sur l&apos;inférence LLM — détails dans la section <em>Facteurs</em> plus bas.</span>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Grid :</span>
              <RegionToggle value={region} onChange={handleRegionChange} />
            </div>
            <DateRangeSelector value={range} onChange={setRange} />
          </div>
        </div>

        {(!mounted || isLoading) && (
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
                    <Zap className="w-4 h-4" /> Énergie
                  </CardDescription>
                  <CardTitle className="text-3xl font-bold tabular-nums font-mono text-[#f59e0b]">
                    {formatEnergy(windowed.windowEnergy)}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">
                    Sur la période · {formatEnergy(data.energy_wh)} all-time
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-2">
                    <Droplet className="w-4 h-4" /> Eau
                  </CardDescription>
                  <CardTitle className="text-3xl font-bold tabular-nums font-mono text-[#60a5fa]">
                    {formatWater(windowed.windowWater)}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">
                    Sur la période · {formatWater(data.water_ml)} all-time
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-2">
                    <Cloud className="w-4 h-4" /> CO₂
                  </CardDescription>
                  <CardTitle className="text-3xl font-bold tabular-nums font-mono text-[#dc2626]">
                    {formatCo2(windowed.windowCo2)}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">
                    Grid {region.toUpperCase()} · {formatCo2(data.co2_g)} all-time
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Equivalences */}
            <Card>
              <CardHeader>
                <CardTitle>Équivalences</CardTitle>
                <CardDescription>Pour rendre ces chiffres plus parlants · basé sur les totaux all-time</CardDescription>
              </CardHeader>
              <CardContent>
                <EquivalencesPanel impact={data} />
              </CardContent>
            </Card>

            {/* Impact over time — filtered by range */}
            {windowed.filteredDaily.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Impact Over Time</CardTitle>
                  <CardDescription>
                    Évolution journalière · {range.usingCustom ? `${range.days} jours (custom)` : range.preset === 'all' ? 'toute la période' : `derniers ${range.days} jours`} · toggle énergie / eau / CO₂
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ImpactOverTimeChart daily={windowed.filteredDaily} />
                </CardContent>
              </Card>
            )}

            {/* Impact by model + breakdown */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {data.models.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Impact by Model</CardTitle>
                    <CardDescription>Énergie consommée · Opus pèse 2.5× plus lourd que Sonnet</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ImpactByModelChart models={data.models} />
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader>
                  <CardTitle>Breakdown by Token Type</CardTitle>
                  <CardDescription>Les tokens output dominent · 5× plus coûteux en énergie</CardDescription>
                </CardHeader>
                <CardContent>
                  <ImpactBreakdownDonut byTokenType={data.by_token_type} />
                </CardContent>
              </Card>
            </div>

            {/* Factors & sources */}
            <Card>
              <CardHeader>
                <CardTitle>Facteurs d&apos;impact &amp; sources</CardTitle>
                <CardDescription>
                  Tous les coefficients utilisés, avec les limites et les publications d&apos;origine
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ImpactFactorsTable />
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  )
}
