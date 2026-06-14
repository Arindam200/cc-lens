'use client'

import { usePathname } from 'next/navigation'
import { useSidebar } from '@/components/layout/sidebar-context'

export function ClientLayout({ children }: { children: React.ReactNode }) {
  const { collapsed } = useSidebar()
  const pathname = usePathname()
  return (
    <main
      className={[
        'flex-1 min-h-screen overflow-x-hidden bg-background pb-16 md:pb-0',
        'transition-[margin] duration-300',
        collapsed ? 'md:ml-14' : 'md:ml-56',
      ].join(' ')}
    >
      {/* Re-key per route so the page-enter reveal replays on every navigation */}
      <div key={pathname} className="t-page-enter">
        {children}
      </div>
      <footer className="border-t border-border/50 py-3 px-6 flex items-center justify-center mb-16 md:mb-0">
        <p className="text-xs text-muted-foreground">
          Made by{' '}
          <a
            href="https://github.com/Arindam200"
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
          >
            Arindam
          </a>
        </p>
      </footer>
    </main>
  )
}
