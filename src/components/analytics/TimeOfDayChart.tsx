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

function wrStyle(wr: number, total: number) {
  if (total === 0) return { fill: 'bg-slate-700/30', border: 'border-slate-600/20', glow: '' }
  if (wr >= 60) return { fill: 'bg-gradient-to-t from-[#0A0E1A] to-green-500/90', border: 'border-green-400', glow: 'shadow-[0_0_12px_rgba(74,222,128,0.5)]' }
  if (wr >= 45) return { fill: 'bg-gradient-to-t from-[#0A0E1A] to-[#FFC91B]/90', border: 'border-[#FFC91B]', glow: 'shadow-[0_0_12px_rgba(255,201,27,0.5)]' }
  return { fill: 'bg-gradient-to-t from-[#0A0E1A] to-red-500/90', border: 'border-red-500', glow: 'shadow-[0_0_12px_rgba(239,68,68,0.5)]' }
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
    <div className="relative overflow-hidden bg-[#090E17]/80 backdrop-blur-md rounded-xl p-5 md:p-6 border-b-[4px] border-[#06090E] shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_8px_16px_rgba(0,0,0,0.6)] group/card">
      {/* Background scanlines grid */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:20px_20px] pointer-events-none mix-blend-screen opacity-50" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#090E17] via-transparent to-transparent pointer-events-none" />

      {/* Title */}
      <h3 className="font-['Lilita_One'] text-lg text-white mb-5 flex items-center gap-2 relative z-10 drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]">
        <span className="text-xl drop-shadow-md">⏲️</span> {t('timeTitle')}
        <InfoTooltip className="ml-1.5 opacity-70 hover:opacity-100" text={t('tipTimeOfDay')} />
      </h3>

      {/* Bar chart */}
      <div className="relative z-10">
        {/* Horizontal grid lines */}
        <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
          {[100, 75, 50, 25, 0].map(pct => (
            <div key={pct} className="flex items-center gap-1.5 opacity-50">
              <span className="text-[9px] text-slate-500 w-7 text-right tabular-nums font-['Lilita_One'] tracking-wide">
                {pct}%
              </span>
              <div className="flex-1 border-t border-dashed border-white/10" />
            </div>
          ))}
        </div>

        {/* Bars container */}
        <div className="flex items-end gap-[1px] sm:gap-1.5 pl-9 relative" style={{ height: 180 }}>
          {hours.map(h => {
            const heightPct = h.total === 0 ? 1 : Math.max((h.winRate / maxWR) * 100, 2)
            const isCurrentHour = h.hour === currentHour
            const isHovered = hovered === h.hour
            const styles = wrStyle(h.winRate, h.total)

            return (
              <div
                key={h.hour}
                className="flex-1 flex flex-col items-center justify-end h-full relative group cursor-crosshair"
                onMouseEnter={() => setHovered(h.hour)}
                onMouseLeave={() => setHovered(null)}
              >
                {/* Tooltip */}
                {isHovered && (
                  <div className="absolute bottom-full mb-2 z-30 pointer-events-none">
                    <div className="bg-[#0B1120]/95 backdrop-blur-md border border-white/10 rounded border-l-2 border-l-[#4EC0FA] px-2.5 py-1.5 text-center whitespace-nowrap shadow-xl">
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
                      <p className="text-[10px] text-slate-500 font-bold tracking-widest uppercase">
                        {h.total} {t('games')}
                      </p>
                    </div>
                  </div>
                )}

                {/* Vertical guiding line on hover */}
                {isHovered && <div className="absolute top-0 bottom-6 w-[1px] bg-gradient-to-b from-white/20 to-transparent pointer-events-none" />}

                {/* Bar */}
                <div
                  className={`
                    w-full transition-all duration-300 relative rounded-t-sm
                    border-t-2 ${styles.border} ${styles.fill}
                    ${isHovered ? 'opacity-100 brightness-150' : 'opacity-80'}
                    ${isHovered ? styles.glow : ''}
                  `}
                  style={{ height: `${heightPct}%`, minHeight: 3 }}
                >
                  {/* Current hour flashing dot */}
                  {isCurrentHour && (
                    <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-[#4EC0FA] rounded-full shadow-[0_0_8px_rgba(78,192,250,1)] animate-pulse" />
                  )}
                </div>

                {/* Hour label */}
                <span className={`text-[9px] sm:text-[10px] mt-1.5 tabular-nums font-['Lilita_One'] transition-colors ${
                  isCurrentHour ? 'text-[#4EC0FA] drop-shadow-[0_0_4px_rgba(78,192,250,0.5)]' : isHovered ? 'text-white' : 'text-slate-600'
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
        <div className="mt-4 pt-3 border-t border-white/[0.04] flex flex-col sm:flex-row gap-2 sm:gap-6 relative z-10 bg-black/20 rounded-lg p-3">
          {best && (
            <div className="flex items-center gap-2">
              <span className="text-green-400/80 font-['Lilita_One'] text-xs uppercase tracking-wider">{t('bestHour')}:</span>
              <span className="font-['Lilita_One'] text-white bg-green-500/10 border border-green-500/20 px-2 py-0.5 rounded text-sm">
                {padHour(best.hour)}:00
              </span>
              <span className="font-['Lilita_One'] text-green-400 tabular-nums text-sm drop-shadow-[0_0_3px_rgba(74,222,128,0.5)]">
                {best.winRate.toFixed(1)}%
              </span>
            </div>
          )}
          {worst && (
            <div className="flex items-center gap-2">
              <span className="text-red-400/80 font-['Lilita_One'] text-xs uppercase tracking-wider">{t('worstHour')}:</span>
              <span className="font-['Lilita_One'] text-white bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded text-sm">
                {padHour(worst.hour)}:00
              </span>
              <span className="font-['Lilita_One'] text-red-400 tabular-nums text-sm drop-shadow-[0_0_3px_rgba(248,113,113,0.5)]">
                {worst.winRate.toFixed(1)}%
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

