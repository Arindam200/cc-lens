'use client'

import type { Region } from '@/lib/impact'
import { REGION_LABELS, CARBON_INTENSITY } from '@/lib/impact'

interface Props {
  value: Region
  onChange: (r: Region) => void
}

export function RegionToggle({ value, onChange }: Props) {
  return (
    <div className="inline-flex items-center gap-0.5 border border-border rounded-md p-[3px] bg-secondary">
      {(Object.keys(REGION_LABELS) as Region[]).map(r => (
        <button
          key={r}
          onClick={() => onChange(r)}
          title={`${CARBON_INTENSITY[r]} kg CO₂e/kWh`}
          className={`px-2.5 py-1 rounded-[4px] text-[11px] font-mono uppercase tracking-[0.12em] transition-colors duration-150 ${
            value === r
              ? 'bg-background text-foreground'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          {REGION_LABELS[r]}
        </button>
      ))}
    </div>
  )
}
