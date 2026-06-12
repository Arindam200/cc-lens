import fs from 'fs/promises'
import path from 'path'
import os from 'os'

// User-level cc-lens settings, stored next to pricing.json in ~/.cc-lens/.
// Only known keys are read or written, so a hand-edited file can carry extra
// fields without cc-lens clobbering them on save.

export interface CcLensConfig {
  /** Soft monthly spend limit (API-equivalent USD); drives budget UI + alerts */
  monthly_budget_usd?: number
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
  await fs.mkdir(configDir(), { recursive: true })
  // Write-then-rename so a crash mid-write can't truncate the live config
  const file = configFile()
  const tmp = `${file}.tmp`
  await fs.writeFile(tmp, JSON.stringify(existing, null, 2) + '\n', 'utf-8')
  await fs.rename(tmp, file)
  return readConfig()
}
