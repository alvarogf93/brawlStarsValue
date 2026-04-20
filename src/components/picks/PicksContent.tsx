'use client'

import { useTranslations } from 'next-intl'
import { MapCard } from '@/components/picks/MapCard'
import { SafeAdSlot } from '@/components/ui/SafeAdSlot'
import { useAuth } from '@/hooks/useAuth'
import { isPremium } from '@/lib/premium'
import type { Profile } from '@/lib/supabase/types'
import { Crown, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

interface TopBrawler {
  brawlerId: number
  winRate: number
  pickCount: number
}

interface MetaEvent {
  mode: string
  map: string
  eventId: number
  startTime: string
  endTime: string
  totalBattles: number
  topBrawlers: TopBrawler[]
  source?: 'map-mode' | 'mode-fallback'
}

interface Props {
  events: MetaEvent[]
  locale: string
}

export function PicksContent({ events, locale }: Props) {
  const t = useTranslations('picks')
  const { user, profile } = useAuth()
  const hasPremium = user && profile && isPremium(profile as Profile)

  return (
    <div className="min-h-screen bg-[#030712]">
      {/* Header */}
      <div className="bg-[#0F172A] border-b-4 border-[#030712] shadow-[0_4px_15px_rgba(0,0,0,0.5)]">
        <div className="max-w-5xl mx-auto px-4 py-6 md:py-8">
          <div className="flex items-center gap-3 mb-2">
            <Link href={`/${locale}`} className="text-slate-400 hover:text-white transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <h1 className="font-['Lilita_One'] text-3xl md:text-4xl text-[#FFC91B] text-stroke-brawl-brand transform rotate-[-1deg]">
              {t('title')}
            </h1>
          </div>
          <p className="text-sm text-slate-400 ml-8">{t('subtitle')}</p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-4 py-6 md:py-8">
        {events.length === 0 ? (
          <div className="brawl-card-dark p-12 text-center border-[#090E17]">
            <span className="text-4xl block mb-3">📊</span>
            <p className="font-['Lilita_One'] text-lg text-slate-300">{t('collecting')}</p>
            <p className="text-sm text-slate-500 mt-2">{t('collectingHint')}</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {events.map(event => (
                <MapCard
                  key={`${event.mode}-${event.map}`}
                  mode={event.mode}
                  map={event.map}
                  eventId={event.eventId}
                  endTime={event.endTime}
                  totalBattles={event.totalBattles}
                  topBrawlers={event.topBrawlers}
                  source={event.source}
                />
              ))}
            </div>

            {/* In-content ad — reached only in the non-empty branch,
                so `events.length` is always > 0 here. */}
            <div className="mt-8">
              <SafeAdSlot hasContent={events.length > 0} />
            </div>

            {/* CTA for premium */}
            {!hasPremium && (
              <div className="mt-8 brawl-card-dark p-6 border-[#FFC91B]/20 text-center">
                <Crown className="w-8 h-8 text-[#FFC91B] mx-auto mb-2" />
                <p className="font-['Lilita_One'] text-lg text-white mb-1">{t('ctaTitle')}</p>
                <p className="text-sm text-slate-400 mb-4">{t('ctaDescription')}</p>
                {user && profile ? (
                  <Link
                    href={`/${locale}/profile/${encodeURIComponent(profile.player_tag)}/analytics`}
                    className="brawl-button px-6 py-2.5 inline-flex items-center gap-2 text-sm"
                  >
                    <Crown className="w-4 h-4" /> {t('ctaButton')}
                  </Link>
                ) : (
                  <Link
                    href={`/${locale}`}
                    className="brawl-button px-6 py-2.5 inline-flex items-center gap-2 text-sm"
                  >
                    {t('ctaSignup')}
                  </Link>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
