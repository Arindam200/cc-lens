'use client'

import Link from 'next/link'
import useSWR from 'swr'
import { useEffect, useState } from 'react'
import { Gauge } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { UsageResponse } from '@/app/usage/page'

const fetcher = (url: string) => fetch(url).then(r => { if (!r.ok) throw new Error(); return r.json() })

function color(fraction: number) {
  if (fraction >= 0.9) return 'text-red-500'
  if (fraction >= 0.7) return 'text-amber-500'
  return 'text-emerald-500'
}

function useCountdown(resetMs: number | null | undefined) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!resetMs) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [resetMs])
  if (!resetMs) return null
  const s = Math.max(Math.floor((resetMs - now) / 1000), 0)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

/** Compact always-in-view 5-hour gauge for the top bar. Hidden until data loads
 *  so it never flashes a misleading zero. */
export function UsagePill() {
  const { data } = useSWR<UsageResponse>('/api/usage', fetcher, { refreshInterval: 10_000 })
  const block = data?.fiveHour
  const countdown = useCountdown(block?.resetMs)
  if (!data || !block) return null

  const open = block.startMs !== null
  const pct = block.fraction > 1 ? '100%+' : `${Math.round(block.fraction * 100)}%`

  return (
    <Link
      href="/usage"
      title="5-hour session usage (estimated)"
      className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs hover:bg-accent transition-colors"
    >
      <Gauge className={cn('w-3.5 h-3.5', open ? color(block.fraction) : 'text-emerald-500')} />
      {open ? (
        <>
          <span className={cn('font-semibold tabular-nums', color(block.fraction))}>{pct}</span>
          {countdown && <span className="text-muted-foreground tabular-nums hidden md:inline">· {countdown}</span>}
        </>
      ) : (
        <span className="text-emerald-500 font-medium">Ready</span>
      )}
    </Link>
  )
}
