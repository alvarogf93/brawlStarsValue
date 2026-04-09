'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { getBrawlerPortraitUrl, getBrawlerPortraitFallback, wrColor } from '@/lib/utils'
import { BrawlImg } from '@/components/ui/BrawlImg'

interface BrawlerPerformance {
  id: number
  name: string
  wins: number
  losses: number
  total: number
  winRate: number
  confidence: 'high' | 'medium' | 'low'
  starPlayerRate: number
  avgTrophyChange: number
}

interface Props {
  data: BrawlerPerformance[]
}

function confidenceColor(c: 'high' | 'medium' | 'low'): string {
  switch (c) {
    case 'high': return 'text-green-400 bg-green-400/10'
    case 'medium': return 'text-[#FFC91B] bg-[#FFC91B]/10'
    case 'low': return 'text-slate-500 bg-white/5'
  }
}

function tierLabel(wr: number): { label: string; color: string } {
  if (wr >= 65) return { label: 'S', color: 'text-[#FFC91B] bg-[#FFC91B]/15 border-[#FFC91B]/30' }
  if (wr >= 55) return { label: 'A', color: 'text-green-400 bg-green-400/15 border-green-400/30' }
  if (wr >= 45) return { label: 'B', color: 'text-[#4EC0FA] bg-[#4EC0FA]/15 border-[#4EC0FA]/30' }
  if (wr >= 35) return { label: 'C', color: 'text-orange-400 bg-orange-400/15 border-orange-400/30' }
  return { label: 'D', color: 'text-red-400 bg-red-400/15 border-red-400/30' }
}

export function BrawlerTierList({ data }: Props) {
  const t = useTranslations('advancedAnalytics')
  const [showAll, setShowAll] = useState(false)

  if (data.length === 0) return null

  const sorted = [...data]
    .filter(b => b.total >= 3)
    .sort((a, b) => b.winRate - a.winRate)

  const displayed = showAll ? sorted : sorted.slice(0, 10)
  const hasMore = sorted.length > 10

  return (
    <div className="brawl-card-dark p-5 md:p-6 border-[#090E17]">
      <h3 className="font-['Lilita_One'] text-lg text-white mb-4 flex items-center gap-2">
        <span className="text-xl">{'\uD83C\uDFC5'}</span> {t('brawlerTierList')}
      </h3>

      <div className="space-y-1.5">
        {displayed.map((b, i) => {
          const tier = tierLabel(b.winRate)
          return (
            <div key={b.id} className="flex items-center gap-3 brawl-row rounded-xl px-4 py-2.5">
              {/* Rank */}
              <span className="font-['Lilita_One'] text-xs text-slate-600 w-5 text-right tabular-nums">
                {i + 1}
              </span>

              {/* Tier badge */}
              <span className={`font-['Lilita_One'] text-xs w-6 h-6 rounded-md flex items-center justify-center border ${tier.color}`}>
                {tier.label}
              </span>

              {/* Portrait */}
              <BrawlImg
                src={getBrawlerPortraitUrl(b.id)}
                fallbackSrc={getBrawlerPortraitFallback(b.id)}
                alt={b.name}
                className="w-9 h-9 rounded-lg ring-2 ring-[#090E17]"
              />

              {/* Name + games */}
              <div className="flex-1 min-w-0">
                <p className="font-['Lilita_One'] text-xs text-white truncate">{b.name}</p>
                <div className="flex items-center gap-2">
                  <p className="font-['Lilita_One'] text-[10px] text-slate-500">
                    {b.wins}W / {b.losses}L
                  </p>
                  <span className={`font-['Lilita_One'] text-[9px] px-1.5 py-0.5 rounded ${confidenceColor(b.confidence)}`}>
                    {b.confidence === 'high' ? '10+' : b.confidence === 'medium' ? '3-9' : '1-2'}
                  </span>
                </div>
              </div>

              {/* Trophy change */}
              <span className={`font-['Lilita_One'] text-[10px] tabular-nums ${
                b.avgTrophyChange > 0 ? 'text-green-400' : b.avgTrophyChange < 0 ? 'text-red-400' : 'text-slate-500'
              }`}>
                {b.avgTrophyChange > 0 ? '+' : ''}{b.avgTrophyChange.toFixed(0)}
              </span>

              {/* Win rate */}
              <span className={`font-['Lilita_One'] text-sm tabular-nums w-14 text-right ${wrColor(b.winRate)}`}>
                {b.winRate.toFixed(1)}%
              </span>
            </div>
          )
        })}
      </div>

      {hasMore && (
        <button
          onClick={() => setShowAll(prev => !prev)}
          className="mt-3 w-full py-2 font-['Lilita_One'] text-xs text-slate-400 hover:text-[#FFC91B] transition-colors rounded-lg bg-white/[0.02] hover:bg-white/[0.04]"
        >
          {showAll ? 'Show less' : `+${sorted.length - 10} more`}
        </button>
      )}
    </div>
  )
}
