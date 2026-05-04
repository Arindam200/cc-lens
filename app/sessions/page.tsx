'use client'

import useSWR from 'swr'
import { TopBar } from '@/components/layout/top-bar'
import { SessionTable } from '@/components/sessions/session-table'
import type { SessionWithFacet } from '@/types/claude'

const fetcher = (url: string) =>
  fetch(url).then(r => { if (!r.ok) throw new Error(`API error ${r.status}`); return r.json() })

export default function SessionsPage() {
  const { data, error, isLoading } = useSWR<{ sessions: SessionWithFacet[]; total: number }>(
    '/api/sessions',
    fetcher,
    { refreshInterval: 60_000 }
  )

  return (
    <div className="flex flex-col min-h-screen">
      <TopBar
        title="Claude Code Analytics · Sessions"
        subtitle={data ? `${data.total} total sessions` : 'loading...'}
      />
      <div className="p-6">
        {error && (
          <p className="text-[#f87171] text-sm font-mono">Error: {String(error)}</p>
        )}
        {isLoading && (
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-10 bg-muted rounded animate-pulse" />
            ))}
          </div>
        )}
        {data && <SessionTable sessions={data.sessions} />}
      </div>
    </div>
  )
}
