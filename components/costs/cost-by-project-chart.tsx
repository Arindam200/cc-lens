'use client'

import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell, ResponsiveContainer } from 'recharts'
import { formatCost } from '@/lib/decode'
import type { ProjectCost } from '@/types/claude'
import { getChartPalette } from '@/lib/chart-palette'
import { useTheme } from '@/components/theme-provider'

interface Props {
  projects: ProjectCost[]
}

export function CostByProjectChart({ projects }: Props) {
  const { theme } = useTheme()
  const palette = getChartPalette(theme)
  const top = projects.slice(0, 12)

  // Indigo gradient: highest = full primary, decay by opacity for following rows
  const fillFor = (i: number) => {
    if (i === 0) return palette.primary
    const alpha = Math.max(20, 88 - i * 6)
    const a = alpha.toString(16).padStart(2, '0')
    return palette.primary + a
  }

  return (
    <div>
      <h3 className="font-mono text-[11px] font-medium text-muted-foreground uppercase tracking-[0.14em] mb-3">Cost by Project</h3>
      <ResponsiveContainer width="100%" height={Math.max(120, top.length * 40)}>
        <BarChart data={top} layout="vertical" margin={{ top: 4, right: 64, bottom: 4, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
          <XAxis
            type="number"
            tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
            tickLine={false}
            axisLine={false}
            tickFormatter={v => v === 0 ? '' : `$${v.toFixed(2)}`}
          />
          <YAxis
            type="category"
            dataKey="display_name"
            tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
            tickLine={false}
            axisLine={false}
            width={144}
            interval={0}
            tickFormatter={(v: string) => v.length > 18 ? v.slice(0, 16) + '…' : v}
          />
          <Tooltip
            contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
            formatter={(val: number | undefined) => [formatCost(val ?? 0), 'Estimated cost']}
          />
          <Bar dataKey="estimated_cost" radius={[0, 3, 3, 0]}>
            {top.map((_, i) => (
              <Cell key={i} fill={fillFor(i)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
