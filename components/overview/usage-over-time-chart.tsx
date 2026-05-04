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
import type { DailyActivity } from '@/types/claude'
import { format, parseISO, subDays } from 'date-fns'

interface Props {
  data: DailyActivity[]
  days?: number
  dateFrom?: string
  dateTo?: string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-card border border-border rounded-lg px-3 py-2 text-xs">
      <p className="text-muted-foreground mb-1">{label}</p>
      {payload.map((p: { name: string; value: number; color: string }) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: <span className="font-bold">{p.value.toLocaleString()}</span>
        </p>
      ))}
    </div>
  )
}

function toIsoDate(val: string): string | null {
  const m = val.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/)
  if (m) {
    const [, month, day, year] = m
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
  }
  const iso = val.match(/^(\d{4})-(\d{2})-(\d{2})/)
  return iso ? val.slice(0, 10) : null
}

function parseDateInput(val: string): Date | null {
  const parsed = new Date(val)
  return isNaN(parsed.getTime()) ? null : parsed
}

export function UsageOverTimeChart({ data, days = 90, dateFrom, dateTo }: Props) {
  let filtered: { date: string; messages: number; sessions: number }[]

  if (dateFrom && dateTo) {
    const fromStr = toIsoDate(dateFrom.trim())
    const toStr = toIsoDate(dateTo.trim())
    if (fromStr && toStr && fromStr <= toStr) {
      filtered = data
        .filter((d) => {
          const dataDate = /^\d{4}-\d{2}-\d{2}/.test(d.date)
            ? d.date.slice(0, 10)
            : toIsoDate(d.date)
          if (!dataDate) return false
          return dataDate >= fromStr && dataDate <= toStr
        })
        .map((d) => ({
          date: (() => {
            try {
              const parsed = d.date.includes('-') ? parseISO(d.date) : new Date(d.date)
              return isNaN(parsed.getTime()) ? d.date : format(parsed, 'dd/MM')
            } catch {
              return d.date
            }
          })(),
          messages: d.messageCount,
          sessions: d.sessionCount,
        }))
    } else {
      filtered = []
    }
  } else {
    const cutoff = subDays(new Date(), days)
    filtered = data
      .filter((d) => parseISO(d.date) >= cutoff)
      .map((d) => ({
        date: format(parseISO(d.date), 'dd/MM'),
        messages: d.messageCount,
        sessions: d.sessionCount,
      }))
  }

  if (filtered.length === 0) {
    const from = dateFrom && dateTo ? parseDateInput(dateFrom) : null
    const to = dateFrom && dateTo ? parseDateInput(dateTo) : null
    const isFuture = from && to && from > new Date()
    return (
      <div className="flex flex-col items-center justify-center h-48 text-muted-foreground text-sm gap-1">
        <span>no data</span>
        {isFuture && (
          <span className="text-xs text-muted-foreground/60">(selected range is in the future)</span>
        )}
        {dateFrom && dateTo && !isFuture && (
          <span className="text-xs text-muted-foreground/60">(no activity in this date range)</span>
        )}
      </div>
    )
  }

  const indigo = '#6366F1'
  const teal = '#14B8A6'

  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={filtered} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
        <defs>
          <linearGradient id="gradMessages" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor={indigo} stopOpacity={0.28} />
            <stop offset="95%" stopColor={indigo} stopOpacity={0} />
          </linearGradient>
          <linearGradient id="gradSessions" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor={teal} stopOpacity={0.18} />
            <stop offset="95%" stopColor={teal} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
          tickLine={false}
          axisLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v: number) => {
            if (v === 0) return ''
            if (v >= 1000) { const k = v / 1000; return Number.isInteger(k) ? `${k}k` : `${k.toFixed(1)}k` }
            return String(v)
          }}
          width={32}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend
          wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
          formatter={(value) => (
            <span style={{ color: 'var(--muted-foreground)', fontSize: 11 }}>{value}</span>
          )}
        />
        <Area
          type="monotone"
          dataKey="messages"
          stroke={indigo}
          strokeWidth={2}
          fill="url(#gradMessages)"
          dot={false}
          activeDot={{ r: 3, fill: indigo }}
        />
        <Area
          type="monotone"
          dataKey="sessions"
          stroke={teal}
          strokeWidth={1.5}
          fill="url(#gradSessions)"
          dot={false}
          activeDot={{ r: 3, fill: teal }}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
