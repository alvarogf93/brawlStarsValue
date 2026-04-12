'use client'

import { useTranslations } from 'next-intl'
import { getGameModeImageUrl, wrColor } from '@/lib/utils'
import { useMapImages } from '@/hooks/useMapImages'
import type { MapPerformance } from '@/lib/analytics/types'

interface Props {
  data: MapPerformance[]
}

export function MapPerformanceList({ data }: Props) {
  const t = useTranslations('advancedAnalytics')
  const mapImages = useMapImages()

  if (data.length === 0) return null

  const sorted = [...data].sort((a, b) => b.winRate - a.winRate)

  return (
    <div className="brawl-card-dark p-5 md:p-6 border-[#090E17]">
      <h3 className="font-['Lilita_One'] text-lg text-white mb-4 flex items-center gap-2">
        <span className="text-xl">{'\uD83D\uDDFA\uFE0F'}</span> {t('mapPerformance')}
      </h3>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        {sorted.slice(0, 12).map(m => {
          const mapImageUrl = mapImages[m.map] ?? null
          const modeIconUrl = getGameModeImageUrl(m.mode)

          return (
            <div
              key={`${m.map}-${m.mode}`}
              className="relative h-24 overflow-hidden rounded-xl border border-white/10"
            >
              {/* Map background */}
              {mapImageUrl && (
                <img src={mapImageUrl} alt={m.map} className="absolute inset-0 w-full h-full object-cover opacity-50" loading="lazy" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-[#0A0E1A] via-[#0A0E1A]/70 to-transparent" />

              {/* Content */}
              <div className={`relative h-full p-3 flex flex-col justify-between ${!mapImageUrl ? 'bg-[#0F172A]' : ''}`}>
                {/* Top: mode icon + WR */}
                <div className="flex items-center justify-between">
                  {modeIconUrl && (
                    <span className="bg-black/50 backdrop-blur-sm rounded-lg p-0.5 border border-white/10 inline-flex">
                      <img src={modeIconUrl} alt={m.mode} className="w-4 h-4" width={16} height={16} />
                    </span>
                  )}
                  <span className={`font-['Lilita_One'] text-base tabular-nums drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] ${wrColor(m.winRate)}`}>
                    {m.winRate.toFixed(1)}%
                  </span>
                </div>

                {/* Bottom: map name + games */}
                <div>
                  <p className="font-['Lilita_One'] text-[11px] text-white leading-tight truncate drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                    {m.map}
                  </p>
                  <p className="font-['Lilita_One'] text-[9px] text-slate-400">
                    {m.total} games
                  </p>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
