'use client'

import { useTranslations } from 'next-intl'
import { InfoTooltip } from '@/components/ui/InfoTooltip'
import type { CarryAnalysis } from '@/lib/analytics/types'

interface Props {
  data: CarryAnalysis
}

export function CarryCard({ data }: Props) {
  const t = useTranslations('advancedAnalytics')
  const hasData = data.carryWR !== null && data.normalWR !== null

  if (!hasData) {
    return (
      <div className="relative overflow-hidden bg-[#090E17]/80 backdrop-blur-md rounded-xl p-5 md:p-6 border-b-[4px] border-[#06090E] shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_8px_16px_rgba(0,0,0,0.6)]">
        <h3 className="font-['Lilita_One'] text-lg text-white mb-4 flex items-center gap-2 drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]">
          <span className="text-xl drop-shadow-md">🔥</span> {t('carryTitle')}
        </h3>
        <div className="bg-[#0A0E1A] p-4 rounded-xl border border-white/5 flex flex-col items-center py-6">
          <span className="text-3xl opacity-30 grayscale mb-2">🎒</span>
          <p className="font-['Lilita_One'] text-sm uppercase tracking-widest text-slate-500 text-center">{t('carryNoData')}</p>
        </div>
      </div>
    )
  }

  const carryWr = data.carryWR!
  const normalWr = data.normalWR!
  const diff = carryWr - normalWr
  const isCarrying = diff > 0

  // Calculate tug-of-war bar percentage
  // If carry is 60 and normal is 40, carry gets 60%.
  const totalWeight = carryWr + normalWr
  const carryPercent = totalWeight === 0 ? 50 : (carryWr / totalWeight) * 100

  return (
    <div className="relative overflow-hidden bg-[#090E17]/80 backdrop-blur-md rounded-xl p-5 md:p-6 border-b-[4px] border-[#06090E] shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_8px_16px_rgba(0,0,0,0.6)] group">
      {/* Background Effect */}
      <div className={`absolute inset-0 opacity-10 bg-gradient-to-r ${isCarrying ? 'from-green-500/30' : 'from-red-500/30'} via-transparent to-transparent pointer-events-none transition-all duration-1000 group-hover:opacity-20`} />

      <h3 className="font-['Lilita_One'] text-lg text-white mb-5 flex items-center gap-2 relative z-10 drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]">
        <span className="text-xl drop-shadow-[0_0_8px_rgba(255,100,50,0.8)]">🔥</span> {t('carryTitle')}
        <InfoTooltip className="ml-1.5 opacity-70 hover:opacity-100" text={t('tipCarry')} />
      </h3>

      {carryWr >= 45 && data.carryGames >= 5 && (
        <div className="mb-6 relative z-10 bg-green-500/10 border border-green-500/30 rounded-lg p-3 text-center shadow-[0_0_15px_rgba(34,197,94,0.1)]">
          <p className="font-['Lilita_One'] text-sm text-green-400 drop-shadow-md tracking-wide">
            {t('carryMaintain', { wr: carryWr.toFixed(1) })} 🚀
          </p>
        </div>
      )}

      {/* Tug of war stats */}
      <div className="flex justify-between items-end mb-3 relative z-10">
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-lg">🎒</span>
            <span className="font-['Lilita_One'] text-[11px] uppercase tracking-widest text-[#FFC91B] drop-shadow-md">{t('carryWR')}</span>
          </div>
          <p className={`font-['Lilita_One'] text-4xl tabular-nums leading-none tracking-wide ${carryWr >= 50 ? 'text-green-400 drop-shadow-[0_0_8px_rgba(34,197,94,0.5)]' : 'text-[#FFC91B]'}`}>
            {carryWr.toFixed(1)}<span className="text-xl opacity-70">%</span>
          </p>
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1.5 bg-black/40 px-2 py-0.5 rounded w-fit border border-white/5">
            {data.carryGames} {t('games')}
          </p>
        </div>

        <div className="flex flex-col items-end">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="font-['Lilita_One'] text-[11px] uppercase tracking-widest text-slate-400">{t('normalCarryWR')}</span>
            <span className="text-lg grayscale opacity-50">🚶</span>
          </div>
          <p className={`font-['Lilita_One'] text-4xl tabular-nums leading-none tracking-wide text-right ${normalWr >= 50 ? 'text-[#4EC0FA] drop-shadow-[0_0_8px_rgba(78,192,250,0.5)]' : 'text-slate-300'}`}>
            {normalWr.toFixed(1)}<span className="text-xl opacity-70">%</span>
          </p>
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1.5 bg-black/40 px-2 py-0.5 rounded w-fit border border-white/5">
            {data.normalGames} {t('games')}
          </p>
        </div>
      </div>

      {/* Tug of war bar */}
      <div className="relative h-6 mt-4 w-full bg-black/60 rounded-full overflow-hidden border-2 border-[#121A2F] shadow-[inset_0_2px_4px_rgba(0,0,0,0.5)] z-10 flex">
        {/* Center line */}
        <div className="absolute left-1/2 top-0 bottom-0 w-1 bg-white/20 z-20 transform -translate-x-1/2" />
        
        {/* Carry side */}
        <div 
          className="h-full bg-gradient-to-r from-orange-500 to-[#FFC91B] relative transition-all duration-1000 ease-out" 
          style={{ width: `${carryPercent}%` }}
        >
          <div className="absolute inset-0 bg-[linear-gradient(45deg,rgba(255,255,255,0.15)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.15)_50%,rgba(255,255,255,0.15)_75%,transparent_75%,transparent_100%)] bg-[length:16px_16px] animate-[slide_2s_linear_infinite]" />
        </div>
        
        {/* Normal side */}
        <div 
          className="h-full bg-gradient-to-r from-slate-600 to-[#4EC0FA] relative transition-all duration-1000 ease-out flex-1"
        >
          <div className="absolute inset-0 bg-[linear-gradient(-45deg,rgba(0,0,0,0.15)_25%,transparent_25%,transparent_50%,rgba(0,0,0,0.15)_50%,rgba(0,0,0,0.15)_75%,transparent_75%,transparent_100%)] bg-[length:16px_16px] pointer-events-none opacity-50" />
        </div>

        {/* Connector icon taking the middle */}
        <div 
          className="absolute top-1/2 -translate-y-1/2 w-8 h-8 rounded-full border-2 border-white/20 bg-[#090E17] flex items-center justify-center z-30 transition-all duration-1000 ease-out shadow-[0_0_10px_rgba(0,0,0,0.8)]"
          style={{ left: `calc(${carryPercent}% - 16px)` }}
        >
          <span className="text-sm font-black text-white pointer-events-none drop-shadow-md">VS</span>
        </div>
      </div>
      
      {/* Diff indicator */}
      <div className="absolute top-6 right-6 z-20">
        <div className={`px-2 py-1 rounded-md border text-[10px] uppercase font-black tracking-widest ${isCarrying ? 'bg-green-500/20 border-green-500/50 text-green-400 shadow-[0_0_10px_rgba(34,197,94,0.3)]' : 'bg-red-500/20 border-red-500/50 text-red-500 shadow-[0_0_10px_rgba(239,68,68,0.3)]'}`}>
          {isCarrying ? '+' : ''}{diff.toFixed(1)}% {t('diff')}
        </div>
      </div>
    </div>
  )
}
