import { describe, it, expect, afterAll } from 'vitest'

// Point user overrides at a path that doesn't exist so the developer's real
// ~/.cc-lens/pricing.json can't leak into assertions
const previousConfigDir = process.env.CC_LENS_CONFIG_DIR
process.env.CC_LENS_CONFIG_DIR = '/nonexistent-cc-lens-test'

afterAll(() => {
  if (previousConfigDir === undefined) delete process.env.CC_LENS_CONFIG_DIR
  else process.env.CC_LENS_CONFIG_DIR = previousConfigDir
})

import {
  getPricing,
  hasKnownPricing,
  estimateCostFromUsage,
  estimateTotalCostFromModel,
  cacheEfficiency,
} from '@/lib/pricing'

const MTOK = 1_000_000

describe('getPricing', () => {
  it('returns exact rates for current models', () => {
    expect(getPricing('claude-opus-4-8').input * MTOK).toBeCloseTo(5)
    expect(getPricing('claude-fable-5').input * MTOK).toBeCloseTo(10)
    expect(getPricing('claude-sonnet-4-6').output * MTOK).toBeCloseTo(15)
    expect(getPricing('claude-haiku-4-5').input * MTOK).toBeCloseTo(1)
  })

  it('resolves date-suffixed IDs to the most specific prefix', () => {
    // claude-opus-4-5-20251101 must hit the 4.5 entry ($5), not legacy claude-opus-4
    expect(getPricing('claude-opus-4-5-20251101').input * MTOK).toBeCloseTo(5)
    expect(getPricing('claude-haiku-4-5-20251001').input * MTOK).toBeCloseTo(1)
  })

  it('resolves legacy Opus 4 date-suffixed IDs to legacy rates', () => {
    // claude-opus-4-20250514 is legacy $15/$75 — must NOT match claude-opus-4-7 etc.
    expect(getPricing('claude-opus-4-20250514').input * MTOK).toBeCloseTo(15)
    expect(getPricing('claude-opus-4-20250514').output * MTOK).toBeCloseTo(75)
  })

  it('falls back to current Opus rates for unknown models', () => {
    expect(getPricing('some-future-model').input * MTOK).toBeCloseTo(5)
  })
})

describe('hasKnownPricing', () => {
  it('is true for known and prefixed models, false for unknown', () => {
    expect(hasKnownPricing('claude-opus-4-8')).toBe(true)
    expect(hasKnownPricing('claude-opus-4-5-20251101')).toBe(true)
    expect(hasKnownPricing('some-future-model')).toBe(false)
  })
})

describe('estimateCostFromUsage', () => {
  it('sums all four token buckets at per-token rates', () => {
    const cost = estimateCostFromUsage('claude-opus-4-8', {
      input_tokens: MTOK,
      output_tokens: MTOK,
      cache_creation_input_tokens: MTOK,
      cache_read_input_tokens: MTOK,
    })
    // 5 + 25 + 6.25 + 0.50
    expect(cost).toBeCloseTo(36.75)
  })

  it('treats missing fields as zero', () => {
    expect(estimateCostFromUsage('claude-opus-4-8', {})).toBe(0)
  })
})

describe('estimateTotalCostFromModel', () => {
  it('matches the per-usage estimator', () => {
    const cost = estimateTotalCostFromModel('claude-sonnet-4-6', {
      inputTokens: MTOK,
      outputTokens: MTOK,
      cacheCreationInputTokens: 0,
      cacheReadInputTokens: 0,
      costUSD: 0,
      webSearchRequests: 0,
    })
    expect(cost).toBeCloseTo(18) // 3 + 15
  })
})

describe('cacheEfficiency', () => {
  it('computes savings, hit rate, and counterfactual cost', () => {
    const result = cacheEfficiency('claude-opus-4-8', {
      inputTokens: MTOK,
      outputTokens: 0,
      cacheCreationInputTokens: 0,
      cacheReadInputTokens: MTOK,
      costUSD: 0,
      webSearchRequests: 0,
    })
    expect(result.savedUSD).toBeCloseTo(4.5) // (5 - 0.5) per MTok
    expect(result.hitRate).toBeCloseTo(0.5)
    expect(result.wouldHavePaidUSD).toBeCloseTo(10)
  })

  it('returns zero hit rate with no context tokens', () => {
    const result = cacheEfficiency('claude-opus-4-8', {
      inputTokens: 0,
      outputTokens: 0,
      cacheCreationInputTokens: 0,
      cacheReadInputTokens: 0,
      costUSD: 0,
      webSearchRequests: 0,
    })
    expect(result.hitRate).toBe(0)
  })
})
