'use client'

import { useState, useMemo } from 'react'
import useSWR, { mutate } from 'swr'
import { Brain, FolderGit2, MessagesSquare, Clock3, Search, Pencil } from 'lucide-react'
import { TopBar } from '@/components/layout/top-bar'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
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
    <span className={`text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded border ${m.color} ${m.bg} ${m.border}`}>
      {m.label}
    </span>
  )
}

function StaleBadge({ mtime }: { mtime: string }) {
  // eslint-disable-next-line react-hooks/purity
  const daysOld = Math.floor((Date.now() - new Date(mtime).getTime()) / 86_400_000)
  if (daysOld < 30) return null
  return (
    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded border border-[#f87171]/30 bg-[#f87171]/10 text-[#f87171]">
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
    <Card
      className={[
        'gap-0 py-0 transition-colors',
        editing ? 'cursor-default' : 'cursor-pointer',
        expanded ? 'lg:col-span-2 xl:col-span-3' : 'hover:border-primary/30',
      ].join(' ')}
      onClick={editing ? undefined : onClick}
      {...(!editing && {
        role: 'button',
        tabIndex: 0,
        'aria-expanded': expanded,
        onKeyDown: (e: React.KeyboardEvent) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onClick()
          }
        },
      })}
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
              <Button
                variant="outline"
                size="sm"
                onClick={handleEdit}
                className="ml-auto h-7 gap-1.5 px-2.5 text-xs"
              >
                <Pencil className="size-3" /> Edit
              </Button>
            )}
          </div>

          {/* Description */}
          {entry.description && (
            <p className="text-xs text-muted-foreground leading-relaxed">{entry.description}</p>
          )}

          {/* Body preview (collapsed) */}
          {!expanded && preview && (
            <p className="text-xs text-muted-foreground/70 line-clamp-2 leading-relaxed">{preview}</p>
          )}

          {/* Full body (expanded, read mode) */}
          {expanded && !editing && (
            <pre className="mt-2 text-xs font-mono text-foreground/80 whitespace-pre-wrap bg-muted/40 rounded-md p-3 overflow-x-auto max-h-96 overflow-y-auto">
              {entry.body}
            </pre>
          )}

          {/* Edit mode */}
          {expanded && editing && (
            <div className="mt-2 space-y-2" onClick={e => e.stopPropagation()}>
              <textarea
                className="w-full min-h-64 bg-muted/40 border border-primary/40 rounded-md p-3 text-xs font-mono text-foreground resize-y outline-none focus:border-primary/70 transition-colors"
                value={draft}
                onChange={e => setDraft(e.target.value)}
                spellCheck={false}
              />
              {saveError && (
                <p className="text-[11px] text-[#f87171]">{saveError}</p>
              )}
              <div className="flex gap-2">
                <Button onClick={handleSave} disabled={saving} size="sm" className="h-8">
                  {saving ? 'Saving…' : 'Save'}
                </Button>
                <Button onClick={handleCancel} disabled={saving} size="sm" variant="outline" className="h-8">
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="flex flex-wrap items-center gap-2 pt-0.5">
            <span className="text-[10px] text-muted-foreground/70 bg-muted px-1.5 py-0.5 rounded">
              {projectName}
            </span>
            <span className="text-[10px] font-mono text-muted-foreground/40">{shortPath}</span>
            <span className="text-[10px] text-muted-foreground/50 ml-auto">
              {formatRelativeDate(entry.mtime)}
            </span>
          </div>
        </div>
      </div>
    </Card>
  )
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({ value, label, color, icon }: { value: number; label: string; color: string; icon: React.ReactNode }) {
  return (
    <Card className="py-0">
      <CardContent className="flex items-center gap-3 px-4 py-3.5">
        <span
          className="flex size-9 shrink-0 items-center justify-center rounded-lg border bg-muted/50 [&_svg]:size-4"
          style={{ color }}
        >
          {icon}
        </span>
        <div className="min-w-0">
          <div className="text-2xl font-bold tabular-nums leading-none" style={{ color }}>{value}</div>
          <div className="mt-1 text-xs text-muted-foreground truncate">{label}</div>
        </div>
      </CardContent>
    </Card>
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
      <TopBar title="Memory" subtitle="AI-written memory from ~/.claude/projects/*/memory/" />
      <div className="t-stagger-group p-4 md:p-6 space-y-5">

        {error && <p className="text-[#f87171] text-sm">Error loading memories.</p>}

        {isLoading && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-20 bg-muted rounded-lg animate-pulse" />
              ))}
            </div>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-32 bg-muted rounded-xl animate-pulse" />
              ))}
            </div>
          </div>
        )}

        {data && (
          <>
            {/* Stat cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard value={memories.length}      label="Total memories" color="#fbbf24"        icon={<Brain />} />
              <StatCard value={projectCount}         label="Projects"       color="var(--viz-sky)" icon={<FolderGit2 />} />
              <StatCard value={counts.feedback ?? 0} label="Feedback"       color="#f87171"        icon={<MessagesSquare />} />
              <StatCard value={staleCount}           label="Stale (>30d)"   color="#94a3b8"        icon={<Clock3 />} />
            </div>

            {/* Toolbar: type filters + search — sticky below the top bar for quick access */}
            <div className="sticky top-[57px] z-20 -mx-4 border-b border-border/60 bg-background/95 px-4 py-3 backdrop-blur md:-mx-6 md:px-6">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                <div className="flex flex-wrap gap-2">
                  {FILTER_TYPES.map(type => {
                    const m = type === 'all' ? null : TYPE_META[type as MemoryType]
                    const count = counts[type] ?? 0
                    const active = filter === type
                    return (
                      <button
                        key={type}
                        onClick={() => setFilter(type)}
                        aria-pressed={active}
                        className={[
                          'flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium capitalize transition-colors',
                          active
                            ? 'border-primary/50 bg-primary/10 text-primary'
                            : 'border-border bg-card text-muted-foreground hover:border-primary/30 hover:text-foreground',
                        ].join(' ')}
                      >
                        {m && (
                          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: m.dot }} />
                        )}
                        {type}
                        <span className="tabular-nums opacity-60">{count}</span>
                      </button>
                    )
                  })}
                </div>

                <div className="relative w-full lg:ml-auto lg:max-w-xs">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/60" />
                  <Input
                    className="pl-9"
                    placeholder="Search memories…"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                  />
                </div>
              </div>

              {/* Result count */}
              {(search || filter !== 'all') && (
                <p className="mt-2 text-xs text-muted-foreground/70">
                  Showing <span className="font-medium text-foreground">{filtered.length}</span> of {memories.length} memories
                </p>
              )}
            </div>

            {/* Memory list */}
            {filtered.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-3xl mb-3">🧠</p>
                <p className="text-muted-foreground/70 text-sm">
                  {memories.length === 0
                    ? 'No memory files found in ~/.claude/projects/*/memory/'
                    : 'No memories match your filter.'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
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
