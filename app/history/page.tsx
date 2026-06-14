'use client'

import { useState, useMemo } from 'react'
import useSWR from 'swr'
import { TopBar } from '@/components/layout/top-bar'
import type { HistoryEntry } from '@/types/claude'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Search, AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react'

const fetcher = (url: string) =>
  fetch(url).then(r => { if (!r.ok) throw new Error(`API error ${r.status}`); return r.json() })

function formatTime(ts: number) {
  return new Date(ts).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  })
}

function projectName(p: string) {
  const parts = p.replace(/\\/g, '/').split('/')
  return parts[parts.length - 1] || p
}

const PAGE_SIZE = 50

export default function HistoryPage() {
  const { data, error, isLoading } = useSWR<{ history: HistoryEntry[] }>(
    '/api/history?limit=2000', fetcher, { refreshInterval: 30_000 }
  )
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const entries = useMemo(() => {
    const all = [...(data?.history ?? [])].reverse()
    if (!search) return all
    const q = search.toLowerCase()
    return all.filter(e =>
      e.display?.toLowerCase().includes(q) ||
      e.project?.toLowerCase().includes(q)
    )
  }, [data, search])

  const totalPages = Math.ceil(entries.length / PAGE_SIZE)
  const pageEntries = entries.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  function handleSearch(v: string) {
    setSearch(v)
    setPage(1)
  }

  return (
    <div className="flex flex-col min-h-screen">
      <TopBar title="History" subtitle="~/.claude/history.jsonl" />
      <div className="t-stagger-group p-4 md:p-6 space-y-4">

        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>Error loading data: {String(error)}</AlertDescription>
          </Alert>
        )}

        {isLoading && (
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-lg" />)}
          </div>
        )}

        {data && (
          <>
            {/* Search + count */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <div className="relative flex-1 w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search commands…"
                  value={search}
                  onChange={e => handleSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Badge variant="outline" className="whitespace-nowrap text-sm px-3 py-1.5">
                {entries.length.toLocaleString()} entries
              </Badge>
            </div>

            {pageEntries.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground text-sm">
                {(data.history?.length ?? 0) === 0
                  ? 'No history found in ~/.claude/history.jsonl'
                  : 'No entries match your search.'}
              </div>
            ) : (
              <>
                <div className="space-y-1">
                  {pageEntries.map((entry, i) => (
                    <div
                      key={i}
                      className="border border-border rounded-lg bg-card px-4 py-3 hover:border-primary/30 transition-colors"
                    >
                      <p className="text-sm font-mono text-foreground leading-relaxed break-words">
                        {entry.display || '—'}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 mt-1.5">
                        {entry.timestamp && (
                          <span className="text-xs text-muted-foreground/60">
                            {formatTime(entry.timestamp)}
                          </span>
                        )}
                        {entry.project && (
                          <Badge variant="secondary" className="text-xs font-mono">
                            {projectName(entry.project)}
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                    >
                      <ChevronLeft className="w-4 h-4" />
                      Prev
                    </Button>
                    <span className="text-sm text-muted-foreground tabular-nums">
                      {page} / {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                    >
                      Next
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
