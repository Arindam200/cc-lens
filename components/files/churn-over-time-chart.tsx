'use client'

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { format, parseISO, subDays } from 'date-fns'
import type { FileChurnDaily } from '@/types/claude'

interface Props {
  data: FileChurnDaily[]
  days?: number
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-card border border-border rounded-lg px-3 py-2 text-[13px]">
      <p className="text-muted-foreground mb-1">{label}</p>
      {payload.map((p: { name: string; value: number; color: string }) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: <span className="font-bold">{p.value.toLocaleString()}</span>
        </p>
      ))}
    </div>
  )
}

export function ChurnOverTimeChart({ data, days = 90 }: Props) {
  const cutoff = subDays(new Date(), days)
  const filtered = data
    .filter((d) => {
      const parsed = parseISO(d.date)
      return !isNaN(parsed.getTime()) && parsed >= cutoff
    })
    .map((d) => ({
      date: format(parseISO(d.date), 'MMM d'),
      added: d.added,
      removed: d.removed,
    }))

  if (filtered.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
        no edits in this range
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={filtered} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
        <defs>
          <linearGradient id="gradAdded" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#34d399" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#34d399" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="gradRemoved" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#f87171" stopOpacity={0.25} />
            <stop offset="95%" stopColor="#f87171" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }}
          tickLine={false}
          axisLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v))}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend
          wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
          formatter={(value) => (
            <span style={{ color: 'var(--muted-foreground)', fontSize: 12 }}>{value}</span>
          )}
        />
        <Area
          type="monotone"
          dataKey="added"
          name="lines added"
          stroke="#34d399"
          strokeWidth={2}
          fill="url(#gradAdded)"
          dot={false}
          activeDot={{ r: 3, fill: '#6ee7b7' }}
        />
        <Area
          type="monotone"
          dataKey="removed"
          name="lines removed"
          stroke="#f87171"
          strokeWidth={1.5}
          fill="url(#gradRemoved)"
          dot={false}
          activeDot={{ r: 3, fill: '#fca5a5' }}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
