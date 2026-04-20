'use client'

import { useState, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { getBrawlerPortraitUrl, getBrawlerPortraitFallback } from '@/lib/utils'
import { BrawlImg } from '@/components/ui/BrawlImg'
import type { TrioSynergy, TeammateSynergy } from '@/lib/analytics/types'
import { InfoTooltip } from '@/components/ui/InfoTooltip'
import { ModeIcon } from '@/components/ui/ModeIcon'
import { ConfidenceBadge } from '@/components/ui/ConfidenceBadge'
import { useMapImages } from '@/hooks/useMapImages'
import { ProBadge } from '@/components/analytics/ProBadge'

function wrColor(wr: number): string {
  if (wr >= 60) return 'text-green-400 drop-shadow-[0_0_5px_rgba(34,197,94,0.6)]'
  if (wr >= 45) return 'text-[#FFC91B] drop-shadow-[0_0_5px_rgba(255,201,27,0.6)]'
  return 'text-red-500 drop-shadow-[0_0_5px_rgba(239,68,68,0.6)]'
}

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
  proTrios?: Map<string, { winRate: number; total: number }> | null
}

type Tab = 'trios' | 'teammates'

export function TeamSynergyView({ trioSynergy, teammateSynergy, proTrios }: Props) {
  const t = useTranslations('advancedAnalytics')
  const [tab, setTab] = useState<Tab>('trios')
  const [expanded, setExpanded] = useState(false)
  const [mapFilter, setMapFilter] = useState<string>('all')
  const mapImages = useMapImages()

  const availableMaps = useMemo(() => {
    const maps = new Map<string, string>() // map → mode
    for (const t of trioSynergy) {
      if (t.map && t.mode) maps.set(t.map, t.mode)
    }
    return Array.from(maps.entries())
      .sort(([a], [b]) => a.localeCompare(b))
  }, [trioSynergy])

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

  const getTrioMapImage = (trio: TrioSynergy): string | null => {
    const mapName = trio.map ?? trio.topMap
    if (!mapName) return null
    return mapImages[mapName] ?? null
  }

  if (trioSynergy.length === 0 && teammateSynergy.length === 0) {
    return (
      <div className="relative overflow-hidden bg-[#090E17]/80 backdrop-blur-md rounded-xl p-5 md:p-6 border-b-[4px] border-[#06090E] shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_8px_16px_rgba(0,0,0,0.6)]">
        <h3 className="font-['Lilita_One'] text-lg text-white mb-4 flex items-center gap-2 drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]">
          <span className="text-xl drop-shadow-md">🤝</span> {t('teamTitle')}
        </h3>
        <div className="flex flex-col items-center py-8 text-center relative z-10">
          <span className="text-4xl mb-3 grayscale opacity-30">👥</span>
          <p className="font-['Lilita_One'] text-sm text-slate-500 uppercase tracking-widest">{t('teamEmpty')}</p>
          <p className="text-[11px] text-slate-600 mt-1">{t('teamEmptyHint')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative overflow-hidden bg-[#090E17]/80 backdrop-blur-md rounded-xl p-5 md:p-6 border-b-[4px] border-[#06090E] shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_8px_16px_rgba(0,0,0,0.6)]">
      {/* Background isometric grids */}
      <div className="absolute inset-0 opacity-[0.03] bg-[linear-gradient(30deg,transparent_48%,rgba(255,255,255,0.5)_50%,transparent_52%),linear-gradient(150deg,transparent_48%,rgba(255,255,255,0.5)_50%,transparent_52%)] bg-[length:60px_35px] pointer-events-none" />

      {/* Header */}
      <div className="flex items-center justify-between mb-5 relative z-10">
        <h3 className="font-['Lilita_One'] text-lg text-white flex items-center gap-2 drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]">
          <span className="text-xl drop-shadow-md">🤝</span> {t('teamTitle')}
          <InfoTooltip className="ml-1.5 opacity-70 hover:opacity-100" text={t('tipTeam')} />
        </h3>
        
        {/* Tab bar redesigned */}
        <div className="flex bg-[#0A0E1A] p-1 rounded-lg border border-white/5 shadow-inner">
          <button
            onClick={() => { setTab('trios'); setExpanded(false) }}
            className={`px-4 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-md transition-all duration-300 ${
              tab === 'trios'
                ? 'bg-[#FFC91B]/20 text-[#FFC91B] shadow-[0_0_10px_rgba(255,201,27,0.3)]'
                : 'text-slate-500 hover:text-white hover:bg-white/5'
            }`}
          >
            {t('trioLabel') || 'Trios'} 🤝
          </button>
          <button
            onClick={() => { setTab('teammates'); setExpanded(false) }}
            className={`px-4 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-md transition-all duration-300 ${
              tab === 'teammates'
                ? 'bg-[#4EC0FA]/20 text-[#4EC0FA] shadow-[0_0_10px_rgba(78,192,250,0.3)]'
                : 'text-slate-500 hover:text-white hover:bg-white/5'
            }`}
          >
            {t('teammates')} 👥
          </button>
        </div>
      </div>

      {/* ── Trio Synergy Tab ─────────────────────────────────────── */}
      {tab === 'trios' && (
        <div className="relative z-10">
          {/* Map filter */}
          {availableMaps.length > 0 && (
            <div className="mb-4 flex justify-between items-center bg-[#0B1120] px-3 py-2 rounded-lg border border-white/5">
              <div className="flex items-center gap-2">
                {mapFilter !== 'all' ? (
                  <ModeIcon mode={availableMaps.find(([m]) => m === mapFilter)?.[1] ?? 'gemGrab'} size={18} />
                ) : (
                  <span className="text-xl opacity-60">🗺️</span>
                )}
                <span className="font-['Lilita_One'] text-xs text-slate-300 tracking-wide uppercase">Filter</span>
              </div>
              <select
                value={mapFilter}
                onChange={e => { setMapFilter(e.target.value); setExpanded(false) }}
                aria-label={t('allMaps') || 'Filter by map'}
                className="bg-[#090E17] text-white text-xs rounded-md px-3 py-1.5 border border-white/10 focus:outline-none focus:border-[#4EC0FA]/50 font-['Lilita_One'] cursor-pointer shadow-md"
              >
                <option value="all">{t('allMaps') || 'All Maps'}</option>
                {availableMaps.map(([map]) => (
                  <option key={map} value={map}>{map}</option>
                ))}
              </select>
            </div>
          )}

          {sortedTrios.length === 0 ? (
            <p className="text-sm font-bold uppercase tracking-widest text-slate-500 text-center py-4">{t('noComboData')}</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {visibleTrios.map((trio, i) => (
                <div
                  key={`${trio.brawlers.map(b => b.id).join('-')}-${trio.map ?? 'global'}`}
                  className="group relative rounded-xl overflow-hidden border border-white/10 bg-[#0A0E1A] hover:border-[#FFC91B]/40 hover:shadow-[0_0_20px_rgba(255,201,27,0.15)] transition-all duration-300 transform hover:-translate-y-1"
                >
                  {/* Draft Podium Isometric Base */}
                  <div className="absolute inset-x-0 bottom-0 h-16 pointer-events-none" style={{ background: 'radial-gradient(ellipse at bottom, rgba(255, 201, 27, 0.2) 0%, transparent 70%)' }}>
                     <div className="absolute inset-x-0 bottom-2 h-8 border-t-2 border-[#FFC91B]/30 opacity-50 blur-[2px] rounded-[100%]" />
                     <div className="absolute inset-x-0 bottom-2 h-8 border-t border-[#FFC91B]/50 rounded-[100%] group-hover:border-[#FFC91B] transition-colors" />
                  </div>

                  {/* Map background */}
                  {(() => {
                    const mapImg = getTrioMapImage(trio)
                    return mapImg ? (
                      <>
                        <img
                          src={mapImg}
                          alt={trio.map ?? trio.topMap ?? ''}
                          className="absolute inset-0 w-full h-full object-cover opacity-30 mix-blend-luminosity group-hover:mix-blend-normal group-hover:scale-110 transition-all duration-700"
                          loading="lazy"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-[#0A0E1A] via-[#0A0E1A]/80 to-transparent" />
                      </>
                    ) : null
                  })()}

                  {/* Top Rank Medal */}
                  {i < 3 && (
                    <div className="absolute top-2 left-2 z-20 w-6 h-6 rounded-full bg-black/60 border border-white/10 flex items-center justify-center shadow-lg backdrop-blur-md">
                      <span className="text-sm">{medal(i)}</span>
                    </div>
                  )}

                  {/* Confidence */}
                  <div className="absolute top-2 right-2 z-20">
                    <ConfidenceBadge total={trio.total} />
                  </div>

                  {/* Content Layout */}
                  <div className="relative pt-8 pb-4 px-4 flex flex-col items-center justify-end h-[140px]">
                    
                    {/* Brawler Podium layout */}
                    <div className="flex items-end justify-center w-full pb-6 relative z-30">
                      {/* Left Brawler */}
                      {trio.brawlers[1] && (
                        <div className="absolute left-[15%] bottom-6 z-10 hover:z-30 transform hover:scale-110 transition-transform">
                          <BrawlImg
                            src={getBrawlerPortraitUrl(trio.brawlers[1].id)}
                            fallbackSrc={getBrawlerPortraitFallback(trio.brawlers[1].id)}
                            alt={trio.brawlers[1].name}
                            className="w-10 h-10 rounded-md border border-white/20 shadow-lg"
                            style={{ clipPath: 'polygon(15% 0, 100% 0, 100% 85%, 85% 100%, 0 100%, 0 15%)' }}
                          />
                        </div>
                      )}
                      
                      {/* Center Brawler (Highest) */}
                      {trio.brawlers[0] && (
                        <div className="absolute left-[40%] bottom-9 z-20 hover:z-30 transform hover:scale-110 transition-transform">
                          {/* Arc line connecting center to left */}
                          <div className="absolute top-1/2 -left-1/2 w-12 h-0.5 bg-gradient-to-r from-transparent via-[#FFC91B]/80 to-transparent rotate-12 origin-left pointer-events-none group-hover:glow-line" />
                          {/* Arc line connecting center to right */}
                          <div className="absolute top-1/2 -right-1/2 w-12 h-0.5 bg-gradient-to-r from-transparent via-[#FFC91B]/80 to-transparent -rotate-12 origin-right pointer-events-none group-hover:glow-line" />
                          
                          <BrawlImg
                            src={getBrawlerPortraitUrl(trio.brawlers[0].id)}
                            fallbackSrc={getBrawlerPortraitFallback(trio.brawlers[0].id)}
                            alt={trio.brawlers[0].name}
                            className="w-12 h-12 rounded-lg border-2 border-[#FFC91B] shadow-[0_0_15px_rgba(255,201,27,0.5)] bg-black/50"
                            style={{ clipPath: 'polygon(15% 0, 100% 0, 100% 85%, 85% 100%, 0 100%, 0 15%)' }}
                          />
                        </div>
                      )}

                      {/* Right Brawler */}
                      {trio.brawlers[2] && (
                        <div className="absolute right-[15%] bottom-6 z-10 hover:z-30 transform hover:scale-110 transition-transform">
                          <BrawlImg
                            src={getBrawlerPortraitUrl(trio.brawlers[2].id)}
                            fallbackSrc={getBrawlerPortraitFallback(trio.brawlers[2].id)}
                            alt={trio.brawlers[2].name}
                            className="w-10 h-10 rounded-md border border-white/20 shadow-lg"
                            style={{ clipPath: 'polygon(15% 0, 100% 0, 100% 85%, 85% 100%, 0 100%, 0 15%)' }}
                          />
                        </div>
                      )}
                    </div>

                    {/* Stats Footer */}
                    <div className="w-full flex items-center justify-between border-t border-white/10 pt-2 mt-2 bg-gradient-to-t from-black/80 to-transparent absolute bottom-0 left-0 px-3 pb-2">
                       <span className={`font-['Lilita_One'] text-xl tabular-nums tracking-wide ${wrColor(trio.winRate)}`}>
                         {trio.winRate.toFixed(1)}%
                       </span>
                       <div className="flex items-center gap-2">
                         {(() => {
                           const trioKey = trio.brawlers.map(b => b.id).sort((a, b) => a - b).join('|')
                           const proTrio = proTrios?.get(trioKey)
                           return proTrio ? (
                             <ProBadge proValue={proTrio.winRate} userValue={trio.winRate} total={proTrio.total} compact />
                           ) : null
                         })()}
                         <span className="text-[10px] font-bold uppercase tracking-widest text-[#4EC0FA] bg-[#4EC0FA]/10 px-1.5 py-0.5 rounded border border-[#4EC0FA]/30">
                           {trio.total} <span className="opacity-70 text-slate-300">G</span>
                         </span>
                       </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {hasMoreTrios && (
            <button
              onClick={() => setExpanded(prev => !prev)}
              className="mt-4 w-full text-center text-[10px] uppercase font-black tracking-widest text-[#FFC91B] hover:text-white hover:bg-[#FFC91B]/10 border border-[#FFC91B]/30 transition-all py-3 rounded-xl shadow-[0_0_10px_rgba(255,201,27,0.1)]"
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
        <div className="relative z-10">
          {sortedTeammates.length === 0 ? (
            <p className="text-sm font-bold uppercase tracking-widest text-slate-500 text-center py-4">{t('noTeammateData')}</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {visibleTeammates.map((tm, i) => (
                <div
                  key={tm.tag}
                  className="group flex items-center justify-between gap-3 bg-black/40 border border-white/5 hover:border-[#4EC0FA]/50 hover:bg-[#4EC0FA]/5 rounded-xl px-4 py-3 transition-colors shadow-sm"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <span className="w-6 h-6 flex items-center justify-center rounded-lg bg-white/5 border border-white/10 flex-shrink-0">
                      {i < 3 ? (
                        <span className="text-sm">{medal(i)}</span>
                      ) : (
                        <span className="font-['Lilita_One'] text-[11px] text-slate-400 tabular-nums">{i + 1}</span>
                      )}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-['Lilita_One'] text-sm text-white truncate drop-shadow-sm group-hover:text-[#4EC0FA] transition-colors">{tm.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] uppercase tracking-widest font-bold text-[#FFC91B]/80">{tm.total} {t('games')}</span>
                        {tm.bestMode && tm.bestModeWR !== null && (
                          <span className="flex items-center gap-0.5 text-[10px] text-slate-400 bg-white/5 px-1 py-0.5 rounded">
                            <ModeIcon mode={tm.bestMode} size={10} />
                            <span className="font-bold tabular-nums ml-1" style={{ color: tm.bestModeWR >= 50 ? '#4ade80' : '#f87171' }}>
                              {tm.bestModeWR.toFixed(0)}%
                            </span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <span className={`font-['Lilita_One'] text-xl tabular-nums tracking-wide flex-shrink-0 ${wrColor(tm.winRate)}`}>
                    {tm.winRate.toFixed(1)}%
                  </span>
                </div>
              ))}
            </div>
          )}

          {hasMoreTeammates && (
            <button
              onClick={() => setExpanded(prev => !prev)}
              className="mt-4 w-full text-center text-[10px] uppercase font-black tracking-widest text-[#4EC0FA] hover:text-white hover:bg-[#4EC0FA]/10 border border-[#4EC0FA]/30 transition-all py-3 rounded-xl shadow-[0_0_10px_rgba(78,192,250,0.1)]"
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
