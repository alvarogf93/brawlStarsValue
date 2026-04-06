'use client'

import Script from 'next/script'
import { useAuth } from '@/hooks/useAuth'
import { isPremium } from '@/lib/auth'
import type { Profile } from '@/lib/supabase/types'

export function AdSenseScript() {
  const { profile, loading } = useAuth()

  // Don't show ads for premium users
  if (!loading && isPremium(profile as Profile | null)) {
    return null
  }

  return (
    <Script
      src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-6838192381842255"
      crossOrigin="anonymous"
      strategy="afterInteractive"
    />
  )
}
