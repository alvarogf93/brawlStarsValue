'use client'

import { useAuth } from '@/hooks/useAuth'
import { isPremium } from '@/lib/premium'
import type { Profile } from '@/lib/supabase/types'

export function AdSenseScript() {
  const { profile, loading } = useAuth()

  // Don't load AdSense for premium / trial users — they paid not
  // to see ads, and loading the script would also ping Google
  // unnecessarily (GDPR-friendlier).
  if (!loading && isPremium(profile as Profile | null)) {
    return null
  }

  // Rendered as a React 19 native `<script async>`, NOT Next.js's
  // `<Script>` component. React 19 auto-hoists async script tags
  // into `<head>` and dedupes by `src`, so re-renders don't double-
  // execute. We avoid Next's `<Script>` because it injects a
  // `data-nscript` attribute that AdSense's validator rejects
  // with a console warning "AdSense head tag doesn't support
  // data-nscript attribute." — cosmetic, but noisy and avoidable.
  return (
    <script
      async
      src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-6838192381842255"
      crossOrigin="anonymous"
    />
  )
}
