'use client'

import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell, ResponsiveContainer } from 'recharts'
import { formatEnergy } from '@/lib/impact'
import type { ModelImpact } from '@/types/claude'
import { getChartPalette } from '@/lib/chart-palette'
import { useTheme } from '@/components/theme-provider'

interface Props {
  models: ModelImpact[]
}

function shortModel(m: string): string {
  if (m.includes('opus-4-6')) return 'Opus 4.6'
  if (m.includes('opus-4-5')) return 'Opus 4.5'
  if (m.includes('sonnet-4-6')) return 'Sonnet 4.6'
  if (m.includes('sonnet-4-5')) return 'Sonnet 4.5'
  if (m.includes('haiku-4-5')) return 'Haiku 4.5'
  return m
}

export function ImpactByModelChart({ models }: Props) {
  const { theme } = useTheme()
  const palette = getChartPalette(theme)
  const data = models
    .filter(m => m.energy_wh > 0)
    .map(m => ({ name: shortModel(m.model), value: m.energy_wh, raw: m.model }))
    .slice(0, 10)

  // Indigo intensity by model family — Opus full, Sonnet mid, Haiku soft.
  const colorFor = (m: string): string => {
    if (/opus/i.test(m)) return palette.primary
    if (/sonnet/i.test(m)) return palette.primary + 'BB'
    if (/haiku/i.test(m)) return palette.primary + '80'
    return palette.neutralMid
  }

  return (
    <div>
      <h3 className="font-mono text-[11px] font-medium text-muted-foreground uppercase tracking-[0.14em] mb-3">Impact by Model</h3>
      <ResponsiveContainer width="100%" height={Math.max(120, data.length * 40)}>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 64, bottom: 4, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
          <XAxis
            type="number"
            tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
            tickLine={false}
            axisLine={false}
            tickFormatter={v => v === 0 ? '' : v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${v.toFixed(0)}`}
          />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
            tickLine={false}
            axisLine={false}
            width={90}
            interval={0}
          />
          <Tooltip
            contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11 }}
            formatter={(v: number | undefined) => [formatEnergy(v ?? 0), 'Energy']}
          />
          <Bar dataKey="value" radius={[0, 3, 3, 0]}>
            {data.map((d, i) => (
              <Cell key={i} fill={colorFor(d.raw)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
