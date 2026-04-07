'use client'

import { useTranslations } from 'next-intl'
import { InfoTooltip } from '@/components/ui/InfoTooltip'
import type { CarryAnalysis } from '@/lib/analytics/types'

interface Props {
  data: CarryAnalysis
}

function wrColor(wr: number): string {
  if (wr >= 60) return 'text-green-400'
  if (wr >= 45) return 'text-[#FFC91B]'
  return 'text-red-400'
}

export function CarryCard({ data }: Props) {
  const t = useTranslations('advancedAnalytics')
  const hasData = data.carryWR !== null && data.normalWR !== null

  return (
    <div className="brawl-card-dark p-5 md:p-6 border-[#090E17]">
      <h3 className="font-['Lilita_One'] text-lg text-white mb-4 flex items-center gap-2">
        <span className="text-xl">🦸</span> {t('carryTitle')}
        <InfoTooltip className="ml-1.5" text={t('tipCarry')} />
      </h3>

      {!hasData ? (
        <div className="rounded-xl p-4 border border-white/5" style={{ background: 'linear-gradient(135deg, rgba(100,116,139,0.08) 0%, rgba(71,85,105,0.03) 100%)' }}>
          <p className="font-['Lilita_One'] text-sm text-slate-400 text-center">{t('carryNoData')}</p>
        </div>
      ) : (
        <>
          {data.carryWR! >= 45 && data.carryGames >= 5 && (
            <div className="rounded-xl p-4 mb-4 border border-green-500/20" style={{ background: 'linear-gradient(135deg, rgba(74,222,128,0.10) 0%, rgba(34,197,94,0.03) 100%)' }}>
              <p className="font-['Lilita_One'] text-sm text-center text-green-400">
                You maintain {data.carryWR!.toFixed(1)}% WR even when carrying!
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2.5">
            <div className="brawl-row rounded-xl p-4 text-center">
              <p className={`font-['Lilita_One'] text-2xl tabular-nums ${wrColor(data.carryWR!)}`}>
                {data.carryWR!.toFixed(1)}%
              </p>
              <p className="text-[10px] uppercase font-bold text-slate-500 mt-1">{t('carryWR')}</p>
              <p className="text-[10px] text-slate-600 mt-0.5">{data.carryGames} {t('games')}</p>
            </div>
            <div className="brawl-row rounded-xl p-4 text-center">
              <p className={`font-['Lilita_One'] text-2xl tabular-nums ${wrColor(data.normalWR!)}`}>
                {data.normalWR!.toFixed(1)}%
              </p>
              <p className="text-[10px] uppercase font-bold text-slate-500 mt-1">{t('normalCarryWR')}</p>
              <p className="text-[10px] text-slate-600 mt-0.5">{data.normalGames} {t('games')}</p>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
