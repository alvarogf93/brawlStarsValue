'use client'

import { useTranslations } from 'next-intl'
import type { ModeStats } from '@/hooks/useAnalytics'

const MODE_ICONS: Record<string, string> = {
  brawlBall: '⚽', gemGrab: '💎', showdown: '💀', duoShowdown: '💀',
  heist: '🔒', bounty: '⭐', siege: '🤖', hotZone: '🔥',
  knockout: '🥊', wipeout: '💥', payload: '🚚', paintBrawl: '🎨',
  trophyThieves: '🏆', duels: '⚔️', ranked: '🏅',
}

export function WinRateByMode({ data }: { data: ModeStats[] }) {
  const t = useTranslations('analytics')

  if (data.length === 0) return null

  return (
    <div className="brawl-card-dark p-5 md:p-6 border-[#090E17]">
      <h3 className="font-['Lilita_One'] text-lg text-white mb-4 flex items-center gap-2">
        <span className="text-xl">📊</span> {t('winRateByMode')}
      </h3>
      <div className="space-y-2.5">
        {data.map(m => (
          <div key={m.mode} className="flex items-center gap-3">
            <span className="text-lg w-7 text-center">{MODE_ICONS[m.mode] || '🎮'}</span>
            <span className="font-['Lilita_One'] text-sm text-slate-300 w-28 truncate">{m.mode}</span>
            <div className="flex-1 h-5 bg-[#0D1321] rounded-full overflow-hidden relative">
              <div
                className="h-full rounded-full relative overflow-hidden transition-all duration-700"
                style={{
                  width: `${m.winRate}%`,
                  background: m.winRate >= 60 ? 'linear-gradient(to right, #4ade80, #22c55e)' : m.winRate >= 45 ? 'linear-gradient(to right, #FFC91B, #F59E0B)' : 'linear-gradient(to right, #f87171, #ef4444)',
                }}
              >
                <div className="absolute inset-0 top-0 h-1/3 bg-white/25 rounded-full" />
              </div>
            </div>
            <span className={`font-['Lilita_One'] text-sm w-12 text-right tabular-nums ${m.winRate >= 60 ? 'text-green-400' : m.winRate >= 45 ? 'text-[#FFC91B]' : 'text-red-400'}`}>
              {m.winRate}%
            </span>
            <span className="text-[10px] text-slate-600 w-8 text-right">{m.total}g</span>
          </div>
        ))}
      </div>
    </div>
  )
}
