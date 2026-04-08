'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { InfoTooltip } from '@/components/ui/InfoTooltip'
import { BrawlImg } from '@/components/ui/BrawlImg'
import { getBrawlerPortraitUrl, getBrawlerPortraitFallback } from '@/lib/utils'
import type { BrawlerComfort } from '@/lib/analytics/types'
import { ConfidenceBadge } from '@/components/ui/ConfidenceBadge'

interface Props {
  data: BrawlerComfort[]
}

function wrColor(wr: number): string {
  if (wr >= 60) return 'text-green-400'
  if (wr >= 45) return 'text-[#FFC91B]'
  return 'text-red-400'
}

function comfortColor(score: number): string {
  if (score >= 70) return 'text-green-400'
  if (score >= 40) return 'text-[#FFC91B]'
  return 'text-red-400'
}

function comfortBg(score: number): string {
  if (score >= 70) return 'bg-green-500'
  if (score >= 40) return 'bg-[#FFC91B]'
  return 'bg-red-500'
}

export function BrawlerComfortList({ data }: Props) {
  const t = useTranslations('advancedAnalytics')
  const [showAll, setShowAll] = useState(false)

  const sorted = [...data].sort((a, b) => b.comfortScore - a.comfortScore)
  const displayed = showAll ? sorted : sorted.slice(0, 8)

  if (sorted.length === 0) return null

  return (
    <div className="brawl-card-dark p-5 md:p-6 border-[#090E17]">
      <h3 className="font-['Lilita_One'] text-lg text-white mb-4 flex items-center gap-2">
        <span className="text-xl">🎯</span> {t('comfortTitle')}
        <InfoTooltip className="ml-1.5" text={t('tipComfort')} />
      </h3>

      <div className="space-y-1.5">
        {displayed.map((b, i) => (
          <div key={b.brawlerId} className="flex items-center gap-3 brawl-row rounded-xl px-4 py-2.5">
            <span className="font-['Lilita_One'] text-sm text-slate-500 w-6 text-right">{i + 1}</span>
            <BrawlImg
              src={getBrawlerPortraitUrl(b.brawlerId)}
              fallbackSrc={getBrawlerPortraitFallback(b.brawlerId)}
              alt={b.brawlerName}
              className="w-8 h-8 rounded-lg"
            />
            <div className="flex-1 min-w-0">
              <p className="font-['Lilita_One'] text-sm text-white truncate">{b.brawlerName}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <div className="flex-1 h-1.5 bg-[#0F172A] rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${comfortBg(b.comfortScore)}`} style={{ width: `${b.comfortScore}%` }} />
                </div>
                <span className={`font-['Lilita_One'] text-xs tabular-nums ${comfortColor(b.comfortScore)}`}>
                  {b.comfortScore.toFixed(0)}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <ConfidenceBadge total={b.gamesPlayed} />
              <div className="text-right">
                <p className={`font-['Lilita_One'] text-sm tabular-nums ${wrColor(b.winRate)}`}>{b.winRate.toFixed(1)}%</p>
                <p className="text-[10px] text-slate-500">{b.gamesPlayed}g</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {sorted.length > 8 && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="w-full mt-3 text-center font-['Lilita_One'] text-sm text-[#4EC0FA] hover:text-white transition-colors"
        >
          {showAll ? t('showLess') : t('showAll')} ({sorted.length})
        </button>
      )}
    </div>
  )
}
