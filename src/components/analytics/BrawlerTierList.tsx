'use client'

import { useState, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { getBrawlerPortraitUrl, getBrawlerPortraitFallback, wrColor } from '@/lib/utils'
import { BrawlImg } from '@/components/ui/BrawlImg'
import { ConfidenceBadge } from '@/components/ui/ConfidenceBadge'

interface BrawlerPerformance {
  id: number
  name: string
  wins: number
  losses: number
  total: number
  winRate: number
  confidence: 'high' | 'medium' | 'low'
  starPlayerRate: number
  avgTrophyChange: number
}

interface Props {
  data: BrawlerPerformance[]
}

type TierKey = 'S' | 'A' | 'B' | 'C' | 'D'

const TIER_ORDER: readonly TierKey[] = ['S', 'A', 'B', 'C', 'D'] as const

const TIER_META: Record<TierKey, { label: string; color: string; bgStyle: string; borderColor: string; shadow: string; }> = {
  S: { 
    label: 'S', 
    color: 'text-[#FFC91B] drop-shadow-[0_0_8px_#FFC91B]', 
    bgStyle: 'bg-gradient-to-b from-[#4A3B00] to-[#1A1500]', 
    borderColor: 'border-b-[#FFC91B]', 
    shadow: 'shadow-[inset_0_1px_1px_rgba(255,201,27,0.4),0_0_15px_rgba(255,201,27,0.3)]' 
  },
  A: { 
    label: 'A', 
    color: 'text-green-400 drop-shadow-[0_0_8px_#4ADE80]', 
    bgStyle: 'bg-gradient-to-b from-[#0F3A20] to-[#051A0E]', 
    borderColor: 'border-b-[#4ade80]', 
    shadow: 'shadow-[inset_0_1px_1px_rgba(74,222,128,0.4),0_0_15px_rgba(74,222,128,0.2)]' 
  },
  B: { 
    label: 'B', 
    color: 'text-[#4EC0FA] drop-shadow-[0_0_8px_#4EC0FA]', 
    bgStyle: 'bg-gradient-to-b from-[#0E2E4A] to-[#041220]', 
    borderColor: 'border-b-[#4EC0FA]', 
    shadow: 'shadow-[inset_0_1px_1px_rgba(78,192,250,0.4),0_0_15px_rgba(78,192,250,0.2)]' 
  },
  C: { 
    label: 'C', 
    color: 'text-orange-400 drop-shadow-[0_0_8px_#FB923C]', 
    bgStyle: 'bg-gradient-to-b from-[#4A2609] to-[#201004]', 
    borderColor: 'border-b-orange-400', 
    shadow: 'shadow-[inset_0_1px_1px_rgba(251,146,60,0.4),0_0_10px_rgba(251,146,60,0.2)]' 
  },
  D: { 
    label: 'D', 
    color: 'text-red-500 drop-shadow-[0_0_8px_#EF4444]', 
    bgStyle: 'bg-gradient-to-b from-[#4A0E0E] to-[#200404]', 
    borderColor: 'border-b-red-600', 
    shadow: 'shadow-[inset_0_1px_1px_rgba(239,68,68,0.4),0_0_10px_rgba(239,68,68,0.2)]' 
  },
}

function tierOf(winRate: number): TierKey {
  if (winRate >= 65) return 'S'
  if (winRate >= 55) return 'A'
  if (winRate >= 45) return 'B'
  if (winRate >= 35) return 'C'
  return 'D'
}

export function BrawlerTierList({ data }: Props) {
  const t = useTranslations('advancedAnalytics')
  const [selectedId, setSelectedId] = useState<number | null>(null)

  // Filter + group by tier (memoized — derived from props during render, no effect)
  const { byTier, totalCount } = useMemo(() => {
    const filtered = data.filter(b => b.total >= 3)
    const groups: Record<TierKey, BrawlerPerformance[]> = {
      S: [], A: [], B: [], C: [], D: [],
    }
    for (const b of filtered) {
      groups[tierOf(b.winRate)].push(b)
    }
    // Sort each tier by winRate descending (best on the left)
    for (const k of TIER_ORDER) {
      groups[k].sort((a, b) => b.winRate - a.winRate)
    }
    return { byTier: groups, totalCount: filtered.length }
  }, [data])

  if (data.length === 0) return null

  // Find selected brawler for the detail panel
  const selected = selectedId !== null
    ? data.find(b => b.id === selectedId) ?? null
    : null

  const handleToggle = (brawlerId: number) => {
    setSelectedId(prev => prev === brawlerId ? null : brawlerId)
  }

  return (
    <div className="relative overflow-hidden bg-[#090E17]/80 backdrop-blur-md rounded-xl p-5 md:p-6 border-b-[4px] border-[#06090E] shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_8px_16px_rgba(0,0,0,0.6)]">

      {/* Header */}
      <div className="mb-5 relative z-10">
        <h3 className="font-['Lilita_One'] text-lg text-white flex items-center gap-2 drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]">
          <span className="text-xl drop-shadow-md">{'\uD83C\uDFC5'}</span> {t('brawlerTierList')}
          <span className="text-[10px] text-white/50 tracking-widest uppercase font-bold ml-auto bg-black/40 px-2 py-1 rounded-md border border-white/5">
            {totalCount} {t('brawlers')}
          </span>
        </h3>
        <p className="text-[11px] text-slate-400 mt-1">{t('tierListSubtitle')}</p>
      </div>

      {/* Tier rows */}
      <div className="space-y-3 relative z-10">
        {TIER_ORDER.map(tier => {
          const brawlers = byTier[tier]
          const meta = TIER_META[tier]
          return (
            <div
              key={tier}
              data-tier={tier}
              className="flex items-stretch gap-2"
            >
              {/* Tier badge (left 3D Stamp) */}
              <div
                className={`relative flex-shrink-0 w-14 rounded-lg border-t border-x border-white/10 border-b-[4px] ${meta.borderColor} ${meta.bgStyle} ${meta.shadow} overflow-hidden group flex items-center justify-center`}
              >
                <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                <span className={`relative font-['Lilita_One'] text-[32px] ${meta.color} transform group-hover:scale-110 transition-transform duration-300`}>
                  {meta.label}
                </span>
              </div>

              {/* Brawler tiles (horizontal, wrap) */}
              <div className="flex-1 min-h-[56px] flex flex-wrap gap-2 items-center rounded-lg bg-black/40 border border-white/5 p-2 shadow-[inset_0_2px_8px_rgba(0,0,0,0.5)]">
                {brawlers.length === 0 ? (
                  <span className="text-[11px] uppercase tracking-widest text-slate-600 px-3 font-bold">{t('tierListEmptyTier')}</span>
                ) : (
                  brawlers.map(b => {
                    const isSelected = selectedId === b.id
                    return (
                      <button
                        key={b.id}
                        type="button"
                        data-brawler-id={b.id}
                        onClick={() => handleToggle(b.id)}
                        className={`group relative w-12 h-12 rounded-lg overflow-hidden transition-all duration-300 transform ${
                          isSelected
                            ? 'ring-2 ring-[#FFC91B] scale-110 shadow-[0_0_15px_rgba(255,201,27,0.4)] z-10'
                            : 'ring-1 ring-white/10 hover:ring-white/40 hover:scale-105 hover:shadow-[0_0_10px_rgba(255,255,255,0.2)]'
                        }`}
                        aria-label={`${b.name} — ${b.winRate.toFixed(1)}% win rate`}
                        aria-pressed={isSelected}
                      >
                        <BrawlImg
                          src={getBrawlerPortraitUrl(b.id)}
                          fallbackSrc={getBrawlerPortraitFallback(b.id)}
                          alt={b.name}
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                        />
                        {/* Visually hidden brawler name */}
                        <span className="sr-only">{b.name}</span>
                        {/* Confidence dot */}
                        <div className="absolute top-1 right-1 drop-shadow-md">
                          <ConfidenceBadge total={b.total} />
                        </div>
                        {/* WR overlay on bottom */}
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 pb-0.5 pt-2 via-black/60 to-transparent text-center">
                          <span className={`text-[9.5px] font-black tracking-wide ${wrColor(b.winRate)}`}>
                            {b.winRate.toFixed(0)}%
                          </span>
                        </div>
                      </button>
                    )
                  })
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Detail panel (Cyber Console Info box) */}
      <div className="mt-5 pt-5 border-t border-white/5 relative z-10">
        {selected ? (
          <div className="relative overflow-hidden bg-gradient-to-r from-[#121A2F]/80 to-[#0A0E1A]/80 border border-white/10 rounded-xl p-4 flex items-center gap-4 shadow-[inset_0_0_20px_rgba(0,0,0,0.5)]">
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPgo8cmVjdCB3aWR0aD0iNCIgaGVpZ2h0PSI0IiBmaWxsPSJ0cmFuc3BhcmVudCI+PC9yZWN0Pgo8cGF0aCBkPSJNMCAwTDAgNCIgc3Ryb2tlPSJyZ2JhKDI1NSwgMjU1LCAyNTUsIDAuMDUpIiBzdHJva2Utd2lkdGg9IjEiPjwvcGF0aD4KPC9zdmc+')] pointer-events-none" />
            
            <BrawlImg
              src={getBrawlerPortraitUrl(selected.id)}
              fallbackSrc={getBrawlerPortraitFallback(selected.id)}
              alt={selected.name}
              className="w-16 h-16 rounded-lg border-2 border-[#FFC91B] flex-shrink-0 shadow-[0_0_15px_rgba(255,201,27,0.3)] relative z-10"
              style={{ clipPath: 'polygon(15% 0, 100% 0, 100% 85%, 85% 100%, 0 100%, 0 15%)' }}
            />
            <div className="flex-1 min-w-0 relative z-10">
              <div className="flex items-center gap-2 mb-1">
                <h4 className="font-['Lilita_One'] text-lg text-white truncate drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                  {selected.name}
                </h4>
                <ConfidenceBadge total={selected.total} className="ml-1" />
              </div>
              <p className={`font-['Lilita_One'] text-2xl tabular-nums tracking-wide drop-shadow-md ${wrColor(selected.winRate)}`}>
                {selected.winRate.toFixed(1)}%
              </p>
              <div className="flex items-center gap-3 text-[10px] uppercase font-bold tracking-widest text-slate-400 mt-2 flex-wrap bg-black/40 inline-flex px-2 py-1.5 rounded-md border border-white/5">
                <span>
                  <span className="text-white drop-shadow-[0_0_4px_rgba(255,255,255,0.4)]">{selected.total}</span> <span className="text-[9px]">G</span> <span className="text-green-400 mx-0.5">{selected.wins}</span><span className="text-slate-600">/</span><span className="text-red-400 mx-0.5">{selected.losses}</span>
                </span>
                <span className="w-1 h-1 rounded-full bg-slate-600" />
                <span className="flex items-center gap-1">
                  <span className="text-[#FFC91B]">⭐</span> {selected.starPlayerRate.toFixed(1)}%
                </span>
                <span className="w-1 h-1 rounded-full bg-slate-600" />
                <span className={`flex items-center ${
                  selected.avgTrophyChange > 0 ? 'text-green-400'
                    : selected.avgTrophyChange < 0 ? 'text-red-400'
                    : 'text-slate-500'
                }`}>
                  {selected.avgTrophyChange > 0 ? '🏆 +' : selected.avgTrophyChange < 0 ? '🏆 ' : '🏆 '} {selected.avgTrophyChange.toFixed(0)}
                </span>
              </div>
            </div>
            {/* Ambient detail glow */}
            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-32 h-32 bg-[#FFC91B]/10 rounded-full blur-3xl pointer-events-none" />
          </div>
        ) : (
          <div className="relative overflow-hidden bg-black/30 border border-dashed border-white/10 rounded-xl p-8 flex items-center justify-center">
            <p className="text-center text-[11px] uppercase tracking-widest font-bold text-slate-500 relative z-10 flex flex-col items-center gap-2">
              <span className="text-2xl grayscale opacity-40">🎯</span>
              {t('tierListSelectHint')}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
