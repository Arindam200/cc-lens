'use client'

import { modelLabel } from '@/lib/model-label'
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

interface Props {
  modelUsage: Record<string, ModelUsage>
}

const MODEL_COLORS = [
  '#d97706',
  '#34d399',
  '#2563eb',
  '#a78bfa',
  '#fbbf24',
  '#ef4444',
  '#06b6d4',
  '#84cc16',
  '#f97316',
  '#ec4899',
]

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const { name, value } = payload[0]
  return (
    <div className="bg-card border border-border rounded px-3 py-2 text-[13px]">
      <p className="text-muted-foreground">{name}</p>
      <p className="text-foreground font-bold">{formatTokens(value)} tokens</p>
    </div>
  )
}

export function ModelBreakdownDonut({ modelUsage }: Props) {
  const data = Object.entries(modelUsage)
    .map(([model, usage]) => ({
      name: modelLabel(model),
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
            <Cell key={i} fill={MODEL_COLORS[i % MODEL_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip content={<CustomTooltip />} />
        <Legend
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ fontSize: 12 }}
          formatter={(value) => (
            <span style={{ color: 'var(--muted-foreground)', fontSize: 12 }}>{value}</span>
          )}
        />
      </PieChart>
    </ResponsiveContainer>
  )
}
