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
import { getGameModeImageUrl, getMapImageUrl } from '@/lib/utils'
import { RotateCcw, Undo2, Swords } from 'lucide-react'

export function DraftSimulator() {
  const t = useTranslations('draft')
  const [state, dispatch] = useReducer(draftReducer, undefined, createInitialState)

  const [brawlers, setBrawlers] = useState<BrawlerEntry[]>([])
  const [draftData, setDraftData] = useState<DraftData | null>(null)
  const [loadingBrawlers, setLoadingBrawlers] = useState(true)
  const [loadingData, setLoadingData] = useState(false)

  // Build brawler lookup map
  const brawlerMap = useMemo(() => {
    const map = new Map<number, BrawlerEntry>()
    for (const b of brawlers) map.set(b.id, b)
    return map
  }, [brawlers])

  // Fetch brawler registry on mount
  useEffect(() => {
    const cached = getCachedRegistry()
    if (cached && cached.length > 0) {
      setBrawlers(cached)
      setLoadingBrawlers(false)
      return
    }

    fetch('https://api.brawlapi.com/v1/brawlers')
      .then(r => r.json())
      .then(data => {
        const list = (data.list ?? data) as Array<{
          id: number; name: string; rarity?: { name: string }; class?: { name: string }; imageUrl2?: string; imageUrl?: string
        }>
        const entries: BrawlerEntry[] = list.map(b => ({
          id: b.id,
          name: b.name,
          rarity: b.rarity?.name ?? 'Unknown',
          class: b.class?.name ?? 'Unknown',
          imageUrl: b.imageUrl2 ?? b.imageUrl ?? '',
        }))
        setBrawlers(entries)
        setCachedRegistry(entries)
      })
      .catch(() => {})
      .finally(() => setLoadingBrawlers(false))
  }, [])

  // Fetch draft data when map is selected
  useEffect(() => {
    if (state.phase !== 'SELECT_STARTER' && state.phase !== 'DRAFTING') return
    if (!state.map || !state.mode) return

    setLoadingData(true)
    fetch(`/api/draft/data?map=${encodeURIComponent(state.map)}&mode=${state.mode}`)
      .then(r => r.json())
      .then(data => setDraftData(data))
      .catch(() => setDraftData(null))
      .finally(() => setLoadingData(false))
  }, [state.map, state.mode, state.phase])

  // Compute recommendations
  const recommendations = useMemo(() => {
    if (!draftData || state.phase !== 'DRAFTING') return []

    const blueIds = state.blueTeam.filter((id): id is number => id !== null)
    const redIds = state.redTeam.filter((id): id is number => id !== null)

    return computeRecommendations({
      meta: draftData.meta,
      matchups: draftData.matchups,
      blueTeam: blueIds,
      redTeam: redIds,
      pickedIds: state.pickedIds,
      personal: draftData.personal,
    })
  }, [draftData, state.blueTeam, state.redTeam, state.pickedIds, state.phase])

  const handleMapSelect = useCallback((map: string, eventId: number) => {
    dispatch({ type: 'SELECT_MAP', map, eventId })
  }, [])

  // Loading state
  if (loadingBrawlers) {
    return (
      <div className="brawl-card-dark p-8 border-[#090E17] text-center">
        <div className="w-8 h-8 border-2 border-[#FFC91B] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm text-slate-400">{t('loadingBrawlers')}</p>
      </div>
    )
  }

  return (
    <div className="brawl-card-dark p-4 md:p-6 border-[#090E17] space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-['Lilita_One'] text-lg text-white flex items-center gap-2">
          <Swords className="w-5 h-5 text-[#FFC91B]" /> {t('draftTitle')}
        </h3>
        {state.phase !== 'IDLE' && (
          <button
            onClick={() => dispatch({ type: 'RESET' })}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" /> {t('reset')}
          </button>
        )}
      </div>

      {/* Phase: Mode Selection */}
      {state.phase === 'IDLE' && (
        <ModeSelector onSelect={(mode: DraftMode) => dispatch({ type: 'SELECT_MODE', mode })} />
      )}

      {/* Phase: Map Selection */}
      {state.phase === 'SELECT_MAP' && state.mode && (
        <MapSelector mode={state.mode} onSelect={handleMapSelect} />
      )}

      {/* Phase: Starter Selection */}
      {state.phase === 'SELECT_STARTER' && (
        <div className="text-center space-y-4">
          <h3 className="font-['Lilita_One'] text-xl text-white">{t('whoStarts')}</h3>
          <div className="flex gap-4 justify-center">
            <button
              onClick={() => dispatch({ type: 'SELECT_STARTER', starter: 'blue' })}
              className="px-8 py-4 rounded-xl border-2 border-blue-500/30 bg-blue-500/10 hover:bg-blue-500/20 hover:border-blue-500/60 transition-all hover:scale-105 active:scale-95"
            >
              <span className="text-2xl block mb-1">🔵</span>
              <span className="font-['Lilita_One'] text-sm text-blue-400">{t('blueFirst')}</span>
            </button>
            <button
              onClick={() => dispatch({ type: 'SELECT_STARTER', starter: 'red' })}
              className="px-8 py-4 rounded-xl border-2 border-red-500/30 bg-red-500/10 hover:bg-red-500/20 hover:border-red-500/60 transition-all hover:scale-105 active:scale-95"
            >
              <span className="text-2xl block mb-1">🔴</span>
              <span className="font-['Lilita_One'] text-sm text-red-400">{t('redFirst')}</span>
            </button>
          </div>
          {loadingData && <p className="text-xs text-slate-500">{t('loadingMeta')}</p>}
        </div>
      )}

      {/* Phase: Drafting */}
      {state.phase === 'DRAFTING' && (
        <div className="space-y-3">
          {/* Context: selected mode + map */}
          <div className="flex items-center gap-3 bg-white/[0.03] rounded-xl px-3 py-2">
            {state.mode && getGameModeImageUrl(state.mode) && (
              <img src={getGameModeImageUrl(state.mode)!} alt={state.mode} className="w-6 h-6" width={24} height={24} />
            )}
            {state.eventId && (
              <img src={getMapImageUrl(state.eventId)} alt={state.map ?? ''} className="w-16 h-10 rounded-md object-cover border border-white/10" width={64} height={40} />
            )}
            <span className="font-['Lilita_One'] text-sm text-white">{state.map}</span>
          </div>

          {/* Team slots (sticky on mobile) */}
          <div className="sticky top-0 z-10 bg-[#24355B] py-2 -mx-4 px-4 md:-mx-6 md:px-6 border-b border-white/5">
            <TeamSlots
              blueTeam={state.blueTeam}
              redTeam={state.redTeam}
              brawlerMap={brawlerMap}
              currentTeam={state.currentTeam}
              picksCompletedInTurn={state.picksCompletedInTurn}
              phase={state.phase}
            />
            <div className="flex items-center justify-center gap-2 mt-2">
              <span className={`text-[11px] font-bold ${state.currentTeam === 'blue' ? 'text-blue-400' : 'text-red-400'}`}>
                {t('turn')} {state.pickHistory.length + 1}/6 — {state.currentTeam === 'blue' ? t('blueTeam') : t('redTeam')}
              </span>
              {state.pickHistory.length > 0 && (
                <button
                  onClick={() => dispatch({ type: 'UNDO' })}
                  className="text-[10px] text-slate-500 hover:text-white flex items-center gap-1 transition-colors"
                >
                  <Undo2 className="w-3 h-3" /> {t('undo')}
                </button>
              )}
            </div>
          </div>

          {/* Brawler grid */}
          <BrawlerGrid
            brawlers={brawlers}
            pickedIds={state.pickedIds}
            onSelect={(id) => dispatch({ type: 'PICK_BRAWLER', brawlerId: id })}
          />

          {/* Recommendations */}
          <RecommendationPanel
            recommendations={recommendations}
            brawlerMap={brawlerMap}
            currentTeam={state.currentTeam}
          />
        </div>
      )}

      {/* Phase: Complete */}
      {state.phase === 'COMPLETE' && (
        <div className="text-center space-y-4">
          <h3 className="font-['Lilita_One'] text-xl text-[#FFC91B]">{t('draftComplete')}</h3>
          <div className="flex items-center justify-center gap-3">
            {state.mode && getGameModeImageUrl(state.mode) && (
              <img src={getGameModeImageUrl(state.mode)!} alt={state.mode} className="w-6 h-6" width={24} height={24} />
            )}
            <span className="font-['Lilita_One'] text-sm text-slate-300">{state.map}</span>
          </div>
          <TeamSlots
            blueTeam={state.blueTeam}
            redTeam={state.redTeam}
            brawlerMap={brawlerMap}
            currentTeam={state.currentTeam}
            picksCompletedInTurn={0}
            phase={state.phase}
          />
          <button
            onClick={() => dispatch({ type: 'RESET' })}
            className="brawl-button px-6 py-2.5 inline-flex items-center gap-2 text-sm"
          >
            <RotateCcw className="w-4 h-4" /> {t('newDraft')}
          </button>
        </div>
      )}

      {/* Ban slots placeholder */}
      {state.phase === 'DRAFTING' && (
        <div className="flex justify-center gap-8 opacity-30">
          <div className="flex items-center gap-1 text-[9px] text-slate-600">
            <span>🚫</span><span>🚫</span>
            <span className="ml-1">{t('bansComingSoon')}</span>
          </div>
        </div>
      )}
    </div>
  )
}
