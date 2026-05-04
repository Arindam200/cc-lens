/**
 * Chart color palette aligned with the SW Nightshift design system.
 * Recharts paints SVG fills/strokes from string values and does not resolve `var(--*)`,
 * so series colors must be expressed as concrete hex per theme.
 *
 * Hierarchy:
 *  - 1: indigo (primary brand accent)
 *  - 2: teal (secondary accent, reserved for binary comparisons)
 *  - 3..5: neutral fade — strong, mid, soft
 *
 * Plus semantic status colors (success / warning / error / neutral) for charts
 * where the data carries meaning, not where colors are decorative.
 */

export type ChartTheme = 'light' | 'dark'

export interface ChartPalette {
  primary: string
  secondary: string
  neutral: string
  neutralMid: string
  neutralSoft: string
  success: string
  warning: string
  error: string
  foreground: string
  muted: string
  grid: string
}

const LIGHT: ChartPalette = {
  primary: '#6366F1',
  secondary: '#14B8A6',
  neutral: '#4B5563',
  neutralMid: '#9CA3AF',
  neutralSoft: '#D1D5DB',
  success: '#22C55E',
  warning: '#E0B341',
  error: '#EF4444',
  foreground: '#111111',
  muted: '#4B5563',
  grid: '#E8E6E1',
}

const DARK: ChartPalette = {
  primary: '#818CF8',
  secondary: '#2DD4BF',
  neutral: '#9CA0AB',
  neutralMid: '#6B7280',
  neutralSoft: '#4B5563',
  success: '#34D399',
  warning: '#FBBF24',
  error: '#F87171',
  foreground: '#EDEDED',
  muted: '#9CA0AB',
  grid: '#2A2A35',
}

export function getChartPalette(theme: ChartTheme): ChartPalette {
  return theme === 'dark' ? DARK : LIGHT
}

/** Series sequence for charts with multiple non-semantic series (donuts, multi-line). */
export function getChartSeries(theme: ChartTheme): string[] {
  const p = getChartPalette(theme)
  return [p.primary, p.secondary, p.neutral, p.neutralMid, p.neutralSoft]
}
