import type { UsageTurn } from '@/lib/claude-reader'
import type { UsagePlan } from '@/lib/config'

// ─────────────────────────────────────────────────────────────────────────────
// Local "headroom" computation.
//
// IMPORTANT: nothing here reads Anthropic's real plan limits — those are never
// written to disk (see the investigation in the usage page footnotes). We
// reconstruct *consumption* exactly from local JSONL, then express it as a
// percent against a cap the user picks or calibrates. The reset countdowns are
// computed from message timestamps the same way Claude's own 5-hour window
// works: the window opens on your first message and closes 5 hours later.
// ─────────────────────────────────────────────────────────────────────────────

export const FIVE_HOURS_MS = 5 * 60 * 60 * 1000
export const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000

export interface WindowStat {
  /** API-equivalent USD consumed in the active window. */
  costUSD: number
  /** input + output + cache tokens consumed in the active window. */
  totalTokens: number
  /** Assistant turns in the active window. */
  turnCount: number
  /** Epoch ms the active window opened, or null when no window is open. */
  startMs: number | null
  /** Epoch ms the active window resets, or null when there's no fixed reset
   *  (rolling 7-day with no pinned anchor) or no window is open. */
  resetMs: number | null
  /** The cap this window is measured against (API-equivalent USD). */
  capUSD: number
  /** costUSD / capUSD, clamped to [0, 1+]; the gauge fill. */
  fraction: number
}

export interface PaceStat {
  /** API-equivalent USD per minute over the active 5-hour block. */
  usdPerMin: number
  /** Projected spend at reset if the current rate holds. */
  projectedAtResetUSD: number
  /** Epoch ms the cap is hit at the current rate, or null if not on track to. */
  capHitMs: number | null
}

export interface PlanPreset {
  id: UsagePlan
  label: string
  /** Rough, editable API-equivalent USD caps. These are estimates, NOT official
   *  Anthropic limits — they exist only to give the gauge a denominator. */
  cap5hUSD: number
  cap7dUSD: number
}

// Seed caps in API-equivalent USD. These are deliberately rough order-of-
// magnitude guesses — the Pro 5h value is anchored to one real observation
// (~$69 ≈ $43 measured ÷ 63% shown by /usage); Max tiers scale by their
// nominal 5×/20× multiples. Treat them as a starting point and CALIBRATE.
export const PLAN_PRESETS: Record<Exclude<UsagePlan, 'custom'>, PlanPreset> = {
  pro:    { id: 'pro',    label: 'Pro',     cap5hUSD: 70,   cap7dUSD: 1500 },
  max5x:  { id: 'max5x',  label: 'Max 5×',  cap5hUSD: 350,  cap7dUSD: 7500 },
  max20x: { id: 'max20x', label: 'Max 20×', cap5hUSD: 1400, cap7dUSD: 30000 },
}

/** Map ~/.claude.json organizationType to our plan id. Falls back to Pro, the
 *  most common plan, when the type is missing or unrecognized. */
export function planFromOrgType(orgType?: string): Exclude<UsagePlan, 'custom'> {
  if (!orgType) return 'pro'
  const t = orgType.toLowerCase()
  if (t.includes('max')) return 'max5x'   // tier (5×/20×) isn't on disk; user can switch
  return 'pro'
}

function fraction(cost: number, cap: number): number {
  if (cap <= 0) return 0
  return cost / cap
}

/**
 * The active 5-hour block. A new block opens on the first message that falls
 * more than 5 hours after the current block opened; the block resets exactly
 * 5 hours after it opened. If `now` is already past that reset, no block is
 * open (the next message will start a fresh one) and consumption reads zero.
 */
export function computeFiveHourBlock(turns: UsageTurn[], nowMs: number, capUSD: number): WindowStat {
  let blockStart: number | null = null
  for (const t of turns) {
    if (blockStart === null || t.ts - blockStart >= FIVE_HOURS_MS) {
      blockStart = t.ts
    }
  }

  const empty: WindowStat = {
    costUSD: 0, totalTokens: 0, turnCount: 0,
    startMs: null, resetMs: null, capUSD, fraction: 0,
  }
  if (blockStart === null) return empty

  const resetMs = blockStart + FIVE_HOURS_MS
  if (nowMs >= resetMs) return empty // block expired; window is fresh

  let costUSD = 0, totalTokens = 0, turnCount = 0
  for (const t of turns) {
    if (t.ts < blockStart) continue
    costUSD += t.costUSD
    totalTokens += t.inputTokens + t.outputTokens + t.cacheReadTokens + t.cacheWriteTokens
    turnCount++
  }
  return { costUSD, totalTokens, turnCount, startMs: blockStart, resetMs, capUSD, fraction: fraction(costUSD, capUSD) }
}

/**
 * The weekly window. With a pinned reset anchor we measure the exact 7-day
 * period ending at the next reset; without one we fall back to a trailing
 * rolling 7 days (no fixed reset to count down to).
 */
export function computeWeeklyWindow(
  turns: UsageTurn[],
  nowMs: number,
  capUSD: number,
  weeklyResetIso?: string,
): WindowStat {
  let periodStart: number
  let resetMs: number | null

  const anchor = weeklyResetIso ? Date.parse(weeklyResetIso) : NaN
  if (!isNaN(anchor)) {
    // Project the anchor forward in 7-day steps to the next reset after now.
    const periods = Math.ceil((nowMs - anchor) / SEVEN_DAYS_MS)
    resetMs = anchor + Math.max(periods, 0) * SEVEN_DAYS_MS
    if (resetMs <= nowMs) resetMs += SEVEN_DAYS_MS
    periodStart = resetMs - SEVEN_DAYS_MS
  } else {
    periodStart = nowMs - SEVEN_DAYS_MS
    resetMs = null // rolling
  }

  let costUSD = 0, totalTokens = 0, turnCount = 0
  for (const t of turns) {
    if (t.ts < periodStart) continue
    costUSD += t.costUSD
    totalTokens += t.inputTokens + t.outputTokens + t.cacheReadTokens + t.cacheWriteTokens
    turnCount++
  }
  return { costUSD, totalTokens, turnCount, startMs: periodStart, resetMs, capUSD, fraction: fraction(costUSD, capUSD) }
}

/** Burn-down projection for the active 5-hour block. */
export function computePace(block: WindowStat, nowMs: number): PaceStat {
  const none: PaceStat = { usdPerMin: 0, projectedAtResetUSD: block.costUSD, capHitMs: null }
  if (block.startMs === null || block.resetMs === null) return none

  const elapsedMin = Math.max((nowMs - block.startMs) / 60_000, 0.5)
  const usdPerMin = block.costUSD / elapsedMin
  const remainingMin = (block.resetMs - nowMs) / 60_000
  const projectedAtResetUSD = block.costUSD + usdPerMin * Math.max(remainingMin, 0)

  let capHitMs: number | null = null
  if (usdPerMin > 0 && block.costUSD < block.capUSD) {
    const minsToCap = (block.capUSD - block.costUSD) / usdPerMin
    const hit = nowMs + minsToCap * 60_000
    if (hit < block.resetMs) capHitMs = hit // only flag if it'd happen before reset
  }
  return { usdPerMin, projectedAtResetUSD, capHitMs }
}

/** Derive a personal cap from the percent Claude Code's own `/usage` shows, so
 *  the gauge tracks the official number. cap = consumption / (percent/100). */
export function calibrateCap(consumedUSD: number, percentShown: number): number | null {
  if (percentShown <= 0 || consumedUSD <= 0) return null
  return consumedUSD / (percentShown / 100)
}
