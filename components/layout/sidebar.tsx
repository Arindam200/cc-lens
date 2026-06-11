'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, FolderOpen, MessageSquare, DollarSign,
  Wrench, Activity, History, Blocks, FileText,
  Brain, Settings, Download, Users, Moon, Sun, PanelLeftClose, PanelLeft,
} from 'lucide-react'
import { useTheme } from '@/components/theme-provider'
import { useSidebar } from '@/components/layout/sidebar-context'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

const NAV = [
  { href: '/',         label: 'Overview',  icon: LayoutDashboard },
  { href: '/projects', label: 'Projects',  icon: FolderOpen      },
  { href: '/sessions', label: 'Sessions',  icon: MessageSquare   },
  { href: '/costs',    label: 'Costs',     icon: DollarSign      },
  { href: '/tools',    label: 'Tools',     icon: Wrench          },
  { href: '/activity', label: 'Activity',  icon: Activity        },
  { href: '/history',  label: 'History',   icon: History         },
  { href: '/workspace', label: 'Workspace', icon: Blocks         },
  { href: '/team',     label: 'Team',      icon: Users           },
  { href: '/plans',    label: 'Plans',     icon: FileText        },
  { href: '/memory',   label: 'Memory',    icon: Brain           },
  { href: '/settings', label: 'Settings',  icon: Settings        },
  { href: '/export',   label: 'Export',    icon: Download        },
]

function NavItem({
  href, label, icon: Icon, active, collapsed,
}: {
  href: string; label: string; icon: React.ElementType; active: boolean; collapsed: boolean
}) {
  const link = (
    <Link
      href={href}
      className={cn(
        'flex items-center gap-2.5 rounded-md text-sm font-medium transition-colors relative',
        collapsed ? 'justify-center p-2.5' : 'px-3 py-2.5',
        active
          ? 'text-sidebar-primary bg-sidebar-accent border-l-2 border-l-sidebar-primary'
          : 'text-sidebar-foreground hover:text-sidebar-accent-foreground hover:bg-sidebar-accent/80',
        active && collapsed && 'border-l-0',
      )}
    >
      <Icon className={cn('w-4 h-4 shrink-0', active ? 'text-sidebar-primary' : 'text-sidebar-foreground/60')} />
      {!collapsed && label}
    </Link>
  )

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{link}</TooltipTrigger>
        <TooltipContent side="right" className="text-xs">{label}</TooltipContent>
      </Tooltip>
    )
  }
  return link
}

function SidebarContents({
  collapsed = false,
  onNavigate,
}: {
  collapsed?: boolean
  onNavigate?: () => void
}) {
  const pathname = usePathname()
  const { theme, toggle: toggleTheme } = useTheme()
  const { toggle: toggleCollapsed } = useSidebar()

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className={cn(
        'border-b border-sidebar-border flex items-center',
        collapsed ? 'justify-center px-2 py-4' : 'justify-between px-4 pt-5 pb-4',
      )}>
        {!collapsed && (
          <span
            className={cn(
              'inline-block rounded-md px-2.5 py-1.5 text-[12px] leading-snug tracking-[0.06em]',
              'whitespace-nowrap select-none',
              /* Light: readable terracotta on soft tint — no heavy dark-game shadow */
              'text-[#9a3412]',
              'bg-linear-to-b from-[#f97316]/14 to-[#f97316]/6',
              'ring-1 ring-inset ring-[#f97316]/28',
              'shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_1px_3px_rgba(24,24,27,0.08)]',
              /* Dark: retro glow */
              'dark:text-[#c2703a]',
              'dark:from-[#c2703a]/18 dark:to-[#c2703a]/8 dark:ring-[#c2703a]/40',
              'dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_0_22px_-8px_rgba(194,112,58,0.45)]',
              '[-webkit-text-stroke:0.35px_rgba(124,45,18,0.35)] dark:[-webkit-text-stroke:0.45px_#b56230]',
            )}
            style={{ fontFamily: 'var(--font-press-start)' }}
          >
            <span
              className="dark:[text-shadow:0_1px_0_#5c2a0c,0_2px_0_#3d1c08,0_3px_6px_rgba(0,0,0,0.35)] [text-shadow:0_1px_0_rgba(255,255,255,0.4)]"
            >
              CC Lens
            </span>
          </span>
        )}
        <button
          onClick={toggleCollapsed}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="hidden md:flex p-1.5 rounded-md text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors cursor-pointer"
        >
          {collapsed
            ? <PanelLeft className="w-4 h-4" />
            : <PanelLeftClose className="w-4 h-4" />}
        </button>
      </div>

      {/* Nav */}
      <nav className={cn('flex-1 py-4 space-y-0.5 overflow-y-auto', collapsed ? 'px-1' : 'px-3')}>
        <TooltipProvider delayDuration={100}>
          {NAV.map(({ href, label, icon }) => (
            <div key={href} onClick={onNavigate}>
              <NavItem
                href={href}
                label={label}
                icon={icon}
                active={pathname === href}
                collapsed={collapsed}
              />
            </div>
          ))}
        </TooltipProvider>
      </nav>

      {/* Footer */}
      <div className={cn(
        'border-t border-sidebar-border flex items-center',
        collapsed ? 'justify-center px-2 py-3' : 'justify-between px-4 py-3',
      )}>
        {!collapsed && (
          <a
            href="https://github.com/Arindam200"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-sidebar-foreground/50 hover:text-sidebar-foreground transition-colors"
          >
           Made by Arindam
          </a>
        )}
        <button
          onClick={toggleTheme}
          aria-label="Toggle theme"
          className="p-1.5 rounded-md text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors cursor-pointer"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
      </div>
    </div>
  )
}

export function Sidebar() {
  const { collapsed, mobileOpen, setMobileOpen } = useSidebar()

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={cn(
          'hidden md:flex fixed left-0 top-0 h-screen flex-col border-r border-sidebar-border bg-sidebar z-40',
          'transition-[width] duration-300 overflow-hidden',
          collapsed ? 'w-14' : 'w-56',
        )}
      >
        <SidebarContents collapsed={collapsed} />
      </aside>

      {/* Mobile Sheet */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-56 p-0 bg-sidebar border-sidebar-border">
          <SidebarContents onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>
    </>
  )
}
