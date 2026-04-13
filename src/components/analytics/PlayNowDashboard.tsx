'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { getBrawlerPortraitUrl, getBrawlerPortraitFallback, getMapImageUrl , wrColor } from '@/lib/utils'
import { BrawlImg } from '@/components/ui/BrawlImg'
import type { PlayNowRecommendation } from '@/lib/analytics/types'
import { ModeIcon } from '@/components/ui/ModeIcon'
import { ConfidenceBadge } from '@/components/ui/ConfidenceBadge'
import { parseSupercellTime } from '@/lib/battle-parser'



/**
 * Returns the time remaining until the event ends, formatted as
 * "Xh Ym" or "Ym". Returns `null` when the input cannot be parsed
 * so the caller can hide the badge instead of rendering "NaNm".
 */
function computeTimeLeft(endTimeStr: string, endedLabel: string): string | null {
  const end = parseSupercellTime(endTimeStr)
  if (!end) return null
  const diff = end.getTime() - Date.now()
  if (diff <= 0) return endedLabel
  const totalMin = Math.floor(diff / 60_000)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}


interface Props {
  recommendations: PlayNowRecommendation[]
}

export function PlayNowDashboard({ recommendations }: Props) {
  const t = useTranslations('advancedAnalytics')
  const [, setTick] = useState(0)
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 60_000)
    return () => clearInterval(interval)
  }, [])

  if (recommendations.length === 0) {
    return (
      <div className="brawl-card-dark p-5 md:p-6 border-[#090E17]">
        <div className="mb-4">
          <h3 className="font-['Lilita_One'] text-lg text-white flex items-center gap-2">
            <span className="text-xl">🎯</span> {t('playNowTitle')}
          </h3>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {t('playNowSubtitle')}
          </p>
        </div>
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <span className="text-4xl mb-3">🎮</span>
          <p className="font-['Lilita_One'] text-sm text-slate-400">
            {t('playNowEmpty')}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="brawl-card-dark p-5 md:p-6 border-[#090E17]">
      <div className="mb-4">
        <h3 className="font-['Lilita_One'] text-lg text-white flex items-center gap-2">
          <span className="text-xl">🎯</span> {t('playNowTitle')}
        </h3>
        <p className="text-[11px] text-slate-500 mt-0.5">
          {t('playNowSubtitle')}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {recommendations.map(slot => {
          const endedLabel = t('ended')
          const timeLeft = computeTimeLeft(slot.slotEndTime, endedLabel)
          const top3 = slot.recommendations.slice(0, 3)
          const best = top3[0]

          return (
            <div
              key={`${slot.mode}-${slot.map}`}
              className="relative rounded-xl overflow-hidden border border-white/10 group"
            >
              {/* Map image as full background */}
              <div className="relative h-44">
                <img
                  src={getMapImageUrl(slot.eventId)}
                  alt={slot.map}
                  className="absolute inset-0 w-full h-full object-cover"
                  loading="lazy"
                />
                {/* Gradient overlay for readability */}
                <div className="absolute inset-0 bg-gradient-to-t from-[#0A0E1A] via-[#0A0E1A]/70 to-transparent" />

                {/* Top-left: mode + time badge (+ mode-aggregate marker when applicable) */}
                <div className="absolute top-2 left-2 flex items-center gap-1.5">
                  <span className="bg-black/50 backdrop-blur-sm rounded-lg px-2 py-0.5 border border-white/10 flex items-center">
                    <ModeIcon mode={slot.mode} size={18} />
                  </span>
                  {timeLeft && (
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full backdrop-blur-sm border ${
                      timeLeft === endedLabel
                        ? 'bg-red-500/30 text-red-300 border-red-500/30'
                        : 'bg-black/40 text-[#4EC0FA] border-[#4EC0FA]/20'
                    }`}>
                      {timeLeft}
                    </span>
                  )}
                  {slot.source === 'mode-aggregate' && (
                    <span
                      className="text-[9px] font-bold text-amber-300 bg-amber-400/10 border border-amber-400/30 rounded px-1.5 py-0.5"
                      title={t('playNowModeAggregateTooltip')}
                    >
                      {t('playNowModeAggregateBadge')}
                    </span>
                  )}
                </div>

                {/* Bottom of map area: map name + best pick hero */}
                <div className="absolute bottom-0 left-0 right-0 px-3 pb-2.5">
                  <p className="font-['Lilita_One'] text-lg text-white text-stroke-brawl leading-tight">
                    {slot.map}
                  </p>
                  {best && (
                    <div className="flex items-center gap-2 mt-1.5">
                      <div className="relative">
                        <BrawlImg
                          src={getBrawlerPortraitUrl(best.brawlerId)}
                          fallbackSrc={getBrawlerPortraitFallback(best.brawlerId)}
                          alt={best.brawlerName}
                          className="w-10 h-10 rounded-lg border-2 border-[#FFC91B]/60"
                        />
                        <span className="absolute -top-1 -right-1 text-[9px] bg-[#FFC91B] text-[#121A2F] rounded-full w-4 h-4 flex items-center justify-center font-black">⭐</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-['Lilita_One'] text-sm text-white leading-none">{best.brawlerName}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          <span className={`font-bold ${wrColor(best.winRate)}`}>{best.winRate.toFixed(1)}%</span>
                          <ConfidenceBadge total={best.gamesPlayed} className="ml-1" />
                          <span className="text-slate-500 ml-1">· {best.gamesPlayed}g</span>
                        </p>
                      </div>
                      {/* Best trio teammates */}
                      {best.bestTrio && (
                        <div className="flex items-center gap-1">
                          <span className="text-[9px] text-slate-500 mr-0.5">+</span>
                          {best.bestTrio.brawlers
                            .filter(b => b.id !== best.brawlerId)
                            .map(b => (
                              <BrawlImg
                                key={b.id}
                                src={getBrawlerPortraitUrl(b.id)}
                                fallbackSrc={getBrawlerPortraitFallback(b.id)}
                                alt={b.name}
                                className="w-7 h-7 rounded-md ring-1 ring-[#FFC91B]/30"
                              />
                            ))
                          }
                          <span className={`text-[9px] font-bold ml-0.5 ${wrColor(best.bestTrio.winRate)}`}>
                            {best.bestTrio.winRate.toFixed(0)}%
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Remaining picks (2nd and 3rd) */}
              {top3.length > 1 && (
                <div className="bg-[#0A0E1A] px-3 py-2 flex gap-2">
                  {top3.slice(1).map((rec) => (
                    <div key={rec.brawlerId} className="flex items-center gap-2 flex-1 bg-white/[0.04] rounded-lg px-2.5 py-1.5">
                      <BrawlImg
                        src={getBrawlerPortraitUrl(rec.brawlerId)}
                        fallbackSrc={getBrawlerPortraitFallback(rec.brawlerId)}
                        alt={rec.brawlerName}
                        className="w-7 h-7 rounded-md flex-shrink-0"
                      />
                      <div className="min-w-0">
                        <p className="font-['Lilita_One'] text-[11px] text-slate-300 truncate">{rec.brawlerName}</p>
                        <p className="text-[9px]">
                          <span className={`font-bold ${wrColor(rec.winRate)}`}>{rec.winRate.toFixed(1)}%</span>
                          <span className="text-slate-600 ml-1">{rec.gamesPlayed}g</span>
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
