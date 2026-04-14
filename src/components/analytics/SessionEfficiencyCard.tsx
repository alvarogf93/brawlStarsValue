'use client'

import { useTranslations } from 'next-intl'
import { InfoTooltip } from '@/components/ui/InfoTooltip'
import type { SessionEfficiency } from '@/lib/analytics/types'

interface Props {
  data: SessionEfficiency[]
}

function wrColor(wr: number): string {
  if (wr >= 60) return 'text-green-400 drop-shadow-[0_0_5px_rgba(34,197,94,0.6)]'
  if (wr >= 45) return 'text-[#FFC91B] drop-shadow-[0_0_5px_rgba(255,201,27,0.6)]'
  return 'text-red-500 drop-shadow-[0_0_5px_rgba(239,68,68,0.6)]'
}

const SESSION_META: Record<number, { label: string; icon: string; color: string; width: string }> = {
  3: { label: '1-3', icon: '▶️', color: '#4ade80', width: 'w-1/4' },
  6: { label: '4-6', icon: '⏩', color: '#4EC0FA', width: 'w-2/4' },
  10: { label: '7-10', icon: '🏃', color: '#FFC91B', width: 'w-3/4' },
  15: { label: '11-15', icon: '🌩️', color: '#f97316', width: 'w-11/12' },
  99: { label: '16+', icon: '🔥', color: '#ef4444', width: 'w-full' },
}

export function SessionEfficiencyCard({ data }: Props) {
  const t = useTranslations('advancedAnalytics')

  const filtered = data.filter(d => d.count > 0)
  if (filtered.length === 0) return null

  const best = [...filtered].sort((a, b) => b.avgWinRate - a.avgWinRate)[0]

  return (
    <div className="relative overflow-hidden bg-[#090E17]/80 backdrop-blur-md rounded-xl p-5 md:p-6 border-b-[4px] border-[#06090E] shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_8px_16px_rgba(0,0,0,0.6)]">
      <h3 className="font-['Lilita_One'] text-lg text-white mb-5 flex items-center gap-2 drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]">
        <span className="text-xl drop-shadow-[0_0_8px_rgba(78,192,250,0.8)]">⏱️</span> {t('sessionEffTitle')}
        <InfoTooltip className="ml-1.5 opacity-70 hover:opacity-100" text={t('tipSessionEff')} />
      </h3>

      <div className="space-y-3 relative z-10">
        {filtered.map(d => {
          const meta = SESSION_META[d.sessionLength] || { label: `${d.sessionLength}`, icon: '⚡', color: '#ffffff', width: 'w-1/2' }
          const isBest = d.sessionLength === best.sessionLength
          return (
            <div
              key={d.sessionLength}
              className={`group flex items-center gap-4 bg-[#0A0E1A] border border-white/5 rounded-xl p-3 pr-5 transition-all duration-300 hover:border-[#4EC0FA]/30 hover:bg-white/[0.03] overflow-hidden relative ${isBest ? 'ring-1 ring-[#FFC91B]/50 hover:ring-[#FFC91B] shadow-[0_0_15px_rgba(255,201,27,0.15)]' : ''}`}
            >
              {/* Progress bar background indicator based on session length */}
              <div 
                className={`absolute left-0 top-0 bottom-0 ${meta.width} opacity-5 group-hover:opacity-10 transition-opacity bg-gradient-to-r from-transparent to-white`} 
                style={{ backgroundImage: `linear-gradient(to right, transparent, ${meta.color})` }}
              />

              {isBest && (
                <div className="absolute top-0 right-3 bg-[#FFC91B] text-black text-[8px] uppercase font-black px-1.5 rounded-b-md shadow-[0_2px_5px_rgba(255,201,27,0.5)]">
                  {t('best')}
                </div>
              )}

              <div className="w-16 flex flex-col items-center justify-center shrink-0 border-r border-white/10 pr-2">
                <span className="text-xl opacity-90 drop-shadow-md mb-1">{meta.icon}</span>
                <p className="font-['Lilita_One'] text-sm tracking-widest drop-shadow-[0_0_5px_currentColor]" style={{ color: meta.color }}>{meta.label}</p>
                <p className="text-[8px] uppercase tracking-widest text-slate-500 font-bold">{t('sessionLengthLabel')}</p>
              </div>

              <div className="flex-1 min-w-0 py-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] uppercase font-black tracking-widest text-slate-400">Win Rate</span>
                  <span className="text-[10px] uppercase font-black tracking-widest text-slate-400">Trophies/Game</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className={`font-['Lilita_One'] text-2xl tabular-nums tracking-wide ${wrColor(d.avgWinRate)}`}>
                    {d.avgWinRate.toFixed(1)}%
                  </span>
                  <span className={`font-['Lilita_One'] text-lg tabular-nums tracking-wide bg-black/40 px-2 py-0.5 rounded border border-white/5 shadow-inner ${d.avgTrophiesPerGame >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {d.avgTrophiesPerGame > 0 ? '+' : ''}{d.avgTrophiesPerGame.toFixed(1)} 🏆
                  </span>
                </div>
              </div>

              <div className="flex flex-col items-center shrink-0 pl-3 border-l border-white/10">
                <span className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-0.5">Frequency</span>
                <span className="font-['Lilita_One'] text-base text-slate-300">
                  ×{d.count}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
