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

  // Compute win probability: compare blue meta+counter scores vs baseline
  const winEstimate = useMemo(() => {
    if (recommendations.length === 0) return 50

    // Blue team avg score
    let blueTotal = 0, blueCount = 0
    for (const bId of blueTeam) {
      const rec = recommendations.find(r => r.brawlerId === bId)
      if (rec) { blueTotal += rec.finalScore; blueCount++ }
    }
    const blueAvg = blueCount > 0 ? blueTotal / blueCount : 50

    // Red team: compute their meta scores (how good their picks are on this map)
    let redTotal = 0, redCount = 0
    for (const bId of redTeam) {
      // Find meta score for red brawler (it was in the original recommendation pool)
      const allRecs = recommendations
      // Red brawlers were removed from recommendations, so we need to estimate
      // Use 50 as baseline — they were picked, so probably decent
      redTotal += 50
      redCount++
    }
    const redAvg = redCount > 0 ? redTotal / redCount : 50

    // Relative advantage: blue score vs average of both
    const combined = blueAvg + redAvg
    const ratio = combined > 0 ? (blueAvg / combined) * 100 : 50

    return Math.min(Math.max(Math.round(ratio), 30), 70)
  }, [blueTeam, redTeam, recommendations])

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
