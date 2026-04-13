'use client'

import { useState, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { getBrawlerPortraitUrl, getBrawlerPortraitFallback, wrColor } from '@/lib/utils'
import { BrawlImg } from '@/components/ui/BrawlImg'
import type { MatchupEntry } from '@/lib/analytics/types'
import { InfoTooltip } from '@/components/ui/InfoTooltip'

interface Props {
  data: MatchupEntry[]
  proMatchups?: Map<string, { winRate: number; total: number }> | null
}

const INITIAL_LIMIT = 20






export function MatchupMatrix({ data, proMatchups }: Props) {
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
    const list = selectedBrawler === 'all'
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
          <span className="text-xl">⚔️</span> {t('matchupsTitleExplicit')}
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
          <span className="text-xl">⚔️</span> {t('matchupsTitleExplicit')}
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

      {/* Matchup table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[9px] text-slate-500 uppercase tracking-wider">
              <th className="text-left pb-2 pl-1 font-bold">{t('matchupYou')}</th>
              <th className="text-left pb-2 font-bold">vs</th>
              <th className="text-right pb-2 font-bold">WR</th>
              <th className="text-right pb-2 font-bold hidden sm:table-cell">W/L</th>
              <th className="text-right pb-2 font-bold hidden sm:table-cell">{t('matchupGames')}</th>
              {proMatchups && <th className="text-right pb-2 font-bold">PRO</th>}
              {proMatchups && <th className="text-right pb-2 pr-1 font-bold hidden sm:table-cell">Diff</th>}
            </tr>
          </thead>
          <tbody>
            {visible.map(m => {
              const losses = m.total - m.wins
              const proEntry = proMatchups?.get(`${m.myBrawlerId}|${m.opponentBrawlerId}`)
              const diff = proEntry ? m.winRate - proEntry.winRate : null
              return (
                <tr
                  key={`${m.myBrawlerId}-${m.opponentBrawlerId}`}
                  className={`border-t border-white/5 hover:bg-white/[0.03] transition-colors ${m.total < 3 ? 'opacity-40' : ''}`}
                >
                  {/* My brawler */}
                  <td className="py-1.5 pl-1">
                    <div className="flex items-center gap-1.5">
                      <BrawlImg
                        src={getBrawlerPortraitUrl(m.myBrawlerId)}
                        fallbackSrc={getBrawlerPortraitFallback(m.myBrawlerId)}
                        alt={m.myBrawlerName}
                        className="w-6 h-6 rounded-md"
                      />
                      <span className="text-xs text-white font-['Lilita_One'] truncate max-w-[70px]">{m.myBrawlerName}</span>
                    </div>
                  </td>

                  {/* Opponent */}
                  <td className="py-1.5">
                    <div className="flex items-center gap-1.5">
                      <BrawlImg
                        src={getBrawlerPortraitUrl(m.opponentBrawlerId)}
                        fallbackSrc={getBrawlerPortraitFallback(m.opponentBrawlerId)}
                        alt={m.opponentBrawlerName}
                        className="w-6 h-6 rounded-md"
                      />
                      <span className="text-xs text-slate-300 truncate max-w-[70px]">{m.opponentBrawlerName}</span>
                    </div>
                  </td>

                  {/* Win Rate */}
                  <td className={`py-1.5 text-right font-['Lilita_One'] text-sm tabular-nums ${wrColor(m.winRate)}`}>
                    {m.winRate.toFixed(1)}%
                  </td>

                  {/* W/L */}
                  <td className="py-1.5 text-right text-[10px] text-slate-400 tabular-nums hidden sm:table-cell">
                    <span className="text-green-400">{m.wins}</span>
                    <span className="text-slate-600">/</span>
                    <span className="text-red-400">{losses}</span>
                  </td>

                  {/* Games */}
                  <td className="py-1.5 text-right text-[10px] text-slate-500 tabular-nums hidden sm:table-cell">
                    {m.total}
                  </td>

                  {/* PRO WR */}
                  {proMatchups && (
                    <td className="py-1.5 text-right text-[10px] tabular-nums">
                      {proEntry ? (
                        <span className="text-[#FFC91B]">{proEntry.winRate.toFixed(1)}%</span>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>
                  )}

                  {/* Diff vs PRO */}
                  {proMatchups && (
                    <td className="py-1.5 pr-1 text-right text-[10px] font-bold tabular-nums hidden sm:table-cell">
                      {diff !== null ? (
                        <span className={diff > 0 ? 'text-green-400' : diff < 0 ? 'text-red-400' : 'text-slate-500'}>
                          {diff > 0 ? '+' : ''}{diff.toFixed(1)}%
                        </span>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
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
