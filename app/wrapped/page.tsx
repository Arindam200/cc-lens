'use client'

import { useEffect, useRef, useState } from 'react'
import useSWR from 'swr'
import { TopBar } from '@/components/layout/top-bar'
import { formatTokens, formatCost } from '@/lib/decode'
import type { WrappedStats } from '@/app/api/wrapped/route'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import { AlertTriangle, Download, Share2, Sparkles } from 'lucide-react'

const fetcher = (url: string) =>
  fetch(url).then(r => { if (!r.ok) throw new Error(`API error ${r.status}`); return r.json() })

const W = 1200
const H = 675

// ─── Stat definitions ───────────────────────────────────────────────────────

type StatKey =
  | 'sessions' | 'tokens' | 'api_value' | 'days_active'
  | 'top_project' | 'busiest_hour' | 'favorite_tool' | 'top_model'

interface StatDef {
  key: StatKey
  label: string
  /** Always shown — the two numbers that make the card make sense. */
  locked?: boolean
}

// Order here is the order blocks flow into the card's grid.
const STAT_DEFS: StatDef[] = [
  { key: 'sessions',      label: 'Sessions' },
  { key: 'tokens',        label: 'Tokens', locked: true },
  { key: 'api_value',     label: 'API value' },
  { key: 'days_active',   label: 'Days active' },
  { key: 'top_project',   label: 'Top project' },
  { key: 'busiest_hour',  label: 'Busiest hour' },
  { key: 'favorite_tool', label: 'Favorite tool' },
  { key: 'top_model',     label: 'Top model', locked: true },
]

// 8 stat slots in a 3-column grid; the bottom-right slot is reserved for the footer.
const SLOTS: Array<{ x: number; y: number }> = [
  { x: 64, y: 250 }, { x: 460, y: 250 }, { x: 860, y: 250 },
  { x: 64, y: 400 }, { x: 460, y: 400 }, { x: 860, y: 400 },
  { x: 64, y: 550 }, { x: 460, y: 550 },
]

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

function statContent(key: StatKey, stats: WrappedStats): { label: string; value: string; sub?: string } {
  switch (key) {
    case 'sessions':
      return { label: 'Sessions', value: stats.sessions.toLocaleString(), sub: `${stats.messages.toLocaleString()} messages` }
    case 'tokens':
      return { label: 'Tokens', value: formatTokens(stats.total_tokens), sub: `${formatTokens(stats.output_tokens)} generated` }
    case 'api_value':
      return { label: 'API value', value: formatCost(stats.total_cost), sub: `${(stats.cache_hit_rate * 100).toFixed(0)}% cache hit rate` }
    case 'days_active':
      return { label: 'Days active', value: String(stats.active_days), sub: `${stats.longest_streak_days}-day longest streak` }
    case 'top_project':
      return { label: 'Top project', value: stats.top_project?.name ?? '—', sub: stats.top_project ? `${stats.top_project.sessions} sessions` : undefined }
    case 'busiest_hour':
      return { label: 'Busiest hour', value: hourLabel(stats.busiest_hour) }
    case 'favorite_tool':
      return { label: 'Favorite tool', value: stats.top_tool?.name ?? '—', sub: stats.top_tool ? `${stats.top_tool.calls.toLocaleString()} calls` : undefined }
    case 'top_model':
      return { label: 'Top model', value: modelShortName(stats.top_model) }
  }
}

// ─── Card ────────────────────────────────────────────────────────────────────

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

