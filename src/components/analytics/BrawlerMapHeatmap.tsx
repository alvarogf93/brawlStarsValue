'use client'

import { useState, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { getBrawlerPortraitUrl, getBrawlerPortraitFallback, getMapImageUrl } from '@/lib/utils'
import { BrawlImg } from '@/components/ui/BrawlImg'
import type { BrawlerMapEntry } from '@/lib/analytics/types'
import { InfoTooltip } from '@/components/ui/InfoTooltip'
import { ModeIcon } from '@/components/ui/ModeIcon'
import { ConfidenceBadge } from '@/components/ui/ConfidenceBadge'
import { useMapImages } from '@/hooks/useMapImages'
import { ProBadge } from '@/components/analytics/ProBadge'

interface Props {
  data: BrawlerMapEntry[]
  proData?: Map<string, { winRate: number; total: number }> | null
}

function getThermalStyle(wr: number) {
  if (wr >= 65) return {
    bg: 'bg-green-500/20 hover:bg-green-500/30',
    border: 'border-green-400',
    text: 'text-green-400 drop-shadow-[0_0_8px_rgba(74,222,128,0.8)]',
    shadow: 'shadow-[0_0_15px_rgba(74,222,128,0.15)] hover:shadow-[0_0_25px_rgba(74,222,128,0.3)]',
    glow: 'from-green-500/20'
  }
  if (wr >= 55) return {
    bg: 'bg-[#FFC91B]/20 hover:bg-[#FFC91B]/30',
    border: 'border-[#FFC91B]',
    text: 'text-[#FFC91B] drop-shadow-[0_0_8px_rgba(255,201,27,0.8)]',
    shadow: 'shadow-[0_0_15px_rgba(255,201,27,0.15)] hover:shadow-[0_0_25px_rgba(255,201,27,0.3)]',
    glow: 'from-[#FFC91B]/20'
  }
  if (wr >= 45) return {
    bg: 'bg-orange-500/20 hover:bg-orange-500/30',
    border: 'border-orange-400',
    text: 'text-orange-400 drop-shadow-[0_0_8px_rgba(251,146,60,0.8)]',
    shadow: 'shadow-[0_0_15px_rgba(251,146,60,0.15)] hover:shadow-[0_0_25px_rgba(251,146,60,0.3)]',
    glow: 'from-orange-500/20'
  }
  return {
    bg: 'bg-red-600/20 hover:bg-red-600/30',
    border: 'border-red-500',
    text: 'text-red-400 drop-shadow-[0_0_8px_rgba(239,68,68,0.8)]',
    shadow: 'shadow-[0_0_15px_rgba(239,68,68,0.15)] hover:shadow-[0_0_25px_rgba(239,68,68,0.3)]',
    glow: 'from-red-600/20'
  }
}

export function BrawlerMapHeatmap({ data, proData }: Props) {
  const t = useTranslations('advancedAnalytics')
  const [selectedBrawler, setSelectedBrawler] = useState<string>('all')
  const mapImages = useMapImages()

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
      <div className="relative overflow-hidden bg-[#090E17]/80 backdrop-blur-md rounded-xl p-5 md:p-6 border-b-[4px] border-[#06090E] shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_8px_16px_rgba(0,0,0,0.6)]">
        <h3 className="font-['Lilita_One'] text-lg text-white flex items-center gap-2 mb-4 drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]">
          <span className="text-xl drop-shadow-md">🗺️</span> {t('brawlerMapTitle')}
        </h3>
        <div className="flex flex-col items-center py-8 text-center relative z-10">
          <span className="text-4xl mb-3 grayscale opacity-30">📊</span>
          <p className="font-['Lilita_One'] text-sm text-slate-500 uppercase tracking-widest">{t('brawlerMapEmpty')}</p>
          <p className="text-[11px] text-slate-600 mt-1">{t('brawlerMapEmptyHint')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative overflow-hidden bg-[#090E17]/80 backdrop-blur-md rounded-xl p-5 md:p-6 border-b-[4px] border-[#06090E] shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_8px_16px_rgba(0,0,0,0.6)]">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5 relative z-20">
        <h3 className="font-['Lilita_One'] text-lg text-white flex items-center gap-2 drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]">
          <span className="text-xl drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]">🗺️</span> {t('brawlerMapTitle')}
          <InfoTooltip className="ml-1.5 opacity-70 hover:opacity-100" text={t('tipBrawlerMap')} />
        </h3>
        <select
          value={selectedBrawler}
          onChange={e => setSelectedBrawler(e.target.value)}
          className="bg-[#0A0E1A]/90 text-xs text-white border-2 border-white/10 rounded-lg px-3 py-2 outline-none font-['Lilita_One'] shadow-[0_4px_8px_rgba(0,0,0,0.5)] hover:border-[#4EC0FA]/50 focus:border-[#4EC0FA] transition-colors cursor-pointer"
        >
          <option value="all">{t('allBrawlers')}</option>
          {brawlers.map(b => (
            <option key={b.id} value={String(b.id)}>{b.name} ({b.total}g)</option>
          ))}
        </select>
      </div>

      <div className="bg-[#000000] p-2 rounded-xl border border-white/5 shadow-[inset_0_4px_20px_rgba(0,0,0,0.8)]">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-1.5">
          {filtered.map(entry => {
            const thermal = getThermalStyle(entry.winRate)
            return (
              <div
                key={`${entry.brawlerId}-${entry.map}`}
                className={`group relative rounded-lg border-l-[3px] border-b-[3px] ${thermal.border} overflow-hidden p-2.5 flex flex-col gap-2 transition-all duration-300 transform hover:-translate-y-0.5 hover:z-10 bg-[#0A0E1A] ${thermal.shadow}`}
              >
                {/* Thermal Glow background */}
                <div className={`absolute inset-0 bg-gradient-to-tr ${thermal.glow} to-transparent opacity-10 group-hover:opacity-30 transition-opacity z-0 pointer-events-none`} />

                {/* Map background image */}
                {(entry.eventId || mapImages[entry.map]) && (
                  <img
                    src={entry.eventId ? getMapImageUrl(entry.eventId) : mapImages[entry.map]}
                    alt=""
                    className="absolute inset-0 w-full h-full object-cover opacity-20 mix-blend-luminosity group-hover:mix-blend-normal transition-all duration-700 group-hover:scale-110 pointer-events-none z-0"
                    loading="lazy"
                  />
                )}
                <div className="absolute inset-0 bg-black/50 group-hover:bg-black/30 transition-colors pointer-events-none z-0" />

                {/* Top: Brawler + WR */}
                <div className="flex items-center justify-between relative z-10">
                  <BrawlImg
                    src={getBrawlerPortraitUrl(entry.brawlerId)}
                    fallbackSrc={getBrawlerPortraitFallback(entry.brawlerId)}
                    alt={entry.brawlerName}
                    className={`w-9 h-9 rounded-md flex-shrink-0 border border-white/10 ${selectedBrawler !== 'all' ? 'ring-1 ring-[#FFC91B]/50' : ''}`}
                    style={{ clipPath: 'polygon(10% 0, 100% 0, 100% 90%, 90% 100%, 0 100%, 0 10%)' }}
                  />
                  <div className="flex flex-col items-end">
                    <span className={`font-['Lilita_One'] text-xl tabular-nums tracking-wide ${thermal.text}`}>
                      {entry.winRate.toFixed(1)}%
                    </span>
                    {proData?.get(`${entry.brawlerId}|${entry.map}`) && (
                      <div className="mt-0.5 scale-90 origin-right">
                        <ProBadge
                          proValue={proData.get(`${entry.brawlerId}|${entry.map}`)!.winRate}
                          userValue={entry.winRate}
                          total={proData.get(`${entry.brawlerId}|${entry.map}`)!.total}
                          compact
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Middle: Names */}
                <div className="min-w-0 relative z-10 bg-black/40 p-1.5 rounded-md border border-white/5 backdrop-blur-sm mt-1">
                  {selectedBrawler === 'all' && (
                    <p className="font-['Lilita_One'] text-[11px] text-white truncate drop-shadow-md">
                      {entry.brawlerName}
                    </p>
                  )}
                  <p className="font-['Lilita_One'] text-[10px] text-slate-300 truncate drop-shadow-md">
                    {entry.map}
                  </p>
                  <div className="flex items-center gap-1.5 mt-1 border-t border-white/10 pt-1">
                    <ModeIcon mode={entry.mode} size={10} />
                    <span className="text-[9px] uppercase font-bold tracking-widest text-slate-400 truncate">
                      {entry.mode}
                    </span>
                  </div>
                </div>

                {/* Confidence indicator */}
                <div className="absolute top-1 right-1 z-10 opacity-80 group-hover:opacity-100 transition-opacity">
                  <ConfidenceBadge total={entry.total} />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
