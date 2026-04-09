'use client'

import { useTranslations } from 'next-intl'
import type { Recommendation } from '@/lib/brawler-detail/types'

interface Props {
  recommendations: Recommendation[]
}

const BORDER_COLORS: Record<Recommendation['type'], string> = {
  play: 'border-green-400',
  avoid: 'border-red-400',
  team: 'border-[#4EC0FA]',
}

const EMOJI: Record<Recommendation['type'], string> = {
  play: '✅',
  avoid: '⛔',
  team: '🤝',
}

const DIFF_COLOR = (diff: number) =>
  diff > 0 ? 'text-green-400' : diff < 0 ? 'text-red-400' : 'text-slate-400'

/**
 * Actionable recommendations for a specific brawler.
 * Shows 3-5 tips with colored left border indicating play/avoid/team.
 */
export function BrawlerRecommendations({ recommendations }: Props) {
  const t = useTranslations('brawlerDetail')

  if (recommendations.length === 0) return null

  return (
    <div className="brawl-card-dark p-5 md:p-6 border-[#090E17]">
      <h4 className="font-['Lilita_One'] text-lg text-white mb-4 flex items-center gap-2">
        <span className="text-xl">💡</span> {t('recommendationsTitle')}
      </h4>

      <div className="space-y-2">
        {recommendations.map((rec, i) => (
          <div
            key={i}
            className={`brawl-row rounded-xl px-4 py-3 border-l-4 ${BORDER_COLORS[rec.type]}`}
          >
            <div className="flex items-start gap-3">
              <span className="text-base mt-0.5 shrink-0">{EMOJI[rec.type]}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white font-medium">
                  {rec.type === 'play' && rec.map && (
                    t('tipPlay', {
                      brawler: rec.brawlerName,
                      map: rec.map,
                      diff: `${rec.diff > 0 ? '+' : ''}${rec.diff}`,
                    })
                  )}
                  {rec.type === 'avoid' && rec.map && (
                    t('tipAvoidMap', {
                      brawler: rec.brawlerName,
                      map: rec.map,
                      diff: `${rec.diff}`,
                    })
                  )}
                  {rec.type === 'avoid' && rec.opponentName && !rec.map && (
                    t('tipAvoidMatchup', {
                      brawler: rec.brawlerName,
                      opponent: rec.opponentName,
                      diff: `${rec.diff}`,
                    })
                  )}
                  {rec.type === 'team' && rec.opponentName && (
                    t('tipTeam', {
                      brawler: rec.brawlerName,
                      opponent: rec.opponentName,
                      diff: `${rec.diff > 0 ? '+' : ''}${rec.diff}`,
                    })
                  )}
                </p>
                <p className={`text-xs mt-0.5 ${DIFF_COLOR(rec.diff)}`}>
                  {rec.diff > 0 ? '+' : ''}{rec.diff}% {t('vsMeta')}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
