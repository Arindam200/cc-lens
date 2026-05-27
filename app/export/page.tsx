'use client'

import { useState, useRef, useCallback, useMemo } from 'react'
import useSWR from 'swr'
import { TopBar } from '@/components/layout/top-bar'
import type { ImportDiff } from '@/types/claude'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import {
  Download,
  Upload,
  Database,
  Layers,
  History,
  FileJson2,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  CalendarDays,
} from 'lucide-react'
import { format } from 'date-fns'

const fetcher = (url: string) =>
  fetch(url).then(r => {
    if (!r.ok) throw new Error(`API error ${r.status}`)
    return r.json()
  })

interface ExportPreview {
  sessionCount: number
  facetCount: number
  historyEntries: number
  hasStatsCache: boolean
  totalSessionsIndexed: number
}

function previewUrl(dateFrom: string, dateTo: string) {
  const p = new URLSearchParams()
  if (dateFrom) p.set('from', dateFrom)
  if (dateTo) p.set('to', dateTo)
  const q = p.toString()
  return `/api/export${q ? `?${q}` : ''}`
}

export default function ExportPage() {
  const [exporting, setExporting] = useState(false)
  const [exportRange, setExportRange] = useState<{ from?: Date; to?: Date }>({})
  const [exportPickerOpen, setExportPickerOpen] = useState(false)
  const [importDiff, setImportDiff] = useState<ImportDiff | null>(null)
  const [importError, setImportError] = useState('')
  const [importLoading, setImportLoading] = useState(false)
  const [dragging, setDragging] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const rangeFromStr = exportRange.from ? format(exportRange.from, 'yyyy-MM-dd') : ''
  const rangeToStr = exportRange.to ? format(exportRange.to, 'yyyy-MM-dd') : ''
  const swrKey = useMemo(() => previewUrl(rangeFromStr, rangeToStr), [rangeFromStr, rangeToStr])

  const exportPickerLabel =
    exportRange.from && exportRange.to
      ? `${format(exportRange.from, 'MMM d')} – ${format(exportRange.to, 'MMM d, yyyy')}`
      : exportRange.from
        ? `${format(exportRange.from, 'MMM d, yyyy')} – …`
        : 'Pick date range (optional)'
  const { data: preview, error: previewError, isLoading: previewLoading } = useSWR<ExportPreview>(
    swrKey,
    fetcher,
    { refreshInterval: 30_000, keepPreviousData: true }
  )

  const dateFilterActive = Boolean(exportRange.from || exportRange.to)

  async function handleExport() {
    setExporting(true)
    try {
      const body: Record<string, unknown> = {}
      if (rangeFromStr || rangeToStr) {
        body.dateRange = { from: rangeFromStr || undefined, to: rangeToStr || undefined }
      }

      const res = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const data = await res.json()
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const date = new Date().toISOString().slice(0, 10)
      a.href = url
      a.download = `cclens-export-${date}.cclens.json`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setExporting(false)
    }
  }

  async function processFile(file: File) {
    setImportError('')
    setImportDiff(null)
    setImportLoading(true)
    try {
      const text = await file.text()
      const json = JSON.parse(text)
      const res = await fetch('/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(json),
      })
      if (!res.ok) {
        const err = await res.json()
        setImportError(err.error ?? 'Import failed')
        return
      }
      const diff = await res.json() as ImportDiff
      setImportDiff(diff)
    } catch (e) {
      setImportError(String(e))
    } finally {
      setImportLoading(false)
    }
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }, [])

  return (
    <div className="flex flex-col min-h-screen">
      <TopBar
        title="Export & import"
        subtitle="Download a portable backup of ~/.claude/ analytics or merge data from another machine"
      />

      <div className="p-6 space-y-6 flex-1">
        {previewError && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Could not load export preview</AlertTitle>
            <AlertDescription>{String(previewError)}</AlertDescription>
          </Alert>
        )}

        {/* Summary — fills the page so it never feels empty */}
        <section className="space-y-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">What will be exported</h2>
            <p className="text-sm text-muted-foreground mt-1">
              One JSON file includes stats cache, session metadata, facets, and command history. Numbers below respect the optional date range.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {previewLoading && !preview ? (
              <>
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-[104px] rounded-xl" />
                ))}
              </>
            ) : (
              <>
                <Card className="shadow-sm">
                  <CardHeader className="pb-2">
                    <CardDescription className="flex items-center gap-2">
                      <Database className="size-4 text-primary" />
                      Sessions
                    </CardDescription>
                    <CardTitle className="text-2xl tabular-nums">
                      {preview?.sessionCount ?? '—'}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-xs text-muted-foreground">
                      {dateFilterActive
                        ? 'In selected range'
                        : `of ${preview?.totalSessionsIndexed ?? '—'} indexed`}
                    </p>
                  </CardContent>
                </Card>
                <Card className="shadow-sm">
                  <CardHeader className="pb-2">
                    <CardDescription className="flex items-center gap-2">
                      <Layers className="size-4 text-primary" />
                      Facets
                    </CardDescription>
                    <CardTitle className="text-2xl tabular-nums">
                      {preview?.facetCount ?? '—'}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-xs text-muted-foreground">Linked to exported sessions</p>
                  </CardContent>
                </Card>
                <Card className="shadow-sm">
                  <CardHeader className="pb-2">
                    <CardDescription className="flex items-center gap-2">
                      <History className="size-4 text-primary" />
                      History rows
                    </CardDescription>
                    <CardTitle className="text-2xl tabular-nums">
                      {preview?.historyEntries ?? '—'}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-xs text-muted-foreground">Recent entries (up to 10k)</p>
                  </CardContent>
                </Card>
                <Card className="shadow-sm">
                  <CardHeader className="pb-2">
                    <CardDescription className="flex items-center gap-2">
                      <FileJson2 className="size-4 text-primary" />
                      Stats cache
                    </CardDescription>
                    <CardTitle className="text-base font-medium">
                      {preview?.hasStatsCache ? (
                        <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                          <CheckCircle2 className="size-5 shrink-0" />
                          Included
                        </span>
                      ) : (
                        <span className="text-muted-foreground">Not found</span>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-xs text-muted-foreground">From ~/.claude/ when available</p>
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:items-stretch">
          {/* Export */}
          <Card className="shadow-sm border-border/80 flex h-full min-h-0 flex-col">
            <CardHeader>
              <div className="flex items-start gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Download className="size-5" />
                </div>
                <div className="space-y-1">
                  <CardTitle>Export</CardTitle>
                  <CardDescription>
                    Download <code className="rounded bg-muted px-1 py-0.5 text-xs">.cclens.json</code> for backup or
                    another machine.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col gap-5 min-h-0">
              <div className="space-y-2">
                <span className="text-sm font-medium leading-none">Date range (optional)</span>
                <div className="flex flex-wrap items-center gap-2">
                  <Popover open={exportPickerOpen} onOpenChange={setExportPickerOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant={dateFilterActive ? 'default' : 'outline'}
                        size="sm"
                        className="gap-2 justify-start"
                      >
                        <CalendarDays className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{exportPickerLabel}</span>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="range"
                        selected={{ from: exportRange.from, to: exportRange.to }}
                        onSelect={range => {
                          setExportRange({ from: range?.from, to: range?.to })
                          if (range?.from && range?.to) setExportPickerOpen(false)
                        }}
                        disabled={{ after: new Date() }}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  {dateFilterActive && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 text-muted-foreground"
                      onClick={() => setExportRange({})}
                    >
                      Clear
                    </Button>
                  )}
                </div>
              </div>
              {dateFilterActive && (
                <p className="text-xs text-muted-foreground rounded-md bg-muted/50 px-3 py-2 border border-border/60">
                  Only sessions whose <span className="font-medium text-foreground/80">start time</span> falls in this
                  range are included. Use <span className="font-medium text-foreground/80">Clear</span> for a full export.
                </p>
              )}
              <div className="mt-auto flex flex-col gap-5">
                <Separator />
                <Button
                  className="w-full sm:w-auto"
                  size="lg"
                  onClick={handleExport}
                  disabled={exporting || previewLoading}
                >
                  {exporting ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Preparing download…
                    </>
                  ) : (
                    <>
                      <Download className="size-4" />
                      Download export
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Import */}
          <Card className="shadow-sm border-border/80 flex h-full min-h-0 flex-col">
            <CardHeader>
              <div className="flex items-start gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
                  <Upload className="size-5" />
                </div>
                <div className="space-y-1">
                  <CardTitle>Import / merge</CardTitle>
                  <CardDescription>
                    Drop a file from another machine. Merge is <strong className="text-foreground/90">additive only</strong>
                    — existing sessions are never overwritten.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col gap-4 min-h-0">
              <button
                type="button"
                onDragOver={e => {
                  e.preventDefault()
                  setDragging(true)
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                onClick={() => fileRef.current?.click()}
                className={`
                  flex w-full flex-1 min-h-[220px] flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors
                  ${dragging ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/40 hover:bg-muted/40'}
                `}
              >
                <Upload className="size-8 mb-3 text-muted-foreground opacity-80" />
                <p className="text-sm text-foreground font-medium">Drop .cclens.json here</p>
                <p className="text-xs text-muted-foreground mt-1">
                  or <span className="text-primary underline underline-offset-2">browse files</span>
                </p>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".json,.cclens.json,application/json"
                  className="hidden"
                  onChange={e => {
                    const file = e.target.files?.[0]
                    if (file) processFile(file)
                  }}
                />
              </button>

              {importLoading && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  Analyzing file…
                </div>
              )}

              {importError && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription className="font-mono text-xs">{importError}</AlertDescription>
                </Alert>
              )}

              {importDiff && (
                <div className="rounded-lg border bg-muted/30 p-4 space-y-3 text-sm">
                  <p className="font-semibold text-foreground flex items-center gap-2">
                    <FileJson2 className="size-4 opacity-70" />
                    Merge preview
                  </p>
                  <dl className="grid gap-2 text-muted-foreground">
                    <div className="flex justify-between gap-4">
                      <dt>Sessions in file</dt>
                      <dd className="font-mono text-foreground font-semibold tabular-nums">
                        {importDiff.total_in_export}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt>Already present (skipped)</dt>
                      <dd className="font-mono tabular-nums text-muted-foreground/80">{importDiff.already_present}</dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt>New sessions to add</dt>
                      <dd
                        className={`font-mono font-semibold tabular-nums ${
                          importDiff.new_sessions > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground/60'
                        }`}
                      >
                        {importDiff.new_sessions}
                      </dd>
                    </div>
                  </dl>

                  {importDiff.new_sessions === 0 ? (
                    <p className="text-xs text-muted-foreground pt-1 border-t border-border/60">
                      Everything in this file is already in your index. Nothing to merge.
                    </p>
                  ) : (
                    <div className="space-y-2 pt-1 border-t border-border/60">
                      <Alert className="border-amber-500/40 bg-amber-500/5">
                        <AlertTriangle className="h-4 w-4 text-amber-600" />
                        <AlertDescription className="text-xs text-amber-800 dark:text-amber-200/90">
                          Writing merged data to ~/.claude/ is not implemented in this build — this is a preview only.
                        </AlertDescription>
                      </Alert>
                      <div className="max-h-36 overflow-auto rounded-md border border-border/60 bg-background/50 space-y-1 p-2 font-mono text-[11px] text-muted-foreground">
                        {importDiff.sessions_to_add.slice(0, 12).map(s => (
                          <div key={s.session_id}>
                            + {s.session_id.slice(0, 8)}… · {s.start_time.slice(0, 10)} ·{' '}
                            {s.project_path?.split('/').slice(-1)[0] ?? '—'}
                          </div>
                        ))}
                        {importDiff.sessions_to_add.length > 12 && (
                          <p className="text-muted-foreground/50 pt-1">
                            …and {importDiff.sessions_to_add.length - 12} more
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
