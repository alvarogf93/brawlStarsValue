'use client'

import { useTranslations } from 'next-intl'
import type { AdvancedAnalytics } from '@/lib/analytics/types'
import { InfoTooltip } from '@/components/ui/InfoTooltip'
import { ProBadge } from '@/components/analytics/ProBadge'

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
          <p className="text-[10px] uppercase font-bold text-slate-500 mt-1">
            {t('winRateLabel')}
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
            {t('record')}
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
            {t('trophyChange')}
          </p>
        </div>

        {/* Star Player */}
        <div className="brawl-card-dark rounded-xl p-4 text-center">
          <p className="font-['Lilita_One'] text-2xl tabular-nums text-[#FFC91B]">
            {starPlayerRate.toFixed(1)}%
          </p>
          <p className="text-[10px] uppercase font-bold text-slate-500 mt-1 flex items-center justify-center gap-1">
            ⭐ {t('starPlayer')} ({starPlayerCount})
            <InfoTooltip className="ml-1.5" text={t('tipStarPlayer')} />
          </p>
        </div>

        {/* Avg Duration */}
        <div className="brawl-card-dark rounded-xl p-4 text-center">
          <p className="font-['Lilita_One'] text-2xl tabular-nums text-[#4EC0FA]">
            {formatDuration(avgDuration)}
          </p>
          <p className="text-[10px] uppercase font-bold text-slate-500 mt-1">
            {t('avgDuration')}
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
              {t('currentStreak')}
            </p>
          </div>
        )}

        {/* Longest Win Streak */}
        <div className="brawl-card-dark rounded-xl p-4 text-center">
          <p className="font-['Lilita_One'] text-2xl tabular-nums text-green-400">
            {streak.longestWin} 🔥
          </p>
          <p className="text-[10px] uppercase font-bold text-slate-500 mt-1">
            {t('bestWinStreak')}
          </p>
        </div>

        {/* Longest Loss Streak */}
        <div className="brawl-card-dark rounded-xl p-4 text-center">
          <p className="font-['Lilita_One'] text-2xl tabular-nums text-red-400">
            {streak.longestLoss} 💀
          </p>
          <p className="text-[10px] uppercase font-bold text-slate-500 mt-1">
            {t('worstLossStreak')}
          </p>
        </div>
      </div>
    </div>
  )
}
