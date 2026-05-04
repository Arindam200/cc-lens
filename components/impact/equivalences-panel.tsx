'use client'

import { Zap, Droplet, Cloud } from 'lucide-react'
import { EQUIVALENCES } from '@/lib/impact'
import type { ImpactAnalytics } from '@/types/claude'

interface Props {
  impact: ImpactAnalytics
}

function Item({ value, unit, label }: { value: string; unit?: string; label: string }) {
  return (
    <li className="flex items-baseline gap-2 text-sm">
      <span className="font-mono font-bold text-foreground tabular-nums">
        {value}
        {unit && <span className="text-muted-foreground font-normal ml-0.5">{unit}</span>}
      </span>
      <span className="text-muted-foreground text-xs">{label}</span>
    </li>
  )
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 10_000) return `${(n / 1_000).toFixed(0)}k`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  if (n >= 10) return n.toFixed(0)
  if (n >= 1) return n.toFixed(1)
  return n.toFixed(2)
}

export function EquivalencesPanel({ impact }: Props) {
  const wh = impact.energy_wh
  const ml = impact.water_ml
  const g = impact.co2_g

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {/* Energy */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Zap className="w-4 h-4 text-[var(--warning)]" />
          <h4 className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Énergie</h4>
        </div>
        <ul className="space-y-2">
          <Item value={formatCount(wh / EQUIVALENCES.energy.led_hours)} label="heures d'ampoule LED (10W)" />
          <Item value={formatCount(wh / EQUIVALENCES.energy.smartphone_charge)} label="charges de smartphone" />
          <Item value={formatCount(wh / EQUIVALENCES.energy.ev_km)} unit="km" label="en voiture électrique" />
          <Item value={formatCount(wh / EQUIVALENCES.energy.washing_machine)} label="cycles de lave-linge" />
        </ul>
      </div>

      {/* Water */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Droplet className="w-4 h-4 text-primary" />
          <h4 className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Eau</h4>
        </div>
        <ul className="space-y-2">
          <Item value={formatCount(ml / EQUIVALENCES.water.glass)} label="verres d'eau (25 cL)" />
          <Item value={formatCount(ml / EQUIVALENCES.water.bottle)} label="bouteilles (50 cL)" />
          <Item value={formatCount(ml / EQUIVALENCES.water.shower)} label="douches courtes (60 L)" />
        </ul>
      </div>

      {/* CO₂ */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Cloud className="w-4 h-4 text-[var(--error)]" />
          <h4 className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">CO₂</h4>
        </div>
        <ul className="space-y-2">
          <Item value={formatCount(g / EQUIVALENCES.co2.petrol_car_km)} unit="km" label="en voiture essence" />
          <Item value={formatCount(g / EQUIVALENCES.co2.paris_ny_flight)} label="vols Paris → New York" />
          <Item value={formatCount(g / EQUIVALENCES.co2.beef_kg)} unit="kg" label="de bœuf consommé" />
        </ul>
      </div>
    </div>
  )
}
