'use client'

import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell, ResponsiveContainer } from 'recharts'
import { CATEGORY_COLORS } from '@/lib/tool-categories'
import type { SkillSummary } from '@/types/claude'

interface Props {
  skills: SkillSummary[]
  limit?: number
}

export function SkillRankingPanel({ skills, limit = 25 }: Props) {
  const top = skills.slice(0, limit)
  if (top.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-6 text-center">
        No skill invocations recorded yet. Skills appear here once you use slash commands like <code>/commit</code> or <code>/review</code>.
      </p>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={Math.max(200, top.length * 26)}>
      <BarChart data={top} layout="vertical" margin={{ top: 0, right: 60, bottom: 0, left: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
        <XAxis
          type="number"
          tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
          tickLine={false}
          axisLine={false}
          tickFormatter={v => v.toLocaleString()}
        />
        <YAxis
          type="category"
          dataKey="name"
          tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }}
          tickLine={false}
          axisLine={false}
          width={160}
        />
        <Tooltip
          contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 4, fontSize: 12 }}
          formatter={(val: number | undefined, _key?: string, props?: { payload?: SkillSummary }) => [
            `${(val ?? 0).toLocaleString()} calls · ${props?.payload?.session_count ?? 0} sessions · ${props?.payload?.project_count ?? 0} projects`,
            props?.payload?.name ?? '',
          ]}
        />
        <Bar dataKey="total_calls" radius={[0, 3, 3, 0]}>
          {top.map((_, i) => (
            <Cell key={i} fill={CATEGORY_COLORS.skill} fillOpacity={0.92} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
