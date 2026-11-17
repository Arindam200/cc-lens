import { describe, it, expect } from 'vitest'
import { modelLabel } from '@/lib/model-label'

describe('modelLabel', () => {
  it('labels 4.x and 5.x ids, dated ids and the long-prompt bucket', () => {
    expect(modelLabel('claude-opus-4-8')).toBe('Opus 4.8')
    expect(modelLabel('claude-opus-5-5')).toBe('Opus 5.5')
    expect(modelLabel('claude-sonnet-4-5-20250929')).toBe('Sonnet 4.5')
    expect(modelLabel('claude-fable-5-2')).toBe('Fable 5.2')
    expect(modelLabel('claude-haiku-5-5@long')).toBe('Haiku 5.5 (long prompt)')
    expect(modelLabel('claude-opus-4-20250514')).toBe('Opus 4')
  })
})
