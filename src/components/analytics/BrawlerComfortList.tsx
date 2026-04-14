'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { InfoTooltip } from '@/components/ui/InfoTooltip'
import { BrawlImg } from '@/components/ui/BrawlImg'
import { getBrawlerPortraitUrl, getBrawlerPortraitFallback, wrColor } from '@/lib/utils'
import type { BrawlerComfort } from '@/lib/analytics/types'
import { ConfidenceBadge } from '@/components/ui/ConfidenceBadge'

interface Props {
  data: BrawlerComfort[]
}

function comfortColor(score: number): string {
  if (score >= 70) return 'text-green-400 drop-shadow-[0_0_5px_rgba(74,222,128,0.5)]'
  if (score >= 40) return 'text-[#FFC91B] drop-shadow-[0_0_5px_rgba(255,201,27,0.5)]'
  return 'text-red-400 drop-shadow-[0_0_5px_rgba(248,113,113,0.5)]'
}

function comfortBg(score: number): string {
  if (score >= 70) return 'bg-gradient-to-r from-green-600/80 to-green-400 shadow-[0_0_8px_rgba(74,222,128,0.5)]'
  if (score >= 40) return 'bg-gradient-to-r from-[#FFC91B]/80 to-[#FFC91B] shadow-[0_0_8px_rgba(255,201,27,0.5)]'
  return 'bg-gradient-to-r from-red-600/80 to-red-400 shadow-[0_0_8px_rgba(248,113,113,0.5)]'
}

export function BrawlerComfortList({ data }: Props) {
  const t = useTranslations('advancedAnalytics')
  const [showAll, setShowAll] = useState(false)

  const sorted = [...data].sort((a, b) => b.comfortScore - a.comfortScore)
  const displayed = showAll ? sorted : sorted.slice(0, 8)

  if (sorted.length === 0) return null

  return (
    <div className="relative overflow-hidden bg-[#090E17]/80 backdrop-blur-md rounded-xl p-5 md:p-6 border-b-[4px] border-[#06090E] shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_8px_16px_rgba(0,0,0,0.6)] group/card">
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.01)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.01)_1px,transparent_1px)] bg-[size:15px_15px] pointer-events-none mix-blend-screen opacity-50" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#090E17] via-transparent to-transparent pointer-events-none" />

      <h3 className="font-['Lilita_One'] text-lg text-white mb-6 flex items-center gap-2 relative z-10 drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]">
        <span className="text-xl drop-shadow-md">🎯</span> {t('comfortTitle')}
        <InfoTooltip className="ml-1.5 opacity-70 hover:opacity-100" text={t('tipComfort')} />
      </h3>

      <div className="space-y-2 relative z-10">
        {displayed.map((b, i) => (
          <div key={b.brawlerId} className="flex items-center gap-3 bg-gradient-to-r from-[#0B1120] to-[#0A0E1A] border border-white/5 rounded-xl px-4 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] hover:border-[#FFC91B]/30 hover:bg-[#121A2F]/80 transition-all group">
            <span className="font-['Lilita_One'] text-sm text-slate-500 w-6 text-right group-hover:text-[#4EC0FA] transition-colors">{i + 1}</span>
            <BrawlImg
              src={getBrawlerPortraitUrl(b.brawlerId)}
              fallbackSrc={getBrawlerPortraitFallback(b.brawlerId)}
              alt={b.brawlerName}
              className="w-8 h-8 rounded-lg shadow-[0_0_8px_rgba(0,0,0,0.5)] border border-white/10 group-hover:border-[#FFC91B]/50 transition-colors"
            />
            <div className="flex-1 min-w-0">
              <p className="font-['Lilita_One'] text-sm text-white truncate drop-shadow-md">{b.brawlerName}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <div className="flex-1 h-3 bg-[#06090E] rounded-full overflow-hidden shadow-inner border border-white/5 relative">
                  <div className={`h-full rounded-r-full ${comfortBg(b.comfortScore)} relative`} style={{ width: `${b.comfortScore}%` }}>
                      <div className="absolute inset-y-0 left-0 w-full bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite] pointer-events-none" />
                  </div>
                </div>
                <span className={`font-['Lilita_One'] text-xs tabular-nums ${comfortColor(b.comfortScore)} w-6 text-right`}>
                  {b.comfortScore.toFixed(0)}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <ConfidenceBadge total={b.gamesPlayed} />
              <div className="text-right border-l border-white/10 pl-2">
                <p className={`font-['Lilita_One'] text-sm tabular-nums drop-shadow-[0_0_5px_currentColor] ${wrColor(b.winRate)}`}>{b.winRate.toFixed(1)}%</p>
                <p className="text-[10px] text-slate-500 tracking-widest font-bold">{b.gamesPlayed} <span className="opacity-70">G</span></p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {sorted.length > 8 && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="w-full mt-4 py-2 text-center font-['Lilita_One'] text-sm text-[#4EC0FA] hover:text-white transition-colors relative z-10 hover:bg-white/5 rounded-lg border border-transparent hover:border-white/10"
        >
          {showAll ? t('showLess') : t('showAll')} ({sorted.length})
        </button>
      )}
    </div>
  )
}
