'use client'

import { TrendingUp, TrendingDown } from 'lucide-react'
import { LineChart, Line, ResponsiveContainer } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
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

/**
 * Recharts paints SVG stroke/fill from string values; `var(--*)` does not resolve on SVG.
 * Resolve known DA tokens to concrete hex per theme. Unknown values pass through.
 */
function resolveChartColor(accentColor: string | undefined, theme: 'light' | 'dark'): string {
  const indigo = theme === 'light' ? '#6366F1' : '#818CF8'
  const fg = theme === 'light' ? '#111111' : '#EDEDED'
  if (!accentColor) return indigo
  switch (accentColor) {
    case 'var(--viz-sky)':
    case 'var(--primary)':
    case 'var(--chart-1)':
      return indigo
    case 'var(--foreground)':
      return fg
    default:
      return accentColor
  }
}

export function StatCard({ title, value, description, trend, sparkData, accentColor }: StatCardProps) {
  const { theme } = useTheme()
  const resolvedAccent = resolveChartColor(accentColor, theme)
  const hasTrend = trend !== undefined && !isNaN(trend)
  const isUp = hasTrend && trend! >= 0
  const trendColor = hasTrend
    ? isUp ? '#22C55E' : '#EF4444'
    : undefined
  const rawSpark = sparkData ?? []
  // Single point does not draw a line in Recharts; duplicate for a flat segment.
  const chartData =
    rawSpark.length === 1
      ? [{ v: rawSpark[0]! }, { v: rawSpark[0]! }]
      : rawSpark.map(v => ({ v }))

  return (
    <Card className="gap-3 hover:border-primary cursor-default overflow-visible">
      <CardHeader className="pb-0">
        <CardDescription className="font-mono text-[12px] tracking-[0.14em] uppercase text-muted-foreground">
          {title}
        </CardDescription>
        <div className="flex items-end justify-between mt-2">
          <CardTitle
            className="text-3xl font-semibold tabular-nums leading-none tracking-[-0.02em] font-mono"
            style={{ color: resolvedAccent }}
          >
            {value}
          </CardTitle>
          {hasTrend && (
            <Badge
              variant="tag"
              className="gap-1"
              style={{
                color: trendColor,
                borderColor: `${trendColor}40`,
                backgroundColor: `${trendColor}14`,
              }}
            >
              {isUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {Math.abs(trend!).toFixed(1)}%
            </Badge>
          )}
        </div>
        {description && (
          <CardDescription className="text-xs mt-1.5 text-[var(--subtle-foreground)]">{description}</CardDescription>
        )}
      </CardHeader>
      {chartData.length > 0 && (
        <CardContent className="pt-0 pb-4 px-6 overflow-visible">
          <ResponsiveContainer width="100%" height={48} style={{ overflow: 'visible' }}>
            <LineChart data={chartData} margin={{ top: 4, right: 4, left: 4, bottom: 6 }}>
              <Line
                type="monotone"
                dataKey="v"
                stroke={resolvedAccent}
                strokeWidth={1.5}
                dot={false}
                strokeOpacity={0.7}
                activeDot={{ r: 3, fill: resolvedAccent }}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      )}
    </Card>
  )
}
