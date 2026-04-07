'use client'

import { useTranslations } from 'next-intl'
import { InfoTooltip } from '@/components/ui/InfoTooltip'
import type { SessionEfficiency } from '@/lib/analytics/types'

interface Props {
  data: SessionEfficiency[]
}

function wrColor(wr: number): string {
  if (wr >= 60) return 'text-green-400'
  if (wr >= 45) return 'text-[#FFC91B]'
  return 'text-red-400'
}

const SESSION_LABELS: Record<number, string> = {
  3: '1-3',
  6: '4-6',
  10: '7-10',
  15: '11-15',
  99: '16+',
}

export function SessionEfficiencyCard({ data }: Props) {
  const t = useTranslations('advancedAnalytics')

  const filtered = data.filter(d => d.count > 0)
  if (filtered.length === 0) return null

  const best = [...filtered].sort((a, b) => b.avgWinRate - a.avgWinRate)[0]

  return (
    <div className="brawl-card-dark p-5 md:p-6 border-[#090E17]">
      <h3 className="font-['Lilita_One'] text-lg text-white mb-4 flex items-center gap-2">
        <span className="text-xl">⏱️</span> {t('sessionEffTitle')}
        <InfoTooltip className="ml-1.5" text={t('tipSessionEff')} />
      </h3>

      <div className="space-y-2">
        {filtered.map(d => {
          const label = SESSION_LABELS[d.sessionLength] || `${d.sessionLength}`
          const isBest = d.sessionLength === best.sessionLength
          return (
            <div
              key={d.sessionLength}
              className={`flex items-center gap-3 brawl-row rounded-xl px-4 py-3 ${isBest ? 'ring-1 ring-green-500/30' : ''}`}
            >
              <div className="w-14 text-center shrink-0">
                <p className="font-['Lilita_One'] text-sm text-[#4EC0FA]">{label}</p>
                <p className="text-[9px] text-slate-500">{t('sessionLengthLabel')}</p>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className={`font-['Lilita_One'] text-lg tabular-nums ${wrColor(d.avgWinRate)}`}>
                    {d.avgWinRate.toFixed(1)}%
                  </span>
                  <span className={`font-['Lilita_One'] text-sm tabular-nums ${d.avgTrophiesPerGame >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {d.avgTrophiesPerGame > 0 ? '+' : ''}{d.avgTrophiesPerGame.toFixed(1)} 🏆
                  </span>
                </div>
              </div>
              <span className="text-[10px] text-slate-500 shrink-0">
                ×{d.count}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
