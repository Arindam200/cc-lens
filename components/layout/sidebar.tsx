'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, FolderOpen, MessageSquare, DollarSign,
  Wrench, Activity, History, Blocks, FileText, Lightbulb, Gift,
  Brain, Settings, Download, Users, ListTodo, Gauge, Moon, Sun, PanelLeftClose, PanelLeft,
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
  { href: '/usage',    label: 'Usage',     icon: Gauge           },
  { href: '/insights', label: 'Insights',  icon: Lightbulb       },
  { href: '/tools',    label: 'Tools',     icon: Wrench          },
  { href: '/activity', label: 'Activity',  icon: Activity        },
  { href: '/history',  label: 'History',   icon: History         },
  { href: '/workspace', label: 'Workspace', icon: Blocks         },
  { href: '/team',     label: 'Team',      icon: Users           },
  { href: '/wrapped',  label: 'Wrapped',   icon: Gift            },
  { href: '/plans',    label: 'Plans',     icon: FileText        },
  { href: '/tasks',    label: 'Tasks',     icon: ListTodo        },
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
      aria-current={active ? 'page' : undefined}
      className={cn(
        'group/nav relative flex items-center gap-2.5 rounded-md text-sm transition-colors',
        collapsed ? 'justify-center p-2' : 'px-3 py-2',
        active
          ? 'bg-sidebar-accent font-medium text-sidebar-accent-foreground'
          : 'font-normal text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground',
      )}
    >
      {/* Active indicator: slim rounded accent bar at the row's leading edge */}
      {active && !collapsed && (
        <span
          aria-hidden
          className="absolute left-0 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-r-full bg-primary"
        />
      )}
      <Icon
        className={cn(
          'size-4 shrink-0 transition-colors',
          active
            ? collapsed
              ? 'text-primary'
              : 'text-sidebar-accent-foreground'
            : 'text-sidebar-foreground/45 group-hover/nav:text-sidebar-foreground/80',
        )}
      />
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
  const { theme, toggle: toggleTheme, mounted } = useTheme()
  const { toggle: toggleCollapsed } = useSidebar()

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className={cn(
        'border-b border-sidebar-border',
        collapsed
          ? 'flex flex-col items-center gap-3 px-2 py-4'
          : 'flex items-center justify-between px-4',
      )}>
        <Link
          href="/"
          aria-label="CC Lens home"
          className="flex items-center select-none rounded-md transition-opacity hover:opacity-80"
        >
          {collapsed ? (
            <Image
              src="/logo.png"
              alt="CC Lens"
              width={32}
              height={32}
              priority
              className="size-8 shrink-0 rounded-md"
            />
          ) : (
            <Image
              src="/logo-full.png"
              alt="CC Lens"
              width={180}
              height={108}
              priority
              className="h-16 w-auto"
            />
          )}
        </Link>
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
          {!mounted
            ? <span className="block w-4 h-4" aria-hidden />
            : theme === 'dark'
              ? <Sun className="w-4 h-4" />
              : <Moon className="w-4 h-4" />}
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
