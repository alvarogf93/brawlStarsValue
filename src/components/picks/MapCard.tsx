'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { getBrawlerPortraitUrl, getBrawlerPortraitFallback, getMapImageUrl, getGameModeImageUrl } from '@/lib/utils'
import { BrawlImg } from '@/components/ui/BrawlImg'
import { ConfidenceBadge } from '@/components/ui/ConfidenceBadge'
import { ChevronDown, ChevronUp } from 'lucide-react'

function wrColor(wr: number): string {
  if (wr >= 60) return 'text-green-400'
  if (wr >= 50) return 'text-[#FFC91B]'
  return 'text-red-400'
}

function barGradient(wr: number): string {
  if (wr >= 60) return 'from-green-500/80 to-green-400/80'
  if (wr >= 50) return 'from-[#FFC91B]/80 to-yellow-300/80'
  return 'from-red-500/80 to-red-400/80'
}

function computeTimeLeft(endTimeStr: string, endedLabel: string): string {
  const diff = new Date(endTimeStr).getTime() - Date.now()
  if (diff <= 0) return endedLabel
  const totalMin = Math.floor(diff / 60_000)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

interface TopBrawler {
  brawlerId: number
  winRate: number
  pickCount: number
}

interface Props {
  mode: string
  map: string
  eventId: number
  endTime: string
  totalBattles: number
  topBrawlers: TopBrawler[]
}

export function MapCard({ mode, map, eventId, endTime, totalBattles, topBrawlers }: Props) {
  const t = useTranslations('picks')
  const [expanded, setExpanded] = useState(false)
  const [, setTick] = useState(0)

  // Update countdown every minute
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 60_000)
    return () => clearInterval(interval)
  }, [])

  const modeIconUrl = getGameModeImageUrl(mode)
  const mapImageUrl = getMapImageUrl(eventId)
  const timeLeft = computeTimeLeft(endTime, t('ended'))
  const visible = expanded ? topBrawlers : topBrawlers.slice(0, 5)
  const hasMore = topBrawlers.length > 5
  const isLimited = totalBattles < 100

  return (
    <div className="brawl-card-dark overflow-hidden border-[#090E17]">
      {/* Map header with background */}
      <div className="relative h-28 overflow-hidden">
        <img
          src={mapImageUrl}
          alt={map}
          className="absolute inset-0 w-full h-full object-cover opacity-50"
          loading="lazy"
          width={400}
          height={112}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0A0E1A] via-[#0A0E1A]/60 to-transparent" />

        {/* Mode + time badge */}
        <div className="absolute top-2.5 left-3 flex items-center gap-1.5">
          {modeIconUrl && (
            <span className="bg-black/50 backdrop-blur-sm rounded-lg p-1 border border-white/10">
              <img src={modeIconUrl} alt={mode} className="w-5 h-5" width={20} height={20} />
            </span>
          )}
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full backdrop-blur-sm border ${
            timeLeft === t('ended')
              ? 'bg-red-500/30 text-red-300 border-red-500/30'
              : 'bg-black/40 text-[#4EC0FA] border-[#4EC0FA]/20'
          }`}>
            {timeLeft}
          </span>
        </div>

        {/* Map name */}
        <div className="absolute bottom-2 left-3 right-3">
          <p className="font-['Lilita_One'] text-lg text-white text-stroke-brawl leading-tight">{map}</p>
          {isLimited && (
            <p className="text-[9px] text-amber-400/80 mt-0.5">{t('limitedData')}</p>
          )}
        </div>
      </div>

      {/* Brawler rankings */}
      <div className="p-3 space-y-1">
        {visible.length === 0 ? (
          <p className="text-center text-sm text-slate-500 py-4">{t('noData')}</p>
        ) : (
          visible.map((b, i) => (
            <div key={b.brawlerId} className="flex items-center gap-2 brawl-row rounded-lg px-2.5 py-1.5">
              {/* Rank */}
              <span className="font-['Lilita_One'] text-xs text-slate-500 w-5 text-right">
                {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`}
              </span>

              {/* Portrait */}
              <BrawlImg
                src={getBrawlerPortraitUrl(b.brawlerId)}
                fallbackSrc={getBrawlerPortraitFallback(b.brawlerId)}
                alt={`Brawler ${b.brawlerId}`}
                className="w-7 h-7 rounded-md flex-shrink-0"
              />

              {/* Win rate bar */}
              <div className="flex-1 min-w-0">
                <div className="h-2 bg-white/[0.06] rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full bg-gradient-to-r ${barGradient(b.winRate)}`}
                    style={{ width: `${Math.min(b.winRate, 100)}%` }}
                  />
                </div>
              </div>

              {/* Win rate + confidence */}
              <ConfidenceBadge total={b.pickCount} className="mr-0.5" />
              <span className={`font-['Lilita_One'] text-sm tabular-nums w-14 text-right ${wrColor(b.winRate)}`}>
                {b.winRate}%
              </span>
            </div>
          ))
        )}

        {/* Expand/collapse */}
        {hasMore && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-full flex items-center justify-center gap-1 text-[11px] font-bold text-slate-500 hover:text-[#FFC91B] transition-colors py-1.5"
          >
            {expanded ? (
              <><ChevronUp className="w-3 h-3" /> {t('showLess')}</>
            ) : (
              <><ChevronDown className="w-3 h-3" /> {t('showMore')}</>
            )}
          </button>
        )}
      </div>
    </div>
  )
}
