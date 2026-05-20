'use client'

import { AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from 'recharts'
import { CATEGORY_COLORS } from '@/lib/tool-categories'

interface Props {
  daily: Array<{ date: string; total: number }>
}

export function SkillTimelineChart({ daily }: Props) {
  if (daily.length === 0) {
    return <p className="text-sm text-muted-foreground py-6 text-center">No timeline data yet.</p>
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={daily} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
          tickLine={false}
          axisLine={false}
          tickFormatter={d => d.slice(5)}
        />
        <YAxis
          tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
          tickLine={false}
          axisLine={false}
          allowDecimals={false}
        />
        <Tooltip
          contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 4, fontSize: 12 }}
          formatter={(val: number | undefined) => [`${val ?? 0} calls`, 'Skills']}
        />
        <Area
          type="monotone"
          dataKey="total"
          stroke={CATEGORY_COLORS.skill}
          fill={CATEGORY_COLORS.skill}
          fillOpacity={0.25}
          strokeWidth={2}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
