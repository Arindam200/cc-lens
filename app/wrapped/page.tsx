'use client'

import { useRef, useState } from 'react'
import useSWR from 'swr'
import { TopBar } from '@/components/layout/top-bar'
import { formatTokens, formatCost } from '@/lib/decode'
import type { WrappedStats } from '@/app/api/wrapped/route'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AlertTriangle, Download, Share2 } from 'lucide-react'

const fetcher = (url: string) =>
  fetch(url).then(r => { if (!r.ok) throw new Error(`API error ${r.status}`); return r.json() })

const W = 1200
const H = 675

function modelShortName(model: string | null): string {
  if (!model) return '—'
  const m = model.replace(/^claude-/, '').replace(/-\d{8}$/, '')
  const parts = m.split('-')
  const family = parts[0].charAt(0).toUpperCase() + parts[0].slice(1)
  const version = parts.slice(1).join('.')
  return version ? `${family} ${version}` : family
}

function hourLabel(h: number | null): string {
  if (h === null) return '—'
  const period = h >= 12 ? 'PM' : 'AM'
  const display = h % 12 === 0 ? 12 : h % 12
  return `${display} ${period}`
}

function StatBlock({ x, y, label, value, sub }: { x: number; y: number; label: string; value: string; sub?: string }) {
  return (
    <g transform={`translate(${x}, ${y})`}>
      <text fill="#a8a29e" fontSize="20" fontFamily="ui-sans-serif, system-ui, sans-serif" letterSpacing="2">
        {label.toUpperCase()}
      </text>
      <text y="52" fill="#fafaf9" fontSize="46" fontWeight="700" fontFamily="ui-sans-serif, system-ui, sans-serif">
        {value}
      </text>
      {sub && (
        <text y="82" fill="#78716c" fontSize="18" fontFamily="ui-sans-serif, system-ui, sans-serif">
          {sub}
        </text>
      )}
    </g>
  )
}

