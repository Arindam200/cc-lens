'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { SessionBadges } from './session-badges'
import { formatCost, formatDuration, formatDate, projectDisplayName } from '@/lib/decode'
import type { SessionWithFacet } from '@/types/claude'

const PAGE_SIZE = 25

type SortKey = 'start_time' | 'duration_minutes' | 'total_messages' | 'estimated_cost' | 'tool_calls'
type SortDir = 'asc' | 'desc'

interface Props {
  sessions: SessionWithFacet[]
}

function SortHeader({
  label, k, sortKey, sortDir, onSort,
}: {
  label: string
  k: SortKey
  sortKey: SortKey
  sortDir: SortDir
  onSort: (k: SortKey) => void
}) {
  const active = sortKey === k
  return (
    <button
      onClick={() => onSort(k)}
      className={`text-left text-[12px] font-bold uppercase tracking-wider whitespace-nowrap hover:text-foreground transition-colors ${active ? 'text-primary' : 'text-muted-foreground'}`}
    >
      {label} {active ? (sortDir === 'desc' ? '↓' : '↑') : ''}
    </button>
  )
}

export function SessionTable({ sessions }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('start_time')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [page, setPage] = useState(1)
  const [filterCompacted, setFilterCompacted] = useState(false)
  const [filterAgent, setFilterAgent] = useState(false)
  const [filterMcp, setFilterMcp] = useState(false)
  const [search, setSearch] = useState('')
  const [focusedIdx, setFocusedIdx] = useState<number | null>(null)
  const rowRefs = useRef<(HTMLTableRowElement | null)[]>([])
  const router = useRouter()

  const filtered = useMemo(() => {
    let s = sessions
    if (filterCompacted) s = s.filter(x => x.has_compaction)
    if (filterAgent)     s = s.filter(x => x.uses_task_agent)
    if (filterMcp)       s = s.filter(x => x.uses_mcp)
    if (search) {
      const q = search.toLowerCase()
      s = s.filter(x =>
        x.project_path?.toLowerCase().includes(q) ||
        x.first_prompt?.toLowerCase().includes(q) ||
        x.slug?.toLowerCase().includes(q)
      )
    }
    return s
  }, [sessions, filterCompacted, filterAgent, filterMcp, search])

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let av: number, bv: number
      if (sortKey === 'start_time') {
        av = new Date(a.start_time).getTime()
        bv = new Date(b.start_time).getTime()
      } else if (sortKey === 'total_messages') {
        av = (a.user_message_count ?? 0) + (a.assistant_message_count ?? 0)
        bv = (b.user_message_count ?? 0) + (b.assistant_message_count ?? 0)
      } else if (sortKey === 'tool_calls') {
        av = Object.values(a.tool_counts ?? {}).reduce((s, c) => s + c, 0)
        bv = Object.values(b.tool_counts ?? {}).reduce((s, c) => s + c, 0)
      } else {
        av = (a[sortKey] as number) ?? 0
        bv = (b[sortKey] as number) ?? 0
      }
      return sortDir === 'desc' ? bv - av : av - bv
    })
  }, [filtered, sortKey, sortDir])

  const totalPages = Math.ceil(sorted.length / PAGE_SIZE)
  const paginated = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  // j/k keyboard navigation for rows
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      const el = document.activeElement
      const tag = el?.tagName.toLowerCase()
      if (tag === 'input' || tag === 'textarea' || (el as HTMLElement)?.isContentEditable) return

      if (e.key === 'j') {
        e.preventDefault()
        setFocusedIdx(i => {
          const next = i === null ? 0 : Math.min(i + 1, paginated.length - 1)
          rowRefs.current[next]?.scrollIntoView({ block: 'nearest' })
          return next
        })
      } else if (e.key === 'k') {
        e.preventDefault()
        setFocusedIdx(i => {
          const next = i === null ? 0 : Math.max(i - 1, 0)
          rowRefs.current[next]?.scrollIntoView({ block: 'nearest' })
          return next
        })
      } else if (e.key === 'Enter' && focusedIdx !== null) {
        const s = paginated[focusedIdx]
        if (s) router.push(`/sessions/${s.session_id}`)
      } else if (e.key === 'Escape' && focusedIdx !== null) {
        setFocusedIdx(null)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [focusedIdx, paginated, router])

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    else { setSortKey(key); setSortDir('desc') }
    setPage(1)
    setFocusedIdx(null)
  }

  return (
    <div className="space-y-3">
      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <input
          type="text"
          placeholder="Search project or prompt..."
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); setFocusedIdx(null) }}
          className="bg-muted border border-border rounded px-2 py-1 text-[13px] text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-primary/50 w-52"
        />
        <label className="flex items-center gap-1.5 text-[13px] text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
          <input
            type="checkbox"
            checked={filterCompacted}
            onChange={e => { setFilterCompacted(e.target.checked); setPage(1); setFocusedIdx(null) }}
            className="accent-amber-500"
          />
          ⚡ compacted
        </label>
        <label className="flex items-center gap-1.5 text-[13px] text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
          <input
            type="checkbox"
            checked={filterAgent}
            onChange={e => { setFilterAgent(e.target.checked); setPage(1); setFocusedIdx(null) }}
            className="accent-purple-500"
          />
          🤖 agent
        </label>
        <label className="flex items-center gap-1.5 text-[13px] text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
          <input
            type="checkbox"
            checked={filterMcp}
            onChange={e => { setFilterMcp(e.target.checked); setPage(1); setFocusedIdx(null) }}
            className="accent-blue-500"
          />
          🔌 mcp
        </label>
        <span className="ml-auto text-[13px] text-muted-foreground">
          {filtered.length} sessions
        </span>
      </div>

      {/* Table */}
      <div className="border border-border rounded overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-border bg-muted">
                <th className="px-3 py-2 text-left"><SortHeader label="Date" k="start_time" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} /></th>
                <th className="px-3 py-2 text-left"><span className="text-[12px] font-bold uppercase tracking-wider text-muted-foreground">Project</span></th>
                <th className="px-3 py-2 text-right"><SortHeader label="Dur" k="duration_minutes" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} /></th>
                <th className="px-3 py-2 text-right"><SortHeader label="Msgs" k="total_messages" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} /></th>
                <th className="px-3 py-2 text-right"><SortHeader label="Tools" k="tool_calls" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} /></th>
                <th className="px-3 py-2 text-right"><SortHeader label="Cost" k="estimated_cost" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} /></th>
                <th className="px-3 py-2 text-left"><span className="text-[12px] font-bold uppercase tracking-wider text-muted-foreground">Flags</span></th>
              </tr>
            </thead>
            <tbody>
              {paginated.map((s, i) => {
                const totalMsgs = (s.user_message_count ?? 0) + (s.assistant_message_count ?? 0)
                const totalTools = Object.values(s.tool_counts ?? {}).reduce((sum, c) => sum + c, 0)
                const projectName = projectDisplayName(s.project_path ?? '')

                return (
                  <tr
                    key={s.session_id}
                    ref={el => { rowRefs.current[i] = el }}
                    className={[
                      'border-b border-border/50 hover:bg-muted transition-colors',
                      i % 2 === 0 ? '' : 'bg-muted/30',
                      i === focusedIdx ? 'ring-2 ring-primary ring-inset bg-muted' : '',
                    ].join(' ')}
                  >
                    <td className="px-3 py-2 font-mono text-muted-foreground whitespace-nowrap">
                      {formatDate(s.start_time)}
                    </td>
                    <td className="px-3 py-2 max-w-[200px]">
                      <Link
                        href={`/sessions/${s.session_id}`}
                        className="text-foreground hover:text-primary transition-colors font-medium truncate block"
                        title={s.project_path ?? ''}
                      >
                        {projectName}
                      </Link>
                      {s.first_prompt && (
                        <p className="text-muted-foreground/60 truncate text-[12px]">
                          {s.first_prompt.slice(0, 60)}
                        </p>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right text-muted-foreground whitespace-nowrap">
                      {formatDuration(s.duration_minutes ?? 0)}
                    </td>
                    <td className="px-3 py-2 text-right text-muted-foreground">
                      {totalMsgs.toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-right text-muted-foreground">
                      {totalTools.toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-primary">
                      {formatCost(s.estimated_cost)}
                    </td>
                    <td className="px-3 py-2">
                      <SessionBadges
                        has_compaction={s.has_compaction}
                        uses_task_agent={s.uses_task_agent}
                        uses_mcp={s.uses_mcp}
                        uses_web_search={s.uses_web_search}
                        uses_web_fetch={s.uses_web_fetch}
                        has_thinking={s.has_thinking}
                      />
                    </td>
                  </tr>
                )
              })}
              {paginated.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground/50 text-[13px]">
                    No sessions match filters
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-[13px]">
          <span className="text-muted-foreground">
            Page {page} of {totalPages} · {sorted.length} sessions
          </span>
          <div className="flex gap-1">
            <button
              onClick={() => { setPage(p => Math.max(1, p - 1)); setFocusedIdx(null) }}
              disabled={page === 1}
              className="px-2 py-1 rounded border border-border text-muted-foreground hover:text-foreground hover:border-primary/40 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              ←
            </button>
            {(() => {
              const maxVisible = Math.min(5, totalPages)
              const startPage = Math.max(1, Math.min(page - 2, totalPages - maxVisible + 1))
              const numPages = Math.min(maxVisible, totalPages - startPage + 1)
              const pages = Array.from({ length: numPages }, (_, i) => startPage + i)
              return pages.map((p) => (
                <button
                  key={p}
                  onClick={() => { setPage(p); setFocusedIdx(null) }}
                  className={`px-2 py-1 rounded border transition-colors ${p === page ? 'border-primary text-primary' : 'border-border text-muted-foreground hover:text-foreground hover:border-primary/40'}`}
                >
                  {p}
                </button>
              ))
            })()}
            <button
              onClick={() => { setPage(p => Math.min(totalPages, p + 1)); setFocusedIdx(null) }}
              disabled={page === totalPages}
              className="px-2 py-1 rounded border border-border text-muted-foreground hover:text-foreground hover:border-primary/40 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
