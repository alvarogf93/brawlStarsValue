'use client'

import { useTranslations } from 'next-intl'
import { InfoTooltip } from '@/components/ui/InfoTooltip'
import type { OpponentStrengthBreakdown } from '@/lib/analytics/types'
import { ConfidenceBadge } from '@/components/ui/ConfidenceBadge'

interface Props {
  data: OpponentStrengthBreakdown[]
}

const TIER_META: Record<string, { icon: string; key: string; color: string; border: string; bg: string; shadow: string }> = {
  weak: { 
    icon: '🟢', 
    key: 'tierWeak', 
    color: 'text-green-400 drop-shadow-[0_0_8px_rgba(74,222,128,0.8)]',
    border: 'border-l-green-500',
    bg: 'bg-gradient-to-r from-green-500/10 to-transparent',
    shadow: 'shadow-[inset_2px_0_10px_rgba(74,222,128,0.1)]'
  },
  even: { 
    icon: '🟡', 
    key: 'tierEven', 
    color: 'text-[#FFC91B] drop-shadow-[0_0_8px_rgba(255,201,27,0.8)]',
    border: 'border-l-[#FFC91B]',
    bg: 'bg-gradient-to-r from-[#FFC91B]/10 to-transparent',
    shadow: 'shadow-[inset_2px_0_10px_rgba(255,201,27,0.1)]'
  },
  strong: { 
    icon: '🔴', 
    key: 'tierStrong', 
    color: 'text-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.8)]',
    border: 'border-l-red-600',
    bg: 'bg-gradient-to-r from-red-600/10 to-transparent',
    shadow: 'shadow-[inset_2px_0_10px_rgba(239,68,68,0.15)]'
  },
}

export function OpponentStrengthCard({ data }: Props) {
  const t = useTranslations('advancedAnalytics')

  const filtered = data.filter(d => d.total > 0)
  if (filtered.length === 0) return null

  return (
    <div className="relative overflow-hidden bg-[#090E17]/80 backdrop-blur-md rounded-xl p-5 md:p-6 border-b-[4px] border-[#06090E] shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_8px_16px_rgba(0,0,0,0.6)]">
      {/* Scouter background grid */}
      <div className="absolute inset-0 opacity-[0.03] bg-[linear-gradient(rgba(255,255,255,0.2)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.2)_1px,transparent_1px)] bg-[length:20px_20px] pointer-events-none" />
      
      {/* Target Crosshair */}
      <div className="absolute right-5 top-5 opacity-20 pointer-events-none w-16 h-16 border-2 border-white/50 rounded-full animate-[spin_10s_linear_infinite]">
        <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-white/50 transform -translate-x-1/2" />
        <div className="absolute left-0 right-0 top-1/2 h-0.5 bg-white/50 transform -translate-y-1/2" />
      </div>

      <h3 className="font-['Lilita_One'] text-lg text-white mb-5 flex items-center gap-2 relative z-10 drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]">
        <span className="text-xl drop-shadow-md">💪</span> {t('opponentTitle')}
        <InfoTooltip className="ml-1 opacity-70 hover:opacity-100" text={t('tipOpponent')} />
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 relative z-10">
        {filtered.map(d => {
          const meta = TIER_META[d.tier]
          return (
            <div key={d.tier} className={`relative overflow-hidden rounded-r-lg border-l-[3px] border-y border-r border-white/5 ${meta.border} ${meta.bg} ${meta.shadow} p-4 flex flex-col justify-between group hover:scale-[1.02] transition-transform`}>
              {/* Scanline */}
              <div className="absolute inset-0 bg-[linear-gradient(transparent_50%,rgba(0,0,0,0.2)_50%)] bg-[length:100%_4px] pointer-events-none opacity-50" />
              
              <div className="relative z-10 flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm opacity-80">{meta.icon}</span>
                  <span className="font-['Lilita_One'] text-sm tracking-wide text-white drop-shadow-md uppercase">{t(meta.key)}</span>
                </div>
                <ConfidenceBadge total={d.total} />
              </div>

              <div className="relative z-10 flex items-end justify-between">
                <div>
                  <p className="text-[9px] uppercase tracking-widest text-slate-400 font-bold mb-0.5">PWR LVL</p>
                  <p className={`font-mono font-bold text-3xl tabular-nums leading-none ${meta.color}`}>
                    {d.winRate.toFixed(1)}<span className="text-lg opacity-70">%</span>
                  </p>
                </div>
                
                <div className="text-right">
                  <p className="font-mono text-[11px] text-slate-300 bg-black/40 px-1.5 py-0.5 rounded border border-white/10 inline-block mb-1">
                    <span className="text-green-400">{d.wins}W</span> / {d.total}G
                  </p>
                  <p className="font-mono text-[10px] text-slate-500 uppercase tracking-widest flex items-center justify-end gap-1">
                    ~{Math.round(d.avgOpponentTrophies)} <span className="opacity-70">🏆</span>
                  </p>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
