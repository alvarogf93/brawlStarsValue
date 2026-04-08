'use client'

import { useTranslations } from 'next-intl'
import type { Recommendation } from '@/lib/draft/scoring'
import type { BrawlerEntry } from '@/lib/brawler-registry'

function wrColor(wr: number): string {
  if (wr >= 60) return 'text-green-400'
  if (wr >= 50) return 'text-[#FFC91B]'
  return 'text-red-400'
}

interface Props {
  recommendations: Recommendation[]
  brawlerMap: Map<number, BrawlerEntry>
  currentTeam: 'blue' | 'red'
}

export function RecommendationPanel({ recommendations, brawlerMap, currentTeam }: Props) {
  const t = useTranslations('draft')
  const top3 = recommendations.slice(0, 3)

  if (currentTeam === 'red') {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-4 text-center">
        <p className="font-['Lilita_One'] text-base text-red-400">{t('enemyTurn')}</p>
        <p className="text-xs text-slate-400 mt-1 font-semibold">{t('selectEnemyPick')}</p>
      </div>
    )
  }

  if (top3.length === 0) {
    return (
      <div className="bg-white/[0.03] border border-white/10 rounded-xl px-4 py-4 text-center">
        <p className="font-['Lilita_One'] text-sm text-slate-300">{t('noRecommendations')}</p>
      </div>
    )
  }

  const medals = ['🥇', '🥈', '🥉']

  return (
    <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl px-4 py-3">
      <p className="font-['Lilita_One'] text-xs text-blue-400 mb-2">{t('recommended')}</p>
      <div className="flex gap-2">
        {top3.map((rec, i) => {
          const brawler = brawlerMap.get(rec.brawlerId)
          if (!brawler) return null
          return (
            <div key={rec.brawlerId} className="flex items-center gap-2 flex-1 bg-white/[0.04] rounded-lg px-2.5 py-2">
              <span className="text-sm">{medals[i]}</span>
              <img src={brawler.imageUrl} alt={brawler.name} className="w-8 h-8 rounded-md" width={32} height={32} />
              <div className="min-w-0 flex-1">
                <p className="font-['Lilita_One'] text-[11px] text-white truncate">{brawler.name}</p>
                <div className="flex items-center gap-1.5 text-[9px]">
                  <span className={`font-bold ${wrColor(rec.metaScore)}`}>{rec.metaScore.toFixed(1)}% 🏆</span>
                  {rec.counterScore > 0 && (
                    <span className={`font-bold ${wrColor(rec.counterScore)}`}>{rec.counterScore.toFixed(1)}% ⚔️</span>
                  )}
                  {rec.personalScore > 0 && (
                    <span className={`font-bold ${wrColor(rec.personalScore)}`}>{rec.personalScore.toFixed(1)}% ⭐</span>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
