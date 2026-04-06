'use client'

import { useState, useEffect } from 'react'
import { getBrawlerPortraitUrl, getMapImageUrl } from '@/lib/utils'
import type { PlayNowRecommendation } from '@/lib/analytics/types'

function wrColor(wr: number): string {
  if (wr >= 60) return 'text-green-400'
  if (wr >= 45) return 'text-[#FFC91B]'
  return 'text-red-400'
}

function computeTimeLeft(endTimeStr: string): string {
  const diff = new Date(endTimeStr).getTime() - Date.now()
  if (diff <= 0) return 'Ended'
  const totalMin = Math.floor(diff / 60_000)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

const MODE_ICONS: Record<string, string> = {
  brawlBall: '⚽', gemGrab: '💎', showdown: '💀', duoShowdown: '💀', soloShowdown: '💀',
  heist: '🔒', bounty: '⭐', siege: '🤖', hotZone: '🔥',
  knockout: '🥊', wipeout: '💥', payload: '🚚', paintBrawl: '🎨',
  trophyThieves: '🏆', duels: '⚔️', ranked: '🏅',
}

interface Props {
  recommendations: PlayNowRecommendation[]
}

export function PlayNowDashboard({ recommendations }: Props) {
  const [, setTick] = useState(0)
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 60_000)
    return () => clearInterval(interval)
  }, [])

  if (recommendations.length === 0) {
    return (
      <div className="brawl-card-dark p-5 md:p-6 border-[#090E17]">
        <h3 className="font-['Lilita_One'] text-lg text-white mb-4 flex items-center gap-2">
          <span className="text-xl">🎯</span> Play Now
        </h3>
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <span className="text-4xl mb-3">🎮</span>
          <p className="font-['Lilita_One'] text-sm text-slate-400">
            Play some more games to unlock recommendations!
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="brawl-card-dark p-5 md:p-6 border-[#090E17]">
      <h3 className="font-['Lilita_One'] text-lg text-white mb-4 flex items-center gap-2">
        <span className="text-xl">🎯</span> Play Now
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {recommendations.map(slot => {
          const timeLeft = computeTimeLeft(slot.slotEndTime)
          const modeIcon = MODE_ICONS[slot.mode] || '🎮'
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

                {/* Top-left: mode + time badge */}
                <div className="absolute top-2 left-2 flex items-center gap-1.5">
                  <span className="text-sm bg-black/50 backdrop-blur-sm rounded-lg px-2 py-0.5 border border-white/10">
                    {modeIcon}
                  </span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full backdrop-blur-sm border ${
                    timeLeft === 'Ended'
                      ? 'bg-red-500/30 text-red-300 border-red-500/30'
                      : 'bg-black/40 text-[#4EC0FA] border-[#4EC0FA]/20'
                  }`}>
                    {timeLeft}
                  </span>
                </div>

                {/* Bottom of map area: map name + best pick hero */}
                <div className="absolute bottom-0 left-0 right-0 px-3 pb-2.5">
                  <p className="font-['Lilita_One'] text-lg text-white text-stroke-brawl leading-tight">
                    {slot.map}
                  </p>
                  {best && (
                    <div className="flex items-center gap-2 mt-1.5">
                      <div className="relative">
                        <img
                          src={getBrawlerPortraitUrl(best.brawlerId)}
                          alt={best.brawlerName}
                          className="w-10 h-10 rounded-lg border-2 border-[#FFC91B]/60"
                          loading="lazy"
                        />
                        <span className="absolute -top-1 -right-1 text-[9px] bg-[#FFC91B] text-[#121A2F] rounded-full w-4 h-4 flex items-center justify-center font-black">⭐</span>
                      </div>
                      <div>
                        <p className="font-['Lilita_One'] text-sm text-white leading-none">{best.brawlerName}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          <span className={`font-bold ${wrColor(best.winRate)}`}>{best.winRate.toFixed(1)}%</span>
                          <span className="text-slate-500 ml-1">· {best.gamesPlayed}g</span>
                          {best.bestTeammateBrawler && (
                            <span className="text-slate-500"> · with <span className="text-slate-300">{best.bestTeammateBrawler}</span></span>
                          )}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Remaining picks (2nd and 3rd) */}
              {top3.length > 1 && (
                <div className="bg-[#0A0E1A] px-3 py-2 flex gap-2">
                  {top3.slice(1).map((rec, i) => (
                    <div key={rec.brawlerId} className="flex items-center gap-2 flex-1 bg-white/[0.04] rounded-lg px-2.5 py-1.5">
                      <img
                        src={getBrawlerPortraitUrl(rec.brawlerId)}
                        alt={rec.brawlerName}
                        className="w-7 h-7 rounded-md flex-shrink-0"
                        loading="lazy"
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
