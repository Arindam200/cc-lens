'use client'

import { useMemo, useState } from 'react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from 'recharts'
import { formatEnergy, formatWater, formatCo2 } from '@/lib/impact'
import type { DailyImpact } from '@/types/claude'
import { getChartPalette } from '@/lib/chart-palette'
import { useTheme } from '@/components/theme-provider'

interface Props {
  daily: DailyImpact[]
}

type Metric = 'energy' | 'water' | 'co2'

const METRIC_KEYS: Record<Metric, { label: string; key: keyof DailyImpact; format: (v: number) => string; axisFormat: (v: number) => string }> = {
  energy: {
    label: 'Energy',
    key: 'energy_wh',
    format: (v) => formatEnergy(v),
    axisFormat: (v) => v === 0 ? '' : v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${v.toFixed(0)}`,
  },
  water: {
    label: 'Water',
    key: 'water_ml',
    format: (v) => formatWater(v),
    axisFormat: (v) => v === 0 ? '' : v >= 1000 ? `${(v / 1000).toFixed(1)}L` : `${v.toFixed(0)}`,
  },
  co2: {
    label: 'CO₂',
    key: 'co2_g',
    format: (v) => formatCo2(v),
    axisFormat: (v) => v === 0 ? '' : v >= 1000 ? `${(v / 1000).toFixed(1)}kg` : `${v.toFixed(0)}g`,
  },
}

export function ImpactOverTimeChart({ daily }: Props) {
  const [metric, setMetric] = useState<Metric>('energy')
  const { theme } = useTheme()
  const palette = getChartPalette(theme)

  const colorFor = (m: Metric): string => {
    if (m === 'energy') return palette.warning
    if (m === 'water') return palette.primary
    return palette.error
  }

  const data = useMemo(() => {
    const sorted = [...daily].sort((a, b) => a.date.localeCompare(b.date))
    return sorted.map(d => ({
      date: d.date.slice(8) + '/' + d.date.slice(5, 7),
      value: d[METRIC_KEYS[metric].key] as number,
    }))
  }, [daily, metric])

  const cfg = METRIC_KEYS[metric]
  const stroke = colorFor(metric)

  return (
    <div>
      <div className="flex items-center justify-end mb-3">
        <div className="flex gap-1">
          {(Object.keys(METRIC_KEYS) as Metric[]).map(m => (
            <button
              key={m}
              onClick={() => setMetric(m)}
              className={`px-2.5 py-1 rounded-[4px] text-[11px] font-mono uppercase tracking-[0.12em] transition-colors duration-150 ${metric === m ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground border border-border'}`}
            >
              {METRIC_KEYS[m].label}
            </button>
          ))}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={data} margin={{ top: 4, right: 8, bottom: 8, left: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
          <YAxis tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} tickFormatter={cfg.axisFormat} width={52} />
          <Tooltip
            contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11 }}
            formatter={(val: number | undefined) => [cfg.format(val ?? 0), cfg.label]}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke={stroke}
            fill={stroke + '30'}
            strokeWidth={1.5}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