function WrappedCard({
  stats, name, tagline, logoDataUrl, visible, svgRef,
}: {
  stats: WrappedStats
  name: string
  tagline: string
  logoDataUrl: string | null
  visible: Record<StatKey, boolean>
  svgRef: React.RefObject<SVGSVGElement | null>
}) {
  const shown = STAT_DEFS.filter(d => visible[d.key]).slice(0, SLOTS.length)

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
        <clipPath id="logo-clip">
          <rect x="64" y="44" width="54" height="54" rx="13" />
        </clipPath>
      </defs>

      <rect width={W} height={H} fill="#1c1917" />
      <rect width={W} height={H} fill="url(#glow-tr)" />
      <rect width={W} height={H} fill="url(#glow-bl)" />
      <rect x="3" y="3" width={W - 6} height={H - 6} fill="none" stroke="#d97706" strokeOpacity="0.5" strokeWidth="2" rx="16" />

      {/* Header — logo + wordmark on the left, identity on the right */}
      {logoDataUrl && (
        <image href={logoDataUrl} x="64" y="44" width="54" height="54" clipPath="url(#logo-clip)" preserveAspectRatio="xMidYMid slice" />
      )}
      <text x={logoDataUrl ? 134 : 64} y="80" fill="#d97706" fontSize="25" fontWeight="700" letterSpacing="5" fontFamily="ui-monospace, monospace">
        CLAUDE CODE WRAPPED
      </text>
      <text x="64" y="172" fill="#fafaf9" fontSize="80" fontWeight="800" fontFamily="ui-sans-serif, system-ui, sans-serif">
        {stats.year}
      </text>

      <text x={W - 64} y="62" textAnchor="end" fill="#78716c" fontSize="20" fontFamily="ui-monospace, monospace">
        npx cc-lens
      </text>
      {name && (
        <text x={W - 64} y="132" textAnchor="end" fill="#fafaf9" fontSize="44" fontWeight="700" fontFamily="ui-sans-serif, system-ui, sans-serif">
          {name}
        </text>
      )}
      {tagline && (
        <text x={W - 64} y="168" textAnchor="end" fill="#a8a29e" fontSize="21" fontFamily="ui-sans-serif, system-ui, sans-serif">
          {tagline}
        </text>
      )}

      {/* Stat grid — only the blocks the user chose to show */}
      {shown.map((def, i) => {
        const slot = SLOTS[i]
        const c = statContent(def.key, stats)
        return <StatBlock key={def.key} x={slot.x} y={slot.y} label={c.label} value={c.value} sub={c.sub} />
      })}

      {/* Footer — pinned bottom-right */}
      <text x={860} y={602} fill="#78716c" fontSize="18" fontFamily="ui-sans-serif, system-ui, sans-serif">
        Local-first dashboard for Claude Code
      </text>
      <text x={860} y={630} fill="#d97706" fontSize="18" fontWeight="600" fontFamily="ui-monospace, monospace">
        github.com/Arindam200/cc-lens
      </text>
    </svg>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────

export default function WrappedPage() {
  const currentYear = new Date().getFullYear()
  const [year, setYear] = useState(currentYear)
  const { data, error, isLoading } = useSWR<WrappedStats>(`/api/wrapped?year=${year}`, fetcher)
  const svgRef = useRef<SVGSVGElement | null>(null)
  const [downloading, setDownloading] = useState(false)

  // Personalization
  const [name, setName] = useState('')
  const [tagline, setTagline] = useState('')
  const [visible, setVisible] = useState<Record<StatKey, boolean>>({
    sessions: true, tokens: true, api_value: true, days_active: true,
    top_project: true, busiest_hour: true, favorite_tool: true, top_model: true,
  })

  // Inline the logo as a data URL so it renders into the exported PNG.
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null)
  useEffect(() => {
    let active = true
    fetch('/logo.png')
      .then(r => r.blob())
      .then(blob => new Promise<string>((resolve, reject) => {
        const fr = new FileReader()
        fr.onload = () => resolve(fr.result as string)
        fr.onerror = () => reject(new Error('logo read failed'))
        fr.readAsDataURL(blob)
      }))
      .then(url => { if (active) setLogoDataUrl(url) })
      .catch(() => { /* card still renders without the logo */ })
    return () => { active = false }
  }, [])

  function toggleStat(key: StatKey) {
    const def = STAT_DEFS.find(d => d.key === key)
    if (def?.locked) return
    setVisible(v => ({ ...v, [key]: !v[key] }))
  }

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
      <div className="t-stagger-group p-6 space-y-6">

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

        {isLoading && <Skeleton className="aspect-[16/9] w-full max-w-4xl rounded-xl" />}

        {data && data.sessions === 0 && (
          <Alert>
            <Share2 className="h-4 w-4" />
            <AlertDescription>No sessions recorded in {year} yet.</AlertDescription>
          </Alert>
        )}

        {data && data.sessions > 0 && (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
            {/* Card + caption */}
            <div className="space-y-3">
              <WrappedCard
                stats={data}
                name={name.trim()}
                tagline={tagline.trim()}
                logoDataUrl={logoDataUrl}
                visible={visible}
                svgRef={svgRef}
              />
              <p className="text-xs text-muted-foreground">
                The card is rendered locally and contains only the aggregates you see — no prompts, no paths. Post it anywhere.
              </p>
            </div>

            {/* Customization panel */}
            <aside className="rounded-xl border border-border bg-card p-5 shadow-sm lg:sticky lg:top-6">
              <div className="flex items-center gap-2">
                <Sparkles className="size-4 text-primary" />
                <h3 className="text-sm font-semibold">Make it yours</h3>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Add your name and pick what to show, then download.
              </p>

              <div className="mt-4 space-y-3">
                <div className="space-y-1.5">
                  <label htmlFor="wrapped-name" className="text-xs font-medium text-muted-foreground">Name</label>
                  <Input
                    id="wrapped-name"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="e.g. Arindam"
                    maxLength={24}
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="wrapped-tagline" className="text-xs font-medium text-muted-foreground">Tagline</label>
                  <Input
                    id="wrapped-tagline"
                    value={tagline}
                    onChange={e => setTagline(e.target.value)}
                    placeholder="e.g. Shipping with Claude Code"
                    maxLength={42}
                  />
                </div>
              </div>

              <Separator className="my-4" />

              <p className="text-xs font-medium text-muted-foreground">Show on card</p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {STAT_DEFS.map(def => {
                  const active = visible[def.key]
                  return (
                    <button
                      key={def.key}
                      type="button"
                      onClick={() => toggleStat(def.key)}
                      disabled={def.locked}
                      aria-pressed={active}
                      className={cn(
                        'flex items-center justify-between gap-1 rounded-md border px-2.5 py-2 text-xs transition-colors',
                        active
                          ? 'border-primary/50 bg-primary/10 text-foreground'
                          : 'border-border text-muted-foreground hover:bg-muted/50',
                        def.locked && 'cursor-default opacity-80',
                      )}
                    >
                      <span className="truncate">{def.label}</span>
                      <span className={cn('shrink-0 text-[10px] font-medium', active ? 'text-primary' : 'text-muted-foreground/70')}>
                        {def.locked ? 'Always' : active ? 'On' : 'Off'}
                      </span>
                    </button>
                  )
                })}
              </div>
            </aside>
          </div>
        )}
      </div>
    </div>
  )
}
