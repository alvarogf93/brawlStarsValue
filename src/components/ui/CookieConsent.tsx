'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'

const CONSENT_KEY = 'brawlvalue:cookie-consent'

export function CookieConsent() {
  const t = useTranslations('consent')
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // Read localStorage on mount to decide whether to show the banner.
    // Must happen after hydration (not in initial state) because
    // localStorage is not available during SSR.
    const consent = localStorage.getItem(CONSENT_KEY)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!consent) setVisible(true)
  }, [])

  function accept() {
    localStorage.setItem(CONSENT_KEY, 'accepted')
    setVisible(false)
  }

  function reject() {
    localStorage.setItem(CONSENT_KEY, 'rejected')
    setVisible(false)
    // Disable AdSense by removing the script
    document.querySelectorAll('.adsbygoogle').forEach(el => el.remove())
  }

  if (!visible) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[9999] p-3 sm:p-4 animate-[fadeSlideIn_0.3s_ease-out]">
      <div className="max-w-3xl mx-auto bg-[#0A1428]/95 backdrop-blur-md border border-[#1C5CF1]/40 rounded-xl p-4 sm:p-5 shadow-[0_0_30px_rgba(28,92,241,0.2)]">
        <p className="text-[#A0C4FF] text-xs sm:text-sm leading-relaxed mb-3">
          {t('message')}
        </p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={reject}
            className="px-4 py-2 text-xs sm:text-sm text-[#A0C4FF]/70 hover:text-white transition-colors rounded-lg border border-[#1C5CF1]/20 hover:border-[#1C5CF1]/50"
          >
            {t('reject')}
          </button>
          <button
            onClick={accept}
            className="px-5 py-2 text-xs sm:text-sm font-bold text-white bg-[#1C5CF1] hover:bg-[#1C5CF1]/80 transition-colors rounded-lg shadow-[0_0_12px_rgba(28,92,241,0.4)]"
          >
            {t('accept')}
          </button>
        </div>
      </div>
    </div>
  )
}
