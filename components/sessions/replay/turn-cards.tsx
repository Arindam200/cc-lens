'use client'

import { useState } from 'react'
import { ToolGroup } from './tool-group'
import { AssistantMarkdown } from './assistant-markdown'
import { parseUserMessage } from '@/lib/user-message'
import { formatCost, formatTokens, formatDurationMs } from '@/lib/decode'
import type { ReplayTurn, TurnUsage } from '@/types/claude'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ChevronDown, ChevronUp, Brain, Clock, Coins, Bot, Terminal } from 'lucide-react'

type ToolResultMap = Map<string, { content: string; is_error: boolean }>

function SidechainBadge() {
  return (
    <Badge
      variant="outline"
      className="text-[11px] px-1.5 py-0 h-5 gap-1 text-purple-700 border-purple-500/30 bg-purple-500/10 dark:text-purple-300"
    >
      <Bot className="w-3 h-3" /> subagent
    </Badge>
  )
}

/** Show “Show more” when assistant text exceeds this length (markdown; avoid slicing mid-block). */
const ASSISTANT_COLLAPSE_THRESHOLD = 900

function modelShortName(model?: string): string {
  return model?.includes('opus-4-8') ? 'Opus 4.8'
    : model?.includes('opus-4-7') ? 'Opus 4.7'
    : model?.includes('opus-4-6') ? 'Opus 4.6'
    : model?.includes('opus-4-5') ? 'Opus 4.5'
    : model?.includes('opus-4')   ? 'Opus 4'
    : model?.includes('sonnet-4-6') ? 'Sonnet 4.6'
    : model?.includes('sonnet-4-5') ? 'Sonnet 4.5'
    : model?.includes('sonnet')   ? 'Sonnet'
    : model?.includes('haiku')    ? 'Haiku'
    : model ?? 'Claude'
}

// ─── Aggregated token / cost footer ───────────────────────────────────────────

function TokenBreakdown({ usage, cost }: { usage: TurnUsage; cost: number }) {
  const items = [
    usage.input_tokens                ? { label: 'In',  value: usage.input_tokens,                color: 'var(--viz-sky)' } : null,
    usage.output_tokens               ? { label: 'Out', value: usage.output_tokens,               color: '#d97706' } : null,
    usage.cache_creation_input_tokens ? { label: 'cW',  value: usage.cache_creation_input_tokens, color: '#a78bfa' } : null,
    usage.cache_read_input_tokens     ? { label: 'cR',  value: usage.cache_read_input_tokens,     color: '#34d399' } : null,
  ].filter(Boolean) as { label: string; value: number; color: string }[]

  if (items.length === 0) return null

  return (
    <div className="flex items-center gap-1 flex-wrap">
      <Coins className="w-3 h-3 text-muted-foreground/50 shrink-0" />
      {items.map(({ label, value, color }) => (
        <span
          key={label}
          className="text-[11px] font-mono px-1.5 py-0.5 rounded border border-border/50 bg-muted/50"
          style={{ color }}
        >
          {label}:{formatTokens(value)}
        </span>
      ))}
      {cost ? (
        <span className="text-[11px] font-mono text-[#d97706] px-1 py-0.5">{formatCost(cost)}</span>
      ) : null}
    </div>
  )
}

// ─── User turn ────────────────────────────────────────────────────────────────

export function UserTurnCard({ turn }: { turn: ReplayTurn }) {
  const parsed = parseUserMessage(turn.text ?? '')

  // Caveat is instructional noise injected by the CLI — skip it entirely.
  if (parsed.kind === 'caveat') return null

  const wrap = (children: React.ReactNode, align: 'end' | 'stretch' = 'end') => (
    <div className={cn('mb-5 flex flex-col gap-1.5', align === 'end' ? 'items-end' : 'items-stretch', turn.is_sidechain && 'pl-6 border-l-2 border-purple-500/25')}>
      <span className="flex items-center gap-2 text-[11px] text-muted-foreground/40 pr-1">
        {turn.is_sidechain && <SidechainBadge />}
        {new Date(turn.timestamp).toLocaleTimeString()}
      </span>
      {children}
    </div>
  )

  if (parsed.kind === 'slash_command') {
    return wrap(
      <div className="inline-flex items-center gap-2 self-end rounded-xl border border-border/60 bg-muted/50 px-3 py-2">
        <Terminal className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <span className="font-mono text-[13px] font-semibold text-foreground">{parsed.name}</span>
        {parsed.args && <span className="font-mono text-[12px] text-muted-foreground">{parsed.args}</span>}
      </div>
    )
  }

  if (parsed.kind === 'command_output') {
    return wrap(
      <div className="w-full max-w-[90%] self-start rounded-xl border border-border/50 bg-muted/30 px-3 py-2.5 text-left">
        <p className="mb-1 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground/60">
          <Terminal className="h-3 w-3" /> Command output
        </p>
        <pre className="whitespace-pre-wrap break-words font-mono text-[12px] leading-relaxed text-foreground/80">
          {parsed.text}
        </pre>
      </div>,
      'stretch'
    )
  }

  // Plain user message
  return wrap(
    <div className="max-w-[85%] bg-primary/10 border border-primary/20 rounded-2xl rounded-tr-sm px-4 py-3">
      <p className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">{parsed.text}</p>
    </div>
  )
}

// ─── Thinking ─────────────────────────────────────────────────────────────────

