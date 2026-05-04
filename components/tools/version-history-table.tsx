import { formatDate } from '@/lib/decode'
import type { VersionRecord } from '@/types/claude'

interface Props {
  versions: VersionRecord[]
}

export function VersionHistoryTable({ versions }: Props) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm font-mono tabular-nums">
        <thead>
          <tr className="border-b border-border">
            {['Version', 'Sessions', 'First Seen', 'Last Seen'].map(h => (
              <th key={h} className={`py-2 text-[11px] font-medium font-mono text-muted-foreground uppercase tracking-[0.14em] ${h === 'Version' ? 'text-left' : 'text-right'}`}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {versions.map((v, i) => (
            <tr key={v.version} className={`border-b border-border/40 hover:bg-secondary transition-colors ${i === 0 ? 'text-primary' : 'text-foreground/70'}`}>
              <td className="py-2.5 font-bold">{v.version}</td>
              <td className="py-2.5 text-right">{v.session_count}</td>
              <td className="py-2.5 text-right text-muted-foreground">{v.first_seen ? formatDate(v.first_seen) : '—'}</td>
              <td className="py-2.5 text-right text-muted-foreground">{v.last_seen ? formatDate(v.last_seen) : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
