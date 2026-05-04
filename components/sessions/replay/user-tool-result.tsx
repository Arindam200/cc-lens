'use client'

import { cn } from '@/lib/utils'
import { AlertCircle, CheckCircle2, FileEdit, FileText, Info } from 'lucide-react'

export type ParsedToolResult =
  | { kind: 'file_updated'; path: string; note?: string }
  | { kind: 'file_written'; path: string; note?: string }
  | { kind: 'file_read'; path: string; note?: string }
  | { kind: 'plain'; text: string }

function restAfterAction(s: string, idx: number, needleLen: number): string | undefined {
  let rest = s.slice(idx + needleLen).trim()
  rest = rest.replace(/^\.\s*/, '').trim()
  if (rest.startsWith('(') && rest.endsWith(')')) {
    rest = rest.slice(1, -1).trim()
  }
  return rest || undefined
}

/**
 * Best-effort parse of common Claude Code / tool sandbox result strings.
 */
export function parseToolResultMessage(raw: string): ParsedToolResult {
  const s = raw.trim()
  if (!s) return { kind: 'plain', text: raw }

  const prefix = 'The file '

  const needles: Array<{ needle: string; kind: 'file_updated' | 'file_written' | 'file_read' }> = [
    { needle: ' has been updated successfully', kind: 'file_updated' },
    { needle: ' has been written successfully', kind: 'file_written' },
    { needle: ' has been written.', kind: 'file_written' },
    { needle: ' was read successfully', kind: 'file_read' },
    { needle: ' has been read.', kind: 'file_read' },
  ]

  if (s.startsWith(prefix)) {
    for (const { needle, kind } of needles) {
      const i = s.indexOf(needle)
      if (i <= prefix.length) continue
      const path = s.slice(prefix.length, i).trim()
      if (!path) continue
      const note = restAfterAction(s, i, needle.length)
      if (kind === 'file_updated') return { kind: 'file_updated', path, note }
      if (kind === 'file_written') return { kind: 'file_written', path, note }
      return { kind: 'file_read', path, note }
    }
  }

  return { kind: 'plain', text: s }
}

function formatPathForUi(path: string, max = 100): string {
  if (path.length <= max) return path
  const parts = path.split('/')
  if (parts.length <= 2) return path.slice(0, max - 1) + '…'
  const file = parts[parts.length - 1] ?? path
  const start = parts.slice(0, 2).join('/')
  return `${start}/…/${file}`
}

interface Props {
  content: string
  isError: boolean
}

export function UserToolResult({ content, isError }: Props) {
  const parsed = parseToolResultMessage(content)

  if (isError) {
    return (
      <div className="flex gap-2.5 rounded-lg border border-[rgba(239,68,68,0.25)] bg-[rgba(239,68,68,0.06)] px-3 py-2.5 text-left">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--error)]" />
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--error)]">Tool error</p>
          <pre className="mt-1 whitespace-pre-wrap wrap-break-word font-mono text-[12px] leading-relaxed text-[var(--error)]/90">
            {content}
          </pre>
        </div>
      </div>
    )
  }

  if (parsed.kind === 'file_updated') {
    return (
      <div className="flex gap-2.5 rounded-lg border border-[rgba(34,197,94,0.20)] bg-[rgba(34,197,94,0.05)] px-3 py-2.5 text-left">
        <FileEdit className="mt-0.5 h-4 w-4 shrink-0 text-[var(--success)]" />
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[13px] font-medium text-foreground">File updated</span>
            <CheckCircle2 className="h-3.5 w-3.5 text-[var(--success)]/90" aria-hidden />
          </div>
          <p
            className="break-all font-mono text-[12px] leading-snug text-foreground/85"
            title={parsed.path}
          >
            {formatPathForUi(parsed.path)}
          </p>
          {parsed.note ? (
            <p className="flex gap-1.5 text-[11px] leading-relaxed text-muted-foreground">
              <Info className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground/50" />
              <span>{parsed.note}</span>
            </p>
          ) : null}
        </div>
      </div>
    )
  }

  if (parsed.kind === 'file_written') {
    return (
      <div className="flex gap-2.5 rounded-lg border border-[rgba(99,102,241,0.20)] bg-[var(--primary-soft)] px-3 py-2.5 text-left">
        <FileText className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <div className="min-w-0 flex-1 space-y-1">
          <span className="text-[13px] font-medium text-foreground">File written</span>
          <p className="break-all font-mono text-[12px] leading-snug text-foreground/85" title={parsed.path}>
            {formatPathForUi(parsed.path)}
          </p>
          {parsed.note ? <p className="text-[11px] text-muted-foreground">{parsed.note}</p> : null}
        </div>
      </div>
    )
  }

  if (parsed.kind === 'file_read') {
    return (
      <div className="flex gap-2.5 rounded-lg border border-border bg-secondary px-3 py-2.5 text-left">
        <FileText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1 space-y-1">
          <span className="text-[13px] font-medium text-foreground/90">File read</span>
          <p className="break-all font-mono text-[12px] leading-snug text-muted-foreground" title={parsed.path}>
            {formatPathForUi(parsed.path)}
          </p>
          {parsed.note ? <p className="text-[11px] text-muted-foreground/80">{parsed.note}</p> : null}
        </div>
      </div>
    )
  }

  const text = parsed.text
  const long = text.length > 320

  return (
    <div
      className={cn(
        'rounded-lg border border-border bg-secondary px-3 py-2.5 text-left',
        'text-[13px] leading-relaxed text-foreground/85'
      )}
    >
      <p className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground/70">Result</p>
      <p className={cn('mt-1.5 whitespace-pre-wrap wrap-break-word', long && 'line-clamp-6')}>{text}</p>
      {long && (
        <p className="mt-2 text-[11px] text-muted-foreground/50 tabular-nums">… {text.length.toLocaleString()} characters total</p>
      )}
    </div>
  )
}
