'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

// g + letter → navigate to page
const G_MAP: Record<string, string> = {
  h: '/',
  s: '/sessions',
  p: '/projects',
  c: '/costs',
  t: '/tools',
  a: '/activity',
  m: '/memory',
  e: '/export',
  l: '/plans',
  y: '/history',
  o: '/workspace',
}

function isTyping(): boolean {
  const el = document.activeElement
  if (!el) return false
  const tag = el.tagName.toLowerCase()
  return tag === 'input' || tag === 'textarea' || (el as HTMLElement).isContentEditable
}

export function useGlobalKeyboardNav(): boolean {
  const router = useRouter()
  const [gMode, setGMode] = useState(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function clearGMode() {
    setGMode(false)
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (isTyping()) return
      // Ignore if any modifier key is held (except shift)
      if (e.metaKey || e.ctrlKey || e.altKey) return

      // '/' opens search
      if (e.key === '/' && !gMode) {
        e.preventDefault()
        window.dispatchEvent(new CustomEvent('open-search'))
        return
      }

      if (gMode) {
        clearGMode()
        if (e.key === 'Escape') return
        const target = G_MAP[e.key]
        if (target) {
          e.preventDefault()
          router.push(target)
        }
        return
      }

      if (e.key === 'g') {
        setGMode(true)
        timeoutRef.current = setTimeout(clearGMode, 500)
      }
    }

    window.addEventListener('keydown', handler)
    return () => {
      window.removeEventListener('keydown', handler)
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [gMode, router])

  return gMode
}
