'use client'

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import type { ModelUsage } from '@/types/claude'
import { formatTokens } from '@/lib/decode'
import { getChartSeries } from '@/lib/chart-palette'
import { useTheme } from '@/components/theme-provider'

interface Props {
  modelUsage: Record<string, ModelUsage>
}

function shortModelName(model: string): string {
  if (model.includes('opus-4-6'))      return 'Opus 4.6'
  if (model.includes('opus-4-5'))      return 'Opus 4.5'
  if (model.includes('sonnet-4-6'))    return 'Sonnet 4.6'
  if (model.includes('sonnet-4-5'))    return 'Sonnet 4.5'
  if (model.includes('haiku-4-5'))     return 'Haiku 4.5'
  // Generic fallback
  const parts = model.split('-')
  return parts.slice(0, 3).join('-')
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const { name, value } = payload[0]
  return (
    <div className="bg-card border border-border rounded px-3 py-2 text-xs">
      <p className="text-muted-foreground">{name}</p>
      <p className="text-foreground font-bold">{formatTokens(value)} tokens</p>
    </div>
  )
}

export function ModelBreakdownDonut({ modelUsage }: Props) {
  const { theme } = useTheme()
  const series = getChartSeries(theme)
  const data = Object.entries(modelUsage)
    .map(([model, usage]) => ({
      name: shortModelName(model),
      value: (usage.inputTokens ?? 0) + (usage.outputTokens ?? 0) + (usage.cacheReadInputTokens ?? 0) + (usage.cacheCreationInputTokens ?? 0),
    }))
    .filter(d => d.value > 0)
    .sort((a, b) => b.value - a.value)

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
        no model data
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
