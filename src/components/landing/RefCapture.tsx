'use client'

import { useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { STORAGE_KEYS } from '@/lib/storage'

/** Captures ?ref=CODE from URL and stores in localStorage for later use during registration */
export function RefCapture() {
  const searchParams = useSearchParams()

  useEffect(() => {
    const ref = searchParams.get('ref')
    if (ref) {
      try {
        localStorage.setItem(STORAGE_KEYS.REF, ref.toUpperCase())
      } catch { /* ignore */ }
    }
  }, [searchParams])

  return null
}
