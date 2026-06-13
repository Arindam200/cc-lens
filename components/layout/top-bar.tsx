'use client'

import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { mutate } from 'swr'
import { Search, RefreshCw, Star, Github, Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useSidebar } from '@/components/layout/sidebar-context'
import { UsagePill } from '@/components/usage/usage-pill'
import { cn } from '@/lib/utils'

interface TopBarProps {
  title: string
  subtitle?: string
  showStarButton?: boolean
  className?: string
}

const GITHUB_REPO = 'https://github.com/Arindam200/cc-lens'

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

export function TopBar({ title, subtitle, showStarButton = false, className }: TopBarProps) {
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
      className={cn(
        'sticky top-0 z-30 flex items-center justify-between gap-4 border-b border-border bg-background/95 py-3 backdrop-blur px-4 md:px-6',
        className
      )}
    >
      {/* Left: title + subtitle */}
      <div className="min-w-0">
        <h1 className="text-base font-semibold text-foreground truncate">{title}</h1>
        {subtitle && (
          <p className="text-xs text-muted-foreground truncate" suppressHydrationWarning>
            {subtitle}{now ? ` · ${now}` : ''}
          </p>
        )}
        {!subtitle && now && (
          <p className="text-xs text-muted-foreground" suppressHydrationWarning>{now}</p>
        )}
      </div>

      {/* Right: actions */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Live 5-hour usage gauge — always in view */}
        <UsagePill />

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
          <kbd className="ml-1 text-[10px] text-muted-foreground/50 border border-border rounded px-1 font-sans">⌘K</kbd>
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

        {/* Star on GitHub */}
        {showStarButton && (
          <Button asChild size="sm" className="gap-2 font-medium">
            <a href={GITHUB_REPO} target="_blank" rel="noopener noreferrer">
              <Github className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Star on GitHub</span>
              <span className="sm:hidden">Star</span>
              <Star className="w-3 h-3 fill-current opacity-80" />
            </a>
          </Button>
        )}
      </div>
    </header>
  )
}
