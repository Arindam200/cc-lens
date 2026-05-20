'use client'

import { useState, useMemo } from 'react'
import useSWR, { mutate } from 'swr'
import { TopBar } from '@/components/layout/top-bar'
import type { MemoryEntry, MemoryType } from '@/lib/claude-reader'
import { projectDisplayName, projectShortPath, formatRelativeDate } from '@/lib/decode'

const fetcher = (url: string) =>
  fetch(url).then(r => { if (!r.ok) throw new Error(`API error ${r.status}`); return r.json() })

// ── Type config ───────────────────────────────────────────────────────────────

const TYPE_META: Record<MemoryType, { label: string; color: string; bg: string; border: string; dot: string }> = {
  user:      { label: 'user',      color: 'text-blue-700 dark:text-blue-400', bg: 'bg-blue-700/10 dark:bg-blue-400/10', border: 'border-blue-700/30 dark:border-blue-400/30', dot: 'var(--viz-sky)' },
  feedback:  { label: 'feedback',  color: 'text-[#f87171]', bg: 'bg-[#f87171]/10', border: 'border-[#f87171]/30', dot: '#f87171' },
  project:   { label: 'project',   color: 'text-[#a78bfa]', bg: 'bg-[#a78bfa]/10', border: 'border-[#a78bfa]/30', dot: '#a78bfa' },
  reference: { label: 'reference', color: 'text-[#34d399]', bg: 'bg-[#34d399]/10', border: 'border-[#34d399]/30', dot: '#34d399' },
  index:     { label: 'index',     color: 'text-[#fbbf24]', bg: 'bg-[#fbbf24]/10', border: 'border-[#fbbf24]/30', dot: '#fbbf24' },
  unknown:   { label: '?',         color: 'text-muted-foreground', bg: 'bg-muted', border: 'border-border', dot: '#94a3b8' },
}

const FILTER_TYPES = ['all', 'user', 'feedback', 'project', 'reference', 'index'] as const
type FilterType = typeof FILTER_TYPES[number]

function TypeBadge({ type }: { type: MemoryType }) {
  const m = TYPE_META[type] ?? TYPE_META.unknown
  return (
    <span className={`text-[10px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${m.color} ${m.bg} ${m.border}`}>
      {m.label}
    </span>
  )
}

