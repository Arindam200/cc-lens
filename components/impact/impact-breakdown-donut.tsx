'use client'

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { formatEnergy } from '@/lib/impact'
import type { TokenTypeImpact } from '@/types/claude'
import { getChartSeries } from '@/lib/chart-palette'
import { useTheme } from '@/components/theme-provider'

interface Props {
  byTokenType: TokenTypeImpact
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const { name, value } = payload[0]
  return (
    <div className="bg-card border border-border rounded px-3 py-2 text-xs">
      <p className="text-muted-foreground">{name}</p>
      <p className="text-foreground font-bold">{formatEnergy(value)}</p>
    </div>
  )
}

export function ImpactBreakdownDonut({ byTokenType }: Props) {
  const { theme } = useTheme()
  const series = getChartSeries(theme)
  const data = [
    { name: 'Input', value: byTokenType.input.energy_wh },
    { name: 'Output', value: byTokenType.output.energy_wh },
    { name: 'Cache Read', value: byTokenType.cache_read.energy_wh },
    { name: 'Cache Write', value: byTokenType.cache_write.energy_wh },
  ].filter(d => d.value > 0)

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
        no data
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="45%"
          innerRadius={55}
          outerRadius={85}
          paddingAngle={2}
          dataKey="value"
          strokeWidth={0}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={series[i % series.length]} />
          ))}
        </Pie>
        <Tooltip content={<CustomTooltip />} />
        <Legend
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ fontSize: 11 }}
          formatter={(value) => (
            <span style={{ color: 'var(--muted-foreground)', fontSize: 11 }}>{value}</span>
          )}
        />
      </PieChart>
    </ResponsiveContainer>
  )
}
