'use client'

import { useMemo } from 'react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from 'recharts'
import { formatCost } from '@/lib/decode'
import type { DailyCost } from '@/types/claude'
import { getChartSeries } from '@/lib/chart-palette'
import { useTheme } from '@/components/theme-provider'

function shortModel(m: string): string {
  if (m.includes('opus-4-6'))   return 'Opus 4.6'
  if (m.includes('opus-4-5'))   return 'Opus 4.5'
  if (m.includes('sonnet-4-6')) return 'Sonnet 4.6'
  if (m.includes('haiku-4-5'))  return 'Haiku 4.5'
  return m
}

interface Props {
  daily: DailyCost[]
}

export function CostOverTimeChart({ daily }: Props) {
  const { theme } = useTheme()
  const series = getChartSeries(theme)
  const { data, models } = useMemo(() => {
    const sorted = [...daily].sort((a, b) => a.date.localeCompare(b.date))
    const modelSet = new Set<string>()
    for (const d of sorted) Object.keys(d.costs ?? {}).forEach(m => modelSet.add(m))
    const models = [...modelSet]
    return {
      data: sorted.map(d => ({
        date: d.date.slice(8) + '/' + d.date.slice(5, 7), // DD/MM
        ...Object.fromEntries(models.map(m => [m, d.costs[m] ?? 0])),
        total: d.total,
      })),
      models,
    }
  }, [daily])

  return (
    <div>
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={data} margin={{ top: 4, right: 8, bottom: 8, left: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
          <YAxis tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} tickFormatter={v => v === 0 ? '' : `$${v.toFixed(2)}`} width={52} />
          <Tooltip
            contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11 }}
            formatter={(val: number | undefined, name?: string) => [formatCost(val ?? 0), shortModel(name ?? '')]}
          />
          {models.map((m, i) => {
            const color = series[i % series.length]
            return (
              <Area
                key={m}
                type="monotone"
                dataKey={m}
                stackId="1"
                stroke={color}
                fill={color + '30'}
                strokeWidth={1.5}
              />
            )
          })}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
