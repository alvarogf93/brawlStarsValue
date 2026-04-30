'use client'

import { useParams, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useEffect, useRef } from 'react'
import { BreakdownGrid } from '@/components/profile/BreakdownGrid'
import { GemIcon } from '@/components/ui/GemIcon'
import { AnimatedCounter } from '@/components/ui/AnimatedCounter'
import { SafeAdSlot } from '@/components/ui/SafeAdSlot'
import { usePlayerData } from '@/hooks/usePlayerData'
import { Skeleton } from '@/components/ui/Skeleton'
import { useSkinClassifications } from '@/hooks/useSkinClassifications'
import { getClubBadgeUrl } from '@/lib/utils'
import Link from 'next/link'

export default function OverviewPage() {
  const params = useParams<{ tag: string; locale: string }>()
  const t = useTranslations('profile')
  const tag = decodeURIComponent(params.tag)
  const locale = params.locale || 'es'
  const searchParams = useSearchParams()
  const fromLanding = searchParams.get('from') === 'landing'
  const { data, isLoading, error } = usePlayerData(tag, { fromLanding, locale })
  const { totalCosmeticGems } = useSkinClassifications(tag)
  const confettiFired = useRef(false)

  useEffect(() => {
    if (data && !confettiFired.current) {
      confettiFired.current = true
      import('canvas-confetti').then(({ default: confetti }) => {
        confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 }, colors: ['#FFC91B', '#4EC0FA', '#F82F41', '#B23DFF'] })
      })
    }
  }, [data])

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-8 animate-fade-in">
        <div className="brawl-card-dark inline-block px-12 py-6 border-8 border-black transform scale-[1.1] rotate-[-2deg] shadow-[0_12px_0_0_rgba(18,26,47,1),inset_0_4px_0_rgba(255,255,255,0.2)]">
          <Skeleton className="h-16 w-40 mx-auto rounded-xl" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 w-full max-w-3xl">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="brawl-card-dark rounded-xl p-4 space-y-2">
              <Skeleton className="h-8 w-16 mx-auto" />
              <Skeleton className="h-3 w-12 mx-auto" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (error || !data || !data.breakdown) {
    return (
      <div className="glass p-8 rounded-2xl text-center border-red-500/30">
        <p className="text-red-400 mb-4">{error || t('loadError')}</p>
        <button
          onClick={() => window.location.reload()}
          className="brawl-button px-6 py-2.5 text-sm"
        >
          {t('retry') || 'Retry'}
        </button>
      </div>
    )
  }

  const grandTotal = data.totalGems + totalCosmeticGems
  const club = data.player?.club && 'name' in data.player.club ? data.player.club : null
  const clubName = club?.name ?? null
  const clubBadgeId = club && 'badgeId' in club ? (club as { badgeId?: number | null }).badgeId : null

  // Brawl Stars colors come as 0xffRRGGBB.
  const rawColor = (data.player as { nameColor?: string })?.nameColor || ''
  const nameColorHex = rawColor.startsWith('0xff') ? `#${rawColor.slice(4)}` : rawColor || '#FFFFFF'

  return (
    <div className="animate-fade-in w-full">
      {/* ═══ HERO CARD ═══ */}
      <div className="brawl-card p-8 md:p-12 text-center relative overflow-hidden bg-gradient-to-b from-[#1C5CF1] to-[#121A2F]">

        {/* Club badge — absolute, top-left */}
        {clubName && (
          <Link
            href={`/${locale}/profile/${encodeURIComponent(tag)}/club`}
            className="absolute top-3 left-3 md:top-4 md:left-4 z-20 group flex flex-col items-center gap-1"
          >
            <div className="w-14 h-14 md:w-20 md:h-20 transform rotate-[-4deg] transition-transform duration-300 group-hover:scale-110 group-hover:rotate-[-1deg] drop-shadow-[0_4px_8px_rgba(0,0,0,0.6)]">
              {clubBadgeId ? (
                <img
                  src={getClubBadgeUrl(clubBadgeId)}
                  alt={clubName}
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="w-full h-full rounded-xl bg-gradient-to-b from-[#2563EB] to-[#1E3A8A] border-3 border-[#FFC91B] flex items-center justify-center shadow-[inset_0_2px_0_rgba(255,255,255,0.2)]">
                  <span className="text-2xl">🛡️</span>
                </div>
              )}
            </div>
            <span className="font-['Lilita_One'] text-[10px] md:text-xs text-white/90 text-stroke-brawl-brand drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)] max-w-[80px] md:max-w-[120px] truncate text-center transform rotate-[-2deg]">
              {clubName}
            </span>
          </Link>
        )}

        {/* Player name */}
        <div className="relative z-10 flex flex-col items-center mb-6">
          <h1 
            className="text-3xl md:text-5xl font-['Lilita_One'] tracking-wide text-stroke-brawl transform rotate-[-1deg] drop-shadow-[0_4px_0_rgba(18,26,47,0.5)]"
            style={{ color: nameColorHex }}
          >
            {data.playerName}
          </h1>
        </div>

        {/* Main gem count */}
        <div className="relative z-10 inline-block">
          <h2 className="text-6xl md:text-[120px] leading-none font-['Lilita_One'] tracking-wide text-white text-stroke-brawl transform rotate-[-2deg]">
            <AnimatedCounter value={grandTotal} duration={1800} fromZero />
          </h2>
        </div>

        <div className="bg-[var(--color-brawl-gold)] border-4 border-black rounded-full px-6 py-2 inline-flex items-center gap-2 mt-8 relative z-10 shadow-[0_4px_0_0_rgba(18,26,47,1)] transform rotate-[2deg] animate-float">
          <GemIcon className="w-8 h-8" />
          <span className="text-black font-[900] uppercase font-['Lilita_One'] text-xl">{t('totalGems')}</span>
        </div>

      </div>

      {/* Top ad — placed between the hero card and the breakdown grid.
          The early-return guards above ensure `data.breakdown` exists,
          which is the same condition that drives the breakdown render
          below this slot. */}
      <SafeAdSlot hasContent={!!data.breakdown} className="mt-2 mb-6" />

      {/* Breakdown Section */}
      <BreakdownGrid breakdown={data.breakdown} stats={data.stats} />

      {/* Bottom ad — sits below the breakdown grid; reuses the same
          breakdown-presence signal so it disappears with the section. */}
      <SafeAdSlot hasContent={!!data.breakdown} className="mt-8" />
    </div>
  )
}
