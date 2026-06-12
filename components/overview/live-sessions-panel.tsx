'use client'

import useSWR from 'swr'
import Link from 'next/link'
import { Radio } from 'lucide-react'
import { projectDisplayName, formatRelativeDate } from '@/lib/decode'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { LiveSession } from '@/types/claude'

const fetcher = (url: string) =>
  fetch(url).then(r => { if (!r.ok) throw new Error(`API error ${r.status}`); return r.json() })

function StatusBadge({ status }: { status?: string }) {
  if (status === 'running') {
    return (
      <Badge variant="outline" className="text-[#34d399] border-[#34d399]/30 bg-[#34d399]/10 gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-[#34d399] inline-block animate-pulse" />
        Running
      </Badge>
    )
  }
  return (
    <Badge variant="outline" className="text-amber-600 dark:text-amber-400 border-amber-500/30 bg-amber-500/10 gap-1.5">
      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block" />
      Idle
    </Badge>
  )
}

export function LiveSessionsPanel() {
  const { data } = useSWR<{ live: LiveSession[] }>('/api/live', fetcher, {
    refreshInterval: 5_000,
  })

  const live = data?.live ?? []
  if (live.length === 0) return null

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#34d399] opacity-60" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#34d399]" />
              </span>
              Live Sessions
            </CardTitle>
            <CardDescription>
              {live.length} live Claude Code {live.length === 1 ? 'process' : 'processes'} detected
            </CardDescription>
          </div>
          <Radio className="w-4 h-4 text-muted-foreground mt-0.5" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {live.map(s => (
            <Link
              key={s.pid}
              href={`/sessions/${s.sessionId}`}
              className="border border-border rounded-lg p-3 hover:border-primary/40 hover:bg-muted/50 transition-colors block"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-sm truncate" title={s.cwd}>
                  {projectDisplayName(s.cwd ?? '')}
                </span>
                <StatusBadge status={s.status} />
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-muted-foreground">
                <span className="font-mono">pid {s.pid}</span>
                {s.entrypoint && <span>{s.entrypoint}</span>}
                {s.version && <span className="font-mono">v{s.version}</span>}
                {s.startedAt && (
                  <span>started {formatRelativeDate(new Date(s.startedAt).toISOString())}</span>
                )}
              </div>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
