import { formatTokens, formatCost } from '@/lib/decode'
import type { ModelCostBreakdown } from '@/types/claude'

function shortModel(m: string): string {
  if (m.includes('opus-4-7'))   return 'claude-opus-4.7'
  if (m.includes('opus-4-6'))   return 'claude-opus-4.6'
  if (m.includes('opus-4-5'))   return 'claude-opus-4.5'
  if (m.includes('sonnet-4-6')) return 'claude-sonnet-4.6'
  if (m.includes('haiku-4-5'))  return 'claude-haiku-4.5'
  return m
}

interface Props {
  models: ModelCostBreakdown[]
}

export function ModelTokenTable({ models }: Props) {
  const totals = models.reduce((acc, m) => ({
    input: acc.input + m.input_tokens,
    output: acc.output + m.output_tokens,
    cacheWrite: acc.cacheWrite + m.cache_write_tokens,
    cacheRead: acc.cacheRead + m.cache_read_tokens,
    cost: acc.cost + m.estimated_cost,
  }), { input: 0, output: 0, cacheWrite: 0, cacheRead: 0, cost: 0 })

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[13px] font-mono">
        <thead>
          <tr className="border-b border-border">
            {['Model', 'Input', 'Output', 'Cache W', 'Cache R', 'Cost'].map(h => (
              <th key={h} className={`py-2 text-[12px] font-bold text-muted-foreground uppercase tracking-wider ${h === 'Model' ? 'text-left' : 'text-right'}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {models.map(m => (
            <tr key={m.model} className="border-b border-border/30 hover:bg-muted/50 transition-colors">
              <td className="py-2 text-foreground/80">{shortModel(m.model)}</td>
              <td className="py-2 text-right text-blue-700 dark:text-[#60a5fa]">{formatTokens(m.input_tokens)}</td>
              <td className="py-2 text-right text-[#d97706]">{formatTokens(m.output_tokens)}</td>
              <td className="py-2 text-right text-[#a78bfa]">{formatTokens(m.cache_write_tokens)}</td>
              <td className="py-2 text-right text-[#34d399]">{formatTokens(m.cache_read_tokens)}</td>
              <td className="py-2 text-right text-[#d97706] font-bold">{formatCost(m.estimated_cost)}</td>
            </tr>
          ))}
          <tr className="border-t border-border font-bold">
            <td className="py-2 text-muted-foreground">TOTAL</td>
            <td className="py-2 text-right text-blue-700 dark:text-[#60a5fa]">{formatTokens(totals.input)}</td>
            <td className="py-2 text-right text-[#d97706]">{formatTokens(totals.output)}</td>
            <td className="py-2 text-right text-[#a78bfa]">{formatTokens(totals.cacheWrite)}</td>
            <td className="py-2 text-right text-[#34d399]">{formatTokens(totals.cacheRead)}</td>
            <td className="py-2 text-right text-[#d97706]">{formatCost(totals.cost)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}
