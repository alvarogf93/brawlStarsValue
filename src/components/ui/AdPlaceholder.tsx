'use client'

import { useEffect, useRef } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { isPremium } from '@/lib/premium'
import type { Profile } from '@/lib/supabase/types'

// AdSense injects an `adsbygoogle` array on the global window. Declare it
// once so we don't need `any` casts every time we call push().
declare global {
  interface Window {
    adsbygoogle?: Array<Record<string, unknown>>
  }
}

const ADSENSE_PUB_ID = 'ca-pub-6838192381842255'

export function AdPlaceholder({ className = '' }: { className?: string }) {
  const { profile } = useAuth()
  const adRef = useRef<HTMLModElement>(null)
  const pushed = useRef(false)

  const hasPremium = isPremium(profile as Profile | null)

  useEffect(() => {
    if (!ADSENSE_PUB_ID || pushed.current || hasPremium) return
    try {
      window.adsbygoogle = window.adsbygoogle || []
      window.adsbygoogle.push({})
      pushed.current = true
    } catch {
      // AdSense not loaded yet or blocked
    }
  }, [hasPremium])

  if (hasPremium) return null

  if (!ADSENSE_PUB_ID) {
    return (
      <div className={`w-full min-h-[90px] sm:min-h-[120px] bg-[#090E17]/80 border-2 border-dashed border-[#1C5CF1]/30 rounded-xl flex items-center justify-center relative overflow-hidden shadow-inner ${className}`}>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(28,92,241,0.08)_0%,transparent_70%)]" />
        <span className="text-[#4EC0FA]/40 font-['Lilita_One'] tracking-[0.3em] text-xs sm:text-sm uppercase relative z-10 select-none drop-shadow-md">
          Anuncio - Ad Space
        </span>
      </div>
    )
  }

  return (
    <div className={`w-full min-h-[90px] ${className}`}>
      <ins
        ref={adRef}
        className="adsbygoogle"
        style={{ display: 'block' }}
        data-ad-client={ADSENSE_PUB_ID}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  )
}
