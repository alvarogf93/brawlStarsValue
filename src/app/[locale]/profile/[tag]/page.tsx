'use client'

import { useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { BreakdownGrid } from '@/components/profile/BreakdownGrid'
import { GemIcon } from '@/components/ui/GemIcon'
import { AnimatedCounter } from '@/components/ui/AnimatedCounter'
import { usePlayerData } from '@/hooks/usePlayerData'

export default function OverviewPage() {
  const params = useParams<{ tag: string }>()
  const t = useTranslations('profile')
  const tag = decodeURIComponent(params.tag)
  const { data, isLoading, error } = usePlayerData(tag)

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
        <p className="text-red-400">{error || 'No se pudo cargar la información del perfil.'}</p>
      </div>
    )
  }

  return (
    <div className="animate-fade-in w-full">
      {/* Hero Section */}
      <div className="brawl-card p-8 md:p-12 text-center relative overflow-hidden bg-gradient-to-b from-[#1C5CF1] to-[#121A2F]">
        <p className="text-[var(--color-brawl-gold)] text-lg font-['Lilita_One'] tracking-widest uppercase mb-4 relative z-10">
          Valoración de <span className="text-white">{data.playerName}</span>
        </p>
        <div className="relative z-10 inline-block">
          <h2 className="text-6xl md:text-[120px] leading-none font-['Lilita_One'] tracking-wide text-white text-stroke-brawl transform rotate-[-2deg]">
            {data.gemEquivalent.toLocaleString()}
          </h2>
        </div>
        <div className="bg-[var(--color-brawl-gold)] border-4 border-black rounded-full px-6 py-2 inline-flex items-center gap-2 mt-8 relative z-10 shadow-[0_4px_0_0_rgba(18,26,47,1)] transform rotate-[2deg] animate-float">
          <GemIcon className="w-8 h-8" />
          <span className="text-black font-[900] uppercase font-['Lilita_One'] text-xl">{t('gemEquivalent')}</span>
        </div>
      </div>

      {/* Breakdown Section */}
      <BreakdownGrid breakdown={data.breakdown} />

      {/* Ad Placeholder to prevent CLS */}
      <div className="w-full min-h-[250px] mt-8 bg-[var(--color-brawl-dark)]/50 border-4 border-[var(--color-brawl-dark)] rounded-2xl flex items-center justify-center border-dashed">
        <p className="text-white/50 font-['Lilita_One'] text-xl">ESPACIO PUBLICITARIO</p>
      </div>
    </div>
  )
}
