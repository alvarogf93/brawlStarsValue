'use client'

import { useState, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { getBrawlerPortraitUrl } from '@/lib/utils'
import type { MatchupEntry } from '@/lib/analytics/types'
import { InfoTooltip } from '@/components/ui/InfoTooltip'

interface Props {
  data: MatchupEntry[]
}

const INITIAL_LIMIT = 20

function wrColor(wr: number) {
  if (wr >= 60) return 'text-green-400'
  if (wr >= 50) return 'text-[#FFC91B]'
  return 'text-red-400'
}

function barGradient(wr: number) {
  if (wr >= 60) return 'from-green-500 to-green-400'
  if (wr >= 50) return 'from-[#FFC91B] to-yellow-300'
  return 'from-red-500 to-red-400'
}

export function MatchupMatrix({ data }: Props) {
  const t = useTranslations('advancedAnalytics')
  const [selectedBrawler, setSelectedBrawler] = useState<string>('all')
  const [bestFirst, setBestFirst] = useState(false)
  const [showAll, setShowAll] = useState(false)

  const brawlerOptions = useMemo(() => {
    const names = new Map<string, number>()
    for (const d of data) {
      if (!names.has(d.myBrawlerName)) {
        names.set(d.myBrawlerName, d.myBrawlerId)
      }
    }
    return Array.from(names.entries())
      .sort(([a], [b]) => a.localeCompare(b))
  }, [data])

  const filtered = useMemo(() => {
    let list = selectedBrawler === 'all'
      ? data
      : data.filter(d => d.myBrawlerName === selectedBrawler)

    return [...list].sort((a, b) =>
      bestFirst
        ? b.wilsonScore - a.wilsonScore
        : a.wilsonScore - b.wilsonScore
    )
  }, [data, selectedBrawler, bestFirst])

  const visible = showAll ? filtered : filtered.slice(0, INITIAL_LIMIT)
  const hasMore = filtered.length > INITIAL_LIMIT

  if (data.length === 0) {
    return (
      <div className="brawl-card-dark p-5 md:p-6 border-[#090E17]">
        <h3 className="font-['Lilita_One'] text-lg text-white mb-4 flex items-center gap-2">
          <span className="text-xl">⚔️</span> {t('matchupsTitle')}
        </h3>
        <div className="flex flex-col items-center py-8 text-center">
          <span className="text-3xl mb-2">🎯</span>
          <p className="font-['Lilita_One'] text-sm text-slate-400">{t('matchupsEmpty')}</p>
          <p className="text-[11px] text-slate-600 mt-1">{t('matchupsEmptyHint')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="brawl-card-dark p-5 md:p-6 border-[#090E17]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <h3 className="font-['Lilita_One'] text-lg text-white flex items-center gap-2">
          <span className="text-xl">⚔️</span> {t('matchupsTitle')}
          <InfoTooltip className="ml-1.5" text={t('tipMatchups')} />
        </h3>

        <div className="flex flex-wrap items-center gap-2">
          {/* Brawler filter */}
          <select
            value={selectedBrawler}
            onChange={e => { setSelectedBrawler(e.target.value); setShowAll(false) }}
            className="bg-white/[0.06] text-xs text-white border border-white/10 rounded-lg px-2 py-1.5 outline-none focus:border-[#FFC91B]/40 transition-colors"
          >
            <option value="all" className="bg-[#0B1120]">{t('allBrawlers')}</option>
            {brawlerOptions.map(([name]) => (
              <option key={name} value={name} className="bg-[#0B1120]">{name}</option>
            ))}
          </select>

          {/* Sort toggles */}
          <div className="flex gap-1">
            <button
              onClick={() => { setBestFirst(true); setShowAll(false) }}
              className={`px-2 py-1 text-[10px] font-bold rounded transition-colors ${
                bestFirst
                  ? 'bg-green-500/20 text-green-400'
                  : 'text-slate-500 hover:text-white'
              }`}
            >
              {t('strengths')} 💪
            </button>
            <button
              onClick={() => { setBestFirst(false); setShowAll(false) }}
              className={`px-2 py-1 text-[10px] font-bold rounded transition-colors ${
                !bestFirst
                  ? 'bg-red-500/20 text-red-400'
                  : 'text-slate-500 hover:text-white'
              }`}
            >
              {t('weaknesses')} ☠️
            </button>
          </div>
        </div>
      </div>

      {/* Matchup list */}
      <div className="space-y-1.5">
        {visible.map(m => {
          const losses = m.total - m.wins
          return (
            <div
              key={`${m.myBrawlerId}-${m.opponentBrawlerId}`}
              className="flex items-center gap-2 brawl-row rounded-xl px-3 py-2"
            >
              {/* My brawler */}
              <img
                src={getBrawlerPortraitUrl(m.myBrawlerId)}
                alt={m.myBrawlerName}
                className="w-6 h-6 rounded-md flex-shrink-0"
                loading="lazy"
              />

              <span className="text-[10px] text-slate-500 font-bold flex-shrink-0">vs</span>

              {/* Opponent brawler */}
              <img
                src={getBrawlerPortraitUrl(m.opponentBrawlerId)}
                alt={m.opponentBrawlerName}
                className="w-6 h-6 rounded-md flex-shrink-0"
                loading="lazy"
              />

              {/* Win rate bar */}
              <div className="flex-1 min-w-0 mx-2">
                <div className="h-2 bg-white/[0.06] rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full bg-gradient-to-r ${barGradient(m.winRate)}`}
                    style={{ width: `${Math.min(m.winRate, 100)}%` }}
                  />
                </div>
              </div>

              {/* Win rate text */}
              <span className={`font-['Lilita_One'] text-sm flex-shrink-0 w-12 text-right ${wrColor(m.winRate)}`}>
                {m.winRate.toFixed(1)}%
              </span>

              {/* W/L count */}
              <span className="text-[10px] text-slate-500 flex-shrink-0 w-14 text-right">
                {m.wins}W {losses}L
              </span>

              {/* Sample size */}
              <span className="text-[9px] text-slate-600 flex-shrink-0 w-8 text-right">
                {m.total}g
              </span>
            </div>
          )
        })}
      </div>

      {/* Show all / collapse */}
      {hasMore && (
        <button
          onClick={() => setShowAll(prev => !prev)}
          className="mt-3 w-full text-center text-[11px] font-bold text-slate-500 hover:text-[#FFC91B] transition-colors py-1.5"
        >
          {showAll ? t('showLess') : `${t('showAll')} (${filtered.length})`}
        </button>
      )}

      {/* Empty state */}
      {visible.length === 0 && (
        <p className="text-center text-sm text-slate-500 py-6">
          {t('matchupsEmpty')}
        </p>
      )}
    </div>
  )
}
