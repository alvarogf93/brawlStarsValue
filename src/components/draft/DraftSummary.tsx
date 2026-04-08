'use client'

import { useMemo } from 'react'
import { wrColor } from '@/lib/utils'
import { useTranslations } from 'next-intl'
import type { BrawlerEntry } from '@/lib/brawler-registry'
import type { Recommendation } from '@/lib/draft/scoring'
import { RotateCcw } from 'lucide-react'


interface Props {
  blueTeam: number[]
  redTeam: number[]
  brawlerMap: Map<number, BrawlerEntry>
  recommendations: Recommendation[]
  modeIconUrl: string | null
  mapName: string | null
  onReset: () => void
}

export function DraftSummary({ blueTeam, redTeam, brawlerMap, recommendations, modeIconUrl, mapName, onReset }: Props) {
  const t = useTranslations('draft')

  // Compute aggregate advantage for blue team
  const blueAdvantage = useMemo(() => {
    let totalScore = 0
    let count = 0
    for (const bId of blueTeam) {
      const rec = recommendations.find(r => r.brawlerId === bId)
      if (rec) {
        totalScore += rec.finalScore
        count++
      }
    }
    return count > 0 ? totalScore / count : 50
  }, [blueTeam, recommendations])

  const winEstimate = Math.min(Math.max(Math.round(blueAdvantage), 30), 70)

  return (
    <div className="space-y-5 text-center">
      {/* Title */}
      <div>
        <h3 className="font-['Lilita_One'] text-2xl text-[#FFC91B]">{t('draftComplete')}</h3>
        {mapName && (
          <p className="font-['Lilita_One'] text-sm text-slate-400 flex items-center justify-center gap-2 mt-1">
            {modeIconUrl && <img src={modeIconUrl} alt="" className="w-4 h-4" width={16} height={16} />}
            {mapName}
          </p>
        )}
      </div>

      {/* Teams face-off */}
      <div className="bg-white/[0.03] rounded-2xl p-5 border border-white/5">
        <div className="flex items-center justify-center gap-4 md:gap-8">
          {/* Blue team */}
          <div className="flex flex-col items-center gap-2">
            <span className="font-['Lilita_One'] text-xs text-blue-400">{t('blueTeam')}</span>
            <div className="flex gap-2">
              {blueTeam.map(id => {
                const b = brawlerMap.get(id)
                return b ? (
                  <div key={id} className="w-14 h-14 md:w-16 md:h-16 rounded-xl border-2 border-blue-500/40 overflow-hidden bg-blue-500/10">
                    <img src={b.imageUrl} alt={b.name} className="w-full h-full object-cover" width={64} height={64} />
                  </div>
                ) : null
              })}
            </div>
          </div>

          <span className="font-['Lilita_One'] text-2xl text-slate-600">VS</span>

          {/* Red team */}
          <div className="flex flex-col items-center gap-2">
            <span className="font-['Lilita_One'] text-xs text-red-400">{t('redTeam')}</span>
            <div className="flex gap-2">
              {redTeam.map(id => {
                const b = brawlerMap.get(id)
                return b ? (
                  <div key={id} className="w-14 h-14 md:w-16 md:h-16 rounded-xl border-2 border-red-500/40 overflow-hidden bg-red-500/10">
                    <img src={b.imageUrl} alt={b.name} className="w-full h-full object-cover" width={64} height={64} />
                  </div>
                ) : null
              })}
            </div>
          </div>
        </div>

        {/* Win probability bar */}
        <div className="mt-5">
          <div className="flex items-center justify-between text-[10px] font-bold mb-1">
            <span className="text-blue-400">{winEstimate}%</span>
            <span className="text-slate-600">{t('winProbability')}</span>
            <span className="text-red-400">{100 - winEstimate}%</span>
          </div>
          <div className="h-3 rounded-full overflow-hidden flex bg-white/5">
            <div className="bg-gradient-to-r from-blue-600 to-blue-400 transition-all duration-500" style={{ width: `${winEstimate}%` }} />
            <div className="bg-gradient-to-r from-red-400 to-red-600 flex-1" />
          </div>
        </div>

        {/* Matchup highlights */}
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {blueTeam.map(bId => {
            const b = brawlerMap.get(bId)
            const rec = recommendations.find(r => r.brawlerId === bId)
            if (!b || !rec) return null
            return (
              <div key={bId} className="flex items-center gap-1.5 bg-white/[0.04] rounded-lg px-2 py-1">
                <img src={b.imageUrl} alt="" className="w-5 h-5 rounded" width={20} height={20} />
                <span className={`font-['Lilita_One'] text-[11px] ${wrColor(rec.metaScore)}`}>
                  {rec.metaScore.toFixed(0)}%
                </span>
                {rec.counterScore > 0 && (
                  <span className={`text-[9px] ${wrColor(rec.counterScore)}`}>
                    vs {rec.counterScore.toFixed(0)}%
                  </span>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Actions */}
      <button onClick={onReset} className="brawl-button px-6 py-2.5 inline-flex items-center gap-2 text-sm">
        <RotateCcw className="w-4 h-4" /> {t('newDraft')}
      </button>
    </div>
  )
}
