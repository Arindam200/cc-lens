'use client'

import { LineChart, Line, ResponsiveContainer } from 'recharts'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Delta, DeltaIcon, DeltaValue } from '@/components/delta'
import { useTheme } from '@/components/theme-provider'

interface StatCardProps {
  title: string
  value: string
  description?: string
  /** Percentage change vs previous period: positive = up, negative = down */
  trend?: number
  /** Raw values for sparkline (last N days) */
  sparkData?: number[]
  accentColor?: string
}

/** Recharts sets SVG stroke/fill from strings; `var(--*)` often does not resolve on SVG → black. */
function resolveChartColor(accentColor: string | undefined, theme: 'light' | 'dark'): string {
  if (!accentColor) return theme === 'light' ? '#f97316' : '#d97706'
  switch (accentColor) {
    case 'var(--viz-sky)':
      return theme === 'light' ? '#1d4ed8' : '#60a5fa'
    case 'var(--foreground)':
      return theme === 'light' ? '#18181b' : '#e8eaed'
    default:
      return accentColor
  }
}

export function StatCard({ title, value, description, trend, sparkData, accentColor }: StatCardProps) {
  const { theme } = useTheme()
  const resolvedAccent = resolveChartColor(accentColor, theme)
  const hasTrend = trend !== undefined && !isNaN(trend)
  const rawSpark = sparkData ?? []
  // Single point does not draw a line in Recharts; duplicate for a flat segment.
  const chartData =
    rawSpark.length === 1
      ? [{ v: rawSpark[0]! }, { v: rawSpark[0]! }]
      : rawSpark.map(v => ({ v }))

  return (
    <Card className="gap-0 justify-between overflow-hidden py-0">
      <CardHeader className="gap-2 px-5 pt-5 pb-0">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-muted-foreground">{title}</span>
          {hasTrend && (
            <Delta value={trend!} variant="badge" className="px-1.5 py-0 text-[11px]">
              <DeltaIcon variant="trend" />
              <DeltaValue />
            </Delta>
          )}
        </div>
        <p
          className="text-3xl font-bold tabular-nums leading-none tracking-tight"
          style={{ color: resolvedAccent }}
        >
          {value}
        </p>
        {description && (
          <p className="text-xs text-muted-foreground leading-snug">{description}</p>
        )}
      </CardHeader>
      <CardContent className="px-0 pb-0 pt-3">
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={40}>
            <LineChart data={chartData} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
              <Line
                type="monotone"
                dataKey="v"
                stroke={resolvedAccent}
                strokeWidth={1.75}
                dot={false}
                strokeOpacity={0.8}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-10" />
        )}
      </CardContent>
    </Card>
  )
}
