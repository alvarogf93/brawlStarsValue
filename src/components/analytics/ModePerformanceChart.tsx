'use client'

import { useTranslations } from 'next-intl'
import { getGameModeImageUrl, wrColor } from '@/lib/utils'
import { MODE_DISPLAY_NAMES } from '@/lib/constants'
import type { ModePerformance } from '@/lib/analytics/types'

interface Props {
  data: ModePerformance[]
}

export function ModePerformanceChart({ data }: Props) {
  const t = useTranslations('advancedAnalytics')

  if (data.length === 0) return null

  const sorted = [...data].sort((a, b) => b.winRate - a.winRate)

  return (
    <div className="brawl-card-dark p-5 md:p-6 border-[#090E17]">
      <h3 className="font-['Lilita_One'] text-lg text-white mb-4 flex items-center gap-2">
        <span className="text-xl">{'\uD83C\uDFAE'}</span> {t('modePerformance')}
      </h3>

      <div className="space-y-2">
        {sorted.map(m => {
          const modeIconUrl = getGameModeImageUrl(m.mode)
          const barWidth = Math.max(10, Math.min(100, m.winRate))

          return (
            <div key={m.mode} className="brawl-row rounded-xl px-4 py-3 flex items-center gap-3">
              {/* Mode icon */}
              {modeIconUrl && (
                <img src={modeIconUrl} alt={m.mode} className="w-7 h-7 flex-shrink-0" width={28} height={28} />
              )}

              {/* Mode name + games */}
              <div className="w-24 flex-shrink-0">
                <p className="font-['Lilita_One'] text-xs text-white truncate">
                  {MODE_DISPLAY_NAMES[m.mode] ?? m.mode}
                </p>
                <p className="font-['Lilita_One'] text-[10px] text-slate-500">
                  {m.total} games
                </p>
              </div>

              {/* Bar */}
              <div className="flex-1 h-5 bg-white/5 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${barWidth}%`,
                    background: m.winRate >= 55
                      ? 'linear-gradient(90deg, #22c55e, #4ade80)'
                      : m.winRate >= 45
                        ? 'linear-gradient(90deg, #FFC91B, #FBBF24)'
                        : 'linear-gradient(90deg, #ef4444, #f87171)',
                  }}
                />
              </div>

              {/* WR value */}
              <span className={`font-['Lilita_One'] text-sm tabular-nums w-14 text-right ${wrColor(m.winRate)}`}>
                {m.winRate.toFixed(1)}%
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
