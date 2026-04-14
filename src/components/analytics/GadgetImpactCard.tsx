'use client'

import { useTranslations } from 'next-intl'
import { InfoTooltip } from '@/components/ui/InfoTooltip'
import type { GadgetStarPowerImpact } from '@/lib/analytics/types'

interface Props {
  data: GadgetStarPowerImpact
}

function wrStyle(wr: number) {
  if (wr >= 60) return { text: 'text-green-400 drop-shadow-[0_0_5px_rgba(74,222,128,0.5)]', container: 'border-green-500/20 bg-gradient-to-br from-[#0B1120] to-green-500/5' }
  if (wr >= 45) return { text: 'text-[#FFC91B] drop-shadow-[0_0_5px_rgba(255,201,27,0.5)]', container: 'border-[#FFC91B]/20 bg-gradient-to-br from-[#0B1120] to-[#FFC91B]/5' }
  return { text: 'text-red-400 drop-shadow-[0_0_5px_rgba(248,113,113,0.5)]', container: 'border-red-500/20 bg-gradient-to-br from-[#0B1120] to-red-500/5' }
}

function ComparisonRow({ label, withData, withoutData, withLabel, withoutLabel }: {
  label: string
  withData: { wins: number; total: number; winRate: number }
  withoutData: { wins: number; total: number; winRate: number }
  withLabel: string
  withoutLabel: string
}) {
  const hasData = withData.total > 0 && withoutData.total > 0
  const delta = hasData ? withData.winRate - withoutData.winRate : null

  const withStyles = withData.total > 0 ? wrStyle(withData.winRate) : { text: 'text-slate-500', container: 'border-[#1E293B] bg-[#0A0E1A]' }
  const withoutStyles = withoutData.total > 0 ? wrStyle(withoutData.winRate) : { text: 'text-slate-500', container: 'border-[#1E293B] bg-[#0A0E1A]' }


  return (
    <div className="space-y-2 relative z-10">
      <p className="font-['Lilita_One'] text-sm text-[#4EC0FA] drop-shadow-[0_0_5px_rgba(78,192,250,0.5)] ml-1">{label}</p>
      <div className="grid grid-cols-2 gap-3">
        <div className={`rounded-xl p-3 text-center border shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] relative overflow-hidden ${withStyles.container}`}>
          <div className="absolute top-0 right-0 w-8 h-8 bg-black/20 blur-xl rounded-full" />
          <p className="font-['Lilita_One'] text-[10px] uppercase font-bold tracking-widest text-[#4EC0FA]/80 mb-1">{withLabel}</p>
          <p className={`font-['Lilita_One'] text-2xl tabular-nums ${withStyles.text}`}>
            {withData.total > 0 ? `${withData.winRate.toFixed(1)}%` : '--'}
          </p>
          <p className="text-[10px] text-slate-500 tracking-wider font-bold mt-0.5">{withData.total} <span className="opacity-70">G</span></p>
        </div>
        <div className={`rounded-xl p-3 text-center border shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] relative overflow-hidden ${withoutStyles.container}`}>
          <div className="absolute top-0 right-0 w-8 h-8 bg-black/20 blur-xl rounded-full" />
          <p className="font-['Lilita_One'] text-[10px] uppercase font-bold tracking-widest text-slate-400 mb-1">{withoutLabel}</p>
          <p className={`font-['Lilita_One'] text-2xl tabular-nums ${withoutStyles.text}`}>
            {withoutData.total > 0 ? `${withoutData.winRate.toFixed(1)}%` : '--'}
          </p>
          <p className="text-[10px] text-slate-500 tracking-wider font-bold mt-0.5">{withoutData.total} <span className="opacity-70">G</span></p>
          
          {/* Delta Indicator */}
          {delta !== null && Math.abs(delta) >= 2 && (
            <div className={`absolute top-2 right-2 flex items-center justify-center font-['Lilita_One'] text-[10px] px-1.5 py-0.5 rounded border shadow-lg backdrop-blur-md tabular-nums ${
              delta > 0 
                ? 'text-red-400 bg-red-950/80 border-red-500/30 shadow-[0_0_8px_rgba(239,68,68,0.3)]' 
                : 'text-green-400 bg-green-950/80 border-green-500/30 shadow-[0_0_8px_rgba(74,222,128,0.3)]'
            }`}>
              {delta > 0 ? '+' : ''}{(-delta).toFixed(1)}%
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export function GadgetImpactCard({ data }: Props) {
  const t = useTranslations('advancedAnalytics')

  const hasAnyData = data.withGadgets.total > 0 || data.withStarPowers.total > 0

  if (!hasAnyData) return null

  return (
    <div className="relative overflow-hidden bg-[#090E17]/80 backdrop-blur-md rounded-xl p-5 md:p-6 border-b-[4px] border-[#06090E] shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_8px_16px_rgba(0,0,0,0.6)] group/card">
      {/* Background blueprint grid */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(78,192,250,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(78,192,250,0.03)_1px,transparent_1px)] bg-[size:20px_20px] pointer-events-none" />

      <h3 className="font-['Lilita_One'] text-lg text-white mb-6 flex items-center gap-2 relative z-10 drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]">
        <span className="text-xl drop-shadow-md">🔧</span> {t('gadgetTitle')}
        <InfoTooltip className="ml-1.5 opacity-70 hover:opacity-100" text={t('tipGadget')} />
      </h3>

      <div className="space-y-6">
        {(data.withGadgets.total > 0 || data.withoutGadgets.total > 0) && (
          <ComparisonRow
            label="Gadgets"
            withData={data.withGadgets}
            withoutData={data.withoutGadgets}
            withLabel={t('withGadgets')}
            withoutLabel={t('withoutGadgets')}
          />
        )}
        
        {/* Divider */}
        {data.withGadgets.total > 0 && data.withStarPowers.total > 0 && (
          <div className="w-full h-px bg-gradient-to-r from-transparent via-white/10 to-transparent relative z-10" />
        )}

        {(data.withStarPowers.total > 0 || data.withoutStarPowers.total > 0) && (
          <ComparisonRow
            label="Star Powers"
            withData={data.withStarPowers}
            withoutData={data.withoutStarPowers}
            withLabel={t('withStarPowers')}
            withoutLabel={t('withoutStarPowers')}
          />
        )}
      </div>
    </div>
  )
}
