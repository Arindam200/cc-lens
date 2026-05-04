'use client'

interface BadgeProps {
  has_compaction?: boolean
  uses_task_agent?: boolean
  uses_mcp?: boolean
  uses_web_search?: boolean
  uses_web_fetch?: boolean
  has_thinking?: boolean
}

export function SessionBadges({
  has_compaction,
  uses_task_agent,
  uses_mcp,
  uses_web_search,
  uses_web_fetch,
  has_thinking,
}: BadgeProps) {
  const tagBase =
    "inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-[4px] text-[10px] font-mono uppercase tracking-[0.12em] bg-[var(--surface-2)] text-muted-foreground border border-border"
  const accentTag =
    "inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-[4px] text-[10px] font-mono uppercase tracking-[0.12em] bg-[var(--primary-soft)] text-primary border border-[rgba(99,102,241,0.30)]"
  const warnTag =
    "inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-[4px] text-[10px] font-mono uppercase tracking-[0.12em] bg-[rgba(224,179,65,0.10)] text-[var(--warning)] border border-[rgba(224,179,65,0.28)]"
  return (
    <div className="flex flex-wrap gap-1">
      {has_compaction && <span className={warnTag}>⚡ compacted</span>}
      {uses_task_agent && <span className={accentTag}>🤖 agent</span>}
      {uses_mcp && <span className={tagBase}>🔌 mcp</span>}
      {(uses_web_search || uses_web_fetch) && <span className={tagBase}>🔍 web</span>}
      {has_thinking && <span className={accentTag}>🧠 thinking</span>}
    </div>
  )
}
