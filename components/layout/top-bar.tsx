'use client'

import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { mutate } from 'swr'
import { Search, RefreshCw, Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useSidebar } from '@/components/layout/sidebar-context'
import { cn } from '@/lib/utils'

interface TopBarProps {
  title: string
  subtitle?: string
  className?: string
}

function formatTimestamp(d: Date) {
  return d.toLocaleString('en-US', {
    month: 'numeric',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  })
}

export function TopBar({ title, subtitle, className }: TopBarProps) {
  const router = useRouter()
  const { setMobileOpen } = useSidebar()
  const [refreshing, setRefreshing] = useState(false)
  const [now, setNow] = useState<string>('')

  useEffect(() => {
    const update = () => setNow(formatTimestamp(new Date()))
    const initial = window.setTimeout(update, 0)
    const interval = window.setInterval(update, 1000)
    return () => {
      window.clearTimeout(initial)
      window.clearInterval(interval)
    }
  }, [])

  async function handleRefresh() {
    setRefreshing(true)
    await mutate(() => true, undefined, { revalidate: true })
    router.refresh()
    setTimeout(() => setRefreshing(false), 800)
  }

  return (
    <header
      data-glass="sticky"
      className={cn(
        'sticky top-0 z-30 flex items-center justify-between gap-4 py-3 px-4 md:px-6',
        className
      )}
    >
      {/* Left: title + subtitle */}
      <div className="min-w-0">
        <h1 className="text-[15px] font-medium tracking-[-0.015em] text-foreground truncate">{title}</h1>
        {subtitle && (
          <p className="text-xs font-mono text-muted-foreground truncate tracking-wide" suppressHydrationWarning>
            {subtitle}{now ? ` · ${now}` : ''}
          </p>
        )}
        {!subtitle && now && (
          <p className="text-xs font-mono text-muted-foreground tracking-wide" suppressHydrationWarning>{now}</p>
        )}
      </div>

      {/* Right: actions */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Mobile hamburger */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setMobileOpen(true)}
          className="md:hidden"
          aria-label="Open menu"
        >
          <Menu className="w-4 h-4" />
        </Button>
        {/* Search — desktop */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => window.dispatchEvent(new CustomEvent('open-search'))}
          className="hidden md:flex items-center gap-2 text-muted-foreground"
        >
          <Search className="w-3.5 h-3.5" />
          Search
          <kbd className="ml-1 text-[10px] text-muted-foreground/60 border border-border rounded-[4px] px-1.5 py-0.5 font-mono tracking-wide">⌘K</kbd>
        </Button>

        {/* Search — mobile icon only */}
        <Button
          variant="outline"
          size="icon"
          onClick={() => window.dispatchEvent(new CustomEvent('open-search'))}
          className="md:hidden"
          aria-label="Search"
        >
          <Search className="w-4 h-4" />
        </Button>

        {/* Refresh */}
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={refreshing}
          className="gap-2"
          aria-label="Refresh data"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">{refreshing ? 'Refreshing…' : 'Refresh'}</span>
        </Button>

      </div>
    </header>
  )
}
