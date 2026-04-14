'use client'

import { useTranslations } from 'next-intl'
import { InfoTooltip } from '@/components/ui/InfoTooltip'
import type { PowerLevelImpact } from '@/lib/analytics/types'

interface Props {
  data: PowerLevelImpact[]
}

function wrStyle(wr: number) {
  if (wr >= 60) return { fill: 'bg-gradient-to-r from-green-600/50 to-green-400', shadow: 'shadow-[0_0_12px_rgba(74,222,128,0.5)]', text: 'text-green-400', border: 'border-green-400/50' }
  if (wr >= 45) return { fill: 'bg-gradient-to-r from-[#FFC91B]/50 to-[#FFC91B]', shadow: 'shadow-[0_0_12px_rgba(255,201,27,0.5)]', text: 'text-[#FFC91B]', border: 'border-[#FFC91B]/50' }
  return { fill: 'bg-gradient-to-r from-red-600/50 to-red-500', shadow: 'shadow-[0_0_12px_rgba(239,68,68,0.5)]', text: 'text-red-400', border: 'border-red-500/50' }
}

export function PowerLevelChart({ data }: Props) {
  const t = useTranslations('advancedAnalytics')

  const filtered = data.filter(d => d.total > 0)
  if (filtered.length === 0) return null

  const maxTotal = Math.max(...filtered.map(d => d.total))

  return (
    <div className="relative overflow-hidden bg-[#090E17]/80 backdrop-blur-md rounded-xl p-5 md:p-6 border-b-[4px] border-[#06090E] shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_8px_16px_rgba(0,0,0,0.6)] group/card">
      {/* Target hex pattern background */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_100%_100%,rgba(78,192,250,0.05)_0%,transparent_50%)] pointer-events-none" />

      <h3 className="font-['Lilita_One'] text-lg text-white mb-6 flex items-center gap-2 relative z-10 drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]">
        <span className="text-xl drop-shadow-md">⚡</span> {t('powerLevelTitle')}
        <InfoTooltip className="ml-1.5 opacity-70 hover:opacity-100" text={t('tipPowerLevel')} />
      </h3>

      <div className="space-y-4 relative z-10">
        {filtered.map(d => {
          const barWidth = d.total > 0 ? Math.max((d.total / maxTotal) * 100, 8) : 0
          const styles = wrStyle(d.winRate)
          return (
            <div key={d.powerLevel} className="flex items-center gap-3 group relative">
              <span className="font-['Lilita_One'] text-sm text-slate-400 w-10 text-right shrink-0 drop-shadow-md group-hover:text-white transition-colors">
                {t('powerLevelLabel')} {d.powerLevel}
              </span>
              
              <div className="flex-1 h-7 bg-[#0B1120] rounded-r-full rounded-l-sm overflow-hidden relative shadow-inner border border-white/5">
                <div
                  className={`h-full rounded-r-full rounded-l-sm ${styles.fill} ${styles.shadow} opacity-80 group-hover:opacity-100 group-hover:brightness-125 transition-all duration-500 border-r-2 ${styles.border}`}
                  style={{ width: `${barWidth}%` }}
                />
                <span className="absolute inset-y-0 left-3 flex items-center justify-center font-['Lilita_One'] text-xs text-white/90 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                  {d.winRate.toFixed(1)}%
                </span>
                
                {/* Scanner effect line moving across the bar on hover */}
                <div className="absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite] pointer-events-none" />
              </div>
              
              <span className={`text-[10px] font-bold tracking-widest uppercase w-12 text-right shrink-0 transition-colors ${styles.text}`}>
                {d.total} <span className="opacity-70">G</span>
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