function StaleBadge({ mtime }: { mtime: string }) {
  // eslint-disable-next-line react-hooks/purity
  const daysOld = Math.floor((Date.now() - new Date(mtime).getTime()) / 86_400_000)
  if (daysOld < 30) return null
  return (
    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-[#f87171]/30 bg-[#f87171]/10 text-[#f87171]">
      stale
    </span>
  )
}

// ── Memory card ───────────────────────────────────────────────────────────────

function MemoryCard({ entry, onClick, expanded }: { entry: MemoryEntry; onClick: () => void; expanded: boolean }) {
  const projectName = projectDisplayName(entry.projectPath)
  const shortPath = projectShortPath(entry.projectPath)
  const m = TYPE_META[entry.type] ?? TYPE_META.unknown
  const preview = entry.body.slice(0, 200).replace(/\n+/g, ' ').trim()

  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(entry.body)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  async function handleSave(e: React.MouseEvent) {
    e.stopPropagation()
    setSaving(true)
    setSaveError(null)
    try {
      const res = await fetch('/api/memory', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectSlug: entry.projectSlug,
          file: entry.file,
          content: draft,
        }),
      })
      if (!res.ok) {
        const { error } = await res.json()
        setSaveError(error ?? 'Save failed')
      } else {
        setEditing(false)
        mutate('/api/memory')
      }
    } catch (err) {
      setSaveError(String(err))
    } finally {
      setSaving(false)
    }
  }

  function handleEdit(e: React.MouseEvent) {
    e.stopPropagation()
    setDraft(entry.body)
    setSaveError(null)
    setEditing(true)
  }

  function handleCancel(e: React.MouseEvent) {
    e.stopPropagation()
    setEditing(false)
    setSaveError(null)
    setDraft(entry.body)
  }

  return (
    <div
      className={[
        'border rounded-lg bg-card transition-all',
        editing ? 'cursor-default' : 'cursor-pointer',
        expanded ? '' : 'hover:border-primary/30',
        'border-border',
      ].join(' ')}
      onClick={editing ? undefined : onClick}
      style={expanded ? { borderColor: m.dot + '66' } : undefined}
    >
      <div className="px-4 py-3.5 flex items-start gap-3">
        {/* Type dot */}
        <div
          className="flex-shrink-0 w-2 h-2 rounded-full mt-2"
          style={{ backgroundColor: m.dot }}
        />

        <div className="flex-1 min-w-0 space-y-1.5">
          {/* Header row */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-mono font-semibold text-foreground truncate">{entry.name}</span>
            <TypeBadge type={entry.type} />
            <StaleBadge mtime={entry.mtime} />
            {expanded && !editing && (
              <button
                onClick={handleEdit}
                className="ml-auto text-[10px] font-mono px-2 py-0.5 rounded border border-border text-muted-foreground hover:border-primary/40 hover:text-foreground transition-colors"
              >
                edit
              </button>
            )}
          </div>

          {/* Description */}
          {entry.description && (
            <p className="text-xs font-mono text-muted-foreground">{entry.description}</p>
          )}

          {/* Body preview (collapsed) */}
          {!expanded && preview && (
            <p className="text-xs font-mono text-muted-foreground/60 line-clamp-2">{preview}</p>
          )}

          {/* Full body (expanded, read mode) */}
          {expanded && !editing && (
            <pre className="mt-2 text-xs font-mono text-foreground/80 whitespace-pre-wrap bg-muted/40 rounded p-3 overflow-x-auto max-h-96 overflow-y-auto">
              {entry.body}
            </pre>
          )}

          {/* Edit mode */}
          {expanded && editing && (
            <div className="mt-2 space-y-2" onClick={e => e.stopPropagation()}>
              <textarea
                className="w-full min-h-64 bg-muted/40 border border-primary/40 rounded p-3 text-xs font-mono text-foreground resize-y outline-none focus:border-primary/70 transition-colors"
                value={draft}
                onChange={e => setDraft(e.target.value)}
                spellCheck={false}
              />
              {saveError && (
                <p className="text-[11px] font-mono text-[#f87171]">{saveError}</p>
              )}
              <div className="flex gap-2">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-3 py-1.5 text-xs font-mono rounded border border-[#34d399]/50 text-[#34d399] bg-[#34d399]/10 hover:bg-[#34d399]/20 disabled:opacity-50 transition-colors"
                >
                  {saving ? 'saving…' : 'save'}
                </button>
                <button
                  onClick={handleCancel}
                  disabled={saving}
                  className="px-3 py-1.5 text-xs font-mono rounded border border-border text-muted-foreground hover:text-foreground hover:border-primary/30 disabled:opacity-50 transition-colors"
                >
                  cancel
                </button>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="flex flex-wrap items-center gap-2 pt-0.5">
            <span className="text-[10px] font-mono text-muted-foreground/60 bg-muted px-1.5 py-0.5 rounded">
              {projectName}
            </span>
            <span className="text-[10px] font-mono text-muted-foreground/40">{shortPath}</span>
            <span className="text-[10px] font-mono text-muted-foreground/50 ml-auto">
              {formatRelativeDate(entry.mtime)}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <div className="border border-border bg-card rounded-lg px-4 py-3 flex flex-col gap-1">
      <span className="text-2xl font-mono font-bold" style={{ color }}>{value}</span>
      <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">{label}</span>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function MemoryPage() {
  const { data, error, isLoading } = useSWR<{ memories: MemoryEntry[] }>(
    '/api/memory', fetcher, { refreshInterval: 15_000 }
  )
  const [filter, setFilter] = useState<FilterType>('all')
  const [search, setSearch] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const memories = useMemo(() => data?.memories ?? [], [data?.memories])

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: memories.length }
    for (const type of ['user', 'feedback', 'project', 'reference', 'index']) {
      c[type] = memories.filter(m => m.type === type).length
    }
    return c
  }, [memories])

  const staleCount = useMemo(
    // eslint-disable-next-line react-hooks/purity
    () => memories.filter(m => (Date.now() - new Date(m.mtime).getTime()) / 86_400_000 >= 30).length,
    [memories]
  )

  const projectCount = useMemo(
    () => new Set(memories.map(m => m.projectSlug)).size,
    [memories]
  )

  const filtered = useMemo(() => {
    return memories.filter(m => {
      if (filter !== 'all' && m.type !== filter) return false
      if (search) {
        const q = search.toLowerCase()
        return (
          m.name.toLowerCase().includes(q) ||
          m.description.toLowerCase().includes(q) ||
          m.body.toLowerCase().includes(q) ||
          m.projectPath.toLowerCase().includes(q)
        )
      }
      return true
    })
  }, [memories, filter, search])

  function toggleExpand(id: string) {
    setExpandedId(prev => (prev === id ? null : id))
  }

  return (
    <div className="flex flex-col min-h-screen">
      <TopBar title="claude-code-lens · memory" subtitle="~/.claude/projects/*/memory/" />
      <div className="p-4 md:p-6 space-y-5">

        {error && <p className="text-[#f87171] text-sm font-mono">Error loading memories.</p>}

        {isLoading && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-20 bg-muted rounded-lg animate-pulse" />
              ))}
            </div>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-24 bg-muted rounded-lg animate-pulse" />
            ))}
          </div>
        )}

        {data && (
          <>
            {/* Stat cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard value={memories.length}  label="total memories" color="#fbbf24" />
              <StatCard value={projectCount}     label="projects"       color="var(--viz-sky)" />
              <StatCard value={counts.feedback ?? 0} label="feedback"   color="#f87171" />
              <StatCard value={staleCount}        label="stale (>30d)"  color="#94a3b8" />
            </div>

            {/* Type filter tabs */}
            <div className="flex flex-wrap gap-2">
              {FILTER_TYPES.map(type => {
                const m = type === 'all' ? null : TYPE_META[type as MemoryType]
                const count = counts[type] ?? 0
                const active = filter === type
                return (
                  <button
                    key={type}
                    onClick={() => setFilter(type)}
                    className={[
                      'flex items-center gap-1.5 px-3 py-1.5 rounded border text-xs font-mono transition-all',
                      active
                        ? 'border-primary/50 bg-primary/10 text-primary'
                        : 'border-border bg-card text-muted-foreground hover:border-primary/30 hover:text-foreground',
                    ].join(' ')}
                  >
                    {m && (
                      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: m.dot }} />
                    )}
                    {type}
                    <span className="opacity-60">({count})</span>
                  </button>
                )
              })}
            </div>

            {/* Search */}
            <div className="border border-border rounded-lg bg-card focus-within:border-primary/40 transition-colors">
              <input
                className="w-full bg-transparent px-4 py-2.5 text-sm font-mono text-foreground placeholder-muted-foreground/50 outline-none"
                placeholder="search memories..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>

            {/* Result count */}
            {(search || filter !== 'all') && (
              <p className="text-xs font-mono text-muted-foreground/60">
                showing <span className="text-[#fbbf24]">{filtered.length}</span> of {memories.length} memories
              </p>
            )}

            {/* Memory list */}
            {filtered.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-3xl mb-3">🧠</p>
                <p className="text-muted-foreground/60 text-sm font-mono">
                  {memories.length === 0
                    ? 'No memory files found in ~/.claude/projects/*/memory/'
                    : 'No memories match your filter.'}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {filtered.map(entry => {
                  const id = `${entry.projectSlug}/${entry.file}`
                  return (
                    <MemoryCard
                      key={id}
                      entry={entry}
                      expanded={expandedId === id}
                      onClick={() => toggleExpand(id)}
                    />
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
