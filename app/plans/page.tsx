'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { TopBar } from '@/components/layout/top-bar'
import { cn } from '@/lib/utils'
import { ChevronDown, ClipboardList } from 'lucide-react'

const fetcher = (url: string) =>
  fetch(url).then(r => { if (!r.ok) throw new Error(`API error ${r.status}`); return r.json() })

interface PlanFile {
  name: string
  content: string
  mtime: string
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function wordCount(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length
}

function extractTitle(content: string): string | null {
  const firstLine = content.split('\n').find(l => l.trim())
  if (firstLine?.startsWith('#')) return firstLine.replace(/^#+\s*/, '').trim()
  return null
}

// Minimal markdown renderer — handles headings, bold, code, lists, hr, plain text
function MarkdownLine({ line }: { line: string }) {
  // h1
  if (/^#\s/.test(line))
    return (
      <p className="text-foreground font-bold text-base font-mono mt-4 mb-1 first:mt-0 leading-snug tracking-tight">
        {line.replace(/^#\s/, '')}
      </p>
    )
  // h2
  if (/^##\s/.test(line))
    return (
      <p className="text-primary font-bold text-sm font-mono mt-3 mb-1 leading-snug">
        {line.replace(/^##\s/, '')}
      </p>
    )
  // h3
  if (/^###\s/.test(line))
    return (
      <p className="text-foreground font-semibold text-sm font-mono mt-2 mb-0.5 leading-snug">
        {line.replace(/^###\s/, '')}
      </p>
    )
  // hr
  if (/^---+$/.test(line.trim()))
    return <hr className="border-border my-3" />
  // empty
  if (!line.trim())
    return <div className="h-2" />
  // bullet list
  if (/^[-*]\s/.test(line))
    return (
      <p className="text-foreground/95 text-sm font-mono leading-relaxed flex gap-2">
        <span className="text-primary flex-shrink-0">›</span>
        <InlineMarkdown text={line.replace(/^[-*]\s/, '')} />
      </p>
    )
  // numbered list
  if (/^\d+\.\s/.test(line)) {
    const [num, ...rest] = line.split(/\.\s(.+)/)
    return (
      <p className="text-foreground/95 text-sm font-mono leading-relaxed flex gap-2">
        <span className="text-primary flex-shrink-0 w-5 text-right">{num}.</span>
        <InlineMarkdown text={rest.join('. ')} />
      </p>
    )
  }
  // code block marker — handled at block level, fallback
  if (line.startsWith('```'))
    return <span className="text-muted-foreground/60 text-xs font-mono">{line}</span>

  return (
    <p className="text-foreground/95 text-sm font-mono leading-relaxed">
      <InlineMarkdown text={line} />
    </p>
  )
}

function InlineMarkdown({ text }: { text: string }) {
  // Bold + italic: ***text***
  // Bold: **text**
  // Inline code: `text`
  const parts = text.split(/(`[^`]+`|\*\*\*[^*]+\*\*\*|\*\*[^*]+\*\*|\*[^*]+\*)/)
  return (
    <>
      {parts.map((p, i) => {
        if (p.startsWith('***') && p.endsWith('***'))
          return <strong key={i} className="text-primary italic">{p.slice(3, -3)}</strong>
        if (p.startsWith('**') && p.endsWith('**'))
          return <strong key={i} className="text-foreground font-bold">{p.slice(2, -2)}</strong>
        if (p.startsWith('*') && p.endsWith('*'))
          return <em key={i} className="text-muted-foreground italic">{p.slice(1, -1)}</em>
        if (p.startsWith('`') && p.endsWith('`'))
          return (
            <code
              key={i}
              className="text-foreground bg-[var(--surface-2)] border border-border px-1.5 py-0.5 rounded-[4px] text-xs font-mono"
            >
              {p.slice(1, -1)}
            </code>
          )
        return <span key={i}>{p}</span>
      })}
    </>
  )
}

function MarkdownContent({ content }: { content: string }) {
  const lines = content.split('\n')
  const result: React.ReactNode[] = []
  let inCodeBlock = false
  let codeLines: string[] = []
  let codeLang = ''

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (line.startsWith('```')) {
      if (!inCodeBlock) {
        inCodeBlock = true
        codeLang = line.slice(3).trim()
        codeLines = []
      } else {
        inCodeBlock = false
        result.push(
          <div
            key={i}
            className="my-2 rounded-lg border border-border bg-muted/80 dark:bg-muted overflow-x-auto shadow-sm"
          >
            {codeLang && (
              <div className="px-3 py-1.5 border-b border-border text-[10px] font-mono text-muted-foreground uppercase tracking-wide">
                {codeLang}
              </div>
            )}
            <pre className="px-3 py-2.5 text-xs font-mono text-foreground leading-relaxed">{codeLines.join('\n')}</pre>
          </div>
        )
        codeLines = []
        codeLang = ''
      }
      continue
    }
    if (inCodeBlock) {
      codeLines.push(line)
      continue
    }
    result.push(<MarkdownLine key={i} line={line} />)
  }

  return <div className="space-y-0.5">{result}</div>
}

function PlanCard({ plan }: { plan: PlanFile }) {
  const [expanded, setExpanded] = useState(false)
  const lines = plan.content.split('\n').filter(l => l.trim())
  const title = extractTitle(plan.content)
  const words = wordCount(plan.content)

  // Preview: first 8 non-empty lines
  const previewContent = plan.content.split('\n').slice(0, 12).join('\n')
  const hasMore = plan.content.split('\n').length > 12

  return (
    <div
      className={[
        'border rounded-xl transition-all duration-200 shadow-sm',
        expanded ? 'border-primary/40 bg-card ring-1 ring-primary/10' : 'border-border bg-card hover:border-primary/25',
      ].join(' ')}
    >

      {/* Header — always visible */}
      <button
        type="button"
        aria-expanded={expanded}
        className="flex w-full items-start justify-between gap-4 rounded-t-xl px-5 py-4 text-left md:px-6"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex items-center gap-2.5">
            <ClipboardList className="h-4 w-4 shrink-0 text-[#d97706]" aria-hidden />
            <span className="truncate font-mono text-sm font-bold text-foreground">
              {title ?? plan.name}
            </span>
          </div>
          {title && title !== plan.name && (
            <p className="mb-2 pl-7 font-mono text-xs text-muted-foreground/60">{plan.name}</p>
          )}
          <div className="flex flex-wrap items-center gap-4 pl-7">
            <span className="font-mono text-xs text-muted-foreground/60">{formatDate(plan.mtime)}</span>
            <span className="font-mono text-xs text-muted-foreground/60">{lines.length} lines</span>
            <span className="font-mono text-xs text-muted-foreground/60">{words} words</span>
          </div>
        </div>
        <ChevronDown
          className={cn(
            'mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200',
            expanded && 'rotate-180'
          )}
          aria-hidden
        />
      </button>

      {/* Preview (collapsed) */}
      {!expanded && (
        <div className="px-5 pb-5 md:px-6 border-t border-border/60 bg-muted/25 dark:bg-muted/10">
          <div className="pt-4 rounded-lg">
            <MarkdownContent content={previewContent} />
            {hasMore && (
              <p className="text-muted-foreground text-xs font-mono mt-3 pl-0.5">
                — {plan.content.split('\n').length - 12} more lines, click to expand —
              </p>
            )}
          </div>
        </div>
      )}

      {/* Full content (expanded) */}
      {expanded && (
        <div className="px-5 pb-6 md:px-6 border-t border-primary/15 bg-muted/25 dark:bg-muted/10">
          <div className="pt-5 max-h-[min(70vh,56rem)] overflow-y-auto rounded-lg pr-1">
            <MarkdownContent content={plan.content} />
          </div>
        </div>
      )}
    </div>
  )
}

export default function PlansPage() {
  const { data, error, isLoading } = useSWR<{ plans: PlanFile[] }>(
    '/api/plans', fetcher, { refreshInterval: 30_000 }
  )
  const [search, setSearch] = useState('')

  const plans = data?.plans ?? []
  const filtered = plans.filter(p =>
    !search ||
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.content.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="flex flex-col min-h-screen">
      <TopBar title="claude-code-lens · plans" subtitle="~/.claude/plans/" />
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
                  placeholder="search plans by name or content..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
              <p className="text-sm font-mono text-muted-foreground whitespace-nowrap">
                <span className="text-[#fbbf24] font-bold">{filtered.length}</span>
                {filtered.length !== plans.length && (
                  <span className="text-muted-foreground/60"> of {plans.length}</span>
                )} plans
              </p>
            </div>

            {filtered.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-[#d97706] text-2xl mb-3">📋</p>
                <p className="text-muted-foreground/60 text-sm font-mono">
                  {plans.length === 0
                    ? 'No plans found in ~/.claude/plans/'
                    : 'No plans match your search.'}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filtered.map(plan => (
                  <PlanCard key={plan.name} plan={plan} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
