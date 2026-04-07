'use client'

import { useState, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { getBrawlerPortraitUrl, getMapImageUrl } from '@/lib/utils'
import type { BrawlerMapEntry } from '@/lib/analytics/types'
import { InfoTooltip } from '@/components/ui/InfoTooltip'

interface Props {
  data: BrawlerMapEntry[]
}

function wrColor(wr: number): string {
  if (wr >= 60) return 'text-green-400'
  if (wr >= 45) return 'text-[#FFC91B]'
  return 'text-red-400'
}

function wrBorderColor(wr: number): string {
  if (wr >= 60) return 'border-l-green-500'
  if (wr >= 45) return 'border-l-[#FFC91B]'
  return 'border-l-red-500'
}

const MODE_ICONS: Record<string, string> = {
  brawlBall: '⚽', gemGrab: '💎', showdown: '💀', duoShowdown: '💀', soloShowdown: '💀',
  heist: '🔒', bounty: '⭐', siege: '🤖', hotZone: '🔥',
  knockout: '🥊', wipeout: '💥', payload: '🚚', paintBrawl: '🎨',
  trophyThieves: '🏆', duels: '⚔️', ranked: '🏅',
}

export function BrawlerMapHeatmap({ data }: Props) {
  const t = useTranslations('advancedAnalytics')
  const [selectedBrawler, setSelectedBrawler] = useState<string>('all')

  const { brawlers, filtered } = useMemo(() => {
    const brawlerMap = new Map<number, { id: number; name: string; total: number }>()
    for (const e of data) {
      const existing = brawlerMap.get(e.brawlerId)
      if (existing) existing.total += e.total
      else brawlerMap.set(e.brawlerId, { id: e.brawlerId, name: e.brawlerName, total: e.total })
    }
    const sorted = [...brawlerMap.values()].sort((a, b) => b.total - a.total)

    const filtered = selectedBrawler === 'all'
      ? data
      : data.filter(e => String(e.brawlerId) === selectedBrawler)

    return { brawlers: sorted, filtered: [...filtered].sort((a, b) => b.wilsonScore - a.wilsonScore) }
  }, [data, selectedBrawler])

  if (data.length === 0) {
    return (
      <div className="brawl-card-dark p-5 md:p-6 border-[#090E17]">
        <h3 className="font-['Lilita_One'] text-lg text-white flex items-center gap-2 mb-4">
          <span className="text-xl">🗺️</span> {t('brawlerMapTitle')}
        </h3>
        <div className="flex flex-col items-center py-8 text-center">
          <span className="text-3xl mb-2">📊</span>
          <p className="font-['Lilita_One'] text-sm text-slate-400">{t('brawlerMapEmpty')}</p>
          <p className="text-[11px] text-slate-600 mt-1">{t('brawlerMapEmptyHint')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="brawl-card-dark p-5 md:p-6 border-[#090E17]">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <h3 className="font-['Lilita_One'] text-lg text-white flex items-center gap-2">
          <span className="text-xl">🗺️</span> {t('brawlerMapTitle')}
          <InfoTooltip className="ml-1.5" text={t('tipBrawlerMap')} />
        </h3>
        <select
          value={selectedBrawler}
          onChange={e => setSelectedBrawler(e.target.value)}
          className="bg-[var(--color-brawl-dark)] text-xs text-white border-2 border-[var(--color-brawl-dark)] rounded-xl px-3 py-2 outline-none font-['Lilita_One'] shadow-[0_2px_0_rgba(0,0,0,0.3)] focus:border-[var(--color-brawl-gold)]"
        >
          <option value="all">{t('allBrawlers')}</option>
          {brawlers.map(b => (
            <option key={b.id} value={String(b.id)}>{b.name} ({b.total}g)</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
        {filtered.map(entry => (
          <div
            key={`${entry.brawlerId}-${entry.map}`}
            className={`relative rounded-xl border-l-4 ${wrBorderColor(entry.winRate)} overflow-hidden p-3 flex flex-col gap-2 transition-all hover:scale-[1.03] brawl-row`}
          >
            {/* Map background image */}
            {entry.eventId && (
              <img
                src={getMapImageUrl(entry.eventId)}
                alt=""
                className="absolute inset-0 w-full h-full object-cover opacity-40 pointer-events-none"
                loading="lazy"
              />
            )}

            {/* Top: Brawler + WR */}
            <div className="flex items-center justify-between relative z-10">
              <img
                src={getBrawlerPortraitUrl(entry.brawlerId)}
                alt={entry.brawlerName}
                className="w-8 h-8 rounded-lg flex-shrink-0"
                loading="lazy"
              />
              <span className={`font-['Lilita_One'] text-lg tabular-nums ${wrColor(entry.winRate)}`} style={{ textShadow: '0 1px 0 rgba(0,0,0,0.4)' }}>
                {entry.winRate}%
              </span>
            </div>

            {/* Middle: Names */}
            <div className="min-w-0 relative z-10">
              {selectedBrawler === 'all' && (
                <p className="font-['Lilita_One'] text-xs text-white truncate" style={{ textShadow: '0 1px 0 rgba(0,0,0,0.3)' }}>
                  {entry.brawlerName}
                </p>
              )}
              <p className="text-[11px] text-slate-300 truncate" style={{ textShadow: '0 1px 0 rgba(0,0,0,0.3)' }}>
                {entry.map}
              </p>
            </div>

            {/* Bottom: Mode + games */}
            <div className="flex items-center justify-between relative z-10">
              <span className="text-[10px] text-slate-400">
                {MODE_ICONS[entry.mode] || '🎮'} {entry.mode}
              </span>
              <span className="text-[10px] text-slate-400 font-['Lilita_One']">
                {entry.total}g
              </span>
            </div>

            {/* Confidence dot */}
            {entry.confidence === 'low' && (
              <div className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-slate-600 z-10" title="Low confidence" />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
