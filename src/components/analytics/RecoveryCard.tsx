'use client'

import { useTranslations } from 'next-intl'
import { InfoTooltip } from '@/components/ui/InfoTooltip'
import type { RecoveryAnalysis } from '@/lib/analytics/types'

interface Props {
  data: RecoveryAnalysis
}

export function RecoveryCard({ data }: Props) {
  const t = useTranslations('advancedAnalytics')
  const hasData = data.recoveryEpisodes > 0

  return (
    <div className="brawl-card-dark p-5 md:p-6 border-[#090E17]">
      <h3 className="font-['Lilita_One'] text-lg text-white mb-4 flex items-center gap-2">
        <span className="text-xl">🔄</span> {t('recoveryTitle')}
        <InfoTooltip className="ml-1.5" text={t('tipRecovery')} />
      </h3>

      {!hasData ? (
        <div className="rounded-xl p-4 border border-white/5" style={{ background: 'linear-gradient(135deg, rgba(100,116,139,0.08) 0%, rgba(71,85,105,0.03) 100%)' }}>
          <p className="font-['Lilita_One'] text-sm text-slate-400 text-center">{t('recoveryNoData')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <div className="brawl-row rounded-xl p-4 text-center">
            <p className="font-['Lilita_One'] text-2xl tabular-nums text-[#4EC0FA]">
              {data.avgGamesToRecover !== null ? data.avgGamesToRecover.toFixed(1) : '--'}
            </p>
            <p className="text-[10px] uppercase font-bold text-slate-500 mt-1">{t('avgRecoveryGames')}</p>
          </div>
          <div className="brawl-row rounded-xl p-4 text-center">
            <p className="font-['Lilita_One'] text-2xl tabular-nums text-[#FFC91B]">
              {data.recoveryEpisodes}
            </p>
            <p className="text-[10px] uppercase font-bold text-slate-500 mt-1">{t('recoveryEpisodesLabel')}</p>
          </div>
          <div className="brawl-row rounded-xl p-4 text-center">
            <p className={`font-['Lilita_One'] text-2xl tabular-nums ${
              data.successRate !== null && data.successRate >= 60 ? 'text-green-400' : data.successRate !== null && data.successRate >= 40 ? 'text-[#FFC91B]' : 'text-red-400'
            }`}>
              {data.successRate !== null ? `${data.successRate.toFixed(0)}%` : '--'}
            </p>
            <p className="text-[10px] uppercase font-bold text-slate-500 mt-1">{t('recoverySuccess')}</p>
          </div>
        </div>
      )}
    </div>
  )
}
