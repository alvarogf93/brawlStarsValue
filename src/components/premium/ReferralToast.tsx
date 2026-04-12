'use client'

import { useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { useAuth } from '@/hooks/useAuth'
import type { Profile } from '@/lib/supabase/types'
import { toast } from 'sonner'

/**
 * Fires a one-time toast notification when someone uses the user's referral code.
 * Uses referral_count + localStorage to detect new referrals across sessions.
 * Render this component in the app layout (always mounted).
 */
export function ReferralToast() {
  const { profile } = useAuth()
  const t = useTranslations('premium')

  useEffect(() => {
    if (!profile?.id) return
    const p = profile as Profile
    if (!p.referral_count || p.referral_count <= 0) return
    const key = `brawlvalue:ref-notified-${p.referral_count}`
    try {
      if (localStorage.getItem(key)) return
      localStorage.setItem(key, '1')
      toast.success(t('referralSuccess'))
    } catch { /* ignore */ }
  }, [profile, t])

  return null
}
