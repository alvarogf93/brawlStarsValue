'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { getBrawlerPortraitUrl, getBrawlerPortraitFallback, getMapImageUrl, wrColor } from '@/lib/utils'
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
      <div className="relative overflow-hidden bg-[#090E17]/80 backdrop-blur-md rounded-xl p-5 md:p-6 border-b-[4px] border-[#06090E] shadow-[0_8px_16px_rgba(0,0,0,0.5)]">
        <div className="mb-4">
          <h3 className="font-['Lilita_One'] text-lg text-white flex items-center gap-2 drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]">
            <span className="text-xl">🎯</span> {t('playNowTitle')}
          </h3>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {t('playNowSubtitle')}
          </p>
        </div>
        <div className="flex flex-col items-center justify-center py-10 text-center relative z-10">
          <span className="text-4xl mb-3 opacity-50 grayscale">🎮</span>
          <p className="font-['Lilita_One'] text-sm text-slate-500">
            {t('playNowEmpty')}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative overflow-hidden bg-[#090E17]/80 backdrop-blur-md rounded-xl p-5 md:p-6 border-b-[4px] border-[#06090E] shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_8px_16px_rgba(0,0,0,0.6)]">
      {/* Background diagonal bars indicating "Loading Lobby" feel */}
      <div className="absolute inset-0 opacity-[0.02] bg-[linear-gradient(45deg,#fff_25%,transparent_25%,transparent_50%,#fff_50%,#fff_75%,transparent_75%,transparent_100%)] bg-[length:30px_30px] pointer-events-none" />

      <div className="mb-4 relative z-10">
        <h3 className="font-['Lilita_One'] text-lg text-white flex items-center gap-2 drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]">
          <span className="text-xl animate-pulse drop-shadow-[0_0_5px_rgba(16,185,129,0.8)]">🟢</span> {t('playNowTitle')}
        </h3>
        <p className="text-[11px] text-slate-400 mt-0.5 uppercase tracking-widest font-bold">
          {t('playNowSubtitle')}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 relative z-10">
        {recommendations.map(slot => {
          const endedLabel = t('ended')
          const timeLeft = computeTimeLeft(slot.slotEndTime, endedLabel)
          const top3 = slot.recommendations.slice(0, 3)
          const best = top3[0]

          return (
            <div
              key={`${slot.mode}-${slot.map}`}
              className="group relative rounded-xl overflow-hidden border-2 border-white/5 hover:border-[#10B981]/60 hover:shadow-[0_0_20px_rgba(16,185,129,0.25)] transition-all duration-300 transform hover:-translate-y-1 bg-[#0A0E1A]"
            >
              {/* Match Found Shimmer */}
              <div className="absolute -inset-1 bg-gradient-to-r from-transparent via-[#10B981]/20 to-transparent translate-x-[-150%] group-hover:animate-[shimmer_2s_infinite] pointer-events-none z-20" />

              {/* Map image as full background */}
              <div className="relative h-48">
                <img
                  src={getMapImageUrl(slot.eventId)}
                  alt={slot.map}
                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                  loading="lazy"
                />
                {/* Gradient overlay for readability */}
                <div className="absolute inset-0 bg-gradient-to-t from-[#0A0E1A] via-[#0A0E1A]/60 to-transparent" />

                {/* Top-left: mode + time badge */}
                <div className="absolute top-3 left-3 flex items-center gap-2">
                  <span className="bg-[#121A2F]/90 backdrop-blur-md rounded-lg px-2 py-1 border border-white/10 flex items-center shadow-lg">
                    <ModeIcon mode={slot.mode} size={18} />
                  </span>
                  {timeLeft && (
                    <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-md backdrop-blur-md border shadow-[0_0_10px_rgba(0,0,0,0.5)] ${
                      timeLeft === endedLabel
                        ? 'bg-red-500/80 text-white border-red-400'
                        : 'bg-[#10B981]/20 text-[#10B981] border-[#10B981]/30 group-hover:bg-[#10B981]/40 group-hover:border-[#10B981]'
                    }`}>
                      {timeLeft}
                    </span>
                  )}
                  {slot.source === 'mode-aggregate' && (
                    <span
                      className="text-[9px] font-bold text-amber-300 bg-amber-400/20 border border-amber-400/50 rounded px-1.5 py-0.5 backdrop-blur-sm"
                      title={t('playNowModeAggregateTooltip')}
                    >
                      {t('playNowModeAggregateBadge')}
                    </span>
                  )}
                </div>

                {/* Bottom of map area: map name + best pick hero */}
                <div className="absolute bottom-0 left-0 right-0 px-4 pb-3">
                  <p className="font-['Lilita_One'] text-xl text-white text-stroke-brawl leading-tight drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                    {slot.map}
                  </p>
                  {best && (
                    <div className="flex items-center gap-3 mt-2 bg-[#000000]/40 backdrop-blur-sm p-2.5 rounded-xl border border-white/5">
                      <div className="relative group-hover:animate-pulse">
                        <BrawlImg
                          src={getBrawlerPortraitUrl(best.brawlerId)}
                          fallbackSrc={getBrawlerPortraitFallback(best.brawlerId)}
                          alt={best.brawlerName}
                          className="w-12 h-12 rounded-lg border-2 border-[#10B981]"
                          style={{ clipPath: 'polygon(15% 0, 100% 0, 100% 85%, 85% 100%, 0 100%, 0 15%)' }}
                        />
                        <span className="absolute -top-1 -right-1 text-[10px] bg-[#10B981] text-black shadow-[0_0_8px_#10B981] rounded-full w-5 h-5 flex items-center justify-center font-black">1</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-['Lilita_One'] text-base text-white leading-none drop-shadow-md">{best.brawlerName}</p>
                        <div className="flex items-center text-[11px] mt-1 bg-black/30 rounded-md px-1.5 py-0.5 inline-block border border-white/5">
                          <span className={`font-black tracking-wider drop-shadow-sm ${overallWinRateColor(best.winRate)}`}>{best.winRate.toFixed(1)}%</span>
                          <ConfidenceBadge total={best.gamesPlayed} className="mx-1" />
                          <span className="text-slate-400 font-medium">{best.gamesPlayed}g</span>
                        </div>
                      </div>
                      {/* Best trio teammates */}
                      {best.bestTrio && (
                        <div className="flex flex-col items-end gap-1">
                          <div className="flex items-center gap-1">
                            {best.bestTrio.brawlers
                              .filter(b => b.id !== best.brawlerId)
                              .map(b => (
                                <BrawlImg
                                  key={b.id}
                                  src={getBrawlerPortraitUrl(b.id)}
                                  fallbackSrc={getBrawlerPortraitFallback(b.id)}
                                  alt={b.name}
                                  className="w-6 h-6 rounded-md ring-1 ring-white/20 opacity-80"
                                />
                              ))
                            }
                          </div>
                          <span className="text-[9px] font-black tracking-wider text-[#00E3FF] drop-shadow-[0_0_5px_rgba(0,227,255,0.5)]">
                            {best.bestTrio.winRate.toFixed(0)}% SYN
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Remaining picks (2nd and 3rd) */}
              {top3.length > 1 && (
                <div className="bg-[#0A0E1A] px-3 py-2.5 flex gap-2 border-t border-[#1E293B]">
                  {top3.slice(1).map((rec, index) => (
                    <div key={rec.brawlerId} className="flex items-center gap-2 flex-1 bg-white/[0.03] hover:bg-white/[0.08] transition-colors rounded-lg px-2.5 py-2 border border-white/5">
                      <div className="relative">
                        <BrawlImg
                          src={getBrawlerPortraitUrl(rec.brawlerId)}
                          fallbackSrc={getBrawlerPortraitFallback(rec.brawlerId)}
                          alt={rec.brawlerName}
                          className="w-8 h-8 rounded-md flex-shrink-0"
                          style={{ clipPath: 'polygon(15% 0, 100% 0, 100% 85%, 85% 100%, 0 100%, 0 15%)' }}
                        />
                        <span className="absolute -top-1 -right-1 text-[8px] bg-[#1E293B] text-white border border-white/20 rounded-full w-4 h-4 flex items-center justify-center font-black">
                          {index + 2}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <p className="font-['Lilita_One'] text-[11px] text-slate-300 truncate">{rec.brawlerName}</p>
                        <p className="text-[10px] font-medium tracking-wide">
                          <span className={`${overallWinRateColor(rec.winRate)}`}>{rec.winRate.toFixed(1)}%</span>
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

function overallWinRateColor(wr: number) {
  if (wr >= 60) return 'text-green-400 drop-shadow-[0_0_5px_rgba(34,197,94,0.6)]'
  if (wr >= 50) return 'text-[#FFC91B]'
  return 'text-red-400'
}
