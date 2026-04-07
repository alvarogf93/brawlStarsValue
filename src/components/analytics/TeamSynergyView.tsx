'use client'

import { useState, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { getBrawlerPortraitUrl } from '@/lib/utils'
import type { BrawlerSynergy, TeammateSynergy } from '@/lib/analytics/types'
import { InfoTooltip } from '@/components/ui/InfoTooltip'
import { ModeIcon } from '@/components/ui/ModeIcon'

// ── Helpers ────────────────────────────────────────────────────

function wrColor(wr: number): string {
  if (wr >= 60) return 'text-green-400'
  if (wr >= 45) return 'text-[#FFC91B]'
  return 'text-red-400'
}

function medal(i: number): string {
  if (i === 0) return '🥇'
  if (i === 1) return '🥈'
  if (i === 2) return '🥉'
  return ''
}


const INITIAL_VISIBLE = 15

// ── Props ──────────────────────────────────────────────────────

interface Props {
  brawlerSynergy: BrawlerSynergy[]
  teammateSynergy: TeammateSynergy[]
}

// ── Tabs ───────────────────────────────────────────────────────

type Tab = 'combos' | 'teammates'

// ── Component ──────────────────────────────────────────────────

export function TeamSynergyView({ brawlerSynergy, teammateSynergy }: Props) {
  const t = useTranslations('advancedAnalytics')
  const [tab, setTab] = useState<Tab>('combos')
  const [expanded, setExpanded] = useState(false)
  const [filterBrawler, setFilterBrawler] = useState<string>('all')

  // Unique "my brawler" names for filter dropdown
  const myBrawlers = useMemo(() => {
    const seen = new Map<string, number>()
    for (const s of brawlerSynergy) {
      if (!seen.has(s.myBrawlerName)) seen.set(s.myBrawlerName, s.myBrawlerId)
    }
    return Array.from(seen.entries())
      .sort(([a], [b]) => a.localeCompare(b))
  }, [brawlerSynergy])

  // Filtered + sorted brawler combos
  const filteredCombos = useMemo(() => {
    let list = [...brawlerSynergy]
    if (filterBrawler !== 'all') {
      list = list.filter(s => s.myBrawlerName === filterBrawler)
    }
    return list.sort((a, b) => b.wilsonScore - a.wilsonScore)
  }, [brawlerSynergy, filterBrawler])

  // Sorted teammate synergy
  const sortedTeammates = useMemo(
    () => [...teammateSynergy].sort((a, b) => b.wilsonScore - a.wilsonScore),
    [teammateSynergy],
  )

  const visibleCombos = expanded ? filteredCombos : filteredCombos.slice(0, INITIAL_VISIBLE)
  const visibleTeammates = expanded ? sortedTeammates : sortedTeammates.slice(0, INITIAL_VISIBLE)

  const hasMoreCombos = filteredCombos.length > INITIAL_VISIBLE
  const hasMoreTeammates = sortedTeammates.length > INITIAL_VISIBLE

  if (brawlerSynergy.length === 0 && teammateSynergy.length === 0) {
    return (
      <div className="brawl-card-dark p-5 md:p-6 border-[#090E17]">
        <h3 className="font-['Lilita_One'] text-lg text-white mb-4 flex items-center gap-2">
          <span className="text-xl">🤝</span> {t('teamTitle')}
        </h3>
        <div className="flex flex-col items-center py-8 text-center">
          <span className="text-3xl mb-2">👥</span>
          <p className="font-['Lilita_One'] text-sm text-slate-400">{t('teamEmpty')}</p>
          <p className="text-[11px] text-slate-600 mt-1">{t('teamEmptyHint')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="brawl-card-dark p-5 md:p-6 border-[#090E17]">
      {/* Header */}
      <h3 className="font-['Lilita_One'] text-lg text-white mb-4 flex items-center gap-2">
        <span className="text-xl">🤝</span> {t('teamTitle')}
        <InfoTooltip className="ml-1.5" text={t('tipTeam')} />
      </h3>

      {/* Tab bar */}
      <div className="flex gap-1 mb-4">
        <button
          onClick={() => { setTab('combos'); setExpanded(false) }}
          className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${
            tab === 'combos'
              ? 'bg-[#FFC91B]/20 text-[#FFC91B]'
              : 'text-slate-500 hover:text-white'
          }`}
        >
          {t('brawlerCombos')} 🤝
        </button>
        <button
          onClick={() => { setTab('teammates'); setExpanded(false) }}
          className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${
            tab === 'teammates'
              ? 'bg-[#FFC91B]/20 text-[#FFC91B]'
              : 'text-slate-500 hover:text-white'
          }`}
        >
          {t('teammates')} 👥
        </button>
      </div>

      {/* ── Brawler Combos Tab ─────────────────────────────────── */}
      {tab === 'combos' && (
        <div>
          {/* Filter dropdown */}
          {myBrawlers.length > 1 && (
            <div className="mb-3">
              <select
                value={filterBrawler}
                onChange={e => { setFilterBrawler(e.target.value); setExpanded(false) }}
                className="bg-[#0D1321] text-slate-300 text-xs rounded-lg px-3 py-1.5 border border-white/5 focus:outline-none focus:border-[#FFC91B]/40"
              >
                <option value="all">{t('allBrawlers')}</option>
                {myBrawlers.map(([name]) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </div>
          )}

          {filteredCombos.length === 0 ? (
            <p className="text-sm text-slate-500">{t('noComboData')}</p>
          ) : (
            <div className="space-y-1.5">
              {visibleCombos.map((c, i) => (
                <div
                  key={`${c.myBrawlerId}-${c.teammateBrawlerId}`}
                  className="flex items-center gap-3 brawl-row rounded-xl px-4 py-2.5"
                >
                  {/* Rank */}
                  <span className="font-['Lilita_One'] text-xs text-slate-600 w-5 text-right tabular-nums">
                    {i + 1}
                  </span>

                  {/* Brawler portraits */}
                  <div className="flex items-center -space-x-2">
                    <img
                      src={getBrawlerPortraitUrl(c.myBrawlerId)}
                      alt={c.myBrawlerName}
                      className="w-8 h-8 rounded-lg ring-2 ring-[#090E17] relative z-10"
                      loading="lazy"
                    />
                    <img
                      src={getBrawlerPortraitUrl(c.teammateBrawlerId)}
                      alt={c.teammateBrawlerName}
                      className="w-8 h-8 rounded-lg ring-2 ring-[#090E17]"
                      loading="lazy"
                    />
                  </div>

                  {/* Names */}
                  <div className="flex-1 min-w-0">
                    <p className="font-['Lilita_One'] text-xs text-white truncate">
                      {c.myBrawlerName} + {c.teammateBrawlerName}
                    </p>
                    <p className="text-[10px] text-slate-500">{c.total} {t('games')}</p>
                  </div>

                  {/* Win rate */}
                  <span className={`font-['Lilita_One'] text-sm tabular-nums ${wrColor(c.winRate)}`}>
                    {c.winRate.toFixed(1)}%
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Expand / collapse */}
          {hasMoreCombos && (
            <button
              onClick={() => setExpanded(prev => !prev)}
              className="mt-3 w-full py-2 text-xs font-bold text-slate-400 hover:text-[#FFC91B] transition-colors rounded-lg bg-white/[0.02] hover:bg-white/[0.04]"
            >
              {expanded
                ? t('showLess')
                : t('showAllCombos', { count: filteredCombos.length })}
            </button>
          )}
        </div>
      )}

      {/* ── Teammates Tab ──────────────────────────────────────── */}
      {tab === 'teammates' && (
        <div>
          {sortedTeammates.length === 0 ? (
            <p className="text-sm text-slate-500">{t('noTeammateData')}</p>
          ) : (
            <div className="space-y-1.5">
              {visibleTeammates.map((tm, i) => (
                <div
                  key={tm.tag}
                  className="flex items-center gap-3 brawl-row rounded-xl px-4 py-3"
                >
                  {/* Rank / Medal */}
                  <span className="w-6 text-center flex-shrink-0">
                    {i < 3 ? (
                      <span className="text-base">{medal(i)}</span>
                    ) : (
                      <span className="font-['Lilita_One'] text-xs text-slate-600 tabular-nums">
                        {i + 1}
                      </span>
                    )}
                  </span>

                  {/* Name & details */}
                  <div className="flex-1 min-w-0">
                    <p className="font-['Lilita_One'] text-sm text-white truncate">
                      {tm.name}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-slate-500">
                        {tm.total} {t('games')}
                      </span>
                      {tm.bestMode && tm.bestModeWR !== null && (
                        <span className="text-[10px] text-slate-400 flex items-center gap-0.5">
                          <ModeIcon mode={tm.bestMode} size={14} />
                          <span className={wrColor(tm.bestModeWR)}>
                            {tm.bestModeWR.toFixed(1)}%
                          </span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Win rate */}
                  <span className={`font-['Lilita_One'] text-sm tabular-nums ${wrColor(tm.winRate)}`}>
                    {tm.winRate.toFixed(1)}%
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Expand / collapse */}
          {hasMoreTeammates && (
            <button
              onClick={() => setExpanded(prev => !prev)}
              className="mt-3 w-full py-2 text-xs font-bold text-slate-400 hover:text-[#FFC91B] transition-colors rounded-lg bg-white/[0.02] hover:bg-white/[0.04]"
            >
              {expanded
                ? t('showLess')
                : t('showAllTeammates', { count: sortedTeammates.length })}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
