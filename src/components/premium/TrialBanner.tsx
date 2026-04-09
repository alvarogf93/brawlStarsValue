'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useAuth } from '@/hooks/useAuth'
import { isOnTrial, isTrialExpired } from '@/lib/premium'
import type { Profile } from '@/lib/supabase/types'
import { Clock, Crown } from 'lucide-react'

function formatTimeLeft(endDate: string): { text: string; urgent: boolean } {
  const diff = new Date(endDate).getTime() - Date.now()
  if (diff <= 0) return { text: '', urgent: false }

  const hours = Math.floor(diff / 3600000)
  const minutes = Math.floor((diff % 3600000) / 60000)

  if (hours >= 24) {
    const days = Math.floor(hours / 24)
    const remainingHours = hours % 24
    return { text: `${days}d ${remainingHours}h`, urgent: false }
  }
  if (hours >= 1) {
    return { text: `${hours}h ${minutes}m`, urgent: hours < 6 }
  }
  return { text: `${minutes}m`, urgent: true }
}

export function TrialBanner() {
  const { profile } = useAuth()
  const t = useTranslations('premium')
  const { locale } = useParams<{ locale: string }>()
  const [, setTick] = useState(0)

  // Update every minute
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 60000)
    return () => clearInterval(interval)
  }, [])

  const onTrial = profile && isOnTrial(profile as Profile)
  const expired = profile && isTrialExpired(profile as Profile)

  // Battle count for expired trial message
  const [battleCount, setBattleCount] = useState(0)
  useEffect(() => {
    if (!expired || !profile?.player_tag) return
    fetch(`/api/battles?tag=${encodeURIComponent(profile.player_tag)}&aggregate=true`)
      .then(r => r.json())
      .then(d => setBattleCount(d.total ?? 0))
      .catch(() => {})
  }, [expired, profile?.player_tag])

  const navigateToSubscribe = () => {
    const tag = (profile as Profile)?.player_tag
    if (tag) {
      window.location.href = `/${locale}/profile/${encodeURIComponent(tag)}/subscribe`
    }
  }

  if (!onTrial && !expired) return null

  if (expired) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 space-y-2">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-red-400 shrink-0" />
            <p className="font-['Lilita_One'] text-sm text-red-300">{t('trialExpired')}</p>
          </div>
          <button
            onClick={navigateToSubscribe}
            className="shrink-0 px-3 py-1.5 bg-[#FFC91B] text-[#121A2F] font-['Lilita_One'] text-xs rounded-lg hover:bg-[#FFD84D] transition-colors"
          >
            {t('trialBannerSubscribe')}
          </button>
        </div>
        {battleCount > 0 && (
          <p className="text-xs text-red-300/70 pl-6">
            {t('trialExpiredBody', { battles: String(battleCount), days: '30' })}
          </p>
        )}
      </div>
    )
  }

  const { text, urgent } = formatTimeLeft(profile!.trial_ends_at!)

  return (
    <div className={`rounded-xl px-4 py-3 flex items-center justify-between gap-3 ${
      urgent
        ? 'bg-red-500/10 border border-red-500/30 animate-pulse'
        : 'bg-[#FFC91B]/5 border border-[#FFC91B]/20'
    }`}>
      <div className="flex items-center gap-2">
        <Clock className={`w-4 h-4 shrink-0 ${urgent ? 'text-red-400' : 'text-[#FFC91B]'}`} />
        <p className={`font-['Lilita_One'] text-sm ${urgent ? 'text-red-300' : 'text-[#FFC91B]'}`}>
          {urgent ? t('trialBannerUrgent') : t('trialBanner', { time: text })}
        </p>
      </div>
      <button
        onClick={() => {
          const el = document.getElementById('upgrade-section')
          if (el) { el.scrollIntoView({ behavior: 'smooth' }) }
          else { navigateToSubscribe() }
        }}
        className="shrink-0 px-3 py-1.5 bg-[#FFC91B] text-[#121A2F] font-['Lilita_One'] text-xs rounded-lg hover:bg-[#FFD84D] transition-colors flex items-center gap-1"
      >
        <Crown className="w-3 h-3" /> {t('trialBannerSubscribe')}
      </button>
    </div>
  )
}
