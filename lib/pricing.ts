import type { TurnUsage, ModelUsage } from '@/types/claude'

interface ModelPricing {
  input: number
  output: number
  cacheWrite: number
  cacheRead: number
}

// Vendored defaults — values are $ per million tokens. cacheWrite uses the
// 5-minute ephemeral rate (the common case); users can override via
// ~/.cc-lens/pricing.json. Source: claude.com/pricing as of 2026-05.
const DEFAULT_PRICING_PER_MTOK: Record<string, ModelPricing> = {
  // Opus 4.x current generation — $5 / $25
  'claude-opus-4-7':   { input: 5.00, output: 25.00, cacheWrite: 6.25,  cacheRead: 0.50 },
  'claude-opus-4-6':   { input: 5.00, output: 25.00, cacheWrite: 6.25,  cacheRead: 0.50 },
  'claude-opus-4-5':   { input: 5.00, output: 25.00, cacheWrite: 6.25,  cacheRead: 0.50 },
  // Opus 4.1 / 4.0 — legacy $15 / $75
  'claude-opus-4-1':   { input: 15.00, output: 75.00, cacheWrite: 18.75, cacheRead: 1.50 },
  'claude-opus-4':     { input: 15.00, output: 75.00, cacheWrite: 18.75, cacheRead: 1.50 },
  // Sonnet 4.x — $3 / $15
  'claude-sonnet-4-6': { input: 3.00, output: 15.00, cacheWrite: 3.75,  cacheRead: 0.30 },
  'claude-sonnet-4-5': { input: 3.00, output: 15.00, cacheWrite: 3.75,  cacheRead: 0.30 },
  'claude-sonnet-4':   { input: 3.00, output: 15.00, cacheWrite: 3.75,  cacheRead: 0.30 },
  // Haiku 4.5 — $1 / $5
  'claude-haiku-4-5':  { input: 1.00, output:  5.00, cacheWrite: 1.25,  cacheRead: 0.10 },
  // Haiku 3.5 — retired, $0.80 / $4
  'claude-haiku-3-5':  { input: 0.80, output:  4.00, cacheWrite: 1.00,  cacheRead: 0.08 },
}

function toPerToken(p: ModelPricing): ModelPricing {
  return {
    input:      p.input      / 1_000_000,
    output:     p.output     / 1_000_000,
    cacheWrite: p.cacheWrite / 1_000_000,
    cacheRead:  p.cacheRead  / 1_000_000,
  }
}

function isValidEntry(v: unknown): v is ModelPricing {
  if (!v || typeof v !== 'object') return false
  const o = v as Record<string, unknown>
  return (
    typeof o.input      === 'number' &&
    typeof o.output     === 'number' &&
    typeof o.cacheWrite === 'number' &&
    typeof o.cacheRead  === 'number'
  )
}

// Loads ~/.cc-lens/pricing.json if present. Server-side only; cached for
// process lifetime. Values are merged into defaults, so a user can override
// a single model or add new ones without restating the rest.
function loadUserOverrides(): Record<string, ModelPricing> {
  if (typeof window !== 'undefined') return {}
  try {
    // Use eval to keep these out of any client bundle that might import this
    // file by accident. They only run server-side.
    const os   = eval('require')('os')   as typeof import('os')
    const path = eval('require')('path') as typeof import('path')
    const fs   = eval('require')('fs')   as typeof import('fs')

    const configDir = process.env.CC_LENS_CONFIG_DIR ?? path.join(os.homedir(), '.cc-lens')
    const file = path.join(configDir, 'pricing.json')
    if (!fs.existsSync(file)) return {}

    const raw = JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, unknown>
    const out: Record<string, ModelPricing> = {}
    for (const [model, entry] of Object.entries(raw)) {
      if (isValidEntry(entry)) {
        out[model] = entry
      } else {
        console.warn(`[cc-lens] pricing.json: skipping invalid entry for "${model}"`)
      }
    }
    return out
  } catch (err) {
    console.warn('[cc-lens] failed to load pricing.json:', (err as Error).message)
    return {}
  }
}

let cachedPricing: Record<string, ModelPricing> | null = null
function getPricingTable(): Record<string, ModelPricing> {
  if (cachedPricing) return cachedPricing
  const merged: Record<string, ModelPricing> = { ...DEFAULT_PRICING_PER_MTOK, ...loadUserOverrides() }
  const perToken: Record<string, ModelPricing> = {}
  for (const [k, v] of Object.entries(merged)) perToken[k] = toPerToken(v)
  cachedPricing = perToken
  return perToken
}

// Back-compat export — some callers may have imported PRICING directly.
export const PRICING: Record<string, ModelPricing> = new Proxy({} as Record<string, ModelPricing>, {
  get:           (_, k: string)        => getPricingTable()[k],
  has:           (_, k: string)        => k in getPricingTable(),
  ownKeys:       ()                    => Reflect.ownKeys(getPricingTable()),
  getOwnPropertyDescriptor: (_, k: string) => Object.getOwnPropertyDescriptor(getPricingTable(), k),
})

function getPricing(model: string): ModelPricing {
  const table = getPricingTable()
  if (table[model]) return table[model]
  // fuzzy match on prefix
  for (const key of Object.keys(table)) {
    if (model.startsWith(key) || key.startsWith(model.split('-').slice(0, 3).join('-'))) {
      return table[key]
    }
  }
  return table['claude-opus-4-7']
}

export function estimateCostFromUsage(model: string, usage: TurnUsage): number {
  const p = getPricing(model)
  return (
    (usage.input_tokens                ?? 0) * p.input      +
    (usage.output_tokens               ?? 0) * p.output     +
    (usage.cache_creation_input_tokens ?? 0) * p.cacheWrite +
    (usage.cache_read_input_tokens     ?? 0) * p.cacheRead
  )
}

export function estimateCostFromSessionMeta(
  model: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const p = getPricing(model)
  return inputTokens * p.input + outputTokens * p.output
}

export interface CacheEfficiencyResult {
  savedUSD: number
  hitRate: number
  wouldHavePaidUSD: number
}

export function cacheEfficiency(
  model: string,
  usage: ModelUsage,
): CacheEfficiencyResult {
  const p = getPricing(model)
  const savedPerToken = p.input - p.cacheRead
  const savedUSD = usage.cacheReadInputTokens * savedPerToken
  const totalContext = usage.inputTokens + usage.cacheReadInputTokens
  const hitRate = totalContext > 0
    ? usage.cacheReadInputTokens / totalContext
    : 0
  const wouldHavePaidUSD =
    (usage.inputTokens + usage.cacheReadInputTokens) * p.input +
    usage.outputTokens * p.output +
    usage.cacheCreationInputTokens * p.cacheWrite
  return { savedUSD, hitRate, wouldHavePaidUSD }
}

export function estimateTotalCostFromModel(model: string, usage: ModelUsage): number {
  const p = getPricing(model)
  return (
    (usage.inputTokens                ?? 0) * p.input      +
    (usage.outputTokens               ?? 0) * p.output     +
    (usage.cacheCreationInputTokens   ?? 0) * p.cacheWrite +
    (usage.cacheReadInputTokens       ?? 0) * p.cacheRead
  )
}

export { getPricing }
export type { ModelPricing }
