'use client'

import { useReducer, useState, useEffect, useMemo, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { createInitialState, draftReducer } from '@/lib/draft/state'
import { computeRecommendations } from '@/lib/draft/scoring'
import type { DraftData } from '@/lib/draft/types'
import type { DraftMode } from '@/lib/draft/constants'
import type { BrawlerEntry } from '@/lib/brawler-registry'
import { getCachedRegistry, setCachedRegistry } from '@/lib/brawler-registry'
import { ModeSelector } from './ModeSelector'
import { MapSelector } from './MapSelector'
import { TeamSlots } from './TeamSlots'
import { BrawlerGrid } from './BrawlerGrid'
import { RecommendationPanel } from './RecommendationPanel'
import { DraftSummary } from './DraftSummary'
import { getGameModeImageUrl, getMapImageUrl } from '@/lib/utils'
import { RotateCcw, Undo2, ChevronRight } from 'lucide-react'

export function DraftSimulator() {
  const t = useTranslations('draft')
  const [state, dispatch] = useReducer(draftReducer, undefined, createInitialState)
  const [selectedMapImage, setSelectedMapImage] = useState<string | null>(null)

  const [brawlers, setBrawlers] = useState<BrawlerEntry[]>([])
  const [draftData, setDraftData] = useState<DraftData | null>(null)
  const [loadingBrawlers, setLoadingBrawlers] = useState(true)
  const [loadingData, setLoadingData] = useState(false)
  const [brawlerError, setBrawlerError] = useState(false)

  const brawlerMap = useMemo(() => {
    const map = new Map<number, BrawlerEntry>()
    for (const b of brawlers) map.set(b.id, b)
    return map
  }, [brawlers])

  // Fetch brawler registry
  useEffect(() => {
    const cached = getCachedRegistry()
    if (cached && cached.length > 0) {
      setBrawlers(cached)
      setLoadingBrawlers(false)
      return
    }
    fetch('https://api.brawlapi.com/v1/brawlers')
      .then(r => { if (!r.ok) throw new Error('BrawlAPI error'); return r.json() })
      .then(data => {
        const list = (data.list ?? data) as Array<{
          id: number; name: string; rarity?: { name: string }; class?: { name: string }; imageUrl2?: string; imageUrl?: string
        }>
        const entries: BrawlerEntry[] = list.map(b => ({
          id: b.id, name: b.name, rarity: b.rarity?.name ?? 'Unknown',
          class: b.class?.name ?? 'Unknown', imageUrl: b.imageUrl2 ?? b.imageUrl ?? '',
        }))
        setBrawlers(entries)
        setCachedRegistry(entries)
      })
      .catch(() => setBrawlerError(true))
      .finally(() => setLoadingBrawlers(false))
  }, [])

  // Fetch draft data when map selected
  useEffect(() => {
    if (state.phase !== 'SELECT_STARTER' && state.phase !== 'DRAFTING') return
    if (!state.map || !state.mode) return
    setLoadingData(true)
    fetch(`/api/draft/data?map=${encodeURIComponent(state.map)}&mode=${state.mode}`)
      .then(r => { if (!r.ok) throw new Error('Draft data error'); return r.json() })
      .then(data => setDraftData(data))
      .catch(() => setDraftData(null)).finally(() => setLoadingData(false))
  }, [state.map, state.mode, state.phase])

  const recommendations = useMemo(() => {
    if (!draftData || (state.phase !== 'DRAFTING' && state.phase !== 'COMPLETE')) return []
    return computeRecommendations({
      meta: draftData.meta, matchups: draftData.matchups,
      blueTeam: state.blueTeam.filter((id): id is number => id !== null),
      redTeam: state.redTeam.filter((id): id is number => id !== null),
      pickedIds: state.pickedIds, personal: draftData.personal,
    })
  }, [draftData, state.blueTeam, state.redTeam, state.pickedIds, state.phase])

  const handleMapSelect = useCallback((map: string, eventId: number) => {
    dispatch({ type: 'SELECT_MAP', map, eventId })
    // Store map image for breadcrumb
    setSelectedMapImage(getMapImageUrl(eventId))
  }, [])

  const modeIconUrl = state.mode ? getGameModeImageUrl(state.mode) : null

  if (loadingBrawlers) {
    return (
      <div className="brawl-card-dark p-8 border-[#090E17] text-center">
        <div className="w-8 h-8 border-2 border-[#FFC91B] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="font-['Lilita_One'] text-sm text-slate-400">{t('loadingBrawlers')}</p>
      </div>
    )
  }

  if (brawlerError && brawlers.length === 0) {
    return (
      <div className="brawl-card-dark p-8 border-[#090E17] text-center">
        <span className="text-3xl block mb-3">⚠️</span>
        <p className="font-['Lilita_One'] text-base text-slate-300">{t('errorLoadingBrawlers')}</p>
        <button onClick={() => window.location.reload()} className="mt-3 text-sm text-[#4EC0FA] hover:text-white font-semibold transition-colors">
          {t('retry')}
        </button>
      </div>
    )
  }

  return (
    <div className="brawl-card-dark p-4 md:p-6 border-[#090E17] space-y-4">
      {/* ── Header + Reset ── */}
      <div className="flex items-center justify-between">
        <h3 className="font-['Lilita_One'] text-lg text-white flex items-center gap-2">
          <img src="/assets/modes/48000028.png" alt="" className="w-6 h-6" width={24} height={24} /> {t('draftTitle')}
        </h3>
        {state.phase !== 'IDLE' && (
          <button onClick={() => { dispatch({ type: 'RESET' }); setSelectedMapImage(null) }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-colors">
            <RotateCcw className="w-3.5 h-3.5" /> {t('reset')}
          </button>
        )}
      </div>

      {/* ── Breadcrumb: shows what you've selected so far ── */}
      {state.phase !== 'IDLE' && (
        <div className="flex items-center gap-2 flex-wrap">
          {/* Mode chip */}
          {state.mode && (
            <div className="flex items-center gap-2 bg-white/[0.06] rounded-xl px-3 py-2 border border-white/10">
              {modeIconUrl && <img src={modeIconUrl} alt={state.mode} className="w-5 h-5" width={20} height={20} />}
              <span className="font-['Lilita_One'] text-xs text-white">{state.mode.replace(/([A-Z])/g, ' $1').trim()}</span>
            </div>
          )}

          {/* Map chip */}
          {state.map && (
            <>
              <ChevronRight className="w-4 h-4 text-slate-600" />
              <div className="flex items-center gap-2 bg-white/[0.06] rounded-xl px-2 py-1.5 border border-white/10">
                {(selectedMapImage || state.eventId) && (
                  <img
                    src={selectedMapImage || getMapImageUrl(state.eventId!)}
                    alt={state.map}
                    className="w-12 h-8 rounded-md object-cover"
                    width={48} height={32}
                  />
                )}
                <span className="font-['Lilita_One'] text-xs text-white">{state.map}</span>
              </div>
            </>
          )}

          {/* Starter chip */}
          {state.starter && (
            <>
              <ChevronRight className="w-4 h-4 text-slate-600" />
              <div className={`flex items-center gap-1.5 rounded-xl px-3 py-2 border ${
                state.starter === 'blue'
                  ? 'bg-blue-500/10 border-blue-500/30'
                  : 'bg-red-500/10 border-red-500/30'
              }`}>
                <span className="text-sm">{state.starter === 'blue' ? '🔵' : '🔴'}</span>
                <span className="font-['Lilita_One'] text-xs text-white">
                  {state.starter === 'blue' ? t('blueFirst') : t('redFirst')}
                </span>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Phase: Mode Selection ── */}
      {state.phase === 'IDLE' && (
        <ModeSelector onSelect={(mode: DraftMode) => dispatch({ type: 'SELECT_MODE', mode })} />
      )}

      {/* ── Phase: Map Selection ── */}
      {state.phase === 'SELECT_MAP' && state.mode && (
        <MapSelector mode={state.mode} onSelect={handleMapSelect} />
      )}

      {/* ── Phase: Starter Selection ── */}
      {state.phase === 'SELECT_STARTER' && (
        <div className="text-center space-y-5">
          <h3 className="font-['Lilita_One'] text-xl text-white">{t('whoStarts')}</h3>
          <div className="grid grid-cols-2 gap-4 max-w-sm mx-auto">
            <button
              onClick={() => dispatch({ type: 'SELECT_STARTER', starter: 'blue' })}
              className="relative overflow-hidden rounded-2xl border-2 border-blue-500/30 bg-gradient-to-b from-blue-500/15 to-blue-900/20 p-6 hover:border-blue-400/60 hover:from-blue-500/25 transition-all hover:scale-[1.03] active:scale-[0.97] group"
            >
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(59,130,246,0.15),transparent_70%)]" />
              <span className="text-4xl block mb-2 group-hover:scale-110 transition-transform">🔵</span>
              <span className="font-['Lilita_One'] text-base text-blue-300 block">{t('blueFirst')}</span>
              <span className="text-[10px] text-blue-400/60 mt-1 block">1 → 2 → 2 → 1</span>
            </button>
            <button
              onClick={() => dispatch({ type: 'SELECT_STARTER', starter: 'red' })}
              className="relative overflow-hidden rounded-2xl border-2 border-red-500/30 bg-gradient-to-b from-red-500/15 to-red-900/20 p-6 hover:border-red-400/60 hover:from-red-500/25 transition-all hover:scale-[1.03] active:scale-[0.97] group"
            >
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(239,68,68,0.15),transparent_70%)]" />
              <span className="text-4xl block mb-2 group-hover:scale-110 transition-transform">🔴</span>
              <span className="font-['Lilita_One'] text-base text-red-300 block">{t('redFirst')}</span>
              <span className="text-[10px] text-red-400/60 mt-1 block">1 → 2 → 2 → 1</span>
            </button>
          </div>
          {loadingData && (
            <div className="flex items-center justify-center gap-2">
              <div className="w-4 h-4 border-2 border-[#FFC91B] border-t-transparent rounded-full animate-spin" />
              <p className="text-xs text-slate-500">{t('loadingMeta')}</p>
            </div>
          )}
        </div>
      )}

      {/* ── Phase: Drafting ── */}
      {state.phase === 'DRAFTING' && (
        <div className="space-y-3">
          {/* Team slots */}
          <div className="sticky top-0 z-10 bg-[#1A2744] rounded-xl py-3 px-3 md:px-4 shadow-lg">
            <TeamSlots
              blueTeam={state.blueTeam} redTeam={state.redTeam}
              brawlerMap={brawlerMap} currentTeam={state.currentTeam}
              picksCompletedInTurn={state.picksCompletedInTurn} phase={state.phase}
            />
            <div className="flex items-center justify-center gap-3 mt-2">
              <span className={`text-xs font-['Lilita_One'] ${state.currentTeam === 'blue' ? 'text-blue-400' : 'text-red-400'}`}>
                {t('turn')} {state.pickHistory.length + 1}/6 — {state.currentTeam === 'blue' ? t('blueTeam') : t('redTeam')}
              </span>
              {state.pickHistory.length > 0 && (
                <button onClick={() => dispatch({ type: 'UNDO' })}
                  className="text-[11px] text-slate-500 hover:text-white flex items-center gap-1 transition-colors font-semibold">
                  <Undo2 className="w-3.5 h-3.5" /> {t('undo')}
                </button>
              )}
            </div>
          </div>

          {/* Recommendations (above grid for visibility) */}
          <RecommendationPanel
            recommendations={recommendations}
            brawlerMap={brawlerMap}
            currentTeam={state.currentTeam}
          />

          {/* Brawler grid */}
          <BrawlerGrid
            brawlers={brawlers} pickedIds={state.pickedIds}
            onSelect={(id) => dispatch({ type: 'PICK_BRAWLER', brawlerId: id })}
          />

          {/* Ban slots placeholder */}
          <div className="flex justify-center opacity-25">
            <div className="flex items-center gap-1.5 text-[9px] text-slate-600 bg-white/[0.02] rounded-lg px-3 py-1.5">
              <span>🚫🚫</span>
              <span className="font-semibold">{t('bansComingSoon')}</span>
              <span>🚫🚫</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Phase: Complete ── */}
      {state.phase === 'COMPLETE' && (
        <DraftSummary
          blueTeam={state.blueTeam.filter((id): id is number => id !== null)}
          redTeam={state.redTeam.filter((id): id is number => id !== null)}
          brawlerMap={brawlerMap}
          recommendations={recommendations}
          modeIconUrl={modeIconUrl}
          mapName={state.map}
          onReset={() => { dispatch({ type: 'RESET' }); setSelectedMapImage(null) }}
        />
      )}
    </div>
  )
}
