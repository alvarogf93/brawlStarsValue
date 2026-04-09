'use client'

import { useTranslations } from 'next-intl'
import type { PlayerSegment } from '@/lib/analytics/detect-segment'
import { Crown } from 'lucide-react'

interface PersonalizedHookProps {
  segment: PlayerSegment
  freeStats: {
    winRate: number
    mostPlayedBrawler: string
    starPlayerPct: number
    modeWinRates: { mode: string }[]
  }
  trophies: number
}

export function PersonalizedHook({ segment, freeStats, trophies }: PersonalizedHookProps) {
  const t = useTranslations('premium')

  const messages: Record<PlayerSegment, string> = {
    tilt: t('hookTilt'),
    main: t('hookMastery', { name: freeStats.mostPlayedBrawler }),
    competitive: t('hookCompetitive', { trophies: trophies.toLocaleString() }),
    explorer: t('hookExplorer', { count: String(freeStats.modeWinRates.length) }),
    streak: t('hookClutch', { wr: String(freeStats.starPlayerPct) }),
  }

  return (
    <div className="brawl-card p-5 border-2 border-[#FFC91B]/30 bg-gradient-to-r from-[#FFC91B]/5 to-transparent">
      <div className="flex items-center gap-3">
        <Crown className="w-6 h-6 text-[#FFC91B] shrink-0" />
        <div>
          <p className="font-['Lilita_One'] text-lg text-[#FFC91B]">{messages[segment]}</p>
          <p className="text-sm text-slate-400 mt-0.5">{t('blurUnlock')}</p>
        </div>
      </div>
    </div>
  )
}
