import type { Metadata } from 'next'
import { Geist_Mono, Press_Start_2P } from 'next/font/google'
import './globals.css'
import { Sidebar } from '@/components/layout/sidebar'
import { BottomNav } from '@/components/layout/bottom-nav'
import { ThemeProvider } from '@/components/theme-provider'
import { KeyboardNavProvider } from '@/components/keyboard-nav-provider'
import { SidebarProvider } from '@/components/layout/sidebar-context'
import { ClientLayout } from '@/components/layout/client-layout'

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

const pressStart2P = Press_Start_2P({
  variable: '--font-press-start',
  weight: '400',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'Claude Code Lens',
  description: 'Local Claude Code analytics. Reads directly from ~/.claude/',
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{var t=localStorage.getItem('theme');document.documentElement.classList.toggle('dark',t!=='light')}catch(e){}})()` }} />
      </head>
      <body suppressHydrationWarning className={`${geistMono.variable} ${pressStart2P.variable} antialiased`}>
        <ThemeProvider>
          <SidebarProvider>
            <div className="flex min-h-screen">
              <Sidebar />
              <ClientLayout>{children}</ClientLayout>
            </div>
            <BottomNav />
            <KeyboardNavProvider />
          </SidebarProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
