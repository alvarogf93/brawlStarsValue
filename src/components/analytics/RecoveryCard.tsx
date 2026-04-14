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
    <div className="relative overflow-hidden bg-[#090E17]/80 backdrop-blur-md rounded-xl p-5 md:p-6 border-b-[4px] border-[#06090E] shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_8px_16px_rgba(0,0,0,0.6)]">
      <h3 className="font-['Lilita_One'] text-lg text-white mb-5 flex items-center gap-2 drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]">
        <span className="text-xl drop-shadow-[0_0_8px_rgba(255,201,27,0.8)]">🔄</span> {t('recoveryTitle')}
        <InfoTooltip className="ml-1.5 opacity-70 hover:opacity-100" text={t('tipRecovery')} />
      </h3>

      {!hasData ? (
        <div className="rounded-xl p-4 border border-white/5 bg-[#0A0E1A] shadow-inner">
          <p className="font-['Lilita_One'] text-sm text-slate-400 text-center tracking-wide">{t('recoveryNoData')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 relative z-10">
          <div className="bg-[#0A0E1A] rounded-xl p-4 text-center border border-white/5 transition-all duration-300 hover:border-[#4EC0FA]/30 hover:bg-[#4EC0FA]/5 group relative overflow-hidden">
            {/* Speed line bg */}
            <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-[#4EC0FA]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            
            <p className="font-['Lilita_One'] text-[10px] uppercase tracking-widest text-slate-400 mb-1 z-10 relative flex items-center justify-center gap-1">
              <span className="text-[#4EC0FA] text-[8px]">⏩</span> {t('avgRecoveryGames')}
            </p>
            <p className="font-['Lilita_One'] text-3xl tabular-nums tracking-wide text-[#4EC0FA] drop-shadow-[0_0_8px_rgba(78,192,250,0.4)] z-10 relative">
              {data.avgGamesToRecover !== null ? data.avgGamesToRecover.toFixed(1) : '--'}
            </p>
          </div>
          
          <div className="bg-[#0A0E1A] rounded-xl p-4 text-center border border-white/5 transition-all duration-300 hover:border-[#FFC91B]/30 hover:bg-[#FFC91B]/5 group relative overflow-hidden">
            <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-[#FFC91B]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            
            <p className="font-['Lilita_One'] text-[10px] uppercase tracking-widest text-slate-400 mb-1 z-10 relative flex items-center justify-center gap-1">
              <span className="text-[#FFC91B] text-[8px]">🎯</span> {t('recoveryEpisodesLabel')}
            </p>
            <p className="font-['Lilita_One'] text-3xl tabular-nums tracking-wide text-[#FFC91B] drop-shadow-[0_0_8px_rgba(255,201,27,0.4)] z-10 relative">
              {data.recoveryEpisodes}
            </p>
          </div>
          
          <div className="bg-[#0A0E1A] rounded-xl p-4 text-center border border-white/5 transition-all duration-300 hover:border-green-400/30 hover:bg-green-400/5 group relative overflow-hidden">
            <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-green-400/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

            <p className="font-['Lilita_One'] text-[10px] uppercase tracking-widest text-slate-400 mb-1 z-10 relative flex items-center justify-center gap-1">
              <span className="text-green-400 text-[8px]">✅</span> {t('recoverySuccess')}
            </p>
            <p className={`font-['Lilita_One'] text-3xl tabular-nums tracking-wide z-10 relative ${
              data.successRate !== null && data.successRate >= 60 ? 'text-green-400 drop-shadow-[0_0_8px_rgba(34,197,94,0.4)]' : data.successRate !== null && data.successRate >= 40 ? 'text-[#FFC91B] drop-shadow-[0_0_8px_rgba(255,201,27,0.4)]' : 'text-red-400 drop-shadow-[0_0_8px_rgba(239,68,68,0.4)]'
            }`}>
              {data.successRate !== null ? `${data.successRate.toFixed(0)}%` : '--'}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
