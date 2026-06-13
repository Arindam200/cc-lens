'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Sparkles, RotateCcw } from 'lucide-react'
import type { UsageResponse } from '@/app/usage/page'

const PLAN_LABELS: Record<string, string> = {
  pro: 'Pro', max5x: 'Max 5×', max20x: 'Max 20×', custom: 'Custom',
}

async function putConfig(updates: Record<string, unknown>) {
  const res = await fetch('/api/config', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  })
  if (!res.ok) throw new Error(`config update failed (${res.status})`)
}

export function UsageControls({
  data,
  onChange,
}: {
  data: UsageResponse
  onChange: () => void
}) {
  const [pct5h, setPct5h] = useState('')
  const [pct7d, setPct7d] = useState('')
  const [reset, setReset] = useState('')
  const [busy, setBusy] = useState(false)

  async function run(updates: Record<string, unknown>) {
    setBusy(true)
    try {
      await putConfig(updates)
      onChange()
    } finally {
      setBusy(false)
    }
  }

  async function calibrate() {
    const updates: Record<string, unknown> = {}
    const p5 = parseFloat(pct5h)
    if (p5 > 0 && data.fiveHour.costUSD > 0) updates.usage_cap_5h_usd = data.fiveHour.costUSD / (p5 / 100)
    const p7 = parseFloat(pct7d)
    if (p7 > 0 && data.weekly.costUSD > 0) updates.usage_cap_7d_usd = data.weekly.costUSD / (p7 / 100)
    if (Object.keys(updates).length) {
      await run(updates)
      setPct5h(''); setPct7d('')
    }
  }

  return (
    <div className="space-y-6 text-sm">
      {/* Plan */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-muted-foreground w-28 shrink-0">Plan</span>
        <Select
          value={data.plan}
          onValueChange={(v) => run({ usage_plan: v === data.detectedPlan ? null : v })}
        >
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            {(['pro', 'max5x', 'max20x', 'custom'] as const).map((p) => (
              <SelectItem key={p} value={p}>{PLAN_LABELS[p]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {data.planAutoDetected && (
          <span className="text-xs text-muted-foreground">
            auto-detected from your account ({data.account.organizationType ?? 'unknown'})
          </span>
        )}
      </div>

      {/* Caps */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-muted-foreground w-28 shrink-0">Caps (USD)</span>
        <label className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">5h</span>
          <Input
            type="number" min="0" step="0.5" defaultValue={data.caps.cap5hUSD.toFixed(2)}
            key={`5h-${data.caps.cap5hUSD}`}
            onBlur={(e) => {
              const v = parseFloat(e.target.value)
              if (v > 0 && Math.abs(v - data.caps.cap5hUSD) > 1e-6) run({ usage_cap_5h_usd: v })
            }}
            className="w-24 tabular-nums"
          />
        </label>
        <label className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">7d</span>
          <Input
            type="number" min="0" step="1" defaultValue={data.caps.cap7dUSD.toFixed(2)}
            key={`7d-${data.caps.cap7dUSD}`}
            onBlur={(e) => {
              const v = parseFloat(e.target.value)
              if (v > 0 && Math.abs(v - data.caps.cap7dUSD) > 1e-6) run({ usage_cap_7d_usd: v })
            }}
            className="w-24 tabular-nums"
          />
        </label>
        {(data.caps.cap5hCalibrated || data.caps.cap7dCalibrated) && (
          <Button
            variant="ghost" size="sm" disabled={busy}
            onClick={() => run({ usage_cap_5h_usd: null, usage_cap_7d_usd: null })}
            className="gap-1.5 text-xs text-muted-foreground"
          >
            <RotateCcw className="w-3 h-3" /> reset to {PLAN_LABELS[data.plan === 'custom' ? data.detectedPlan : data.plan]} preset
          </Button>
        )}
      </div>

      {/* Calibration */}
      <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
        <div className="flex items-center gap-2 font-medium">
          <Sparkles className="w-4 h-4 text-[#d97706]" />
          Calibrate to Claude Code&apos;s real numbers
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Run <code className="bg-muted px-1 rounded">/usage</code> in Claude Code and type the percentages it shows.
          We back out your personal cap from the matching consumption we already measured, so the gauge tracks the official figure.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Session %</span>
            <Input value={pct5h} onChange={(e) => setPct5h(e.target.value)} placeholder="63" inputMode="decimal" className="w-24" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Week %</span>
            <Input value={pct7d} onChange={(e) => setPct7d(e.target.value)} placeholder="7" inputMode="decimal" className="w-24" />
          </label>
          <Button onClick={calibrate} disabled={busy || (!pct5h && !pct7d)} size="sm">Calibrate</Button>
        </div>
      </div>

      {/* Weekly reset pin */}
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-muted-foreground text-xs">
            Weekly reset {data.weeklyResetPinned ? '(pinned)' : '(rolling 7-day until pinned)'}
          </span>
          <Input
            type="datetime-local" value={reset} onChange={(e) => setReset(e.target.value)} className="w-56"
          />
        </label>
        <Button
          size="sm" variant="outline" disabled={busy || !reset}
          onClick={() => run({ usage_weekly_reset_iso: new Date(reset).toISOString() })}
        >
          Pin reset
        </Button>
        {data.weeklyResetPinned && (
          <Button size="sm" variant="ghost" disabled={busy}
            onClick={() => run({ usage_weekly_reset_iso: null })}
            className="text-xs text-muted-foreground">
            clear
          </Button>
        )}
        <p className="w-full text-xs text-muted-foreground">
          Copy the &ldquo;Resets …&rdquo; time from <code className="bg-muted px-1 rounded">/usage</code> &rarr; Current week. It&apos;s assigned to your account and isn&apos;t stored locally, so we can&apos;t read it automatically.
        </p>
      </div>
    </div>
  )
}
