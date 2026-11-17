import type { TurnUsage, ModelUsage } from '@/types/claude'

interface ModelPricing {
  input: number
  output: number
  cacheWrite: number
  /** 1-hour cache write rate; defaults to 2x input (Anthropic's published multiplier). */
  cacheWrite1h?: number
  cacheRead: number
}

// Models whose price changes with prompt size. Usage is bucketed per turn under
// `<model>@long` once the prompt passes the threshold (tokens).
const LONG_PROMPT_THRESHOLD: Record<string, number> = { 'claude-haiku-5-5': 100_000 }

/** Pricing bucket for one turn: `<model>@long` when the prompt exceeds the model's long-prompt threshold. */
export function pricingBucket(model: string, promptTokens: number): string {
  for (const [key, limit] of Object.entries(LONG_PROMPT_THRESHOLD)) {
    if (matchesPricingKey(model, key) && promptTokens > limit) return `${key}@long`
  }
  return model
}

// Vendored defaults — values are $ per million tokens. cacheWrite uses the
// 5-minute ephemeral rate (the common case); users can override via
// ~/.cc-lens/pricing.json. Source: platform.claude.com/docs/en/about-claude/pricing, checked 2026-11-17.
const DEFAULT_PRICING_PER_MTOK: Record<string, ModelPricing> = {
  // Fable 5.2 — $8 / $40 (longer keys must exist so they beat the claude-fable-5 prefix)
  'claude-fable-5-2':  { input: 8.00, output: 40.00, cacheWrite: 10.00, cacheRead: 0.20 },
  // Fable 5.1 — $10 / $50, cache read $0.25
  'claude-fable-5-1':  { input: 10.00, output: 50.00, cacheWrite: 12.50, cacheRead: 0.25 },
  // Fable 5 — $10 / $50
  'claude-fable-5':    { input: 10.00, output: 50.00, cacheWrite: 12.50, cacheRead: 1.00 },
  // Opus 5.x current generation
  'claude-opus-5-5':   { input: 4.00, output: 20.00, cacheWrite: 5.00,  cacheRead: 0.20 },
  'claude-opus-5':     { input: 5.00, output: 25.00, cacheWrite: 6.25,  cacheRead: 0.50 },
  // Opus 4.x current generation — $5 / $25
  'claude-opus-4-8':   { input: 5.00, output: 25.00, cacheWrite: 6.25,  cacheRead: 0.50 },
  'claude-opus-4-7':   { input: 5.00, output: 25.00, cacheWrite: 6.25,  cacheRead: 0.50 },
  'claude-opus-4-6':   { input: 5.00, output: 25.00, cacheWrite: 6.25,  cacheRead: 0.50 },
  'claude-opus-4-5':   { input: 5.00, output: 25.00, cacheWrite: 6.25,  cacheRead: 0.50 },
  // Opus 4.1 / 4.0 — legacy $15 / $75
  'claude-opus-4-1':   { input: 15.00, output: 75.00, cacheWrite: 18.75, cacheRead: 1.50 },
  'claude-opus-4':     { input: 15.00, output: 75.00, cacheWrite: 18.75, cacheRead: 1.50 },
  // Sonnet 5.x — $2 / $10
  'claude-sonnet-5-5': { input: 2.00, output: 10.00, cacheWrite: 2.50,  cacheRead: 0.10 },
  'claude-sonnet-5':   { input: 2.00, output: 10.00, cacheWrite: 2.50,  cacheRead: 0.20 },
  // Sonnet 4.x — $3 / $15
  'claude-sonnet-4-6': { input: 3.00, output: 15.00, cacheWrite: 3.75,  cacheRead: 0.30 },
  'claude-sonnet-4-5': { input: 3.00, output: 15.00, cacheWrite: 3.75,  cacheRead: 0.30 },
  'claude-sonnet-4':   { input: 3.00, output: 15.00, cacheWrite: 3.75,  cacheRead: 0.30 },
  // Haiku 5.5 — prompts up to 100k tokens; over 100k is the `@long` row
  'claude-haiku-5-5':       { input: 0.10, output: 0.50, cacheWrite: 0.125, cacheRead: 0.01 },
  'claude-haiku-5-5@long':  { input: 0.50, output: 2.50, cacheWrite: 0.625, cacheRead: 0.05 },
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
    cacheWrite1h: (p.cacheWrite1h ?? p.input * 2) / 1_000_000,
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

/** Exact match, or the key followed by a real suffix segment — so
 *  claude-opus-4-5-20251101 matches claude-opus-4-5, but a hypothetical
 *  claude-opus-4-50 does not. */
function matchesPricingKey(model: string, key: string): boolean {
  return model === key || model.startsWith(`${key}-`)
}

/** True when we have an exact or prefix pricing entry for this model (vs the fallback guess). */
export function hasKnownPricing(model: string): boolean {
  const table = getPricingTable()
  return Object.keys(table).some(key => matchesPricingKey(model, key))
}

/** Models in `models` with no pricing entry (their cost uses a fallback rate). */
export function unpricedModels(models: Iterable<string>): string[] {
  return [...new Set(models)].filter(m => m !== '<synthetic>' && !hasKnownPricing(m)).sort()
}

function getPricing(model: string): ModelPricing {
  const table = getPricingTable()
  if (table[model]) return table[model]
  // Prefix match, longest key first so date-suffixed IDs resolve to the most
  // specific entry (claude-opus-4-5-20251101 → claude-opus-4-5, while
  // claude-opus-4-20250514 falls through to claude-opus-4's legacy rate).
  const keys = Object.keys(table).sort((a, b) => b.length - a.length)
  for (const key of keys) {
    if (matchesPricingKey(model, key)) return table[key]
  }
  // Smart fallback by model family instead of blind Opus fallback:
  if (model.includes('haiku')) return table['claude-haiku-4-5']
  if (model.includes('fable')) return table['claude-fable-5-1'] // highest known Fable rate: never under-estimate an unknown Fable
  if (model.includes('sonnet')) return table['claude-sonnet-5-5'] ?? table['claude-sonnet-4-6']
  // Unknown model — assume current Opus rates rather than legacy ones
  return table['claude-opus-4-8']
}

export function estimateCostFromUsage(model: string, usage: TurnUsage): number {
  const p = getPricing(model)
  const write = usage.cache_creation_input_tokens ?? 0
  const write1h = Math.min(write, usage.cache_creation?.ephemeral_1h_input_tokens ?? 0)
  return (
    (usage.input_tokens                ?? 0) * p.input      +
    (usage.output_tokens               ?? 0) * p.output     +
    (write - write1h) * p.cacheWrite + write1h * (p.cacheWrite1h ?? p.cacheWrite) +
    (usage.cache_read_input_tokens     ?? 0) * p.cacheRead
  )
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
  // No-cache baseline: without prompt caching, the tokens that were written to
  // cache would simply be sent as ordinary input on each call, billed at the
  // input rate — not the (higher) cache-write rate. Pricing them at cacheWrite
  // here would inflate the baseline by the ~25% write premium and understate
  // the savings figure. See issue #12.
  const wouldHavePaidUSD =
    (usage.inputTokens + usage.cacheReadInputTokens + usage.cacheCreationInputTokens) * p.input +
    usage.outputTokens * p.output
  return { savedUSD, hitRate, wouldHavePaidUSD }
}

export function estimateTotalCostFromModel(model: string, usage: ModelUsage): number {
  const p = getPricing(model)
  const write = usage.cacheCreationInputTokens ?? 0
  const write1h = Math.min(write, usage.cacheCreation1hInputTokens ?? 0)
  return (
    (usage.inputTokens                ?? 0) * p.input      +
    (usage.outputTokens               ?? 0) * p.output     +
    (write - write1h) * p.cacheWrite + write1h * (p.cacheWrite1h ?? p.cacheWrite) +
    (usage.cacheReadInputTokens       ?? 0) * p.cacheRead
  )
}

export { getPricing }
export type { ModelPricing }
