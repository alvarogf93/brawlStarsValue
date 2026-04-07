'use client'

import { useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { InfoTooltip } from '@/components/ui/InfoTooltip'
import type { WeeklyPattern } from '@/lib/analytics/types'

interface Props {
  data: WeeklyPattern[]
}

function wrColor(wr: number): string {
  if (wr >= 60) return 'text-green-400'
  if (wr >= 45) return 'text-[#FFC91B]'
  return 'text-red-400'
}

function barColor(wr: number): string {
  if (wr >= 60) return 'bg-green-500'
  if (wr >= 45) return 'bg-[#FFC91B]'
  return 'bg-red-500'
}

export function WeeklyPatternChart({ data }: Props) {
  const t = useTranslations('advancedAnalytics')

  const filtered = data.filter(d => d.total > 0)
  const { best, worst } = useMemo(() => {
    if (filtered.length === 0) return { best: null, worst: null }
    const sorted = [...filtered].sort((a, b) => b.winRate - a.winRate)
    return { best: sorted[0], worst: sorted[sorted.length - 1] }
  }, [filtered])

  if (filtered.length === 0) return null

  const today = new Date().getDay()

  return (
    <div className="brawl-card-dark p-5 md:p-6 border-[#090E17]">
      <h3 className="font-['Lilita_One'] text-lg text-white mb-4 flex items-center gap-2">
        <span className="text-xl">📅</span> {t('weeklyTitle')}
        <InfoTooltip className="ml-1.5" text={t('tipWeekly')} />
      </h3>

      {/* Best/worst summary */}
      {best && worst && best.dayOfWeek !== worst.dayOfWeek && (
        <div className="grid grid-cols-2 gap-2.5 mb-4">
          <div className="brawl-row rounded-xl p-3 text-center">
            <p className="font-['Lilita_One'] text-lg text-green-400">{best.dayName}</p>
            <p className="text-[10px] uppercase font-bold text-slate-500">{t('bestDay')} ({best.winRate.toFixed(1)}%)</p>
          </div>
          <div className="brawl-row rounded-xl p-3 text-center">
            <p className="font-['Lilita_One'] text-lg text-red-400">{worst.dayName}</p>
            <p className="text-[10px] uppercase font-bold text-slate-500">{t('worstDay')} ({worst.winRate.toFixed(1)}%)</p>
          </div>
        </div>
      )}

      {/* Bar chart */}
      <div className="flex items-end gap-1.5 h-32">
        {data.map(d => {
          const height = d.total > 0 ? Math.max((d.winRate / 100) * 100, 10) : 5
          const isToday = d.dayOfWeek === today
          return (
            <div key={d.dayOfWeek} className="flex-1 flex flex-col items-center gap-1">
              <span className={`font-['Lilita_One'] text-[10px] tabular-nums ${d.total > 0 ? wrColor(d.winRate) : 'text-slate-600'}`}>
                {d.total > 0 ? `${d.winRate.toFixed(0)}%` : '--'}
              </span>
              <div className="w-full flex-1 flex items-end">
                <div
                  className={`w-full rounded-t-md transition-all ${d.total > 0 ? barColor(d.winRate) : 'bg-slate-700/30'} ${isToday ? 'ring-2 ring-white/40' : ''} opacity-80`}
                  style={{ height: `${height}%` }}
                />
              </div>
              <span className={`font-['Lilita_One'] text-[10px] ${isToday ? 'text-white' : 'text-slate-500'}`}>
                {d.dayName.slice(0, 3)}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
