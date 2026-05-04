'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

type Theme = 'dark' | 'light'

const ThemeContext = createContext<{ theme: Theme; toggle: () => void }>({
  theme: 'dark',
  toggle: () => {},
})

export function useTheme() {
  return useContext(ThemeContext)
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // SSR default = 'dark' (matches server render, no hydration mismatch).
  // The inline <script> in <head> already applied the correct CSS class before
  // first paint, so there is no visual flash. useEffect then syncs React state.
  const [theme, setTheme] = useState<Theme>('dark')

  useEffect(() => {
    const stored = localStorage.getItem('theme')
    const next: Theme = stored === 'light' ? 'light' : 'dark'
    setTheme(next)
    document.documentElement.classList.toggle('dark', next === 'dark')
  }, [])

  const toggle = useCallback(() => {
    const root = document.documentElement
    root.classList.add('is-theme-switching')
    setTheme(prev => {
      const next: Theme = prev === 'dark' ? 'light' : 'dark'
      localStorage.setItem('theme', next)
      root.classList.toggle('dark', next === 'dark')
      return next
    })
    window.setTimeout(() => {
      root.classList.remove('is-theme-switching')
    }, 480)
  }, [])

  // Memoise the context value so consumers (every chart re-rendered through useTheme)
  // don't re-render on unrelated provider re-renders.
  const value = useMemo(() => ({ theme, toggle }), [theme, toggle])

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  )
}
