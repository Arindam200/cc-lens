'use client'

import { useState } from 'react'
import useSWR from 'swr'
import Link from 'next/link'
import { TopBar } from '@/components/layout/top-bar'
import { cn } from '@/lib/utils'
import { CheckCircle2, Circle, CircleDot, ListTodo, ExternalLink } from 'lucide-react'

const fetcher = (url: string) =>
  fetch(url).then(r => { if (!r.ok) throw new Error(`API error ${r.status}`); return r.json() })

interface TaskItem {
  id?: string
  content: string
  description?: string
  status?: string
  activeForm?: string
}

interface TaskSession {
  sessionId: string
  tasks: TaskItem[]
  mtime: string
  project: string | null
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function StatusIcon({ status }: { status?: string }) {
  if (status === 'completed')
    return <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
  if (status === 'in_progress')
    return <CircleDot className="h-4 w-4 shrink-0 text-[#d97706] dark:text-[#fbbf24]" aria-hidden />
  return <Circle className="h-4 w-4 shrink-0 text-muted-foreground/50" aria-hidden />
}

function TaskRow({ task }: { task: TaskItem }) {
  const done = task.status === 'completed'
  const active = task.status === 'in_progress'
  return (
    <div className="flex items-start gap-2.5 py-1.5">
      <span className="mt-0.5">
        <StatusIcon status={task.status} />
      </span>
      <div className="min-w-0">
        <p
          className={cn(
            'text-sm font-mono leading-relaxed',
            done && 'text-muted-foreground line-through decoration-muted-foreground/40',
            active && 'text-foreground font-semibold',
            !done && !active && 'text-foreground/90',
          )}
        >
          {task.content}
        </p>
        {active && task.activeForm && (
          <p className="text-xs font-mono text-[#d97706] dark:text-[#fbbf24] mt-0.5">
            {task.activeForm}…
          </p>
        )}
      </div>
    </div>
  )
}

function SessionCard({ session }: { session: TaskSession }) {
  const total = session.tasks.length
  const done = session.tasks.filter(t => t.status === 'completed').length
  const inProgress = session.tasks.filter(t => t.status === 'in_progress').length
  const projectName = session.project?.split('/').filter(Boolean).pop()

  return (
    <div className="border border-border rounded-xl bg-card shadow-sm hover:border-primary/25 transition-colors">
      <div className="flex items-start justify-between gap-4 px-5 py-4 md:px-6">
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex items-center gap-2.5">
            <ListTodo className="h-4 w-4 shrink-0 text-[#d97706]" aria-hidden />
            <span className="truncate font-mono text-sm font-bold text-foreground">
              {projectName ?? session.sessionId.slice(0, 8)}
            </span>
            {inProgress > 0 && (
              <span className="rounded-full bg-[#d97706]/10 px-2 py-0.5 font-mono text-[10px] font-bold text-[#b45309] dark:text-[#fbbf24]">
                active
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-4 pl-7">
            <span className="font-mono text-xs text-muted-foreground/60">{formatDate(session.mtime)}</span>
            <span className="font-mono text-xs text-muted-foreground/60">
              {done}/{total} done
            </span>
            <Link
              href={`/sessions/${session.sessionId}`}
              className="inline-flex items-center gap-1 font-mono text-xs text-muted-foreground/60 hover:text-primary transition-colors"
            >
              {session.sessionId.slice(0, 8)} <ExternalLink className="h-3 w-3" aria-hidden />
            </Link>
          </div>
        </div>
        {/* Progress */}
        <div className="hidden sm:block w-28 shrink-0 pt-1.5">
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-emerald-500/80 transition-all"
              style={{ width: `${total ? Math.round((done / total) * 100) : 0}%` }}
            />
          </div>
          <p className="mt-1 text-right font-mono text-[10px] text-muted-foreground/60">
            {total ? Math.round((done / total) * 100) : 0}%
          </p>
        </div>
      </div>
      <div className="border-t border-border/60 bg-muted/25 dark:bg-muted/10 px-5 py-3 md:px-6">
        {session.tasks.map((task, index) => (
          <TaskRow key={task.id ?? `${task.content}-${index}`} task={task} />
        ))}
      </div>
    </div>
  )
}

export default function TasksPage() {
  const { data, error, isLoading } = useSWR<{ sessions: TaskSession[] }>(
    '/api/tasks', fetcher, { refreshInterval: 30_000 }
  )
  const [search, setSearch] = useState('')

  const sessions = data?.sessions ?? []
  const filtered = sessions.filter(s =>
    !search ||
    s.sessionId.toLowerCase().includes(search.toLowerCase()) ||
    (s.project ?? '').toLowerCase().includes(search.toLowerCase()) ||
    s.tasks.some(t => t.content.toLowerCase().includes(search.toLowerCase()))
  )

  return (
    <div className="flex flex-col min-h-screen">
      <TopBar title="claude-code-lens · tasks" subtitle="~/.claude/tasks/" />
      <div className="p-4 md:p-6 space-y-5">

        {error && <p className="text-[#f87171] text-sm font-mono">Error: {String(error)}</p>}

        {isLoading && (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-28 bg-muted rounded-lg animate-pulse" />
            ))}
          </div>
        )}

        {data && (
          <>
            {/* Search + count */}
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
              <div className="flex-1 border border-border rounded-lg bg-card w-full focus-within:border-primary/40 transition-colors">
                <input
                  className="w-full bg-transparent px-4 py-2.5 text-sm font-mono text-foreground placeholder-muted-foreground/50 outline-none"
                  placeholder="search tasks by content, project, or session..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
              <p className="text-sm font-mono text-muted-foreground whitespace-nowrap">
                <span className="text-[#fbbf24] font-bold">{filtered.length}</span>
                {filtered.length !== sessions.length && (
                  <span className="text-muted-foreground/60"> of {sessions.length}</span>
                )} sessions
              </p>
            </div>

            {filtered.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-[#d97706] text-2xl mb-3">☑️</p>
                <p className="text-muted-foreground/60 text-sm font-mono">
                  {sessions.length === 0
                    ? 'No task lists found in ~/.claude/tasks/'
                    : 'No tasks match your search.'}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filtered.map(session => (
                  <SessionCard key={session.sessionId} session={session} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
