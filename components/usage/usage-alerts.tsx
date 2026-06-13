'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Bell, BellOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { computeActiveAlerts, type AlertDef } from '@/lib/usage-alerts'
import type { UsageResponse } from '@/app/usage/page'

const ENABLED_KEY = 'cclens_usage_alerts_enabled'
const FIRED_KEY = 'cclens_usage_alerts_fired'

// Dedupe across reloads: a bounded list of alert ids already shown.
function firedHas(id: string): boolean {
  try { return (JSON.parse(localStorage.getItem(FIRED_KEY) || '[]') as string[]).includes(id) }
  catch { return false }
}
function firedAdd(id: string) {
  try {
    const arr = JSON.parse(localStorage.getItem(FIRED_KEY) || '[]') as string[]
    if (!arr.includes(id)) arr.push(id)
    localStorage.setItem(FIRED_KEY, JSON.stringify(arr.slice(-100)))
  } catch { /* storage unavailable */ }
}

type Permission = 'default' | 'granted' | 'denied' | 'unsupported'

export function UsageAlerts({ data }: { data: UsageResponse }) {
  // This component only mounts client-side (the page gates it behind resolved
  // SWR data), so reading localStorage / Notification in a lazy initializer is
  // safe and avoids a synchronous setState in a mount effect.
  const [enabled, setEnabled] = useState(() =>
    typeof window !== 'undefined' && localStorage.getItem(ENABLED_KEY) === '1')
  const [permission, setPermission] = useState<Permission>(() =>
    typeof Notification === 'undefined' ? 'unsupported' : Notification.permission)
  // Last open 5h/weekly reset timestamps, so we can detect the open -> reset
  // transition that a reset ping announces.
  const prev5h = useRef<number | null>(null)
  const prev7d = useRef<number | null>(null)

  const fire = useCallback((def: AlertDef) => {
    if (permission !== 'granted' || firedHas(def.id)) return
    try {
      new Notification(def.title, { body: def.body, tag: def.id })
      firedAdd(def.id)
    } catch { /* ignore */ }
  }, [permission])

  // Evaluate alerts whenever fresh data arrives.
  useEffect(() => {
    if (!enabled || permission !== 'granted') {
      // Still track window instances so we don't fire a stale reset on enable.
      prev5h.current = data.fiveHour.startMs !== null ? data.fiveHour.resetMs : prev5h.current
      prev7d.current = data.weekly.startMs !== null ? data.weekly.resetMs : prev7d.current
      return
    }
    const now = data.now

    // Reset pings (transition: a window we saw open has passed its reset).
    const b = data.fiveHour
    if (b.startMs !== null && b.resetMs !== null) {
      prev5h.current = b.resetMs
    } else if (prev5h.current !== null && now >= prev5h.current) {
      fire({ id: `reset5h-${prev5h.current}`, title: '5-hour window reset', body: 'Your Claude Code session limit is clear again.' })
      prev5h.current = null
    }

    const w = data.weekly
    if (w.resetMs !== null) {
      if (w.startMs !== null && now < w.resetMs) {
        prev7d.current = w.resetMs
      } else if (prev7d.current !== null && now >= prev7d.current) {
        fire({ id: `reset7d-${prev7d.current}`, title: 'Weekly window reset', body: 'Your 7-day limit is clear again.' })
        prev7d.current = null
      }
    }

    // Cap-threshold + pace alerts.
    for (const def of computeActiveAlerts(data, now)) fire(def)
  }, [data, enabled, permission, fire])

  async function toggle() {
    if (enabled) {
      setEnabled(false)
      localStorage.setItem(ENABLED_KEY, '0')
      return
    }
    if (typeof Notification === 'undefined') { setPermission('unsupported'); return }
    let perm = Notification.permission
    if (perm === 'default') perm = await Notification.requestPermission()
    setPermission(perm)
    if (perm === 'granted') {
      setEnabled(true)
      localStorage.setItem(ENABLED_KEY, '1')
    }
  }

  const active = enabled && permission === 'granted'

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="space-y-1">
        <div className="flex items-center gap-2 font-medium">
          {active ? <Bell className="w-4 h-4 text-[#d97706]" /> : <BellOff className="w-4 h-4 text-muted-foreground" />}
          Reset pings &amp; cap warnings
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed max-w-xl">
          Browser notifications when a window resets, when you cross 80% / 95% of an estimated cap, and when you&apos;re on pace to hit the cap soon. Fires while this tab is open.
          {permission === 'denied' && <span className="text-destructive"> Notifications are blocked in your browser settings.</span>}
          {permission === 'unsupported' && <span className="text-destructive"> This browser doesn&apos;t support notifications.</span>}
        </p>
      </div>
      <Button
        onClick={toggle}
        variant={active ? 'outline' : 'default'}
        size="sm"
        disabled={permission === 'denied' || permission === 'unsupported'}
        className="gap-2 shrink-0"
      >
        {active ? <BellOff className="w-3.5 h-3.5" /> : <Bell className="w-3.5 h-3.5" />}
        {active ? 'Disable' : 'Enable'} alerts
      </Button>
    </div>
  )
}