function ThinkingBlock({ text }: { text?: string }) {
  const [open, setOpen] = useState(false)

  // Encrypted / unrecorded thinking: nothing to expand, show a quiet marker.
  if (!text) {
    return (
      <div className="ml-8">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-indigo-600/70 dark:text-indigo-400/70">
          <Brain className="h-3.5 w-3.5" /> Thought for a moment
        </span>
      </div>
    )
  }

  return (
    <div className="ml-8">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-auto gap-1.5 px-2 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-500/10 hover:text-indigo-900 dark:text-indigo-400/90 dark:hover:text-indigo-300"
        onClick={() => setOpen(o => !o)}
      >
        <Brain className="h-3.5 w-3.5 shrink-0" />
        Extended thinking
        <ChevronDown className={cn('h-3.5 w-3.5 shrink-0 transition-transform duration-200', open && 'rotate-180')} />
      </Button>
      {open && (
        <div className="mt-1 bg-indigo-50 border border-indigo-200/80 rounded-xl px-4 py-3 dark:bg-indigo-950/20 dark:border-indigo-800/25">
          <pre className="text-xs text-indigo-950/90 whitespace-pre-wrap max-h-56 overflow-auto leading-relaxed dark:text-indigo-200/50">
            {text.slice(0, 3000)}
            {text.length > 3000 && (
              <span className="text-indigo-400/40"> …[{(text.length - 3000).toLocaleString()} more chars]</span>
            )}
          </pre>
        </div>
      )}
    </div>
  )
}

// ─── A single segment (one assistant JSONL turn) inside a block ────────────────

function AssistantSegment({ turn, toolResults }: { turn: ReplayTurn; toolResults: ToolResultMap }) {
  const [expanded, setExpanded] = useState(false)
  const text = turn.text ?? ''
  const needsToggle = text.length > ASSISTANT_COLLAPSE_THRESHOLD

  return (
    <>
      {turn.has_thinking && <ThinkingBlock text={turn.thinking_text} />}

      {text && (
        <div className="ml-8">
          <div className="rounded-2xl rounded-tl-sm border border-border/60 bg-card px-4 py-3">
            <div className={cn('relative', needsToggle && !expanded && 'max-h-112 overflow-hidden')}>
              <AssistantMarkdown content={text} />
              {needsToggle && !expanded && (
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-linear-to-t from-card to-transparent" aria-hidden />
              )}
            </div>
            {needsToggle && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="mt-2 h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => setExpanded(e => !e)}
              >
                {expanded ? <><ChevronUp className="h-3 w-3" /> Show less</> : <><ChevronDown className="h-3 w-3" /> Show full response</>}
              </Button>
            )}
          </div>
        </div>
      )}

      {turn.tool_calls && turn.tool_calls.length > 0 && (
        <div className="ml-8">
          <ToolGroup calls={turn.tool_calls} results={toolResults} />
        </div>
      )}
    </>
  )
}

// ─── Assistant block (consecutive assistant turns rendered as one message) ─────

export function AssistantBlock({
  turns,
  blockNumber,
  toolResults,
}: {
  turns: ReplayTurn[]
  blockNumber: number
  toolResults: ToolResultMap
}) {
  if (turns.length === 0) return null

  const model = turns.find(t => t.model)?.model
  const modelShort = modelShortName(model)
  const isSidechain = turns.some(t => t.is_sidechain)
  const totalDuration = turns.reduce((a, t) => a + (t.turn_duration_ms ?? 0), 0)
  const totalCost = turns.reduce((a, t) => a + (t.estimated_cost ?? 0), 0)

  // Aggregate token usage across every segment of the response.
  const usage: TurnUsage = { input_tokens: 0, output_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 }
  for (const t of turns) {
    if (!t.usage) continue
    usage.input_tokens += t.usage.input_tokens ?? 0
    usage.output_tokens += t.usage.output_tokens ?? 0
    usage.cache_creation_input_tokens += t.usage.cache_creation_input_tokens ?? 0
    usage.cache_read_input_tokens += t.usage.cache_read_input_tokens ?? 0
  }
  const hasUsage = usage.input_tokens + usage.output_tokens + usage.cache_creation_input_tokens + usage.cache_read_input_tokens > 0

  return (
    <div className={cn('mb-6 flex flex-col gap-2', isSidechain && 'pl-6 border-l-2 border-purple-500/25')}>
      {/* Single header for the whole response */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1.5">
          <div className="w-6 h-6 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center shrink-0">
            <span className="text-[10px] font-bold text-primary">C</span>
          </div>
          <span className="text-xs font-semibold text-primary/80">Claude</span>
        </div>
        {isSidechain && <SidechainBadge />}
        <Badge variant="outline" className="text-[11px] px-1.5 py-0 h-5 font-mono">{modelShort}</Badge>
        <span className="text-[11px] text-muted-foreground/30">#{blockNumber}</span>
        {totalDuration > 0 && (
          <span className="text-[11px] text-muted-foreground/40 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {formatDurationMs(totalDuration)}
          </span>
        )}
      </div>

      {/* Segments flow as one continuous message */}
      {turns.map((t, i) => (
        <AssistantSegment key={t.uuid || i} turn={t} toolResults={toolResults} />
      ))}

      {/* One consolidated token / cost footer */}
      {hasUsage && (
        <div className="ml-8 mt-0.5">
          <TokenBreakdown usage={usage} cost={totalCost} />
        </div>
      )}
    </div>
  )
}
