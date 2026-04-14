'use client'

import { useTranslations } from 'next-intl'
import { getGameModeImageUrl, wrColor } from '@/lib/utils'
import { MODE_DISPLAY_NAMES } from '@/lib/constants'
import type { ModePerformance } from '@/lib/analytics/types'

interface Props {
  data: ModePerformance[]
}

export function ModePerformanceChart({ data }: Props) {
  const t = useTranslations('advancedAnalytics')

  if (data.length === 0) return null

  const sorted = [...data].sort((a, b) => b.winRate - a.winRate)

  return (
    <div className="relative overflow-hidden bg-[#090E17]/80 backdrop-blur-md rounded-xl p-5 md:p-6 border-b-[4px] border-[#06090E] shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_8px_16px_rgba(0,0,0,0.6)]">
      <h3 className="font-['Lilita_One'] text-lg text-white mb-5 flex items-center gap-2 drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]">
        <span className="text-xl drop-shadow-[0_0_8px_rgba(0,227,255,0.5)]">{'\uD83C\uDFAE'}</span> {t('modePerformance')}
      </h3>

      <div className="space-y-3 relative z-10">
        {sorted.map(m => {
          const modeIconUrl = getGameModeImageUrl(m.mode)
          const barWidth = Math.max(10, Math.min(100, m.winRate))

          return (
            <div key={m.mode} className="bg-white/[0.03] hover:bg-white/[0.05] transition-colors border border-white/5 rounded-lg px-4 py-3 flex items-center gap-4">
              {/* Mode icon */}
              {modeIconUrl && (
                <div className="bg-[#121A2F]/90 backdrop-blur-md rounded-lg p-1 border border-white/10 shadow-lg">
                  <img src={modeIconUrl} alt={m.mode} className="w-6 h-6 flex-shrink-0 drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]" width={24} height={24} />
                </div>
              )}

              {/* Mode name + games */}
              <div className="w-24 flex-shrink-0">
                <p className="font-['Lilita_One'] text-sm text-white truncate drop-shadow-md">
                  {MODE_DISPLAY_NAMES[m.mode] ?? m.mode}
                </p>
                <p className="text-[10px] uppercase font-bold tracking-widest text-[#4EC0FA] mt-0.5">
                  {m.total} <span className="text-slate-500">{t('games')}</span>
                </p>
              </div>

              {/* Ammo Bar */}
              <div className="flex-1 h-5 bg-black/60 shadow-[inset_0_2px_4px_rgba(0,0,0,0.8)] overflow-hidden" style={{ transform: 'skewX(-15deg)' }}>
                <div
                  className="h-full relative overflow-hidden"
                  style={{
                    width: `${barWidth}%`,
                    background: m.winRate >= 55
                      ? 'linear-gradient(90deg, rgba(34,197,94,0.6), rgba(74,222,128,1))'
                      : m.winRate >= 45
                        ? 'linear-gradient(90deg, rgba(255,201,27,0.6), rgba(251,191,36,1))'
                        : 'linear-gradient(90deg, rgba(239,68,68,0.6), rgba(248,113,113,1))',
                    boxShadow: m.winRate >= 55 
                      ? '0 0 10px rgba(74,222,128,0.5)'
                      : m.winRate >= 45 
                        ? '0 0 10px rgba(251,191,36,0.5)'
                        : '0 0 10px rgba(248,113,113,0.5)'
                  }}
                >
                  {/* Energy glint effect */}
                  <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent_0%,rgba(255,255,255,0.3)_50%,transparent_100%)] bg-[length:400%_100%] animate-[shimmer_3s_infinite]" />
                </div>
              </div>

              {/* WR value */}
              <span className={`font-['Lilita_One'] text-lg tabular-nums tracking-wide w-14 text-right flex-shrink-0 ${
                m.winRate >= 60 ? 'text-green-400 drop-shadow-[0_0_5px_rgba(34,197,94,0.5)]' :
                m.winRate >= 45 ? 'text-[#FFC91B] drop-shadow-[0_0_5px_rgba(255,201,27,0.5)]' :
                'text-red-400 drop-shadow-[0_0_5px_rgba(239,68,68,0.5)]'
              }`}>
                {m.winRate.toFixed(1)}%
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
