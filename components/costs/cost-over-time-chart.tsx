'use client'

import { useMemo } from 'react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from 'recharts'
import { formatCost } from '@/lib/decode'
import type { DailyCost } from '@/types/claude'

const MODEL_COLORS: Record<string, string> = {
  'claude-opus-4-7':        '#f97316',
  'claude-opus-4-6':        '#d97706',
  'claude-opus-4-5-20251101': '#a78bfa',
  'claude-sonnet-4-6':      'var(--viz-sky)',
  'claude-haiku-4-5':       '#34d399',
}

function colorForModel(m: string): string {
  for (const [key, col] of Object.entries(MODEL_COLORS)) {
    if (m.includes(key.split('-').slice(2).join('-'))) return col
  }
  return '#7a8494'
}

function shortModel(m: string): string {
  if (m.includes('opus-4-7'))   return 'Opus 4.7'
  if (m.includes('opus-4-6'))   return 'Opus 4.6'
  if (m.includes('opus-4-5'))   return 'Opus 4.5'
  if (m.includes('sonnet-4-6')) return 'Sonnet 4.6'
  if (m.includes('haiku-4-5'))  return 'Haiku 4.5'
  return m
}

interface Props {
  daily: DailyCost[]
  window: Window
  onWindowChange: (window: Window) => void
}

export type CostWindow = 30 | 90 | 'all'
type Window = CostWindow

export function CostOverTimeChart({ daily, window, onWindowChange }: Props) {
  const { data, models } = useMemo(() => {
    const sorted = [...daily].sort((a, b) => a.date.localeCompare(b.date))
    const sliced = sorted
    const modelSet = new Set<string>()
    for (const d of sliced) Object.keys(d.costs ?? {}).forEach(m => modelSet.add(m))
    const models = [...modelSet]
    return {
      data: sliced.map(d => ({
        date: d.date.slice(5), // MM-DD
        ...Object.fromEntries(models.map(m => [m, d.costs[m] ?? 0])),
        total: d.total,
      })),
      models,
    }
  }, [daily])

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[13px] font-bold text-muted-foreground uppercase tracking-widest">Cost Over Time</h3>
        <div className="flex gap-1">
          {([30, 90, 'all'] as Window[]).map(w => (
            <button
              key={w}
              onClick={() => onWindowChange(w)}
              className={`px-2 py-0.5 rounded text-[12px] transition-colors ${window === w ? 'bg-primary text-black font-bold' : 'text-muted-foreground hover:text-foreground border border-border'}`}
            >
              {w === 'all' ? 'All' : `${w}d`}
            </button>
          ))}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
          <YAxis tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} tickFormatter={v => `$${v.toFixed(2)}`} width={48} />
          <Tooltip
            contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 4, fontSize: 12 }}
            formatter={(val: number | undefined, name?: string) => [formatCost(val ?? 0), shortModel(name ?? '')]}
          />
          {models.map(m => (
            <Area
              key={m}
              type="monotone"
              dataKey={m}
              stackId="1"
              stroke={colorForModel(m)}
              fill={colorForModel(m) + '30'}
              strokeWidth={1.5}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
