import { describe, it, expect } from 'vitest'
import {
  slugToPath,
  pathToSlug,
  projectDisplayName,
  projectShortPath,
  formatTokens,
  formatCost,
  formatBytes,
  formatDuration,
  formatPct,
} from '@/lib/decode'

describe('slug helpers', () => {
  it('decodes a slug to a path', () => {
    expect(slugToPath('-Users-foo-bar-myproject')).toBe('/Users/foo/bar/myproject')
  })

  it('encodes a path to a slug', () => {
    expect(pathToSlug('/Users/foo/bar')).toBe('-Users-foo-bar')
  })

  it('derives display names', () => {
    expect(projectDisplayName('/Users/foo/Developer/studio1')).toBe('studio1')
    expect(projectDisplayName('')).toBe('Unknown')
    expect(projectShortPath('/Users/foo/Developer/studio1')).toBe('.../Developer/studio1')
  })
})

describe('formatters', () => {
  it('formats token counts', () => {
    expect(formatTokens(500)).toBe('500')
    expect(formatTokens(1_500)).toBe('1.5K')
    expect(formatTokens(2_500_000)).toBe('2.5M')
    expect(formatTokens(1_200_000_000)).toBe('1.2B')
  })

  it('formats costs with precision by magnitude', () => {
    expect(formatCost(0)).toBe('$0.00')
    expect(formatCost(0.0042)).toBe('$0.0042')
    expect(formatCost(0.42)).toBe('$0.420')
    expect(formatCost(12.345)).toBe('$12.35')
  })

  it('formats bytes', () => {
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(2048)).toBe('2.0 KB')
    expect(formatBytes(5 * 1_048_576)).toBe('5.00 MB')
  })

  it('formats durations', () => {
    expect(formatDuration(0.5)).toBe('<1m')
    expect(formatDuration(45)).toBe('45m')
    expect(formatDuration(60)).toBe('1h')
    expect(formatDuration(95)).toBe('1h 35m')
  })

  it('formats percentages', () => {
    expect(formatPct(1, 4)).toBe('25.0%')
    expect(formatPct(1, 0)).toBe('0%')
  })
})
