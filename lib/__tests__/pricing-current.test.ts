import { describe, it, expect } from 'vitest'
import { getPricing, estimateTotalCostFromModel, pricingBucket, unpricedModels } from '@/lib/pricing'

describe('pricing: current models', () => {
  it('prices Fable 5.2 / Sonnet 5.5 / Haiku 5.5 by their own rows', () => {
    expect(getPricing('claude-fable-5-2').input * 1e6).toBeCloseTo(8)
    expect(getPricing('claude-sonnet-5-5').output * 1e6).toBeCloseTo(10)
    expect(getPricing('claude-haiku-5-5').input * 1e6).toBeCloseTo(0.1)
  })

  it('prices 1-hour cache writes at 2x input and Haiku 5.5 long prompts at the long tier', () => {
    const base = { inputTokens: 0, outputTokens: 0, cacheReadInputTokens: 0, cacheCreationInputTokens: 0, costUSD: 0, webSearchRequests: 0 }
    // Sonnet 5.5: 1M cache-write tokens, all 1h => $4 (2 x $2); all 5m => $2.50
    expect(estimateTotalCostFromModel('claude-sonnet-5-5', { ...base, cacheCreationInputTokens: 1e6, cacheCreation1hInputTokens: 1e6 })).toBeCloseTo(4)
    expect(estimateTotalCostFromModel('claude-sonnet-5-5', { ...base, cacheCreationInputTokens: 1e6 })).toBeCloseTo(2.5)
    expect(pricingBucket('claude-haiku-5-5', 50_000)).toBe('claude-haiku-5-5')
    expect(pricingBucket('claude-haiku-5-5', 150_000)).toBe('claude-haiku-5-5@long')
    expect(estimateTotalCostFromModel('claude-haiku-5-5@long', { ...base, inputTokens: 1e6 })).toBeCloseTo(0.5)
    expect(unpricedModels(['claude-opus-4-8', 'totally-new-model', '<synthetic>'])).toEqual(['totally-new-model'])
  })
})
