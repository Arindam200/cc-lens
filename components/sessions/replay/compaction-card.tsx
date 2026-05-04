import type { CompactionEvent } from '@/types/claude'
import { formatTokens } from '@/lib/decode'

export function CompactionCard({ event }: { event: CompactionEvent }) {
  return (
    <div className="my-3 border border-[rgba(224,179,65,0.30)] bg-[rgba(224,179,65,0.06)] rounded-lg px-4 py-3">
      <div className="flex items-center gap-2 text-[var(--warning)] text-xs font-mono font-medium uppercase tracking-[0.14em] mb-1.5">
        <span>⚡</span>
        <span>Context Compaction</span>
        <span className="ml-auto text-[var(--warning)]/70 font-normal tabular-nums">
          {new Date(event.timestamp).toLocaleTimeString()}
        </span>
      </div>
      <div className="flex gap-4 text-xs text-foreground/70">
        <span>trigger: <span className="text-foreground font-medium">{event.trigger}</span></span>
        <span>context before: <span className="text-foreground font-medium tabular-nums">{formatTokens(event.pre_tokens)} tokens</span></span>
      </div>
      {event.summary && (
        <p className="mt-1.5 text-xs text-muted-foreground italic line-clamp-2">
          &ldquo;{event.summary}&rdquo;
        </p>
      )}
    </div>
  )
}
