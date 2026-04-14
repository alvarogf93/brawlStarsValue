'use client'

import { useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { InfoTooltip } from '@/components/ui/InfoTooltip'
import type { WeeklyPattern } from '@/lib/analytics/types'

interface Props {
  data: WeeklyPattern[]
}

function wrColor(wr: number): string {
  if (wr >= 60) return 'text-green-400 drop-shadow-[0_0_5px_rgba(74,222,128,0.5)]'
  if (wr >= 45) return 'text-[#FFC91B] drop-shadow-[0_0_5px_rgba(255,201,27,0.5)]'
  return 'text-red-400 drop-shadow-[0_0_5px_rgba(248,113,113,0.5)]'
}

function wrStyle(wr: number, total: number) {
  if (total === 0) return { fill: 'bg-slate-700/30', border: 'border-slate-600/20', glow: '' }
  if (wr >= 60) return { fill: 'bg-gradient-to-t from-[#0A0E1A] to-green-500/90', border: 'border-green-400', glow: 'shadow-[0_0_12px_rgba(74,222,128,0.5)]' }
  if (wr >= 45) return { fill: 'bg-gradient-to-t from-[#0A0E1A] to-[#FFC91B]/90', border: 'border-[#FFC91B]', glow: 'shadow-[0_0_12px_rgba(255,201,27,0.5)]' }
  return { fill: 'bg-gradient-to-t from-[#0A0E1A] to-red-500/90', border: 'border-red-500', glow: 'shadow-[0_0_12px_rgba(239,68,68,0.5)]' }
}

export function WeeklyPatternChart({ data }: Props) {
  const t = useTranslations('advancedAnalytics')
  const [hovered, setHovered] = useState<number | null>(null)

  const filtered = data.filter(d => d.total > 0)
  const { best, worst } = useMemo(() => {
    if (filtered.length === 0) return { best: null, worst: null }
    const sorted = [...filtered].sort((a, b) => b.winRate - a.winRate)
    return { best: sorted[0], worst: sorted[sorted.length - 1] }
  }, [filtered])

  if (filtered.length === 0) return null

  const today = new Date().getDay()

  return (
    <div className="relative overflow-hidden bg-[#090E17]/80 backdrop-blur-md rounded-xl p-5 md:p-6 border-b-[4px] border-[#06090E] shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_8px_16px_rgba(0,0,0,0.6)] group/card">
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:15px_15px] pointer-events-none mix-blend-screen opacity-50" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#090E17] via-transparent to-transparent pointer-events-none" />

      <h3 className="font-['Lilita_One'] text-lg text-white mb-4 flex items-center gap-2 relative z-10 drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]">
        <span className="text-xl drop-shadow-md">📅</span> {t('weeklyTitle')}
        <InfoTooltip className="ml-1.5 opacity-70 hover:opacity-100" text={t('tipWeekly')} />
      </h3>

      {/* Best/worst summary */}
      {best && worst && best.dayOfWeek !== worst.dayOfWeek && (
        <div className="grid grid-cols-2 gap-3 mb-6 relative z-10">
          <div className="bg-gradient-to-br from-[#0B1120] to-[#0A0E1A] border border-green-500/20 rounded-xl p-3 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] relative overflow-hidden">
             <div className="absolute top-0 right-0 w-8 h-8 bg-green-500/20 blur-xl rounded-full" />
             <p className="font-['Lilita_One'] text-lg text-green-400 drop-shadow-[0_0_5px_rgba(74,222,128,0.5)]">{best.dayName}</p>
             <p className="text-[10px] uppercase font-bold tracking-widest text-[#4EC0FA]/80 mt-0.5">{t('bestDay')} <span className="text-white">({best.winRate.toFixed(1)}%)</span></p>
          </div>
          <div className="bg-gradient-to-br from-[#0B1120] to-[#0A0E1A] border border-red-500/20 rounded-xl p-3 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] relative overflow-hidden">
             <div className="absolute top-0 right-0 w-8 h-8 bg-red-500/20 blur-xl rounded-full" />
             <p className="font-['Lilita_One'] text-lg text-red-400 drop-shadow-[0_0_5px_rgba(248,113,113,0.5)]">{worst.dayName}</p>
             <p className="text-[10px] uppercase font-bold tracking-widest text-[#4EC0FA]/80 mt-0.5">{t('worstDay')} <span className="text-white">({worst.winRate.toFixed(1)}%)</span></p>
          </div>
        </div>
      )}

      {/* Bar chart */}
      <div className="flex items-end gap-1.5 h-36 relative z-10">
        {data.map(d => {
          const height = d.total > 0 ? Math.max((d.winRate / 100) * 100, 10) : 5
          const isToday = d.dayOfWeek === today
          const isHovered = hovered === d.dayOfWeek
          const styles = wrStyle(d.winRate, d.total)

          return (
            <div
              key={d.dayOfWeek}
              className="flex-1 flex flex-col items-center gap-1 group relative cursor-crosshair h-full justify-end"
              onMouseEnter={() => setHovered(d.dayOfWeek)}
              onMouseLeave={() => setHovered(null)}
            >
              {/* Tooltip */}
              {isHovered && d.total > 0 && (
                <div className="absolute bottom-full mb-6 z-30 pointer-events-none">
                  <div className="bg-[#0B1120]/95 backdrop-blur-md border border-white/10 rounded border-l-2 border-l-[#4EC0FA] px-2.5 py-1.5 text-center whitespace-nowrap shadow-xl">
                    <p className="font-['Lilita_One'] text-sm text-white mb-0.5">{d.dayName}</p>
                    <p className="text-[10px] text-slate-400 tracking-wider">
                      <span className="font-bold text-[#FFC91B]">{d.total}</span> {t('games')}
                    </p>
                  </div>
                </div>
              )}

              {/* VR Hover line */}
              {isHovered && <div className="absolute top-0 bottom-6 w-[1px] bg-gradient-to-b from-white/20 to-transparent pointer-events-none" />}

              <span className={`font-['Lilita_One'] text-[10px] tabular-nums transition-all ${d.total > 0 ? wrColor(d.winRate) : 'text-slate-600'} ${isHovered ? 'scale-110 mb-1' : ''}`}>
                {d.total > 0 ? `${d.winRate.toFixed(0)}%` : '--'}
              </span>
              <div className="w-full flex items-end justify-center" style={{ height: '70%' }}>
                <div
                  className={`w-full rounded-t-sm transition-all duration-300 relative
                    border-t-2 ${styles.border} ${styles.fill}
                    ${isHovered ? 'brightness-150' : 'opacity-80'}
                    ${isHovered ? styles.glow : ''}
                  `}
                  style={{ height: `${height}%` }}
                >
                  {isToday && (
                    <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-[#4EC0FA] rounded-full shadow-[0_0_8px_rgba(78,192,250,1)] animate-pulse" />
                  )}
                </div>
              </div>
              <span className={`font-['Lilita_One'] mt-1 text-[10px] sm:text-xs transition-colors ${
                isToday ? 'text-[#4EC0FA] drop-shadow-[0_0_4px_rgba(78,192,250,0.5)]' : isHovered ? 'text-white' : 'text-slate-500'
              }`}>
                {d.dayName.slice(0, 3)}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
