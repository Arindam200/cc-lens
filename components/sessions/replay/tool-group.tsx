'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { ChevronRight } from 'lucide-react'
import type { ToolCall } from '@/types/claude'
import {
  summarizeGroup,
  rowLabel,
  toolAction,
  callFileDiffs,
  type DiffResult,
} from '@/lib/tool-summary'

type ToolResult = { content: string; is_error: boolean }
type ResultMap = Map<string, ToolResult>

// ─── Level 1: the collapsed group chip ────────────────────────────────────────

export function ToolGroup({ calls, results }: { calls: ToolCall[]; results: ResultMap }) {
  const [open, setOpen] = useState(false)
  if (calls.length === 0) return null

  const summary = summarizeGroup(calls)
  const anyError = calls.some(c => results.get(c.id)?.is_error)

  return (
    <div className="text-sm">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={cn(
          'group/grp flex items-center gap-1.5 py-0.5 text-left text-muted-foreground transition-colors hover:text-foreground',
          anyError && 'text-red-500/80 hover:text-red-500'
        )}
      >
        <span>{summary}</span>
        <ChevronRight
          className={cn('h-3.5 w-3.5 shrink-0 transition-transform duration-200', open && 'rotate-90')}
        />
      </button>

      {open && (
        <div className="mt-1 overflow-hidden rounded-lg border border-border/60 bg-muted/20">
          {calls.map((c, i) => (
            <ToolRow
              key={c.id}
              call={c}
              result={results.get(c.id)}
              last={i === calls.length - 1}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Level 2: a single tool-call row inside the expanded group ─────────────────

function ToolRow({ call, result, last }: { call: ToolCall; result?: ToolResult; last: boolean }) {
  const [open, setOpen] = useState(false)
  const label = rowLabel(call)
  const isError = result?.is_error

  return (
    <div className={cn(!last && 'border-b border-border/40')}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center gap-1.5 px-3 py-1.5 text-left text-[13px] text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
      >
        <span className="shrink-0 font-medium text-foreground/70">{label.verb}</span>
        <span className="truncate font-mono text-[12px]">{label.text}</span>
        {(label.add != null && (label.add > 0 || (label.del ?? 0) > 0)) && (
          <span className="shrink-0 font-mono text-[11px]">
            <span className="text-emerald-600 dark:text-emerald-400">+{label.add}</span>{' '}
            <span className="text-red-500/90 dark:text-red-400">-{label.del ?? 0}</span>
          </span>
        )}
        {isError && (
          <span className="shrink-0 rounded border border-red-500/30 bg-red-500/10 px-1 text-[10px] font-semibold uppercase text-red-500">
            error
          </span>
        )}
        <ChevronRight
          className={cn(
            'ml-auto h-3.5 w-3.5 shrink-0 transition-transform duration-200',
            open && 'rotate-90'
          )}
        />
      </button>

      {open && (
        <div className="border-t border-border/40 bg-background/40 px-3 py-2.5">
          <ToolDetail call={call} result={result} />
        </div>
      )}
    </div>
  )
}

// ─── Level 3: the full detail of one tool call ────────────────────────────────

function ToolDetail({ call, result }: { call: ToolCall; result?: ToolResult }) {
  const action = toolAction(call.name)

  if (action === 'run') {
    const command = String(call.input?.command ?? '')
    return (
      <div className="space-y-2">
        <pre className="overflow-x-auto rounded-md bg-zinc-900 px-3 py-2 font-mono text-[12px] leading-relaxed text-zinc-100 dark:bg-zinc-900/80">
          <span className="select-none text-emerald-400">$ </span>
          {command}
        </pre>
        {result?.content && <OutputBlock content={result.content} isError={result.is_error} />}
      </div>
    )
  }

  if (action === 'edit' || action === 'create') {
    const diffs = callFileDiffs(call)
    const path = diffs[0]?.path ?? String(call.input?.file_path ?? '')
    return (
      <div className="overflow-hidden rounded-md border border-border/60">
        <div className="truncate border-b border-border/60 bg-muted/50 px-3 py-1.5 font-mono text-[11px] text-muted-foreground">
          {path}
        </div>
        {diffs.map((d, i) => (
          <DiffView key={i} diff={d.diff} />
        ))}
      </div>
    )
  }

  // read / search / web / agent / mcp / other → input + result
  return (
    <div className="space-y-2">
      <div>
        <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground/70">Input</p>
        <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-all rounded-md border border-border/50 bg-background/80 p-2 font-mono text-[12px] text-muted-foreground">
          {JSON.stringify(call.input, null, 2).slice(0, 1200)}
        </pre>
      </div>
      {result?.content && (
        <div>
          <p
            className={cn(
              'mb-1 text-[10px] font-medium uppercase tracking-wide',
              result.is_error ? 'text-red-500' : 'text-muted-foreground/70'
            )}
          >
            {result.is_error ? 'Error' : 'Result'}
          </p>
          <OutputBlock content={result.content} isError={result.is_error} />
        </div>
      )}
    </div>
  )
}

function OutputBlock({ content, isError }: { content: string; isError?: boolean }) {
  const truncated = content.length > 4000
  return (
    <pre
      className={cn(
        'max-h-60 overflow-auto whitespace-pre-wrap break-all rounded-md border p-2 font-mono text-[12px] leading-relaxed',
        isError
          ? 'border-red-500/25 bg-red-950/20 text-red-200/90'
          : 'border-border/50 bg-background/80 text-muted-foreground'
      )}
    >
      {content.slice(0, 4000)}
      {truncated && (
        <span className="text-muted-foreground/50"> …[{(content.length - 4000).toLocaleString()} more chars]</span>
      )}
    </pre>
  )
}

function DiffView({ diff }: { diff: DiffResult }) {
  const MAX = 400
  const lines = diff.lines.slice(0, MAX)
  return (
    <div className="overflow-x-auto bg-background font-mono text-[12px] leading-relaxed">
      {lines.map((l, i) => (
        <div
          key={i}
          className={cn(
            'flex',
            l.type === 'add' && 'bg-emerald-500/10',
            l.type === 'del' && 'bg-red-500/10'
          )}
        >
          <span className="w-10 shrink-0 select-none px-1 text-right text-muted-foreground/40">
            {l.oldNo ?? ''}
          </span>
          <span className="w-10 shrink-0 select-none px-1 text-right text-muted-foreground/40">
            {l.newNo ?? ''}
          </span>
          <span
            className={cn(
              'w-4 shrink-0 select-none text-center',
              l.type === 'add' && 'text-emerald-600 dark:text-emerald-400',
              l.type === 'del' && 'text-red-500 dark:text-red-400'
            )}
          >
            {l.type === 'add' ? '+' : l.type === 'del' ? '-' : ''}
          </span>
          <span
            className={cn(
              'whitespace-pre pr-3',
              l.type === 'add' && 'text-emerald-900 dark:text-emerald-200',
              l.type === 'del' && 'text-red-900 dark:text-red-200',
              l.type === 'ctx' && 'text-muted-foreground'
            )}
          >
            {l.text || ' '}
          </span>
        </div>
      ))}
      {diff.lines.length > MAX && (
        <div className="px-3 py-1 text-[11px] text-muted-foreground/50">
          … {(diff.lines.length - MAX).toLocaleString()} more lines
        </div>
      )}
    </div>
  )
}
