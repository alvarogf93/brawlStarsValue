'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { useAuth } from '@/hooks/useAuth'
import type { Profile } from '@/lib/supabase/types'

/**
 * Shows a one-time toast notification when someone uses the user's referral code.
 * Uses referral_count + localStorage to detect new referrals across sessions.
 * Render this component in the app layout (always mounted).
 */
export function ReferralToast() {
  const { profile } = useAuth()
  const t = useTranslations('premium')
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!profile?.id) return
    const p = profile as Profile
    if (!p.referral_count || p.referral_count <= 0) return
    const key = `brawlvalue:ref-notified-${p.referral_count}`
    try {
      if (localStorage.getItem(key)) return
      localStorage.setItem(key, '1')
      setVisible(true)
      setTimeout(() => setVisible(false), 5000)
    } catch { /* ignore */ }
  }, [profile])

  if (!visible) return null

  return (
    <div
      className="fixed top-4 right-4 z-50 bg-[#FFC91B] text-[#121A2F] px-4 py-3 rounded-xl font-['Lilita_One'] shadow-lg animate-fade-in cursor-pointer"
      onClick={() => setVisible(false)}
    >
      🎉 {t('referralSuccess')}
    </div>
  )
}
