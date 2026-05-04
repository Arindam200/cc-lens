'use client'

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Cell } from 'recharts'
import { Coffee, BatteryCharging, Trophy } from 'lucide-react'

export interface DisconnectionStats {
  current_rest_streak: number
  rest_rate_30d: number
  rest_days_30d: number
  longest_break: number
  gaps: Array<{ from: string; to: string; days: number }>
}

interface Props {
  stats: DisconnectionStats
}

function barColor(days: number): string {
  if (days >= 7) return '#22C55E' // success
  if (days >= 3) return '#E0B341' // warning
  return '#EF4444' // error
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const { from, to, days } = payload[0].payload
  return (
    <div className="bg-card border border-border rounded-lg px-3 py-2 text-xs space-y-0.5 shadow-md">
      <p className="text-muted-foreground">{from} → {to}</p>
      <p className="font-bold text-foreground">{days} jour{days > 1 ? 's' : ''} sans Claude</p>
    </div>
  )
}

export function DisconnectionPanel({ stats }: Props) {
  const chartData = stats.gaps.map(g => ({ ...g, label: g.from.slice(5) }))

  return (
    <div className="space-y-5">
      {/* Stat tiles */}
      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Coffee className="w-3.5 h-3.5 shrink-0" /> Break en cours
          </p>
          <p className="text-3xl font-bold font-mono tabular-nums tracking-[-0.02em]" style={{ color: stats.current_rest_streak >= 1 ? 'var(--success)' : 'var(--error)' }}>
            {stats.current_rest_streak}j
          </p>
          <p className="text-xs text-muted-foreground">jours consécutifs sans Claude</p>
        </div>

        <div className="space-y-1">
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <BatteryCharging className="w-3.5 h-3.5 shrink-0" /> Repos / 30j
          </p>
          <p className="text-3xl font-bold font-mono tabular-nums text-primary tracking-[-0.02em]">
            {stats.rest_rate_30d}%
          </p>
          <p className="text-xs text-muted-foreground">{stats.rest_days_30d} jours off sur 30</p>
        </div>

        <div className="space-y-1">
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Trophy className="w-3.5 h-3.5 shrink-0" /> Plus long break
          </p>
          <p className="text-3xl font-bold font-mono tabular-nums text-[var(--warning)] tracking-[-0.02em]">
            {stats.longest_break}j
          </p>
          <p className="text-xs text-muted-foreground">record personnel de déco</p>
        </div>
      </div>

      {/* Gaps timeline */}
      {chartData.length > 0 ? (
        <div>
          <p className="text-xs text-muted-foreground mb-3">
            Historique des pauses ·{' '}
            <span className="text-[var(--success)]">7j+ vraie déco</span>
            {' · '}
            <span className="text-[var(--warning)]">3-6j mini-break</span>
            {' · '}
            <span className="text-[var(--error)]">1-2j weekend</span>
          </p>
          <ResponsiveContainer width="100%" height={150}>
            <BarChart data={chartData} margin={{ top: 4, right: 4, bottom: 4, left: 0 }}>
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
                tickLine={false}
                axisLine={false}
                width={20}
                allowDecimals={false}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(99,102,241,0.06)' }} />
              <ReferenceLine y={7} stroke="#22C55E" strokeDasharray="4 3" strokeOpacity={0.4} />
              <Bar dataKey="days" radius={[3, 3, 0, 0]} maxBarSize={28}>
                {chartData.map((d, i) => (
                  <Cell key={i} fill={barColor(d.days)} fillOpacity={0.85} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground text-center py-6">
          Aucune pause détectée — Claude tous les jours
        </p>
      )}
    </div>
  )
}
