'use client'

import { Fragment, useMemo } from 'react'
import { format, startOfWeek, addDays, eachWeekOfInterval } from 'date-fns'
import type { DailyActivity } from '@/types/claude'
import { useTheme } from '@/components/theme-provider'

interface Props {
  data: DailyActivity[]
}

// Indigo opacity ramp — Nightshift "single accent". Empty → faint → soft → mid → strong.
const DARK_SHADES  = ['#1C1C24', 'rgba(99,102,241,0.22)', 'rgba(99,102,241,0.40)', 'rgba(99,102,241,0.65)', '#818CF8']
const LIGHT_SHADES = ['#EAE7E0', 'rgba(99,102,241,0.18)', 'rgba(99,102,241,0.34)', 'rgba(99,102,241,0.58)', '#6366F1']

const DAY_LABELS = ['', 'Mon', '', 'Wed', '', 'Fri', '']

export function ActivityHeatmap({ data }: Props) {
  const { theme } = useTheme()
  const shades = theme === 'dark' ? DARK_SHADES : LIGHT_SHADES

  function getShade(count: number, max: number): string {
    if (count === 0) return shades[0]
    const ratio = count / max
    if (ratio < 0.2) return shades[1]
    if (ratio < 0.4) return shades[2]
    if (ratio < 0.7) return shades[3]
    return shades[4]
  }

  const { weeks, maxCount } = useMemo(() => {
    const countMap = new Map<string, number>()
    let maxCount = 0
    for (const d of data) {
      countMap.set(d.date, d.messageCount)
      if (d.messageCount > maxCount) maxCount = d.messageCount
    }

    const today = new Date()
    const startDate = startOfWeek(addDays(today, -52 * 7), { weekStartsOn: 0 })
    const weekStarts = eachWeekOfInterval({ start: startDate, end: today }, { weekStartsOn: 0 })
    const weeks = weekStarts.map(weekStart =>
      Array.from({ length: 7 }, (_, i) => {
        const d = addDays(weekStart, i)
        const dateStr = format(d, 'yyyy-MM-dd')
        return { date: d, dateStr, count: countMap.get(dateStr) ?? 0 }
      })
    )

    return { weeks, maxCount }
  }, [data])

  const nWeeks = weeks.length
  const gridStyle = {
    gridTemplateColumns: `minmax(1.75rem, 2rem) repeat(${nWeeks}, minmax(0, 1fr))`,
  } as const

  return (
    <div className="w-full min-w-0">
      <div
        className="grid w-full gap-x-1 gap-y-1"
        style={gridStyle}
      >
        {/* Month row */}
        <div aria-hidden className="min-h-4" />
        {weeks.map((week, wi) => (
          <div
            key={`m-${wi}`}
            className="flex min-h-4 min-w-0 items-end justify-center text-[9px] leading-none text-muted-foreground/80"
          >
            {week[0].date.getDate() <= 7 ? format(week[0].date, 'MMM') : ''}
          </div>
        ))}

        {/* Day rows + cells */}
        {[0, 1, 2, 3, 4, 5, 6].map(di => (
          <Fragment key={di}>
            <div className="flex min-w-0 items-center text-[9px] leading-none text-muted-foreground/80">
              {DAY_LABELS[di]}
            </div>
            {weeks.map((week, wi) => {
              const day = week[di]
              return (
                <div
                  key={`c-${wi}-${di}`}
                  className="aspect-square min-h-[6px] w-full min-w-0 rounded-[3px] cursor-default transition-colors"
                  style={{ backgroundColor: getShade(day.count, maxCount || 1) }}
                  title={`${day.dateStr}: ${day.count} messages`}
                />
              )
            })}
          </Fragment>
        ))}
      </div>

      {/* Legend */}
      <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-border/40 pt-2">
        <span className="text-xs text-muted-foreground">Less</span>
        {shades.map((s, i) => (
          <div key={i} className="h-3 w-3 shrink-0 rounded-[3px]" style={{ backgroundColor: s }} />
        ))}
        <span className="text-xs text-muted-foreground">More</span>
      </div>
    </div>
  )
}
