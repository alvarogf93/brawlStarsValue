'use client'

import { useTranslations } from 'next-intl'
import { InfoTooltip } from '@/components/ui/InfoTooltip'
import type { WarmUpAnalysis } from '@/lib/analytics/types'

interface Props {
  data: WarmUpAnalysis
}

function wrColor(wr: number): string {
  if (wr >= 60) return 'text-green-400 drop-shadow-[0_0_5px_rgba(34,197,94,0.8)]'
  if (wr >= 45) return 'text-[#FFC91B] drop-shadow-[0_0_5px_rgba(255,201,27,0.8)]'
  return 'text-red-400 drop-shadow-[0_0_5px_rgba(239,68,68,0.8)]'
}

export function WarmUpCard({ data }: Props) {
  const t = useTranslations('advancedAnalytics')
  const hasData = data.warmUpWR !== null && data.peakWR !== null

  return (
    <div className="relative overflow-hidden bg-[#090E17]/80 backdrop-blur-md rounded-xl p-5 md:p-6 border-l-[3px] border-l-[#4EC0FA] border-b-[4px] border-b-[#06090E] shadow-[0_8px_16px_rgba(0,0,0,0.5)] group hover:shadow-[0_8px_20px_rgba(78,192,250,0.15)] transition-shadow" style={{ clipPath: 'polygon(15px 0, 100% 0, 100% 100%, 0 100%, 0 15px)' }}>
      <div className="absolute inset-0 bg-gradient-to-tr from-[#4EC0FA]/5 to-transparent pointer-events-none" />
      <div className="absolute -left-4 -bottom-4 text-6xl opacity-5 grayscale group-hover:grayscale-0 group-hover:opacity-10 transition-all duration-700 pointer-events-none transform rotate-12">🏃</div>

      <h3 className="font-['Lilita_One'] text-lg text-white mb-4 flex items-center gap-2 relative z-10 drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]">
        <span className="text-xl drop-shadow-[0_0_8px_rgba(78,192,250,0.8)]">🏃</span> {t('warmUpTitle')}
        <InfoTooltip className="ml-1 opacity-70 hover:opacity-100" text={t('tipWarmUp')} />
      </h3>

      {!hasData ? (
        <div className="rounded-xl p-4 border border-white/5 relative z-10" style={{ background: 'linear-gradient(135deg, rgba(100,116,139,0.08) 0%, rgba(71,85,105,0.03) 100%)' }}>
          <p className="font-['Lilita_One'] text-sm text-slate-500 text-center tracking-wide">{t('warmUpNoData')}</p>
        </div>
      ) : (
        <div className="relative z-10">
          {data.delta !== null && Math.abs(data.delta) >= 3 && (
            <div
              className={`rounded-xl p-3 mb-4 border ${data.delta > 0 ? 'border-green-500/30 shadow-[0_0_15px_rgba(34,197,94,0.15)]' : 'border-amber-500/30'}`}
              style={{
                background: data.delta > 0
                  ? 'linear-gradient(135deg, rgba(74,222,128,0.15) 0%, rgba(34,197,94,0.05) 100%)'
                  : 'linear-gradient(135deg, rgba(245,158,11,0.15) 0%, rgba(217,119,6,0.05) 100%)',
              }}
            >
              <p className={`font-['Lilita_One'] text-sm text-center tracking-wide ${data.delta > 0 ? 'text-green-400 drop-shadow-[0_2px_2px_rgba(0,0,0,0.5)]' : 'text-amber-400'}`}>
                {data.delta > 0
                  ? t('warmUpImprove', { delta: data.delta.toFixed(1) })
                  : t('warmUpDropOff', { delta: Math.abs(data.delta).toFixed(1) })}
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[#0A0E1A] rounded-xl p-4 text-center border-t border-x border-white/5 border-b-[3px] border-b-[#06090E] shadow-[0_4px_8px_rgba(0,0,0,0.4)]">
              <p className="font-['Lilita_One'] text-[10px] uppercase tracking-widest text-[#4EC0FA]/70 mb-1">{t('warmUpWR')}</p>
              <p className={`font-['Lilita_One'] text-2xl tabular-nums ${wrColor(data.warmUpWR!)}`}>
                {data.warmUpWR!.toFixed(1)}%
              </p>
              <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mt-1 bg-black/40 inline-block px-2 py-0.5 rounded-md border border-white/5">{data.warmUpGames} {t('games')}</p>
            </div>
            <div className="bg-[#0A0E1A] rounded-xl p-4 text-center border-t border-x border-white/5 border-b-[3px] border-b-[#06090E] shadow-[0_4px_8px_rgba(0,0,0,0.4)]">
              <p className="font-['Lilita_One'] text-[10px] uppercase tracking-widest text-[#FFC91B]/70 mb-1">{t('peakWR')}</p>
              <p className={`font-['Lilita_One'] text-2xl tabular-nums ${wrColor(data.peakWR!)}`}>
                {data.peakWR!.toFixed(1)}%
              </p>
              <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mt-1 bg-black/40 inline-block px-2 py-0.5 rounded-md border border-white/5">{data.peakGames} {t('games')}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
