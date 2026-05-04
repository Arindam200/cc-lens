'use client'

import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell, ResponsiveContainer } from 'recharts'

interface Props {
  data: Array<{ day: string; count: number }>
}

import { useTheme } from '@/components/theme-provider'
import { getChartPalette } from '@/lib/chart-palette'

export function DayOfWeekChart({ data }: Props) {
  const { theme } = useTheme()
  const palette = getChartPalette(theme)
  const max = Math.max(...data.map(d => d.count), 1)
  return (
    <div>
      <h3 className="font-mono text-[11px] font-medium text-muted-foreground uppercase tracking-[0.14em] mb-3">Day of Week</h3>
      <ResponsiveContainer width="100%" height={140}>
        <BarChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis dataKey="day" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} width={30} tickFormatter={v => v === 0 ? '' : String(v)} />
          <Tooltip
            contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11 }}
            formatter={(val: number | undefined) => [(val ?? 0).toLocaleString(), 'messages']}
          />
          <Bar dataKey="count" radius={[3, 3, 0, 0]}>
            {data.map((d, i) => (
              <Cell
                key={i}
                fill={d.count === max ? palette.primary : d.count > max * 0.6 ? palette.primary + 'AA' : palette.primary + '40'}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
