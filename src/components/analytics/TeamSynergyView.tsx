'use client'

import { useState, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { getBrawlerPortraitUrl, getBrawlerPortraitFallback, wrColor } from '@/lib/utils'
import { BrawlImg } from '@/components/ui/BrawlImg'
import type { TrioSynergy, TeammateSynergy } from '@/lib/analytics/types'
import { InfoTooltip } from '@/components/ui/InfoTooltip'
import { ModeIcon } from '@/components/ui/ModeIcon'
import { ConfidenceBadge } from '@/components/ui/ConfidenceBadge'
import { useMapImages } from '@/hooks/useMapImages'

function medal(i: number): string {
  if (i === 0) return '🥇'
  if (i === 1) return '🥈'
  if (i === 2) return '🥉'
  return ''
}

const INITIAL_VISIBLE = 12

interface Props {
  trioSynergy: TrioSynergy[]
  teammateSynergy: TeammateSynergy[]
}

type Tab = 'trios' | 'teammates'

export function TeamSynergyView({ trioSynergy, teammateSynergy }: Props) {
  const t = useTranslations('advancedAnalytics')
  const [tab, setTab] = useState<Tab>('trios')
  const [expanded, setExpanded] = useState(false)
  const [mapFilter, setMapFilter] = useState<string>('all')
  const mapImages = useMapImages()

  // Available maps from trio data (for filter dropdown)
  const availableMaps = useMemo(() => {
    const maps = new Map<string, string>() // map → mode
    for (const t of trioSynergy) {
      if (t.map && t.mode) maps.set(t.map, t.mode)
    }
    return Array.from(maps.entries())
      .sort(([a], [b]) => a.localeCompare(b))
  }, [trioSynergy])

  // Filtered + sorted trios
  const sortedTrios = useMemo(() => {
    let list = [...trioSynergy]
    if (mapFilter === 'all') {
      list = list.filter(t => t.map === null)
    } else {
      list = list.filter(t => t.map === mapFilter)
    }
    return list.sort((a, b) => b.wilsonScore - a.wilsonScore)
  }, [trioSynergy, mapFilter])

  const sortedTeammates = useMemo(
    () => [...teammateSynergy].sort((a, b) => b.wilsonScore - a.wilsonScore),
    [teammateSynergy],
  )

  const visibleTrios = expanded ? sortedTrios : sortedTrios.slice(0, INITIAL_VISIBLE)
  const visibleTeammates = expanded ? sortedTeammates : sortedTeammates.slice(0, INITIAL_VISIBLE)

  const hasMoreTrios = sortedTrios.length > INITIAL_VISIBLE
  const hasMoreTeammates = sortedTeammates.length > INITIAL_VISIBLE

  // Resolve map image for a trio (uses topMap for global, map for per-map)
  const getTrioMapImage = (trio: TrioSynergy): string | null => {
    const mapName = trio.map ?? trio.topMap
    if (!mapName) return null
    return mapImages[mapName] ?? null
  }

  if (trioSynergy.length === 0 && teammateSynergy.length === 0) {
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
          onClick={() => { setTab('trios'); setExpanded(false) }}
          className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${
            tab === 'trios'
              ? 'bg-[#FFC91B]/20 text-[#FFC91B]'
              : 'text-slate-500 hover:text-white'
          }`}
        >
          {t('trioLabel') || 'Tríos'} 🤝
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

      {/* ── Trio Synergy Tab ─────────────────────────────────────── */}
      {tab === 'trios' && (
        <div>
          {/* Map filter */}
          {availableMaps.length > 0 && (
            <div className="mb-3 flex items-center gap-2">
              {mapFilter !== 'all' && (
                <ModeIcon mode={availableMaps.find(([m]) => m === mapFilter)?.[1] ?? 'gemGrab'} size={16} />
              )}
              <select
                value={mapFilter}
                onChange={e => { setMapFilter(e.target.value); setExpanded(false) }}
                className="bg-[#0D1321] text-slate-300 text-xs rounded-lg px-3 py-1.5 border border-white/5 focus:outline-none focus:border-[#FFC91B]/40 font-['Lilita_One']"
              >
                <option value="all">{t('allMaps') || 'All Maps'}</option>
                {availableMaps.map(([map]) => (
                  <option key={map} value={map}>{map}</option>
                ))}
              </select>
            </div>
          )}

          {sortedTrios.length === 0 ? (
            <p className="text-sm text-slate-500">{t('noComboData')}</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {visibleTrios.map((trio, i) => (
                <div
                  key={`${trio.brawlers.map(b => b.id).join('-')}-${trio.map ?? 'global'}`}
                  className="relative rounded-xl overflow-hidden border border-white/10"
                >
                  {/* Map background — always shown if trio has a map */}
                  {(() => {
                    const mapImg = getTrioMapImage(trio)
                    return mapImg ? (
                      <>
                        <img
                          src={mapImg}
                          alt={trio.map ?? trio.topMap ?? ''}
                          className="absolute inset-0 w-full h-full object-cover"
                          loading="lazy"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-[#0A0E1A] via-[#0A0E1A]/75 to-[#0A0E1A]/30" />
                      </>
                    ) : null
                  })()}

                  {/* Content */}
                  <div className={`relative p-3 flex flex-col items-center gap-2 ${!getTrioMapImage(trio) ? 'brawl-row' : ''}`}>
                    {/* Medal for top 3 */}
                    {i < 3 && (
                      <span className="absolute top-1.5 left-2 text-sm">{medal(i)}</span>
                    )}

                    {/* 3 brawler portraits */}
                    <div className="flex items-center -space-x-1.5">
                      {trio.brawlers.map((b, idx) => (
                        <BrawlImg
                          key={`${b.id}-${idx}`}
                          src={getBrawlerPortraitUrl(b.id)}
                          fallbackSrc={getBrawlerPortraitFallback(b.id)}
                          alt={b.name}
                          className="w-9 h-9 rounded-lg ring-2 ring-[#090E17]"
                        />
                      ))}
                    </div>

                    {/* Win rate */}
                    <span className={`font-['Lilita_One'] text-lg tabular-nums drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] ${wrColor(trio.winRate)}`}>
                      {trio.winRate.toFixed(1)}%
                    </span>

                    {/* Games + confidence */}
                    <div className="flex items-center gap-1.5">
                      <ConfidenceBadge total={trio.total} />
                      <span className="text-[10px] text-slate-400">{trio.total} {t('games')}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {hasMoreTrios && (
            <button
              onClick={() => setExpanded(prev => !prev)}
              className="mt-3 w-full py-2 text-xs font-bold text-slate-400 hover:text-[#FFC91B] transition-colors rounded-lg bg-white/[0.02] hover:bg-white/[0.04]"
            >
              {expanded
                ? t('showLess')
                : t('showAllCombos', { count: sortedTrios.length })}
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
              {visibleTeammates.map((tm, i) => (
                <div
                  key={tm.tag}
                  className="flex items-center gap-3 brawl-row rounded-xl px-4 py-2.5"
                >
                  <span className="w-5 text-center flex-shrink-0">
                    {i < 3 ? (
                      <span className="text-sm">{medal(i)}</span>
                    ) : (
                      <span className="font-['Lilita_One'] text-[10px] text-slate-600 tabular-nums">{i + 1}</span>
                    )}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-['Lilita_One'] text-xs text-white truncate">{tm.name}</p>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-500">{tm.total} {t('games')}</span>
                      {tm.bestMode && tm.bestModeWR !== null && (
                        <span className="text-[10px] text-slate-400 flex items-center gap-0.5">
                          <ModeIcon mode={tm.bestMode} size={12} />
                          <span className={wrColor(tm.bestModeWR)}>{tm.bestModeWR.toFixed(0)}%</span>
                        </span>
                      )}
                    </div>
                  </div>
                  <span className={`font-['Lilita_One'] text-sm tabular-nums ${wrColor(tm.winRate)}`}>
                    {tm.winRate.toFixed(1)}%
                  </span>
                </div>
              ))}
            </div>
          )}

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
