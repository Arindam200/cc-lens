import { formatCost, formatTokens } from '@/lib/decode'
import type { ModelCostBreakdown } from '@/types/claude'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'

interface Props {
  models: ModelCostBreakdown[]
  totalSavings: number
}

export function CacheEfficiencyPanel({ models, totalSavings }: Props) {
  const totalCacheRead = models.reduce((s, m) => s + m.cache_read_tokens, 0)
  const totalInput     = models.reduce((s, m) => s + m.input_tokens, 0)
  const totalContext   = totalInput + totalCacheRead
  const hitRate        = totalContext > 0 ? totalCacheRead / totalContext : 0
  const totalCost      = models.reduce((s, m) => s + m.estimated_cost, 0)
  const wouldHavePaid  = totalCost + totalSavings

  const pieData = [
    { name: 'Cache Read', value: totalCacheRead, color: '#34d399' },
    { name: 'Direct Input', value: totalInput, color: 'var(--viz-sky)' },
  ]

  return (
    <div className="grid grid-cols-[1fr_160px] gap-4 items-start">
      <div className="space-y-2 text-[13px]">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Cache hit rate</span>
          <span className="text-[#34d399] font-bold text-lg">{(hitRate * 100).toFixed(1)}%</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Context from cache</span>
          <span className="text-foreground font-mono">{formatTokens(totalCacheRead)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Context from input</span>
          <span className="text-foreground font-mono">{formatTokens(totalInput)}</span>
        </div>
        <div className="border-t border-border/50 pt-2 mt-2 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Without cache</span>
            <span className="text-red-400 font-mono">{formatCost(wouldHavePaid)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">You paid</span>
            <span className="text-foreground font-mono">{formatCost(totalCost)}</span>
          </div>
          <div className="flex items-center justify-between font-bold">
            <span className="text-[#34d399]">Savings</span>
            <span className="text-[#34d399] font-mono">{formatCost(totalSavings)}</span>
          </div>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={140}>
        <PieChart>
          <Pie
            data={pieData}
            cx="50%"
            cy="50%"
            innerRadius={35}
            outerRadius={60}
            dataKey="value"
            strokeWidth={0}
          >
            {pieData.map((entry, i) => (
              <Cell key={i} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 4, fontSize: 12 }}
            formatter={(val: number | undefined, name?: string) => [formatTokens(val ?? 0), name ?? '']}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
