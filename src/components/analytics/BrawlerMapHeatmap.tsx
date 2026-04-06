'use client'

import { useState, useMemo } from 'react'
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

function wrBg(wr: number): string {
  if (wr >= 60) return 'bg-green-500'
  if (wr >= 45) return 'bg-[#FFC91B]'
  return 'bg-red-500'
}

const MODE_ICONS: Record<string, string> = {
  brawlBall: '⚽', gemGrab: '💎', showdown: '💀', duoShowdown: '💀', soloShowdown: '💀',
  heist: '🔒', bounty: '⭐', siege: '🤖', hotZone: '🔥',
  knockout: '🥊', wipeout: '💥', payload: '🚚', paintBrawl: '🎨',
  trophyThieves: '🏆', duels: '⚔️', ranked: '🏅',
}

export function BrawlerMapHeatmap({ data }: Props) {
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
          <span className="text-xl">🗺️</span> Brawler &times; Map
        </h3>
        <div className="flex flex-col items-center py-8 text-center">
          <span className="text-3xl mb-2">📊</span>
          <p className="font-['Lilita_One'] text-sm text-slate-400">Not enough map data yet</p>
          <p className="text-[11px] text-slate-600 mt-1">Play 3+ games with the same brawler on a map to see performance.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="brawl-card-dark p-5 md:p-6 border-[#090E17]">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <h3 className="font-['Lilita_One'] text-lg text-white flex items-center gap-2">
          <span className="text-xl">🗺️</span> Brawler &times; Map
          <InfoTooltip className="ml-1.5" text="Shows your win rate for each brawler on each map. Green = strong (60%+), gold = average, red = weak. Only combos with 3+ games shown. Ranked by statistical confidence." />
        </h3>
        <select
          value={selectedBrawler}
          onChange={e => setSelectedBrawler(e.target.value)}
          className="bg-white/[0.06] text-xs text-white border border-white/10 rounded-lg px-2 py-1.5 outline-none focus:border-[#FFC91B]/40"
        >
          <option value="all">All Brawlers</option>
          {brawlers.map(b => (
            <option key={b.id} value={String(b.id)}>{b.name} ({b.total}g)</option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        {filtered.map(entry => (
          <div
            key={`${entry.brawlerId}-${entry.map}`}
            className="flex items-center gap-3 bg-white/[0.03] rounded-xl px-3 py-2.5"
          >
            {/* Brawler portrait */}
            <img
              src={getBrawlerPortraitUrl(entry.brawlerId)}
              alt={entry.brawlerName}
              className="w-9 h-9 rounded-lg flex-shrink-0"
              loading="lazy"
            />

            {/* Map thumbnail */}
            {entry.eventId && (
              <img
                src={getMapImageUrl(entry.eventId)}
                alt={entry.map}
                className="w-12 h-9 rounded-md object-cover flex-shrink-0 border border-white/10 hidden sm:block"
                loading="lazy"
              />
            )}

            {/* Map + mode info */}
            <div className="flex-1 min-w-0">
              <p className="font-['Lilita_One'] text-sm text-white truncate">
                {selectedBrawler !== 'all'
                  ? entry.map
                  : <>{entry.brawlerName}<span className="text-slate-500 font-normal mx-1.5">·</span>{entry.map}</>
                }
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[10px] text-slate-500">
                  {MODE_ICONS[entry.mode] || '🎮'} {entry.mode}
                </span>
                <span className="text-[10px] text-slate-600">{entry.total}g</span>
              </div>
            </div>

            {/* Win rate bar + percentage */}
            <div className="flex items-center gap-2.5 flex-shrink-0">
              <div className="w-20 h-2 bg-[#0D1321] rounded-full overflow-hidden hidden sm:block">
                <div
                  className={`h-full rounded-full ${wrBg(entry.winRate)}`}
                  style={{ width: `${entry.winRate}%` }}
                />
              </div>
              <span className={`font-['Lilita_One'] text-sm tabular-nums w-12 text-right ${wrColor(entry.winRate)}`}>
                {entry.winRate}%
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
