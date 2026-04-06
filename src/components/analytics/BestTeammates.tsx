'use client'

import { useTranslations } from 'next-intl'
import type { TeammateStats } from '@/hooks/useAnalytics'

export function BestTeammates({ data }: { data: TeammateStats[] }) {
  const t = useTranslations('analytics')

  if (data.length === 0) return null

  return (
    <div className="brawl-card-dark p-5 md:p-6 border-[#090E17]">
      <h3 className="font-['Lilita_One'] text-lg text-white mb-4 flex items-center gap-2">
        <span className="text-xl">👥</span> {t('bestTeammates')}
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {data.map((tm, i) => (
          <div key={tm.tag} className="flex items-center gap-3 bg-white/[0.03] rounded-xl px-4 py-3">
            <span className={`font-['Lilita_One'] text-lg ${i === 0 ? 'text-[#FFC91B]' : i === 1 ? 'text-slate-300' : 'text-slate-500'}`}>
              {i + 1}
            </span>
            <div className="flex-1 min-w-0">
              <p className="font-['Lilita_One'] text-sm text-white truncate">{tm.name}</p>
              <p className="text-[10px] text-slate-500">{tm.gamesPlayed} {t('games')}</p>
            </div>
            <span className={`font-['Lilita_One'] text-sm ${tm.winRate >= 60 ? 'text-green-400' : tm.winRate >= 45 ? 'text-[#FFC91B]' : 'text-red-400'}`}>
              {tm.winRate}%
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
