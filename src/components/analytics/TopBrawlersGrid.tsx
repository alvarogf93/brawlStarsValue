'use client'

import { useTranslations } from 'next-intl'
import { getBrawlerPortraitUrl, getBrawlerPortraitFallback, wrColor } from '@/lib/utils'
import { BrawlImg } from '@/components/ui/BrawlImg'
import type { TopBrawlerEntry } from '@/lib/draft/pro-analysis'

interface Props {
  brawlers: TopBrawlerEntry[]
  totalBattles: number
}

function TrendBadge({ delta }: { delta: number | null }) {
  if (delta === null) return null
  if (delta > 2) {
    return (
      <span className="text-[10px] font-bold text-green-400 bg-green-400/10 px-1.5 py-0.5 rounded-md">
        {'\u2191'}{delta.toFixed(1)}%
      </span>
    )
  }
  if (delta < -2) {
    return (
      <span className="text-[10px] font-bold text-red-400 bg-red-400/10 px-1.5 py-0.5 rounded-md">
        {'\u2193'}{Math.abs(delta).toFixed(1)}%
      </span>
    )
  }
  return (
    <span className="text-[10px] font-bold text-slate-500 bg-white/5 px-1.5 py-0.5 rounded-md">
      {'\u2014'}
    </span>
  )
}

export function TopBrawlersGrid({ brawlers, totalBattles }: Props) {
  const t = useTranslations('metaPro')

  if (brawlers.length === 0) {
    return (
      <div className="brawl-card-dark p-5 border-[#090E17] text-center">
        <p className="text-sm text-slate-500">{t('noDataForMap')}</p>
      </div>
    )
  }

  return (
    <div className="brawl-card-dark p-5 md:p-6 border-[#090E17]">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-['Lilita_One'] text-lg text-white flex items-center gap-2">
          <span className="text-xl">{'\uD83C\uDFC6'}</span> {t('topBrawlersTitle')}
        </h3>
        <span className="text-[10px] text-slate-500 font-bold">
          {t('totalBattles', { count: String(totalBattles) })}
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
        {brawlers.map((b, i) => (
          <div
            key={b.brawlerId}
            className="brawl-row rounded-xl p-3 flex flex-col items-center gap-2 relative"
          >
            {i < 3 && (
              <span className="absolute top-1.5 left-2 text-sm">
                {i === 0 ? '\uD83E\uDD47' : i === 1 ? '\uD83E\uDD48' : '\uD83E\uDD49'}
              </span>
            )}

            <BrawlImg
              src={getBrawlerPortraitUrl(b.brawlerId)}
              fallbackSrc={getBrawlerPortraitFallback(b.brawlerId)}
              alt={b.name}
              className="w-12 h-12 rounded-lg ring-2 ring-[#090E17]"
            />

            <p className="font-['Lilita_One'] text-xs text-white truncate max-w-full">
              {b.name}
            </p>

            <p className={`font-['Lilita_One'] text-lg tabular-nums ${wrColor(b.winRate)}`}>
              {b.winRate.toFixed(1)}%
            </p>

            <p className="text-[10px] text-slate-500 tabular-nums">
              {b.pickRate.toFixed(1)}% picks
            </p>

            <TrendBadge delta={b.trend7d} />
          </div>
        ))}
      </div>
    </div>
  )
}
