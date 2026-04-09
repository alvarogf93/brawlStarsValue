'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { getBrawlerPortraitUrl, getBrawlerPortraitFallback, wrColor } from '@/lib/utils'
import { BrawlImg } from '@/components/ui/BrawlImg'
import type { MatchupGapEntry } from '@/lib/draft/pro-analysis'

interface Props {
  gaps: MatchupGapEntry[]
}

type SortField = 'gap' | 'yourWR' | 'proWR'

export function MatchupGapTable({ gaps }: Props) {
  const t = useTranslations('metaPro')
  const [sortBy, setSortBy] = useState<SortField>('gap')

  if (gaps.length === 0) {
    return (
      <div className="brawl-card-dark p-5 border-[#090E17] text-center">
        <p className="text-sm text-slate-500">{t('noDataForMap')}</p>
      </div>
    )
  }

  const sorted = [...gaps].sort((a, b) => {
    switch (sortBy) {
      case 'gap': return a.gap - b.gap
      case 'yourWR': return a.yourWR - b.yourWR
      case 'proWR': return b.proWR - a.proWR
      default: return a.gap - b.gap
    }
  })

  return (
    <div className="brawl-card-dark p-5 md:p-6 border-[#090E17]">
      <h3 className="font-['Lilita_One'] text-lg text-white mb-2 flex items-center gap-2">
        <span className="text-xl">{'\u2694\uFE0F'}</span> {t('matchupGapTitle')}
      </h3>
      <p className="text-[10px] text-slate-500 mb-4">{t('matchupGapHint')}</p>

      <div className="flex gap-1 mb-3">
        {(['gap', 'yourWR', 'proWR'] as SortField[]).map(field => (
          <button
            key={field}
            onClick={() => setSortBy(field)}
            className={`px-2 py-1 text-[10px] font-bold rounded-md transition-colors ${
              sortBy === field
                ? 'bg-[#FFC91B]/20 text-[#FFC91B]'
                : 'text-slate-500 hover:text-white'
            }`}
          >
            {field === 'gap' ? 'Gap' : field === 'yourWR' ? 'Your WR' : 'PRO WR'}
          </button>
        ))}
      </div>

      <div className="space-y-1.5 max-h-[400px] overflow-y-auto">
        {sorted.slice(0, 20).map((g) => (
          <div key={`${g.brawlerId}-${g.opponentId}`} className="flex items-center gap-2 brawl-row rounded-lg px-3 py-2">
            <BrawlImg src={getBrawlerPortraitUrl(g.brawlerId)} fallbackSrc={getBrawlerPortraitFallback(g.brawlerId)} alt={g.brawlerName} className="w-6 h-6 rounded-md" />
            <span className="text-[10px] text-slate-400">vs</span>
            <BrawlImg src={getBrawlerPortraitUrl(g.opponentId)} fallbackSrc={getBrawlerPortraitFallback(g.opponentId)} alt={g.opponentName} className="w-6 h-6 rounded-md" />
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-slate-300 truncate">{g.brawlerName} vs {g.opponentName}</p>
            </div>
            <span className={`text-[10px] font-bold tabular-nums ${wrColor(g.yourWR)}`}>{g.yourWR.toFixed(0)}%</span>
            <span className="text-[10px] text-slate-600">/</span>
            <span className="text-[10px] font-bold text-[#FFC91B] tabular-nums">{g.proWR.toFixed(0)}%</span>
            <span className={`text-[10px] font-bold tabular-nums w-12 text-right ${
              g.gap > 3 ? 'text-green-400' : g.gap < -3 ? 'text-red-400' : 'text-slate-400'
            }`}>
              {g.gap > 0 ? '+' : ''}{g.gap.toFixed(1)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
