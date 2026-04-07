'use client'

import { useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useEffect, useRef } from 'react'
import { BreakdownGrid } from '@/components/profile/BreakdownGrid'
import { GemIcon } from '@/components/ui/GemIcon'
import { AnimatedCounter } from '@/components/ui/AnimatedCounter'
import { AdPlaceholder } from '@/components/ui/AdPlaceholder'
import { usePlayerData } from '@/hooks/usePlayerData'
import { useSkinClassifications } from '@/hooks/useSkinClassifications'
import Link from 'next/link'

export default function OverviewPage() {
  const params = useParams<{ tag: string; locale: string }>()
  const t = useTranslations('profile')
  const tag = decodeURIComponent(params.tag)
  const locale = params.locale || 'es'
  const { data, isLoading, error } = usePlayerData(tag)
  const { totalCosmeticGems, classifiedCount } = useSkinClassifications(tag)
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
      <div className="flex flex-col items-center justify-center py-20 animate-pulse">
        <div className="brawl-card-dark inline-block px-12 py-6 border-8 border-black transform scale-[1.1] rotate-[-2deg] shadow-[0_12px_0_0_rgba(18,26,47,1),inset_0_4px_0_rgba(255,255,255,0.2)]">
          <h2 className="text-7xl md:text-8xl font-['Lilita_One'] text-white text-stroke-brawl tracking-wider">
            <AnimatedCounter value={0} duration={2000} />
          </h2>
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
  const clubName = data.player?.club && 'name' in data.player.club ? data.player.club.name : null

  // Brawl Stars colors come as 0xffRRGGBB.
  const rawColor = (data.player as any)?.nameColor || ''
  const nameColorHex = rawColor.startsWith('0xff') ? `#${rawColor.slice(4)}` : rawColor || '#FFFFFF'

  return (
    <div className="animate-fade-in w-full">
      {/* ═══ HERO CARD ═══ */}
      <div className="brawl-card p-8 md:p-12 text-center relative overflow-hidden bg-gradient-to-b from-[#1C5CF1] to-[#121A2F]">

        {/* Club shield — absolute, top-left, casual angle */}
        {clubName && (
          <Link
            href={`/${locale}/profile/${encodeURIComponent(tag)}/club`}
            className="absolute top-4 left-4 z-20 group"
          >
            <div className="w-[110px] h-[75px] md:w-[150px] md:h-[100px] transform rotate-[-6deg] transition-transform duration-300 group-hover:scale-110 group-hover:rotate-[-2deg] origin-top-left">
              <svg viewBox="0 0 200 150" className="w-full h-full drop-shadow-[0_8px_0_rgba(13,19,33,0.8)] filter">
                <defs>
                  <linearGradient id="si" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2563EB" />
                    <stop offset="100%" stopColor="#1E3A8A" />
                  </linearGradient>
                </defs>
                {/* Outer thick gold border (sharp crest) */}
                <path d="M 30 15 L 170 15 L 185 25 L 185 70 L 100 140 L 15 70 L 15 25 Z" fill="#FFC91B" stroke="#0D1321" strokeWidth="8" strokeLinejoin="miter" strokeMiterlimit="4" />
                
                {/* Inner blue crest */}
                <path d="M 40 28 L 160 28 L 170 34 L 170 65 L 100 120 L 30 65 L 30 34 Z" fill="url(#si)" stroke="#0D1321" strokeWidth="4" strokeLinejoin="miter" strokeMiterlimit="4" />

                {/* Crest center split detail */}
                <path d="M 100 28 L 100 120" stroke="rgba(0,0,0,0.2)" strokeWidth="6" />
                
                {/* Star logo accent */}
                <path d="M 100 45 L 105 55 L 115 55 L 108 62 L 110 72 L 100 65 L 90 72 L 92 62 L 85 55 L 95 55 Z" fill="#FFC91B" stroke="#0D1321" strokeWidth="2" strokeLinejoin="round" />

                <text
                  x="100" y="90" textAnchor="middle" dominantBaseline="middle"
                  fill="white" fontFamily="'Lilita One', sans-serif"
                  fontSize={clubName.length > 12 ? '14' : '18'}
                  stroke="#0D1321" strokeWidth="3" paintOrder="stroke"
                  className="filter drop-shadow-[0_2px_1px_rgba(0,0,0,0.8)]"
                >
                  {clubName}
                </text>
              </svg>
              <div className="absolute inset-0 bg-[#FFC91B]/20 blur-[20px] rounded-full scale-50 group-hover:scale-110 transition-transform duration-500 -z-10" />
            </div>
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

      <AdPlaceholder className="mt-2 mb-6" />

      {/* Breakdown Section */}
      <BreakdownGrid breakdown={data.breakdown} stats={data.stats} />
      
      <AdPlaceholder className="mt-8" />
    </div>
  )
}
