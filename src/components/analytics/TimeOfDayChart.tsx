'use client'

import { useState, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { InfoTooltip } from '@/components/ui/InfoTooltip'

interface HourData {
  hour: number // 0-23
  wins: number
  total: number
  winRate: number
}

interface Props {
  data: HourData[]
}

function padHour(h: number): string {
  return String(h).padStart(2, '0')
}

function barColor(wr: number, total: number): string {
  if (total === 0) return 'bg-slate-700'
  if (wr >= 60) return 'bg-green-500'
  if (wr >= 45) return 'bg-[#FFC91B]'
  return 'bg-red-500'
}

function barGlow(wr: number, total: number): string {
  if (total === 0) return ''
  if (wr >= 60) return 'shadow-[0_0_6px_rgba(74,222,128,0.4)]'
  if (wr >= 45) return 'shadow-[0_0_6px_rgba(255,201,27,0.3)]'
  return 'shadow-[0_0_6px_rgba(248,113,113,0.4)]'
}

export function TimeOfDayChart({ data }: Props) {
  const t = useTranslations('advancedAnalytics')
  const [hovered, setHovered] = useState<number | null>(null)

  const currentHour = new Date().getHours()

  // Build a full 0-23 array, filling any missing hours with zero data
  const hours = useMemo(() => {
    const map = new Map<number, HourData>()
    for (const d of data) map.set(d.hour, d)

    return Array.from({ length: 24 }, (_, i) =>
      map.get(i) ?? { hour: i, wins: 0, total: 0, winRate: 0 },
    )
  }, [data])

  // Best / worst hours (only from hours with >= 3 games)
  const { best, worst } = useMemo(() => {
    const qualified = hours.filter(h => h.total >= 3)
    if (qualified.length === 0) return { best: null, worst: null }

    let bestH = qualified[0]
    let worstH = qualified[0]
    for (const h of qualified) {
      if (h.winRate > bestH.winRate) bestH = h
      if (h.winRate < worstH.winRate) worstH = h
    }
    return { best: bestH, worst: worstH }
  }, [hours])

  const maxWR = 100 // bars scale to 100%

  return (
    <div className="brawl-card-dark p-5 md:p-6 border-[#090E17]">
      {/* Title */}
      <h3 className="font-['Lilita_One'] text-lg text-white mb-5 flex items-center gap-2">
        <span className="text-xl">&#x1F550;</span> {t('timeTitle')}
        <InfoTooltip className="ml-1.5" text={t('tipTimeOfDay')} />
      </h3>

      {/* Bar chart */}
      <div className="relative">
        {/* Horizontal grid lines */}
        <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
          {[100, 75, 50, 25, 0].map(pct => (
            <div key={pct} className="flex items-center gap-1.5">
              <span className="text-[9px] text-slate-600 w-7 text-right tabular-nums font-['Lilita_One']">
                {pct}%
              </span>
              <div className="flex-1 border-t border-white/[0.04]" />
            </div>
          ))}
        </div>

        {/* Bars container */}
        <div className="flex items-end gap-[2px] sm:gap-1 pl-9 relative" style={{ height: 180 }}>
          {hours.map(h => {
            const heightPct = h.total === 0 ? 2 : Math.max((h.winRate / maxWR) * 100, 3)
            const isCurrentHour = h.hour === currentHour
            const isHovered = hovered === h.hour

            return (
              <div
                key={h.hour}
                className="flex-1 flex flex-col items-center justify-end h-full relative group"
                onMouseEnter={() => setHovered(h.hour)}
                onMouseLeave={() => setHovered(null)}
              >
                {/* Tooltip */}
                {isHovered && (
                  <div className="absolute bottom-full mb-2 z-20 pointer-events-none">
                    <div className="bg-[#0B1120] border border-white/10 rounded-lg px-2.5 py-1.5 text-center whitespace-nowrap shadow-xl">
                      <p className="font-['Lilita_One'] text-xs text-white">
                        {padHour(h.hour)}:00
                      </p>
                      <p className={`font-['Lilita_One'] text-sm tabular-nums ${
                        h.total === 0
                          ? 'text-slate-500'
                          : h.winRate >= 60
                            ? 'text-green-400'
                            : h.winRate >= 45
                              ? 'text-[#FFC91B]'
                              : 'text-red-400'
                      }`}>
                        {h.total === 0 ? '--' : `${h.winRate.toFixed(1)}%`}
                      </p>
                      <p className="text-[10px] text-slate-500">
                        {h.total} {t('games')}
                      </p>
                    </div>
                  </div>
                )}

                {/* Bar */}
                <div
                  className={`
                    w-full rounded-t-sm transition-all duration-300
                    ${barColor(h.winRate, h.total)}
                    ${isHovered ? 'opacity-100 brightness-125' : 'opacity-80'}
                    ${isHovered ? barGlow(h.winRate, h.total) : ''}
                    ${isCurrentHour ? 'ring-1 ring-[#4EC0FA] ring-offset-1 ring-offset-[#090E17]' : ''}
                  `}
                  style={{ height: `${heightPct}%`, minHeight: 3 }}
                />

                {/* Hour label */}
                <span className={`text-[9px] sm:text-[10px] mt-1.5 tabular-nums font-['Lilita_One'] ${
                  isCurrentHour ? 'text-[#4EC0FA]' : 'text-slate-600'
                }`}>
                  {h.hour}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Best / Worst summary */}
      {(best || worst) && (
        <div className="mt-4 pt-3 border-t border-white/[0.04] flex flex-col sm:flex-row gap-2 sm:gap-6">
          {best && (
            <p className="text-xs text-slate-400">
              <span className="text-green-400 font-['Lilita_One']">{t('bestHour')}:</span>{' '}
              <span className="font-['Lilita_One'] text-white">
                {padHour(best.hour)}:00
              </span>{' '}
              <span className="font-['Lilita_One'] text-green-400 tabular-nums">
                ({best.winRate.toFixed(1)}%)
              </span>
            </p>
          )}
          {worst && (
            <p className="text-xs text-slate-400">
              <span className="text-red-400 font-['Lilita_One']">{t('worstHour')}:</span>{' '}
              <span className="font-['Lilita_One'] text-white">
                {padHour(worst.hour)}:00
              </span>{' '}
              <span className="font-['Lilita_One'] text-red-400 tabular-nums">
                ({worst.winRate.toFixed(1)}%)
              </span>
            </p>
          )}
        </div>
      )}
    </div>
  )
}
