'use client'

import { useTranslations } from 'next-intl'
import { InfoTooltip } from '@/components/ui/InfoTooltip'
import type { PowerLevelImpact } from '@/lib/analytics/types'

interface Props {
  data: PowerLevelImpact[]
}

function wrColor(wr: number): string {
  if (wr >= 60) return 'bg-green-500'
  if (wr >= 45) return 'bg-[#FFC91B]'
  return 'bg-red-500'
}

export function PowerLevelChart({ data }: Props) {
  const t = useTranslations('advancedAnalytics')

  const filtered = data.filter(d => d.total > 0)
  if (filtered.length === 0) return null

  const maxTotal = Math.max(...filtered.map(d => d.total))

  return (
    <div className="brawl-card-dark p-5 md:p-6 border-[#090E17]">
      <h3 className="font-['Lilita_One'] text-lg text-white mb-4 flex items-center gap-2">
        <span className="text-xl">⚡</span> {t('powerLevelTitle')}
        <InfoTooltip className="ml-1.5" text={t('tipPowerLevel')} />
      </h3>

      <div className="space-y-2">
        {filtered.map(d => {
          const barWidth = d.total > 0 ? Math.max((d.total / maxTotal) * 100, 8) : 0
          return (
            <div key={d.powerLevel} className="flex items-center gap-3">
              <span className="font-['Lilita_One'] text-sm text-slate-400 w-10 text-right shrink-0">
                {t('powerLevelLabel')} {d.powerLevel}
              </span>
              <div className="flex-1 h-7 bg-[#0F172A] rounded-lg overflow-hidden relative">
                <div
                  className={`h-full rounded-lg ${wrColor(d.winRate)} opacity-80 transition-all`}
                  style={{ width: `${barWidth}%` }}
                />
                <span className="absolute inset-0 flex items-center justify-center font-['Lilita_One'] text-xs text-white/90">
                  {d.winRate.toFixed(1)}%
                </span>
              </div>
              <span className="text-[10px] text-slate-500 w-12 text-right shrink-0">
                {d.total}g
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
