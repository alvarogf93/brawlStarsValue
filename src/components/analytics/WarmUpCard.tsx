'use client'

import { useTranslations } from 'next-intl'
import { InfoTooltip } from '@/components/ui/InfoTooltip'
import type { WarmUpAnalysis } from '@/lib/analytics/types'

interface Props {
  data: WarmUpAnalysis
}

function wrColor(wr: number): string {
  if (wr >= 60) return 'text-green-400'
  if (wr >= 45) return 'text-[#FFC91B]'
  return 'text-red-400'
}

export function WarmUpCard({ data }: Props) {
  const t = useTranslations('advancedAnalytics')
  const hasData = data.warmUpWR !== null && data.peakWR !== null

  return (
    <div className="brawl-card-dark p-5 md:p-6 border-[#090E17]">
      <h3 className="font-['Lilita_One'] text-lg text-white mb-4 flex items-center gap-2">
        <span className="text-xl">🏃</span> {t('warmUpTitle')}
        <InfoTooltip className="ml-1.5" text={t('tipWarmUp')} />
      </h3>

      {!hasData ? (
        <div className="rounded-xl p-4 border border-white/5" style={{ background: 'linear-gradient(135deg, rgba(100,116,139,0.08) 0%, rgba(71,85,105,0.03) 100%)' }}>
          <p className="font-['Lilita_One'] text-sm text-slate-400 text-center">{t('warmUpNoData')}</p>
        </div>
      ) : (
        <>
          {data.delta !== null && Math.abs(data.delta) >= 3 && (
            <div
              className={`rounded-xl p-4 mb-4 border ${data.delta > 0 ? 'border-green-500/20' : 'border-amber-500/20'}`}
              style={{
                background: data.delta > 0
                  ? 'linear-gradient(135deg, rgba(74,222,128,0.10) 0%, rgba(34,197,94,0.03) 100%)'
                  : 'linear-gradient(135deg, rgba(245,158,11,0.10) 0%, rgba(217,119,6,0.03) 100%)',
              }}
            >
              <p className={`font-['Lilita_One'] text-sm text-center ${data.delta > 0 ? 'text-green-400' : 'text-amber-400'}`}>
                {data.delta > 0
                  ? t('warmUpImprove', { delta: data.delta.toFixed(1) })
                  : t('warmUpDropOff', { delta: Math.abs(data.delta).toFixed(1) })}
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2.5">
            <div className="brawl-row rounded-xl p-4 text-center">
              <p className="font-['Lilita_One'] text-[10px] uppercase tracking-wider text-slate-400 mb-1">{t('warmUpWR')}</p>
              <p className={`font-['Lilita_One'] text-2xl tabular-nums ${wrColor(data.warmUpWR!)}`}>
                {data.warmUpWR!.toFixed(1)}%
              </p>
              <p className="text-[10px] text-slate-600 mt-0.5">{data.warmUpGames} {t('games')}</p>
            </div>
            <div className="brawl-row rounded-xl p-4 text-center">
              <p className="font-['Lilita_One'] text-[10px] uppercase tracking-wider text-slate-400 mb-1">{t('peakWR')}</p>
              <p className={`font-['Lilita_One'] text-2xl tabular-nums ${wrColor(data.peakWR!)}`}>
                {data.peakWR!.toFixed(1)}%
              </p>
              <p className="text-[10px] text-slate-600 mt-0.5">{data.peakGames} {t('games')}</p>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
