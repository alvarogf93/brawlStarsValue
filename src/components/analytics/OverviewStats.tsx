'use client'

import type { AdvancedAnalytics } from '@/lib/analytics/types'
import { InfoTooltip } from '@/components/ui/InfoTooltip'

interface Props {
  overview: AdvancedAnalytics['overview']
}

function formatDuration(seconds: number | null): string {
  if (seconds === null) return '--'
  const m = Math.floor(seconds / 60)
  const s = Math.round(seconds % 60)
  return `${m}m ${s}s`
}

export function OverviewStats({ overview }: Props) {
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
                {streak.currentCount}{' '}
                {streak.currentType === 'win' ? 'Win' : 'Loss'} Streak
              </p>
              <p className="text-[10px] uppercase font-bold text-slate-500">
                Current streak
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
          <p className="text-[10px] uppercase font-bold text-slate-500 mt-1">
            Win Rate
          </p>
        </div>

        {/* W/L Record */}
        <div className="brawl-card-dark rounded-xl p-4 text-center">
          <p className="font-['Lilita_One'] text-2xl tabular-nums">
            <span className="text-green-400">{totalWins}</span>
            <span className="text-slate-600 mx-1">/</span>
            <span className="text-red-400">{totalLosses}</span>
          </p>
          <p className="text-[10px] uppercase font-bold text-slate-500 mt-1">
            W / L
          </p>
        </div>

        {/* Trophy Change */}
        <div className="brawl-card-dark rounded-xl p-4 text-center">
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
          <p className="text-[10px] uppercase font-bold text-slate-500 mt-1">
            Trophies
          </p>
        </div>

        {/* Star Player */}
        <div className="brawl-card-dark rounded-xl p-4 text-center">
          <p className="font-['Lilita_One'] text-2xl tabular-nums text-[#FFC91B]">
            {starPlayerRate.toFixed(1)}%
          </p>
          <p className="text-[10px] uppercase font-bold text-slate-500 mt-1 flex items-center justify-center gap-1">
            ⭐ Star Player ({starPlayerCount})
            <InfoTooltip className="ml-1.5" text="Star Player rate shows how often you were the MVP of the match. Higher = you're carrying your team." />
          </p>
        </div>

        {/* Avg Duration */}
        <div className="brawl-card-dark rounded-xl p-4 text-center">
          <p className="font-['Lilita_One'] text-2xl tabular-nums text-[#4EC0FA]">
            {formatDuration(avgDuration)}
          </p>
          <p className="text-[10px] uppercase font-bold text-slate-500 mt-1">
            Avg Duration
          </p>
        </div>

        {/* Current Streak (compact, shown when < 3 or none) */}
        {!showStreakBanner && (
          <div className="brawl-card-dark rounded-xl p-4 text-center">
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
            <p className="text-[10px] uppercase font-bold text-slate-500 mt-1">
              Current Streak
            </p>
          </div>
        )}

        {/* Longest Win Streak */}
        <div className="brawl-card-dark rounded-xl p-4 text-center">
          <p className="font-['Lilita_One'] text-2xl tabular-nums text-green-400">
            {streak.longestWin} 🔥
          </p>
          <p className="text-[10px] uppercase font-bold text-slate-500 mt-1">
            Best Win Streak
          </p>
        </div>

        {/* Longest Loss Streak */}
        <div className="brawl-card-dark rounded-xl p-4 text-center">
          <p className="font-['Lilita_One'] text-2xl tabular-nums text-red-400">
            {streak.longestLoss} 💀
          </p>
          <p className="text-[10px] uppercase font-bold text-slate-500 mt-1">
            Worst Loss Streak
          </p>
        </div>
      </div>
    </div>
  )
}
