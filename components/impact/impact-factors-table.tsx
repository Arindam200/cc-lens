'use client'

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { TOKEN_ENERGY_WH, CARBON_INTENSITY, INFRA } from '@/lib/impact'

export function ImpactFactorsTable() {
  const tokenRows = [
    { label: 'Input', wh: TOKEN_ENERGY_WH.input, note: 'baseline (5× plus bas que output)' },
    { label: 'Output', wh: TOKEN_ENERGY_WH.output, note: '5× input (ratio de pricing Anthropic)' },
    { label: 'Cache write', wh: TOKEN_ENERGY_WH.cacheWrite, note: '~1.25× input' },
    { label: 'Cache read', wh: TOKEN_ENERGY_WH.cacheRead, note: '10× moins que input — cache est très efficient' },
  ]

  return (
    <div className="space-y-6">
      {/* Energy per token table */}
      <div>
        <h4 className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground mb-2">Énergie par token (baseline Sonnet, avant PUE)</h4>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Type de token</TableHead>
              <TableHead className="text-right">Wh / token</TableHead>
              <TableHead className="text-right">Wh / MTok</TableHead>
              <TableHead>Note</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tokenRows.map(r => (
              <TableRow key={r.label}>
                <TableCell className="font-mono text-sm">{r.label}</TableCell>
                <TableCell className="text-right font-mono text-xs">{r.wh.toExponential(2)}</TableCell>
                <TableCell className="text-right font-mono text-xs">{(r.wh * 1_000_000).toFixed(0)}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{r.note}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Model multipliers */}
      <div>
        <h4 className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground mb-2">Multiplicateur par taille de modèle</h4>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Famille</TableHead>
              <TableHead className="text-right">Multiplicateur</TableHead>
              <TableHead>Note</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell className="font-mono text-sm">Opus</TableCell>
              <TableCell className="text-right font-mono">×2.5</TableCell>
              <TableCell className="text-xs text-muted-foreground">Modèle plus gros, plus de params actifs</TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-mono text-sm">Sonnet</TableCell>
              <TableCell className="text-right font-mono">×1.0</TableCell>
              <TableCell className="text-xs text-muted-foreground">Baseline</TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-mono text-sm">Haiku</TableCell>
              <TableCell className="text-right font-mono">×0.4</TableCell>
              <TableCell className="text-xs text-muted-foreground">Plus petit, plus rapide</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>

      {/* Infrastructure */}
      <div>
        <h4 className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground mb-2">Facteurs d'infrastructure</h4>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Paramètre</TableHead>
              <TableHead className="text-right">Valeur</TableHead>
              <TableHead>Note</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell className="text-sm">PUE (datacenter overhead)</TableCell>
              <TableCell className="text-right font-mono">{INFRA.pue}</TableCell>
              <TableCell className="text-xs text-muted-foreground">AWS hyperscaler moyenne</TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="text-sm">WUE (eau / kWh)</TableCell>
              <TableCell className="text-right font-mono">{INFRA.water_ml_per_wh} L/kWh</TableCell>
              <TableCell className="text-xs text-muted-foreground">Moyenne datacenter</TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="text-sm">Carbon intensity — 🇺🇸 US</TableCell>
              <TableCell className="text-right font-mono">{CARBON_INTENSITY.us} kg/kWh</TableCell>
              <TableCell className="text-xs text-muted-foreground">Grid moyenne US (EIA)</TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="text-sm">Carbon intensity — 🇪🇺 EU</TableCell>
              <TableCell className="text-right font-mono">{CARBON_INTENSITY.eu} kg/kWh</TableCell>
              <TableCell className="text-xs text-muted-foreground">Grid moyenne EU</TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="text-sm">Carbon intensity — 🇫🇷 France</TableCell>
              <TableCell className="text-right font-mono">{CARBON_INTENSITY.fr} kg/kWh</TableCell>
              <TableCell className="text-xs text-muted-foreground">Mix nucléaire dominant</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>

      {/* Caveats */}
      <div className="rounded-md border border-[rgba(224,179,65,0.3)] bg-[rgba(224,179,65,0.06)] p-4 text-xs space-y-2">
        <p className="font-semibold text-[var(--warning)]">⚠ Limites de ces estimations</p>
        <ul className="list-disc list-inside space-y-1 text-muted-foreground">
          <li><strong className="text-foreground">Inference uniquement.</strong> L'entraînement n'est pas inclus — Anthropic ne publie pas ces données.</li>
          <li><strong className="text-foreground">Précision ±30-50 %</strong> selon les modèles et l'usage réel (cf. barres d'erreur Jegham et al.).</li>
          <li><strong className="text-foreground">Localisation réelle inconnue.</strong> Le toggle région sert à visualiser la sensibilité du CO₂ au mix électrique. Les serveurs Anthropic sont probablement mixtes US.</li>
          <li><strong className="text-foreground">Transport réseau négligé</strong> (bande passante internet) vs inférence GPU.</li>
        </ul>
      </div>

      {/* Sources */}
      <div>
        <h4 className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground mb-2">Sources</h4>
        <ul className="text-xs space-y-1.5">
          <li>
            <a href="https://epoch.ai/gradient-updates/how-much-energy-does-chatgpt-use" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
              Epoch AI — How much energy does ChatGPT use?
            </a>
            <span className="text-muted-foreground"> · baseline Wh/query, hypothèses H100</span>
          </li>
          <li>
            <a href="https://simonpcouch.com/blog/2026-01-20-cc-impact/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
              Simon P. Couch — Electricity use of AI coding agents
            </a>
            <span className="text-muted-foreground"> · décomposition Wh/token par type (input, output, cache)</span>
          </li>
          <li>
            <a href="https://arxiv.org/html/2505.09598v1" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
              Jegham et al. — How Hungry is AI? (arXiv 2505.09598)
            </a>
            <span className="text-muted-foreground"> · benchmark énergie/eau/CO₂ par modèle, incluant Claude 3.7 Sonnet</span>
          </li>
        </ul>
      </div>
    </div>
  )
}
