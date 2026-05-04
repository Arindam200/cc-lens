'use client'

import { useState } from 'react'
import { categoryColorMix, parseMcpTool, isMcpTool, toolBarColor } from '@/lib/tool-categories'
import type { ToolCall } from '@/types/claude'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  Wrench,
  Search,
  Globe,
  ClipboardList,
  CheckCircle2,
  ListTodo,
  Plug,
  Bot,
  ChevronDown,
  type LucideIcon,
} from 'lucide-react'

function truncate(s: string, n = 80): string {
  return s.length > n ? s.slice(0, n) + '…' : s
}

function getToolArg(tool: ToolCall): string {
  const inp = tool.input ?? {}
  if (inp.command) return String(inp.command).slice(0, 60)
  if (inp.file_path) return String(inp.file_path).split('/').slice(-2).join('/')
  if (inp.path) return String(inp.path).split('/').slice(-2).join('/')
  if (inp.pattern) return String(inp.pattern).slice(0, 60)
  if (inp.query) return String(inp.query).slice(0, 60)
  if (inp.url) return String(inp.url).slice(0, 60)
  if (inp.description) return String(inp.description).slice(0, 60)
  const keys = Object.keys(inp)
  if (keys.length > 0) return truncate(String(inp[keys[0]]))
  return ''
}

function getToolIcon(name: string): LucideIcon {
  if (name === 'Task') return Bot
  if (name === 'WebSearch') return Search
  if (name === 'WebFetch') return Globe
  if (name === 'EnterPlanMode') return ClipboardList
  if (name === 'ExitPlanMode') return CheckCircle2
  if (name === 'TodoWrite') return ListTodo
  if (isMcpTool(name)) return Plug
  return Wrench
}

export function ToolCallBadge({ tool, result }: { tool: ToolCall; result?: { content: string; is_error: boolean } }) {
  const [expanded, setExpanded] = useState(false)
  const color = toolBarColor(tool.name)
  const mcp = parseMcpTool(tool.name)
  const Icon = getToolIcon(tool.name)
  const arg = getToolArg(tool)
  const displayName = mcp ? `${mcp.server} · ${mcp.tool}` : tool.name

  return (
    <div
      className="overflow-hidden rounded-lg border text-sm font-mono"
      style={{
        borderColor: categoryColorMix(color, 32),
        backgroundColor: categoryColorMix(color, 9),
      }}
    >
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setExpanded(e => !e)}
        className={cn(
          'h-auto min-h-8 w-full justify-between gap-2 rounded-none border-0 bg-transparent px-2.5 py-2 text-left shadow-none hover:bg-muted/50',
          'font-mono text-sm'
        )}
        style={{ color: 'var(--foreground)' }}
      >
        <span className="flex min-w-0 flex-1 items-center gap-2">
          <Icon className="h-3.5 w-3.5 shrink-0 opacity-80" style={{ color }} />
          <span className="font-bold" style={{ color }}>
            {displayName}
          </span>
          {arg ? <span className="truncate text-muted-foreground">{arg}</span> : null}
          {result?.is_error ? (
            <span className="shrink-0 rounded-[4px] border border-[rgba(239,68,68,0.30)] bg-[rgba(239,68,68,0.10)] px-1.5 py-0 text-[10px] font-mono font-medium uppercase tracking-[0.14em] text-[var(--error)]">
              Error
            </span>
          ) : null}
        </span>
        <ChevronDown
          className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200', expanded && 'rotate-180')}
        />
      </Button>
      {expanded && (
        <div className="space-y-2 border-t px-2.5 py-2.5" style={{ borderColor: categoryColorMix(color, 24) }}>
          <div>
            <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground/70">Input</p>
            <pre className="max-h-32 overflow-auto whitespace-pre-wrap break-all rounded-md border border-border/50 bg-background/80 p-2 text-xs text-muted-foreground">
              {truncate(JSON.stringify(tool.input, null, 2), 500)}
            </pre>
          </div>
          {result && (
            <div>
              <p
                className={cn(
                  'mb-1 font-mono text-[11px] font-medium uppercase tracking-[0.14em]',
                  result.is_error ? 'text-[var(--error)]' : 'text-muted-foreground/70'
                )}
              >
                {result.is_error ? 'Error' : 'Result'}
              </p>
              <pre
                className={cn(
                  'max-h-32 overflow-auto whitespace-pre-wrap break-all rounded-md border p-2 text-xs',
                  result.is_error
                    ? 'border-[rgba(239,68,68,0.25)] bg-[rgba(239,68,68,0.06)] text-[var(--error)]'
                    : 'border-border/50 bg-background/80 text-muted-foreground'
                )}
              >
                {truncate(result.content, 500)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
