import type { McpServerSummary } from '@/types/claude'

interface Props {
  servers: McpServerSummary[]
}

export function McpServerPanel({ servers }: Props) {
  if (servers.length === 0) {
    return <p className="text-muted-foreground/50 text-sm">No MCP server usage detected</p>
  }

  return (
    <div className="space-y-4">
      {servers.map(srv => {
        const maxCalls = srv.tools[0]?.calls ?? 1
        return (
          <div key={srv.server_name} className="border border-border rounded-lg p-3.5 bg-card">
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-sm font-medium text-foreground">
                <span className="mr-1.5 text-primary">🔌</span>{srv.server_name}
              </span>
              <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground/70 tabular-nums">
                {srv.tools.length} tools · {srv.total_calls.toLocaleString()} calls · {srv.session_count} sessions
              </span>
            </div>
            <div className="space-y-1.5">
              {srv.tools.map(t => {
                const width = Math.max(4, Math.round((t.calls / maxCalls) * 100))
                return (
                  <div key={t.name} className="flex items-center gap-2 text-xs">
                    <span className="text-muted-foreground/80 w-44 truncate font-mono" title={t.name}>{t.name}</span>
                    <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-primary/60" style={{ width: `${width}%` }} />
                    </div>
                    <span className="text-muted-foreground/60 w-12 text-right tabular-nums font-mono">{t.calls}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
