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

  const statCardClass = "relative overflow-hidden bg-[#090E17]/80 backdrop-blur-md rounded-xl p-5 text-center border-b-[4px] border-b-[#06090e] shadow-[0_8px_16px_rgba(0,0,0,0.6)] transition-transform hover:-translate-y-1 hover:shadow-[0_12px_20px_rgba(0,0,0,0.8)] hover:border-b-[#1E293B] group"

  return (
    <div className="space-y-4">
      {/* ── Streak banner (prominent when >= 3) ── */}
      {showStreakBanner && (
        <div
          className={`relative overflow-hidden rounded-xl p-5 border-t border-x border-b-[4px] shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_8px_20px_rgba(0,0,0,0.6)] ${
            streak.currentType === 'win'
              ? 'border-green-500/40 border-b-green-700/60'
              : 'border-red-500/40 border-b-red-700/60'
          }`}
          style={{
            background:
              streak.currentType === 'win'
                ? 'linear-gradient(135deg, rgba(34,197,94,0.15) 0%, rgba(9,14,23,0.95) 100%)'
                : 'linear-gradient(135deg, rgba(239,68,68,0.15) 0%, rgba(9,14,23,0.95) 100%)',
          }}
        >
          {/* Scanline overlay */}
          <div className="absolute inset-0 opacity-[0.03] bg-[linear-gradient(transparent_50%,#000_50%)] bg-[length:100%_4px] pointer-events-none" />
          
          <div className="relative z-10 flex items-center justify-center gap-4">
            <span className="text-4xl drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]">
              {streak.currentType === 'win' ? '🔥' : '💀'}
            </span>
            <div className="text-center">
              <p
                className={`font-['Lilita_One'] text-3xl tracking-wide ${
                  streak.currentType === 'win' ? 'text-green-400 drop-shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'text-red-400 drop-shadow-[0_0_8px_rgba(239,68,68,0.6)]'
                }`}
              >
                {streak.currentType === 'win'
                  ? t('streakWin', { count: streak.currentCount })
                  : t('streakLoss', { count: streak.currentCount })}
              </p>
              <p className="text-[11px] uppercase font-bold text-white/50 tracking-widest mt-1">
                {t('currentStreak')}
              </p>
            </div>
            <span className="text-4xl drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]">
              {streak.currentType === 'win' ? '🔥' : '💀'}
            </span>
          </div>
        </div>
      )}

      {/* ── Stats grid (Jumbotron Style) ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Win Rate */}
        <div className={statCardClass}>
          {overallWinRate >= 60 && <div className="absolute inset-0 bg-green-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />}
          <p className="font-['Lilita_One'] text-[11px] uppercase tracking-widest text-[#FFC91B]/70 mb-2">
            {t('winRateLabel')}
          </p>
          <p
            className={`font-['Lilita_One'] text-4xl tabular-nums tracking-wide ${
              overallWinRate >= 60
                ? 'text-green-400 drop-shadow-[0_0_10px_rgba(34,197,94,0.4)]'
                : overallWinRate >= 45
                  ? 'text-[#FFC91B] drop-shadow-[0_0_10px_rgba(255,201,27,0.4)]'
                  : 'text-red-400 drop-shadow-[0_0_10px_rgba(239,68,68,0.4)]'
            }`}
          >
            {overallWinRate.toFixed(1)}%
          </p>
          {proAvgWR != null && (
            <div className="mt-2.5 flex justify-center opacity-90 group-hover:opacity-100 transition-opacity">
              <ProBadge proValue={proAvgWR} userValue={overallWinRate} total={0} compact />
            </div>
          )}
        </div>

        {/* W/L Record */}
        <div className={statCardClass}>
          <p className="font-['Lilita_One'] text-[11px] uppercase tracking-widest text-slate-400 mb-2">
            {t('record')}
          </p>
          <p className="font-['Lilita_One'] text-3xl md:text-4xl tabular-nums tracking-wide">
            <span className="text-green-400 drop-shadow-[0_0_8px_rgba(34,197,94,0.3)]">{totalWins}</span>
            <span className="text-slate-600 mx-1.5 font-sans font-light">/</span>
            <span className="text-red-400 drop-shadow-[0_0_8px_rgba(239,68,68,0.3)]">{totalLosses}</span>
          </p>
        </div>

        {/* Trophy Change */}
        <div className={statCardClass}>
          <p className="font-['Lilita_One'] text-[11px] uppercase tracking-widest text-slate-400 mb-2">
            {t('trophyChange')}
          </p>
          <p
            className={`font-['Lilita_One'] text-3xl md:text-4xl tabular-nums tracking-wide ${
              trophyChange > 0
                ? 'text-green-400 drop-shadow-[0_0_10px_rgba(34,197,94,0.4)]'
                : trophyChange < 0
                  ? 'text-red-400 drop-shadow-[0_0_10px_rgba(239,68,68,0.4)]'
                  : 'text-slate-400'
            }`}
          >
            {trophyChange > 0 ? '+' : ''}
            {trophyChange}
          </p>
        </div>

        {/* Star Player */}
        <div className={statCardClass}>
          <p className="font-['Lilita_One'] text-[11px] uppercase tracking-widest text-slate-400 mb-2 flex items-center justify-center gap-1.5">
            <span className="drop-shadow-[0_0_4px_rgba(255,201,27,0.8)]">⭐</span> {t('starPlayer')} ({starPlayerCount})
            <InfoTooltip className="ml-1 opacity-70 hover:opacity-100" text={t('tipStarPlayer')} />
          </p>
          <p className="font-['Lilita_One'] text-3xl md:text-4xl tabular-nums text-[#FFC91B] drop-shadow-[0_0_10px_rgba(255,201,27,0.3)]">
            {starPlayerRate.toFixed(1)}%
          </p>
        </div>

        {/* Avg Duration */}
        <div className={statCardClass}>
          <p className="font-['Lilita_One'] text-[11px] uppercase tracking-widest text-slate-400 mb-2">
            {t('avgDuration')}
          </p>
          <p className="font-['Lilita_One'] text-3xl tabular-nums text-[#00E3FF] drop-shadow-[0_0_10px_rgba(0,227,255,0.3)]">
            {formatDuration(avgDuration)}
          </p>
        </div>

        {/* Current Streak (compact, shown when < 3 or none) */}
        {!showStreakBanner && (
          <div className={statCardClass}>
            <p className="font-['Lilita_One'] text-[11px] uppercase tracking-widest text-slate-400 mb-2">
              {t('currentStreak')}
            </p>
            <p
              className={`font-['Lilita_One'] text-3xl tabular-nums tracking-wide ${
                streak.currentType === 'win'
                  ? 'text-green-400 drop-shadow-[0_0_8px_rgba(34,197,94,0.4)]'
                  : streak.currentType === 'loss'
                    ? 'text-red-400 drop-shadow-[0_0_8px_rgba(239,68,68,0.4)]'
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
        <div className={statCardClass}>
          <div className="absolute inset-0 bg-gradient-to-t from-green-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
          <p className="font-['Lilita_One'] text-[11px] uppercase tracking-widest text-green-400/80 mb-2">
            {t('bestWinStreak')}
          </p>
          <div className="font-['Lilita_One'] text-3xl md:text-4xl tabular-nums text-green-400 drop-shadow-[0_0_10px_rgba(34,197,94,0.4)] inline-flex items-center justify-center gap-2">
            <span>{streak.longestWin}</span>
            <span
              aria-hidden="true"
              className={`transition-opacity duration-700 ${flameVisible ? 'opacity-100 drop-shadow-[0_0_8px_rgba(255,165,0,0.8)]' : 'opacity-0'}`}
            >
              🔥
            </span>
            <OneShotGif
              src="/assets/animations/amber_win.gif"
              alt=""
              className="w-12 h-12"
              durationMs={6000}
              onStart={handleAmberStart}
              mediaStyle={{
                width: '4rem',
                height: '5rem',
                marginTop: '-75%',
                marginLeft: '-45%',
              }}
              frozenStyleOverride={{ width: '3rem' }}
            />
          </div>
        </div>

        {/* Longest Loss Streak */}
        <div className={statCardClass}>
          <div className="absolute inset-0 bg-gradient-to-t from-red-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
          <p className="font-['Lilita_One'] text-[11px] uppercase tracking-widest text-red-400/80 mb-2">
            {t('worstLossStreak')}
          </p>
          <p className="font-['Lilita_One'] text-3xl tabular-nums text-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.4)]">
            {streak.longestLoss} <span className="opacity-80">💀</span>
          </p>
        </div>
      </div>
    </div>
  )
}
