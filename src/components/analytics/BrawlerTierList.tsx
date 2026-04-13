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

const TIER_META: Record<TierKey, { label: string; color: string; bgColor: string; borderColor: string }> = {
  S: { label: 'S', color: 'text-[#FFC91B]',  bgColor: 'bg-[#FFC91B]/15',  borderColor: 'border-[#FFC91B]/30' },
  A: { label: 'A', color: 'text-green-400',  bgColor: 'bg-green-400/15',  borderColor: 'border-green-400/30' },
  B: { label: 'B', color: 'text-[#4EC0FA]',  bgColor: 'bg-[#4EC0FA]/15',  borderColor: 'border-[#4EC0FA]/30' },
  C: { label: 'C', color: 'text-orange-400', bgColor: 'bg-orange-400/15', borderColor: 'border-orange-400/30' },
  D: { label: 'D', color: 'text-red-400',    bgColor: 'bg-red-400/15',    borderColor: 'border-red-400/30' },
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
    <div className="brawl-card-dark p-5 md:p-6 border-[#090E17]">
      {/* Header */}
      <div className="mb-4">
        <h3 className="font-['Lilita_One'] text-lg text-white flex items-center gap-2">
          <span className="text-xl">{'\uD83C\uDFC5'}</span> {t('brawlerTierList')}
          <span className="text-xs text-slate-500 font-normal ml-auto">
            {totalCount} {t('brawlers')}
          </span>
        </h3>
        <p className="text-[11px] text-slate-500 mt-0.5">{t('tierListSubtitle')}</p>
      </div>

      {/* Tier rows */}
      <div className="space-y-2">
        {TIER_ORDER.map(tier => {
          const brawlers = byTier[tier]
          const meta = TIER_META[tier]
          return (
            <div
              key={tier}
              data-tier={tier}
              className="flex items-stretch gap-2"
            >
              {/* Tier badge (left) */}
              <div
                className={`flex-shrink-0 w-12 rounded-lg border ${meta.borderColor} ${meta.bgColor} flex items-center justify-center`}
              >
                <span className={`font-['Lilita_One'] text-2xl ${meta.color}`}>
                  {meta.label}
                </span>
              </div>

              {/* Brawler tiles (horizontal, wrap) */}
              <div className="flex-1 min-h-[52px] flex flex-wrap gap-1.5 items-center rounded-lg bg-white/[0.02] p-1.5">
                {brawlers.length === 0 ? (
                  <span className="text-xs text-slate-700 px-2">{t('tierListEmptyTier')}</span>
                ) : (
                  brawlers.map(b => {
                    const isSelected = selectedId === b.id
                    return (
                      <button
                        key={b.id}
                        type="button"
                        data-brawler-id={b.id}
                        onClick={() => handleToggle(b.id)}
                        className={`relative w-11 h-11 rounded-md overflow-hidden transition-all ${
                          isSelected
                            ? 'ring-2 ring-[#FFC91B] scale-105'
                            : 'ring-1 ring-white/10 hover:ring-white/30'
                        }`}
                        aria-label={`${b.name} — ${b.winRate.toFixed(1)}% win rate`}
                        aria-pressed={isSelected}
                      >
                        <BrawlImg
                          src={getBrawlerPortraitUrl(b.id)}
                          fallbackSrc={getBrawlerPortraitFallback(b.id)}
                          alt={b.name}
                          className="w-full h-full object-cover"
                        />
                        {/* Visually hidden brawler name — accessible to SR + present in textContent for tests */}
                        <span className="sr-only">{b.name}</span>
                        {/* Confidence dot in top-right */}
                        <div className="absolute top-0.5 right-0.5">
                          <ConfidenceBadge total={b.total} />
                        </div>
                        {/* WR overlay on bottom */}
                        <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-center">
                          <span className={`text-[9px] font-['Lilita_One'] tabular-nums ${wrColor(b.winRate)}`}>
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

      {/* Detail panel */}
      <div className="mt-4 pt-4 border-t border-white/5">
        {selected ? (
          <div className="brawl-row rounded-xl p-4 flex items-center gap-4">
            <BrawlImg
              src={getBrawlerPortraitUrl(selected.id)}
              fallbackSrc={getBrawlerPortraitFallback(selected.id)}
              alt={selected.name}
              className="w-14 h-14 rounded-lg ring-2 ring-[#FFC91B]/50 flex-shrink-0"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h4 className="font-['Lilita_One'] text-base text-white truncate">{selected.name}</h4>
                <ConfidenceBadge total={selected.total} />
              </div>
              <p className={`font-['Lilita_One'] text-xl tabular-nums ${wrColor(selected.winRate)}`}>
                {selected.winRate.toFixed(1)}%
              </p>
              <div className="flex items-center gap-3 text-[10px] text-slate-400 mt-1 flex-wrap">
                <span>
                  {t('tierListDetailGames', {
                    total: selected.total,
                    wins: selected.wins,
                    losses: selected.losses,
                  })}
                </span>
                <span>
                  {t('tierListDetailStarRate', { rate: selected.starPlayerRate.toFixed(1) })}
                </span>
                <span className={
                  selected.avgTrophyChange > 0 ? 'text-green-400'
                    : selected.avgTrophyChange < 0 ? 'text-red-400'
                    : 'text-slate-500'
                }>
                  {t('tierListDetailTrophyChange', {
                    delta: (selected.avgTrophyChange > 0 ? '+' : '') + selected.avgTrophyChange.toFixed(0),
                  })}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-center text-sm text-slate-500 py-2">
            {t('tierListSelectHint')}
          </p>
        )}
      </div>
    </div>
  )
}
