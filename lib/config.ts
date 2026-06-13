import fs from 'fs/promises'
import path from 'path'
import os from 'os'

// User-level cc-lens settings, stored next to pricing.json in ~/.cc-lens/.
// Only known keys are read or written, so a hand-edited file can carry extra
// fields without cc-lens clobbering them on save.

/** Subscription plan a usage gauge is calibrated against. `custom` means the
 *  caps below are user-supplied rather than seeded from a preset. */
export type UsagePlan = 'pro' | 'max5x' | 'max20x' | 'custom'

export interface CcLensConfig {
  /** Soft monthly spend limit (API-equivalent USD); drives budget UI + alerts */
  monthly_budget_usd?: number

  // ─── Usage windows (the "headroom" gauge) ───────────────────────────────
  // None of these are read from Anthropic. They let the local gauge express a
  // percent against a cap that the user picks or calibrates, since the real
  // plan limit is never written to disk. See lib/usage-windows.ts.

  /** Override the auto-detected plan (from ~/.claude.json organizationType). */
  usage_plan?: UsagePlan
  /** Calibrated/overridden 5-hour cap, in API-equivalent USD. */
  usage_cap_5h_usd?: number
  /** Calibrated/overridden 7-day cap, in API-equivalent USD. */
  usage_cap_7d_usd?: number
  /** Pinned weekly-reset anchor (ISO). The account-assigned weekly reset is not
   *  on disk, so the user copies it from `/usage` once; we project it weekly. */
  usage_weekly_reset_iso?: string
}

const USAGE_PLANS: ReadonlySet<string> = new Set(['pro', 'max5x', 'max20x', 'custom'])

const UTC_ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/

/** True only for a canonical UTC ISO-8601 string — strict enough that a value
 *  round-trips through Date unchanged. Shared by the config loader and the API
 *  route so both paths accept exactly the same set of values. */
export function isCanonicalUtcIso(value: unknown): value is string {
  if (typeof value !== 'string' || !UTC_ISO_RE.test(value)) return false
  const d = new Date(value)
  return !isNaN(d.getTime()) && d.toISOString() === value
}

export function configDir(): string {
  return process.env.CC_LENS_CONFIG_DIR ?? path.join(os.homedir(), '.cc-lens')
}

function configFile(): string {
  return path.join(configDir(), 'config.json')
}

export async function readConfig(): Promise<CcLensConfig> {
  try {
    const raw = JSON.parse(await fs.readFile(configFile(), 'utf-8')) as Record<string, unknown>
    const out: CcLensConfig = {}
    if (typeof raw.monthly_budget_usd === 'number' && raw.monthly_budget_usd > 0) {
      out.monthly_budget_usd = raw.monthly_budget_usd
    }
    if (typeof raw.usage_plan === 'string' && USAGE_PLANS.has(raw.usage_plan)) {
      out.usage_plan = raw.usage_plan as UsagePlan
    }
    if (typeof raw.usage_cap_5h_usd === 'number' && raw.usage_cap_5h_usd > 0) {
      out.usage_cap_5h_usd = raw.usage_cap_5h_usd
    }
    if (typeof raw.usage_cap_7d_usd === 'number' && raw.usage_cap_7d_usd > 0) {
      out.usage_cap_7d_usd = raw.usage_cap_7d_usd
    }
    if (isCanonicalUtcIso(raw.usage_weekly_reset_iso)) {
      out.usage_weekly_reset_iso = raw.usage_weekly_reset_iso
    }
    return out
  } catch {
    return {}
  }
}

/**
 * Merge updates into config.json, preserving unknown fields. Passing
 * `undefined`/null for a known key deletes it.
 */
export async function updateConfig(updates: Partial<Record<keyof CcLensConfig, unknown>>): Promise<CcLensConfig> {
  let existing: Record<string, unknown> = {}
  try {
    existing = JSON.parse(await fs.readFile(configFile(), 'utf-8')) as Record<string, unknown>
  } catch { /* first write */ }

  if ('monthly_budget_usd' in updates) {
    const v = updates.monthly_budget_usd
    if (typeof v === 'number' && v > 0) existing.monthly_budget_usd = v
    else delete existing.monthly_budget_usd
  }
  if ('usage_plan' in updates) {
    const v = updates.usage_plan
    if (typeof v === 'string' && USAGE_PLANS.has(v)) existing.usage_plan = v
    else delete existing.usage_plan
  }
  if ('usage_cap_5h_usd' in updates) {
    const v = updates.usage_cap_5h_usd
    if (typeof v === 'number' && v > 0) existing.usage_cap_5h_usd = v
    else delete existing.usage_cap_5h_usd
  }
  if ('usage_cap_7d_usd' in updates) {
    const v = updates.usage_cap_7d_usd
    if (typeof v === 'number' && v > 0) existing.usage_cap_7d_usd = v
    else delete existing.usage_cap_7d_usd
  }
  if ('usage_weekly_reset_iso' in updates) {
    const v = updates.usage_weekly_reset_iso
    if (isCanonicalUtcIso(v)) existing.usage_weekly_reset_iso = v
    else delete existing.usage_weekly_reset_iso
  }
  await fs.mkdir(configDir(), { recursive: true })
  // Write-then-rename so a crash mid-write can't truncate the live config
  const file = configFile()
  const tmp = `${file}.tmp`
  await fs.writeFile(tmp, JSON.stringify(existing, null, 2) + '\n', 'utf-8')
  await fs.rename(tmp, file)
  return readConfig()
}
