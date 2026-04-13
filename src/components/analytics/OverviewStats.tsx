'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import type { AdvancedAnalytics } from '@/lib/analytics/types'
import { InfoTooltip } from '@/components/ui/InfoTooltip'
import { ProBadge } from '@/components/analytics/ProBadge'
import { OneShotGif } from '@/components/ui/OneShotGif'

interface Props {
  overview: AdvancedAnalytics['overview']
  proAvgWR?: number | null
}

function formatDuration(seconds: number | null): string {
  if (seconds === null) return '--'
  const m = Math.floor(seconds / 60)
  const s = Math.round(seconds % 60)
  return `${m}m ${s}s`
}

export function OverviewStats({ overview, proAvgWR }: Props) {
  const t = useTranslations('advancedAnalytics')
  const {
    totalBattles,
    overallWinRate,
    totalWins,
    trophyChange,
    starPlayerCount,
    starPlayerRate,
    avgDuration,
    streak,
  } = overview

  // Best Win Streak card animation: when the Amber GIF first
  // becomes visible, schedule the flame emoji to fade in 1s later.
  // The OneShotGif itself handles the play-once-then-freeze logic.
  const flameTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [flameVisible, setFlameVisible] = useState(false)
  useEffect(() => {
    return () => {
      if (flameTimerRef.current) clearTimeout(flameTimerRef.current)
    }
  }, [])
  const handleAmberStart = () => {
    if (flameTimerRef.current) clearTimeout(flameTimerRef.current)
    flameTimerRef.current = setTimeout(() => setFlameVisible(true), 1000)
  }

  const totalLosses = totalBattles - totalWins
  const showStreakBanner = streak.currentCount >= 3 && streak.currentType !== 'none'

  return (
    <div className="space-y-3">
      {/* ── Streak banner (prominent when >= 3) ── */}
      {showStreakBanner && (
        <div
          className={`brawl-card-dark rounded-xl p-4 border ${
            streak.currentType === 'win'
              ? 'border-green-500/30'
              : 'border-red-500/30'
          }`}
          style={{
            background:
              streak.currentType === 'win'
                ? 'linear-gradient(135deg, rgba(74,222,128,0.12) 0%, rgba(34,197,94,0.04) 100%)'
                : 'linear-gradient(135deg, rgba(239,68,68,0.12) 0%, rgba(185,28,28,0.04) 100%)',
          }}
        >
          <div className="flex items-center justify-center gap-3">
            <span className="text-3xl">
              {streak.currentType === 'win' ? '🔥' : '💀'}
            </span>
            <div className="text-center">
              <p
                className={`font-['Lilita_One'] text-2xl ${
                  streak.currentType === 'win' ? 'text-green-400' : 'text-red-400'
                }`}
              >
                {streak.currentType === 'win'
                  ? t('streakWin', { count: streak.currentCount })
                  : t('streakLoss', { count: streak.currentCount })}
              </p>
              <p className="text-[10px] uppercase font-bold text-slate-500">
                {t('currentStreak')}
              </p>
            </div>
            <span className="text-3xl">
              {streak.currentType === 'win' ? '🔥' : '💀'}
            </span>
          </div>
        </div>
      )}

      {/* ── Stats grid ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
        {/* Win Rate */}
        <div className="brawl-card-dark rounded-xl p-4 text-center">
          <p className="font-['Lilita_One'] text-[10px] uppercase tracking-wider text-slate-400 mb-1">
            {t('winRateLabel')}
          </p>
          <p
            className={`font-['Lilita_One'] text-3xl tabular-nums ${
              overallWinRate >= 60
                ? 'text-green-400'
                : overallWinRate >= 45
                  ? 'text-[#FFC91B]'
                  : 'text-red-400'
            }`}
          >
            {overallWinRate.toFixed(1)}%
          </p>
          {proAvgWR != null && (
            <div className="mt-1">
              <ProBadge proValue={proAvgWR} userValue={overallWinRate} total={0} compact />
            </div>
          )}
        </div>

        {/* W/L Record */}
        <div className="brawl-card-dark rounded-xl p-4 text-center">
          <p className="font-['Lilita_One'] text-[10px] uppercase tracking-wider text-slate-400 mb-1">
            {t('record')}
          </p>
          <p className="font-['Lilita_One'] text-2xl tabular-nums">
            <span className="text-green-400">{totalWins}</span>
            <span className="text-slate-600 mx-1">/</span>
            <span className="text-red-400">{totalLosses}</span>
          </p>
        </div>

        {/* Trophy Change */}
        <div className="brawl-card-dark rounded-xl p-4 text-center">
          <p className="font-['Lilita_One'] text-[10px] uppercase tracking-wider text-slate-400 mb-1">
            {t('trophyChange')}
          </p>
          <p
            className={`font-['Lilita_One'] text-2xl tabular-nums ${
              trophyChange > 0
                ? 'text-green-400'
                : trophyChange < 0
                  ? 'text-red-400'
                  : 'text-slate-400'
            }`}
          >
            {trophyChange > 0 ? '+' : ''}
            {trophyChange}
          </p>
        </div>

        {/* Star Player */}
        <div className="brawl-card-dark rounded-xl p-4 text-center">
          <p className="font-['Lilita_One'] text-[10px] uppercase tracking-wider text-slate-400 mb-1 flex items-center justify-center gap-1">
            ⭐ {t('starPlayer')} ({starPlayerCount})
            <InfoTooltip className="ml-1.5" text={t('tipStarPlayer')} />
          </p>
          <p className="font-['Lilita_One'] text-2xl tabular-nums text-[#FFC91B]">
            {starPlayerRate.toFixed(1)}%
          </p>
        </div>

        {/* Avg Duration */}
        <div className="brawl-card-dark rounded-xl p-4 text-center">
          <p className="font-['Lilita_One'] text-[10px] uppercase tracking-wider text-slate-400 mb-1">
            {t('avgDuration')}
          </p>
          <p className="font-['Lilita_One'] text-2xl tabular-nums text-[#4EC0FA]">
            {formatDuration(avgDuration)}
          </p>
        </div>

        {/* Current Streak (compact, shown when < 3 or none) */}
        {!showStreakBanner && (
          <div className="brawl-card-dark rounded-xl p-4 text-center">
            <p className="font-['Lilita_One'] text-[10px] uppercase tracking-wider text-slate-400 mb-1">
              {t('currentStreak')}
            </p>
            <p
              className={`font-['Lilita_One'] text-2xl tabular-nums ${
                streak.currentType === 'win'
                  ? 'text-green-400'
                  : streak.currentType === 'loss'
                    ? 'text-red-400'
                    : 'text-slate-400'
              }`}
            >
              {streak.currentType === 'none' ? '--' : streak.currentCount}
              {streak.currentType === 'win' && ' 🔥'}
              {streak.currentType === 'loss' && ' 💀'}
            </p>
          </div>
        )}

        {/* Longest Win Streak */}
        <div className="brawl-card-dark rounded-xl p-4 text-center">
          <p className="font-['Lilita_One'] text-[10px] uppercase tracking-wider text-slate-400 mb-1">
            {t('bestWinStreak')}
          </p>
          <div className="font-['Lilita_One'] text-2xl tabular-nums text-green-400 inline-flex items-center justify-center gap-2">
            <span>{streak.longestWin}</span>
            <span
              aria-hidden="true"
              className={`transition-opacity duration-700 ${flameVisible ? 'opacity-100' : 'opacity-0'}`}
            >
              🔥
            </span>
            <OneShotGif
              src="/assets/animations/amber_win.gif"
              alt=""
              className="w-12 h-12"
              durationMs={3000}
              onStart={handleAmberStart}
            />
          </div>
        </div>

        {/* Longest Loss Streak */}
        <div className="brawl-card-dark rounded-xl p-4 text-center">
          <p className="font-['Lilita_One'] text-[10px] uppercase tracking-wider text-slate-400 mb-1">
            {t('worstLossStreak')}
          </p>
          <p className="font-['Lilita_One'] text-2xl tabular-nums text-red-400">
            {streak.longestLoss} 💀
          </p>
        </div>
      </div>
    </div>
  )
}
