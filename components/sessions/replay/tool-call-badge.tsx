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

function ExpandableBlock({ label, text, isError = false }: { label: string; text: string; isError?: boolean }) {
  const [open, setOpen] = useState(false)
  const long = text.length > 1000
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <p
          className={cn(
            'text-[11px] font-medium uppercase tracking-wide',
            isError ? 'text-red-400' : 'text-muted-foreground/70',
          )}
        >
          {label}
        </p>
        {long && (
          <button
            type="button"
            onClick={() => setOpen(o => !o)}
            className="text-[11px] text-muted-foreground/70 hover:text-foreground transition-colors"
          >
            {open ? 'Show less' : `Show full (${text.length.toLocaleString()} chars)`}
          </button>
        )}
      </div>
      <pre
        className={cn(
          'overflow-auto whitespace-pre-wrap break-all rounded-md border p-2 text-xs',
          open ? 'max-h-[60vh]' : 'max-h-48',
          isError
            ? 'border-red-500/25 bg-red-950/20 text-red-200/90'
            : 'border-border/50 bg-background/80 text-muted-foreground',
        )}
      >
        {text}
      </pre>
    </div>
  )
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

const TOOL_ICONS: Record<string, LucideIcon> = {
  Task:          Bot,
  WebSearch:     Search,
  WebFetch:      Globe,
  EnterPlanMode: ClipboardList,
  ExitPlanMode:  CheckCircle2,
  TodoWrite:     ListTodo,
}

function ToolIcon({ name, color }: { name: string; color: string }) {
  const Icon = TOOL_ICONS[name] ?? (isMcpTool(name) ? Plug : Wrench)
  return <Icon className="h-3.5 w-3.5 shrink-0 opacity-80" style={{ color }} />
}

export function ToolCallBadge({ tool, result }: { tool: ToolCall; result?: { content: string; is_error: boolean } }) {
  const [expanded, setExpanded] = useState(false)
  const color = toolBarColor(tool.name)
  const mcp = parseMcpTool(tool.name)
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
          <ToolIcon name={tool.name} color={color} />
          <span className="font-bold" style={{ color }}>
            {displayName}
          </span>
          {arg ? <span className="truncate text-muted-foreground">{arg}</span> : null}
          {result?.is_error ? (
            <span className="shrink-0 rounded border border-red-500/30 bg-red-500/10 px-1.5 py-0 text-[10px] font-semibold uppercase tracking-wide text-red-400">
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
          <ExpandableBlock
            label="Input"
            text={JSON.stringify(tool.input, null, 2)}
          />
          {result && (
            <ExpandableBlock
              label={result.is_error ? 'Error' : 'Result'}
              text={result.content}
              isError={result.is_error}
            />
          )}
        </div>
      )}
    </div>
  )
}