function WrappedCard({ stats, svgRef }: { stats: WrappedStats; svgRef: React.RefObject<SVGSVGElement | null> }) {
  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${W} ${H}`}
      xmlns="http://www.w3.org/2000/svg"
      className="w-full h-auto rounded-xl border border-border shadow-lg"
    >
      <defs>
        <radialGradient id="glow-tr" cx="100%" cy="0%" r="80%">
          <stop offset="0%" stopColor="#d97706" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#d97706" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="glow-bl" cx="0%" cy="100%" r="70%">
          <stop offset="0%" stopColor="#f97316" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#f97316" stopOpacity="0" />
        </radialGradient>
      </defs>

      <rect width={W} height={H} fill="#1c1917" />
      <rect width={W} height={H} fill="url(#glow-tr)" />
      <rect width={W} height={H} fill="url(#glow-bl)" />
      <rect x="3" y="3" width={W - 6} height={H - 6} fill="none" stroke="#d97706" strokeOpacity="0.5" strokeWidth="2" rx="16" />

      {/* Header */}
      <text x="64" y="88" fill="#d97706" fontSize="26" fontWeight="700" letterSpacing="6" fontFamily="ui-monospace, monospace">
        CLAUDE CODE WRAPPED
      </text>
      <text x="64" y="170" fill="#fafaf9" fontSize="80" fontWeight="800" fontFamily="ui-sans-serif, system-ui, sans-serif">
        {stats.year}
      </text>
      <text x={W - 64} y="88" textAnchor="end" fill="#78716c" fontSize="22" fontFamily="ui-monospace, monospace">
        npx cc-lens
      </text>

      {/* Stat grid */}
      <StatBlock x={64}  y={250} label="Sessions"       value={stats.sessions.toLocaleString()} sub={`${stats.messages.toLocaleString()} messages`} />
      <StatBlock x={460} y={250} label="Tokens"         value={formatTokens(stats.total_tokens)} sub={`${formatTokens(stats.output_tokens)} generated`} />
      <StatBlock x={860} y={250} label="API value"      value={formatCost(stats.total_cost)} sub={`${(stats.cache_hit_rate * 100).toFixed(0)}% cache hit rate`} />

      <StatBlock x={64}  y={400} label="Days active"    value={String(stats.active_days)} sub={`${stats.longest_streak_days}-day longest streak`} />
      <StatBlock x={460} y={400} label="Top project"    value={stats.top_project?.name ?? '—'} sub={stats.top_project ? `${stats.top_project.sessions} sessions` : undefined} />
      <StatBlock x={860} y={400} label="Busiest hour"   value={hourLabel(stats.busiest_hour)} />

      <StatBlock x={64}  y={550} label="Favorite tool"  value={stats.top_tool?.name ?? '—'} sub={stats.top_tool ? `${stats.top_tool.calls.toLocaleString()} calls` : undefined} />
      <StatBlock x={460} y={550} label="Top model"      value={modelShortName(stats.top_model)} />

      <text x={860} y={602} fill="#78716c" fontSize="18" fontFamily="ui-sans-serif, system-ui, sans-serif">
        Local-first dashboard for Claude Code
      </text>
      <text x={860} y={630} fill="#d97706" fontSize="18" fontWeight="600" fontFamily="ui-monospace, monospace">
        github.com/Arindam200/cc-lens
      </text>
    </svg>
  )
}

export default function WrappedPage() {
  const currentYear = new Date().getFullYear()
  const [year, setYear] = useState(currentYear)
  const { data, error, isLoading } = useSWR<WrappedStats>(`/api/wrapped?year=${year}`, fetcher)
  const svgRef = useRef<SVGSVGElement | null>(null)
  const [downloading, setDownloading] = useState(false)

  async function downloadPng() {
    const svg = svgRef.current
    if (!svg) return
    setDownloading(true)
    try {
      const xml = new XMLSerializer().serializeToString(svg)
      const blob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const img = new Image()
      const scale = 2
      const canvas = document.createElement('canvas')
      try {
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve()
          img.onerror = () => reject(new Error('failed to render card'))
          img.src = url
        })
        canvas.width = W * scale
        canvas.height = H * scale
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      } finally {
        URL.revokeObjectURL(url)
      }
      const png = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'))
      if (!png) throw new Error('failed to encode PNG')
      const a = document.createElement('a')
      a.href = URL.createObjectURL(png)
      a.download = `claude-code-wrapped-${year}.png`
      a.click()
      URL.revokeObjectURL(a.href)
    } finally {
      setDownloading(false)
    }
  }

  const years = [currentYear, currentYear - 1]

  return (
    <div className="flex flex-col min-h-screen">
      <TopBar title="Wrapped" subtitle="Your year with Claude Code, as a shareable card" />
      <div className="p-6 space-y-6 max-w-5xl">

        <div className="flex flex-wrap items-center justify-between gap-3">
          <Tabs value={String(year)} onValueChange={v => setYear(Number(v))}>
            <TabsList>
              {years.map(y => <TabsTrigger key={y} value={String(y)}>{y}</TabsTrigger>)}
            </TabsList>
          </Tabs>
          <Button onClick={downloadPng} disabled={!data || downloading} className="gap-2">
            <Download className="size-4" /> {downloading ? 'Rendering…' : 'Download PNG'}
          </Button>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>Error loading stats: {String(error)}</AlertDescription>
          </Alert>
        )}

        {isLoading && <Skeleton className="aspect-[16/9] w-full rounded-xl" />}

        {data && data.sessions === 0 && (
          <Alert>
            <Share2 className="h-4 w-4" />
            <AlertDescription>No sessions recorded in {year} yet.</AlertDescription>
          </Alert>
        )}

        {data && data.sessions > 0 && (
          <>
            <WrappedCard stats={data} svgRef={svgRef} />
            <p className="text-xs text-muted-foreground">
              The card is rendered locally and contains only the aggregates you see — no prompts, no paths. Post it anywhere.
            </p>
          </>
        )}
      </div>
    </div>
  )
}
