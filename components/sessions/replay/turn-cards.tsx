'use client'

import { useState } from 'react'
import { ToolCallBadge } from './tool-call-badge'
import { CompactionCard } from './compaction-card'
import { AssistantMarkdown } from './assistant-markdown'
import { UserToolResult } from './user-tool-result'
import { formatCost, formatTokens, formatDurationMs } from '@/lib/decode'
import type { ReplayTurn, CompactionEvent } from '@/types/claude'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ChevronDown, ChevronUp, Brain, Clock, Coins } from 'lucide-react'

/** Show “Show more” when assistant text exceeds this length (markdown; avoid slicing mid-block). */
const ASSISTANT_COLLAPSE_THRESHOLD = 900

interface TurnCardProps {
  turn: ReplayTurn
  turnNumber: number
  compactionBefore?: CompactionEvent
  toolResults: Map<string, { content: string; is_error: boolean }>
}

function TokenBreakdown({ turn }: { turn: ReplayTurn }) {
  if (!turn.usage) return null
  const u = turn.usage
  const items = [
    u.input_tokens       ? { label: 'In',     value: u.input_tokens,       color: 'var(--viz-sky)' } : null,
    u.output_tokens      ? { label: 'Out',    value: u.output_tokens,      color: '#d97706' } : null,
    u.cache_creation_input_tokens ? { label: 'cW', value: u.cache_creation_input_tokens, color: '#a78bfa' } : null,
    u.cache_read_input_tokens     ? { label: 'cR', value: u.cache_read_input_tokens,     color: '#34d399' } : null,
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
      {turn.estimated_cost ? (
        <span className="text-[11px] font-mono text-[#d97706] px-1 py-0.5">
          {formatCost(turn.estimated_cost)}
        </span>
      ) : null}
    </div>
  )
}

export function UserTurnCard({ turn, compactionBefore }: TurnCardProps) {
  return (
    <div>
      {compactionBefore && <CompactionCard event={compactionBefore} />}

      <div className="mb-5 flex flex-col items-end gap-1.5">
        {/* Timestamp label */}
        <span className="text-[11px] text-muted-foreground/40 pr-1">
          {new Date(turn.timestamp).toLocaleTimeString()}
        </span>

        {/* User bubble (right-aligned) */}
        {turn.text && (
          <div className="max-w-[85%] bg-primary/10 border border-primary/20 rounded-2xl rounded-tr-sm px-4 py-3">
            <p className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">
              {turn.text}
            </p>
          </div>
        )}

        {/* Tool results (user feedback) */}
        {turn.tool_results && turn.tool_results.length > 0 && (
          <div className="flex w-full max-w-[90%] flex-col gap-2">
            {turn.tool_results.map(r => (
              <UserToolResult key={r.tool_use_id} content={r.content} isError={r.is_error} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export function AssistantTurnCard({ turn, turnNumber, toolResults }: TurnCardProps) {
  const [thinkingOpen, setThinkingOpen] = useState(false)
  const [expanded, setExpanded] = useState(false)

  const modelShort = turn.model?.includes('opus-4-7') ? 'Opus 4.7'
    : turn.model?.includes('opus-4-6') ? 'Opus 4.6'
    : turn.model?.includes('opus-4-5') ? 'Opus 4.5'
    : turn.model?.includes('opus-4')   ? 'Opus 4'
    : turn.model?.includes('sonnet-4-6') ? 'Sonnet 4.6'
    : turn.model?.includes('sonnet-4-5') ? 'Sonnet 4.5'
    : turn.model?.includes('sonnet')   ? 'Sonnet'
    : turn.model?.includes('haiku')    ? 'Haiku'
    : turn.model ?? 'Claude'

  const textToShow = turn.text ?? ''
  const needsExpandToggle = textToShow.length > ASSISTANT_COLLAPSE_THRESHOLD

  return (
    <div className="mb-6 flex flex-col gap-1.5">
      {/* Header row */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1.5">
          <div className="w-6 h-6 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center shrink-0">
            <span className="text-[10px] font-bold text-primary">C</span>
          </div>
          <span className="text-xs font-semibold text-primary/80">Claude</span>
        </div>
        <Badge variant="outline" className="text-[11px] px-1.5 py-0 h-5 font-mono">
          {modelShort}
        </Badge>
        <span className="text-[11px] text-muted-foreground/30">#{turnNumber}</span>
        {turn.turn_duration_ms && (
          <span className="text-[11px] text-muted-foreground/40 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {formatDurationMs(turn.turn_duration_ms)}
          </span>
        )}
      </div>

      {/* Thinking block */}
      {turn.has_thinking && (
        <div className="ml-8">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-auto gap-1.5 px-2 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-500/10 hover:text-indigo-900 dark:text-indigo-400/90 dark:hover:text-indigo-300"
            onClick={() => setThinkingOpen(o => !o)}
          >
            <Brain className="h-3.5 w-3.5 shrink-0" />
            Extended thinking
            <ChevronDown
              className={cn('h-3.5 w-3.5 shrink-0 transition-transform duration-200', thinkingOpen && 'rotate-180')}
            />
          </Button>
          {thinkingOpen && turn.thinking_text && (
            <div className="mt-1 bg-indigo-50 border border-indigo-200/80 rounded-xl px-4 py-3 dark:bg-indigo-950/20 dark:border-indigo-800/25">
              <pre className="text-xs text-indigo-950/90 whitespace-pre-wrap max-h-56 overflow-auto leading-relaxed dark:text-indigo-200/50">
                {turn.thinking_text.slice(0, 3000)}
                {turn.thinking_text.length > 3000 && (
                  <span className="text-indigo-400/40"> …[{(turn.thinking_text.length - 3000).toLocaleString()} more chars]</span>
                )}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* Tool calls */}
      {turn.tool_calls && turn.tool_calls.length > 0 && (
        <div className="ml-8 space-y-1">
          {turn.tool_calls.map(tc => (
            <ToolCallBadge
              key={tc.id}
              tool={tc}
              result={toolResults.get(tc.id)}
            />
          ))}
        </div>
      )}

      {/* Response text bubble */}
      {textToShow && (
        <div className="ml-8">
          <div className="rounded-2xl rounded-tl-sm border border-border/60 bg-card px-4 py-3">
            <div
              className={cn(
                'relative',
                needsExpandToggle && !expanded && 'max-h-112 overflow-hidden'
              )}
            >
              <AssistantMarkdown content={textToShow} />
              {needsExpandToggle && !expanded && (
                <div
                  className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-linear-to-t from-card to-transparent"
                  aria-hidden
                />
              )}
            </div>
            {needsExpandToggle && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="mt-2 h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => setExpanded(e => !e)}
              >
                {expanded ? (
                  <>
                    <ChevronUp className="h-3 w-3" /> Show less
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-3 w-3" /> Show full response
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Token breakdown */}
      {turn.usage && (
        <div className="ml-8 mt-0.5">
          <TokenBreakdown turn={turn} />
        </div>
      )}
    </div>
  )
}
