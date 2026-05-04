interface Props {
  current: number
  longest: number
  totalActiveDays: number
  mostActiveDay: string
  mostActiveDayMsgs: number
}

export function StreakCard({ current, longest, totalActiveDays, mostActiveDay, mostActiveDayMsgs }: Props) {
  const tileLabel = "font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground mb-1.5"
  const tileNote = "text-[var(--subtle-foreground)] text-xs"
  return (
    <div className="grid grid-cols-2 gap-3 text-sm">
      <div className="border border-border rounded-lg p-3.5 bg-card">
        <p className={tileLabel}>Current Streak</p>
        <p className="text-2xl font-bold tabular-nums font-mono text-primary tracking-[-0.02em]">{current}</p>
        <p className={tileNote}>consecutive days</p>
      </div>
      <div className="border border-border rounded-lg p-3.5 bg-card">
        <p className={tileLabel}>Longest Streak</p>
        <p className="text-2xl font-bold tabular-nums font-mono text-foreground tracking-[-0.02em]">{longest}</p>
        <p className={tileNote}>consecutive days</p>
      </div>
      <div className="border border-border rounded-lg p-3.5 bg-card">
        <p className={tileLabel}>Active Days</p>
        <p className="text-2xl font-bold tabular-nums font-mono text-foreground tracking-[-0.02em]">{totalActiveDays}</p>
        <p className={tileNote}>total days with activity</p>
      </div>
      {mostActiveDay && (
        <div className="border border-border rounded-lg p-3.5 bg-card">
          <p className={tileLabel}>Most Active Day</p>
          <p className="text-sm font-bold text-[var(--success)]">{mostActiveDay}</p>
          <p className={tileNote}>{mostActiveDayMsgs.toLocaleString()} messages</p>
        </div>
      )}
    </div>
  )
}
