'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { getBrawlerPortraitUrl } from '@/lib/utils'
import type { BrawlerStats } from '@/hooks/useAnalytics'

export function WinRateByBrawler({ data }: { data: BrawlerStats[] }) {
  const t = useTranslations('analytics')
  const [sortBy, setSortBy] = useState<'total' | 'winRate'>('total')

  if (data.length === 0) return null

  const sorted = [...data].sort((a, b) => sortBy === 'winRate' ? b.winRate - a.winRate : b.total - a.total)

  return (
    <div className="brawl-card-dark p-5 md:p-6 border-[#090E17]">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-['Lilita_One'] text-lg text-white flex items-center gap-2">
          <span className="text-xl">🎯</span> {t('winRateByBrawler')}
        </h3>
        <div className="flex gap-1">
          <button onClick={() => setSortBy('total')} className={`px-2 py-1 text-[10px] font-bold rounded ${sortBy === 'total' ? 'bg-[#FFC91B]/20 text-[#FFC91B]' : 'text-slate-500 hover:text-white'}`}>
            {t('sortGames')}
          </button>
          <button onClick={() => setSortBy('winRate')} className={`px-2 py-1 text-[10px] font-bold rounded ${sortBy === 'winRate' ? 'bg-[#FFC91B]/20 text-[#FFC91B]' : 'text-slate-500 hover:text-white'}`}>
            {t('sortWR')}
          </button>
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
        {sorted.map(b => (
          <div key={b.name} className="flex items-center gap-2 bg-white/[0.03] rounded-xl px-3 py-2">
            <img src={getBrawlerPortraitUrl(b.id)} alt={b.name} className="w-8 h-8 rounded-lg" loading="lazy" />
            <div className="flex-1 min-w-0">
              <p className="font-['Lilita_One'] text-xs text-white truncate">{b.name}</p>
              <p className="text-[10px] text-slate-500">{b.total}g</p>
            </div>
            <span className={`font-['Lilita_One'] text-sm ${b.winRate >= 60 ? 'text-green-400' : b.winRate >= 45 ? 'text-[#FFC91B]' : 'text-red-400'}`}>
              {b.winRate}%
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
