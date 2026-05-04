'use client'

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import type { ProjectSummary } from '@/types/claude'
import { formatTokens } from '@/lib/decode'
import { getChartSeries } from '@/lib/chart-palette'
import { useTheme } from '@/components/theme-provider'

interface Props {
  projects: ProjectSummary[]
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

export function ProjectActivityDonut({ projects }: Props) {
  const { theme } = useTheme()
  const series = getChartSeries(theme)
  const totalTokens = projects.reduce(
    (s, p) => s + (p.input_tokens ?? 0) + (p.output_tokens ?? 0),
    0
  )

  const data = projects
    .slice(0, 5)
    .map((p) => ({
      name: p.display_name,
      value: (p.input_tokens ?? 0) + (p.output_tokens ?? 0),
    }))
    .filter((d) => d.value > 0)

  const othersTokens = totalTokens - data.reduce((s, d) => s + d.value, 0)
  if (othersTokens > 0) {
    data.push({ name: 'others', value: othersTokens })
  }

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
        no project data
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={50}
          outerRadius={80}
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
