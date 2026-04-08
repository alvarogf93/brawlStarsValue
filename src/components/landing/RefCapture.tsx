'use client'

import { useEffect } from 'react'
import { useSearchParams } from 'next/navigation'

/** Captures ?ref=CODE from URL and stores in localStorage for later use during registration */
export function RefCapture() {
  const searchParams = useSearchParams()

  useEffect(() => {
    const ref = searchParams.get('ref')
    if (ref) {
      try {
        localStorage.setItem('brawlvalue:ref', ref.toUpperCase())
      } catch { /* ignore */ }
    }
  }, [searchParams])

  return null
}
