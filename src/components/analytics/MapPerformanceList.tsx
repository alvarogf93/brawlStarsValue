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
    <div className="relative overflow-hidden bg-[#090E17]/80 backdrop-blur-md rounded-xl p-5 md:p-6 border-b-[4px] border-[#06090E] shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_8px_16px_rgba(0,0,0,0.6)]">
      <h3 className="font-['Lilita_One'] text-lg text-white mb-5 flex items-center gap-2 drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]">
        <span className="text-xl drop-shadow-[0_0_8px_rgba(16,185,129,0.5)]">{'\uD83D\uDDFA\uFE0F'}</span> {t('mapPerformance')}
      </h3>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 relative z-10">
        {sorted.slice(0, 12).map((m, index) => {
          const mapImageUrl = mapImages[m.map] ?? null
          const modeIconUrl = getGameModeImageUrl(m.mode)
          const isTop3 = index < 3

          return (
            <div
              key={`${m.map}-${m.mode}`}
              className="group relative h-28 overflow-hidden rounded-xl border border-white/10 hover:border-[#FFC91B]/50 hover:shadow-[0_0_15px_rgba(255,201,27,0.2)] transition-all duration-300 transform hover:-translate-y-1 bg-[#0A0E1A]"
            >
              {/* Map background */}
              {mapImageUrl && (
                <img src={mapImageUrl} alt={m.map} className="absolute inset-0 w-full h-full object-cover opacity-50 group-hover:scale-110 transition-transform duration-700" loading="lazy" />
              )}
              {/* Holographic overlay for top 3 maps */}
              {isTop3 && (
                <div className="absolute inset-0 bg-gradient-to-tr from-[#FFC91B]/20 via-transparent to-[#FFC91B]/10 mix-blend-screen pointer-events-none z-10" />
              )}
              <div className={`absolute inset-0 bg-gradient-to-t ${isTop3 ? 'from-[#0A0E1A] via-[#0A0E1A]/80 to-transparent' : 'from-[#0A0E1A] via-[#0A0E1A]/60 to-transparent'} z-0`} />

              {/* Rank Hologram */}
              {isTop3 && (
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-5xl font-['Lilita_One'] opacity-10 text-[#FFC91B] pointer-events-none z-10 transform -rotate-12 group-hover:opacity-20 transition-opacity">
                  #{index + 1}
                </div>
              )}

              {/* Content */}
              <div className={`relative z-20 h-full p-3 flex flex-col justify-between ${!mapImageUrl ? 'bg-[#0F172A]' : ''}`}>
                {/* Top: mode icon + WR */}
                <div className="flex items-center justify-between">
                  {modeIconUrl && (
                    <span className="bg-[#121A2F]/90 backdrop-blur-sm rounded-md p-1 border border-white/10 inline-flex shadow-md">
                      <img src={modeIconUrl} alt={m.mode} className="w-5 h-5 drop-shadow-md" width={20} height={20} />
                    </span>
                  )}
                  <span className={`font-['Lilita_One'] text-lg tabular-nums tracking-wide drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] ${
                    m.winRate >= 60 ? 'text-green-400' :
                    m.winRate >= 45 ? 'text-[#FFC91B]' :
                    'text-red-400'
                  }`}>
                    {m.winRate.toFixed(1)}%
                  </span>
                </div>

                {/* Bottom: map name + games */}
                <div>
                  <p className="font-['Lilita_One'] text-base text-white leading-none truncate drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                    {m.map}
                  </p>
                  <div className="flex items-center mt-1.5">
                    <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400 bg-black/40 px-1.5 py-0.5 rounded border border-white/5">
                      {m.total} <span className="text-slate-600">G</span>
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
