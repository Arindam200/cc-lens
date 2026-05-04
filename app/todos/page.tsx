'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { TopBar } from '@/components/layout/top-bar'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Search, AlertTriangle, Circle, CircleDot, CircleCheck } from 'lucide-react'

const fetcher = (url: string) =>
  fetch(url).then(r => { if (!r.ok) throw new Error(`API error ${r.status}`); return r.json() })

interface TodoItem {
  id?: string
  content?: string
  status?: string
  priority?: string
  [key: string]: unknown
}

interface TodoFile {
  name: string
  data: unknown
  mtime: string
}

type FilterType = 'all' | 'pending' | 'in_progress' | 'completed'

function parseTodos(data: unknown): TodoItem[] {
  if (Array.isArray(data)) return data as TodoItem[]
  if (data && typeof data === 'object' && 'todos' in data)
    return parseTodos((data as { todos: unknown }).todos)
  return []
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function normalizeStatus(s?: string): string {
  return s ?? 'pending'
}

const PRIORITY_STYLES: Record<string, string> = {
  high:   'bg-[rgba(239,68,68,0.10)] text-[var(--error)] border-[rgba(239,68,68,0.30)]',
  medium: 'bg-[rgba(224,179,65,0.10)] text-[var(--warning)] border-[rgba(224,179,65,0.28)]',
  low:    'bg-secondary text-muted-foreground border-border',
}

const STATUS_META: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  pending:     { icon: Circle,      color: 'text-muted-foreground',   label: 'Pending'     },
  in_progress: { icon: CircleDot,   color: 'text-[var(--warning)]',   label: 'In Progress' },
  completed:   { icon: CircleCheck, color: 'text-[var(--success)]',   label: 'Completed'   },
}

function TodoRow({ item, file }: { item: TodoItem; file: TodoFile }) {
  const status = normalizeStatus(item.status)
  const meta = STATUS_META[status] ?? STATUS_META.pending
  const Icon = meta.icon
  const isCompleted = status === 'completed'

  return (
    <Card className="py-0">
      <CardContent className="px-4 py-3.5 flex items-start gap-3">
        <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${meta.color}`} />
        <div className="flex-1 min-w-0">
          <p className={`text-sm leading-relaxed ${isCompleted ? 'line-through text-muted-foreground/50' : 'text-foreground'}`}>
            {String(item.content ?? JSON.stringify(item))}
          </p>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <Badge
              variant="outline"
              className={`text-[10px] font-mono uppercase tracking-wider ${meta.color}`}
            >
              {meta.label}
            </Badge>
            {item.priority && (
              <Badge
                variant="outline"
                className={`text-[10px] font-mono uppercase tracking-wider ${PRIORITY_STYLES[item.priority] ?? PRIORITY_STYLES.low}`}
              >
                {item.priority}
              </Badge>
            )}
            <Badge variant="secondary" className="text-[10px] font-mono">
              {file.name}
            </Badge>
            <span className="text-[10px] text-muted-foreground/60">
              {formatDate(file.mtime)}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default function TodosPage() {
  const { data, error, isLoading } = useSWR<{ todos: TodoFile[] }>(
    '/api/todos', fetcher, { refreshInterval: 10_000 }
  )
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<FilterType>('all')

  const todos = data?.todos ?? []
  const allItems: Array<{ file: TodoFile; item: TodoItem }> = todos.flatMap(file =>
    parseTodos(file.data).map(item => ({ file, item }))
  )

  const counts = {
    all:         allItems.length,
    pending:     allItems.filter(x => normalizeStatus(x.item.status) === 'pending').length,
    in_progress: allItems.filter(x => normalizeStatus(x.item.status) === 'in_progress').length,
    completed:   allItems.filter(x => normalizeStatus(x.item.status) === 'completed').length,
  }

  const filtered = allItems.filter(({ item }) => {
    if (filter !== 'all' && normalizeStatus(item.status) !== filter) return false
    if (search && !String(item.content ?? '').toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  return (
    <div className="flex flex-col min-h-screen">
      <TopBar title="Todos" subtitle="~/.claude/todos/" />
      <div className="p-4 md:p-6 space-y-5">

        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>Error loading data: {String(error)}</AlertDescription>
          </Alert>
        )}

        {isLoading && (
          <div className="space-y-3">
            <Skeleton className="h-10 w-full rounded-lg" />
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
          </div>
        )}

        {data && (
          <>
            {/* Filter tabs */}
            <Tabs value={filter} onValueChange={v => setFilter(v as FilterType)}>
              <TabsList className="w-full sm:w-auto">
                <TabsTrigger value="all" className="gap-2">
                  All
                  <Badge variant="secondary" className="text-xs tabular-nums">{counts.all}</Badge>
                </TabsTrigger>
                <TabsTrigger value="pending" className="gap-2">
                  <Circle className="w-3.5 h-3.5" />
                  Pending
                  <Badge variant="secondary" className="text-xs tabular-nums">{counts.pending}</Badge>
                </TabsTrigger>
                <TabsTrigger value="in_progress" className="gap-2">
                  <CircleDot className="w-3.5 h-3.5 text-[var(--warning)]" />
                  In Progress
                  <Badge variant="secondary" className="text-xs tabular-nums">{counts.in_progress}</Badge>
                </TabsTrigger>
                <TabsTrigger value="completed" className="gap-2">
                  <CircleCheck className="w-3.5 h-3.5 text-[var(--success)]" />
                  Done
                  <Badge variant="secondary" className="text-xs tabular-nums">{counts.completed}</Badge>
                </TabsTrigger>
              </TabsList>
            </Tabs>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search todos…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            {(search || filter !== 'all') && (
              <p className="text-xs text-muted-foreground">
                Showing <span className="text-primary font-medium">{filtered.length}</span> of {allItems.length} todos
              </p>
            )}

            {filtered.length === 0 ? (
              <div className="text-center py-16">
                <CircleCheck className="w-8 h-8 mx-auto mb-3 text-muted-foreground/40" />
                <p className="text-muted-foreground text-sm">
                  {allItems.length === 0
                    ? 'No todos found in ~/.claude/todos/'
                    : 'No todos match your filter.'}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {filtered.map(({ file, item }, i) => (
                  <TodoRow key={i} item={item} file={file} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
