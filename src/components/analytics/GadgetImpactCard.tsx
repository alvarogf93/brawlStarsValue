'use client'

import { useTranslations } from 'next-intl'
import { InfoTooltip } from '@/components/ui/InfoTooltip'
import type { GadgetStarPowerImpact } from '@/lib/analytics/types'

interface Props {
  data: GadgetStarPowerImpact
}

function wrColor(wr: number): string {
  if (wr >= 60) return 'text-green-400'
  if (wr >= 45) return 'text-[#FFC91B]'
  return 'text-red-400'
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

  return (
    <div className="space-y-1.5">
      <p className="font-['Lilita_One'] text-sm text-slate-300">{label}</p>
      <div className="grid grid-cols-2 gap-2">
        <div className="brawl-row rounded-xl p-3 text-center">
          <p className="font-['Lilita_One'] text-[10px] uppercase tracking-wider text-slate-400 mb-1">{withLabel}</p>
          <p className={`font-['Lilita_One'] text-xl tabular-nums ${withData.total > 0 ? wrColor(withData.winRate) : 'text-slate-500'}`}>
            {withData.total > 0 ? `${withData.winRate.toFixed(1)}%` : '--'}
          </p>
          <p className="text-[10px] text-slate-600">{withData.total}g</p>
        </div>
        <div className="brawl-row rounded-xl p-3 text-center relative">
          <p className="font-['Lilita_One'] text-[10px] uppercase tracking-wider text-slate-400 mb-1">{withoutLabel}</p>
          <p className={`font-['Lilita_One'] text-xl tabular-nums ${withoutData.total > 0 ? wrColor(withoutData.winRate) : 'text-slate-500'}`}>
            {withoutData.total > 0 ? `${withoutData.winRate.toFixed(1)}%` : '--'}
          </p>
          <p className="text-[10px] text-slate-600">{withoutData.total}g</p>
          {delta !== null && Math.abs(delta) >= 2 && (
            <span className={`absolute top-1.5 right-1.5 font-['Lilita_One'] text-[10px] px-1.5 py-0.5 rounded-md tabular-nums ${delta > 0 ? 'text-red-400 bg-red-500/10' : 'text-green-400 bg-green-500/10'}`}>
              {delta > 0 ? '+' : ''}{(-delta).toFixed(1)}%
            </span>
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
    <div className="brawl-card-dark p-5 md:p-6 border-[#090E17]">
      <h3 className="font-['Lilita_One'] text-lg text-white mb-4 flex items-center gap-2">
        <span className="text-xl">🔧</span> {t('gadgetTitle')}
        <InfoTooltip className="ml-1.5" text={t('tipGadget')} />
      </h3>

      <div className="space-y-4">
        {(data.withGadgets.total > 0 || data.withoutGadgets.total > 0) && (
          <ComparisonRow
            label="Gadgets"
            withData={data.withGadgets}
            withoutData={data.withoutGadgets}
            withLabel={t('withGadgets')}
            withoutLabel={t('withoutGadgets')}
          />
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
