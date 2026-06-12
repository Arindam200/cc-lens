'use client'

import useSWR from 'swr'
import Link from 'next/link'
import { TopBar } from '@/components/layout/top-bar'

const fetcher = (url: string) =>
  fetch(url).then(r => { if (!r.ok) throw new Error(`API error ${r.status}`); return r.json() })

function formatBytes(b: number) {
  if (b >= 1_073_741_824) return (b / 1_073_741_824).toFixed(2) + ' GB'
  if (b >= 1_048_576) return (b / 1_048_576).toFixed(1) + ' MB'
  if (b >= 1_024) return (b / 1_024).toFixed(1) + ' KB'
  return b + ' B'
}

function JsonValue({ value, depth = 0 }: { value: unknown; depth?: number }) {
  if (value === null) return <span className="text-muted-foreground">null</span>
  if (typeof value === 'boolean')
    return <span className="text-amber-700 dark:text-[#fbbf24]">{String(value)}</span>
  if (typeof value === 'number')
    return <span className="text-emerald-700 dark:text-[#6ee7b7]">{value}</span>
  if (typeof value === 'string')
    return <span className="text-orange-400 dark:text-[#f9a875]">&quot;{value}&quot;</span>
  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="text-muted-foreground">[]</span>
    return (
      <span>
        <span className="text-muted-foreground">[</span>
        <div className="pl-4">
          {value.map((v, i) => (
            <div key={i}>
              <JsonValue value={v} depth={depth + 1} />
              {i < value.length - 1 && <span className="text-muted-foreground/60">,</span>}
            </div>
          ))}
        </div>
        <span className="text-muted-foreground">]</span>
      </span>
    )
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
    if (entries.length === 0) return <span className="text-muted-foreground">{'{}'}</span>
    return (
      <span>
        <span className="text-muted-foreground">{'{'}</span>
        <div className="pl-4">
          {entries.map(([k, v], i) => (
            <div key={k}>
              <span className="text-muted-foreground">&quot;</span>
              <span className="text-blue-700 dark:text-[#93c5fd]">{k}</span>
              <span className="text-muted-foreground">&quot;</span>
              <span className="text-muted-foreground/60">: </span>
              <JsonValue value={v} depth={depth + 1} />
              {i < entries.length - 1 && <span className="text-muted-foreground/60">,</span>}
            </div>
          ))}
        </div>
        <span className="text-muted-foreground">{'}'}</span>
      </span>
    )
  }
  return <span className="text-foreground">{String(value)}</span>
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border border-border rounded bg-card p-4">
      <h2 className="text-[13px] font-bold text-muted-foreground uppercase tracking-widest mb-4">{title}</h2>
      {children}
    </div>
  )
}

export default function SettingsPage() {
  const { data, error, isLoading } = useSWR<{
    settings: Record<string, unknown>
    storageBytes: number
  }>('/api/settings', fetcher, { refreshInterval: 30_000 })

  return (
    <div className="flex flex-col min-h-screen">
      <TopBar title="claude-code-lens · settings" subtitle="~/.claude/settings.json" />
      <div className="p-4 md:p-6 space-y-6">
        {error && <p className="text-[#f87171] text-sm font-mono">Error: {String(error)}</p>}
        {isLoading && (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-32 bg-muted rounded animate-pulse" />
            ))}
          </div>
        )}
        {data && (
          <>
            <Section title="Storage">
              <div className="flex items-center gap-3">
                <span className="text-primary text-2xl font-mono font-bold">
                  {formatBytes(data.storageBytes)}
                </span>
                <span className="text-muted-foreground text-sm font-mono">used by ~/.claude/</span>
              </div>
            </Section>

            <Section title="Settings">
              {Object.keys(data.settings).length === 0 ? (
                <p className="text-muted-foreground/60 text-sm font-mono">No settings found in ~/.claude/settings.json</p>
              ) : (
                <div className="font-mono text-sm leading-relaxed overflow-x-auto">
                  <JsonValue value={data.settings} />
                </div>
              )}
            </Section>

            {data.settings.env && (
              <Section title="Environment Variables">
                <div className="font-mono text-sm leading-relaxed overflow-x-auto">
                  <JsonValue value={data.settings.env} />
                </div>
              </Section>
            )}

            {data.settings.mcpServers && (
              <Section title="MCP Servers">
                <div className="space-y-3">
                  {Object.entries(data.settings.mcpServers as Record<string, unknown>).map(([name, cfg]) => (
                    <div key={name} className="border border-border rounded p-3">
                      <p className="text-primary font-mono text-sm font-bold mb-2">{name}</p>
                      <div className="font-mono text-xs text-muted-foreground overflow-x-auto">
                        <JsonValue value={cfg} />
                      </div>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            <Section title="Customizations">
              <p className="text-sm text-muted-foreground">
                Skills, plugins, agents, commands, rules, and hooks now live in the{' '}
                <Link href="/workspace" className="text-primary hover:underline">Workspace</Link> page.
              </p>
            </Section>
          </>
        )}
      </div>
    </div>
  )
}
