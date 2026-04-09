'use client'

import { useTranslations } from 'next-intl'
import { getBrawlerPortraitUrl, getBrawlerPortraitFallback } from '@/lib/utils'
import { BrawlImg } from '@/components/ui/BrawlImg'
import type { TrendEntry } from '@/lib/draft/pro-analysis'

interface Props {
  rising: TrendEntry[]
  falling: TrendEntry[]
}

export function TrendingSection({ rising, falling }: Props) {
  const t = useTranslations('metaPro')

  if (rising.length === 0 && falling.length === 0) return null

  return (
    <div className="brawl-card-dark p-5 md:p-6 border-[#090E17]">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <h4 className="font-['Lilita_One'] text-sm text-green-400 mb-3 flex items-center gap-1.5">
            {t('trendRising')} {'\uD83D\uDCC8'}
          </h4>
          {rising.length === 0 ? (
            <p className="text-xs text-slate-600">{t('trendStable')}</p>
          ) : (
            <div className="space-y-2">
              {rising.map(entry => (
                <div key={entry.brawlerId} className="flex items-center gap-3 brawl-row rounded-xl px-3 py-2">
                  <BrawlImg
                    src={getBrawlerPortraitUrl(entry.brawlerId)}
                    fallbackSrc={getBrawlerPortraitFallback(entry.brawlerId)}
                    alt={entry.name}
                    className="w-8 h-8 rounded-lg"
                  />
                  <span className="font-['Lilita_One'] text-xs text-white flex-1 truncate">
                    {entry.name}
                  </span>
                  <span className="text-xs font-bold text-green-400 tabular-nums">
                    +{entry.delta7d.toFixed(1)}%
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <h4 className="font-['Lilita_One'] text-sm text-red-400 mb-3 flex items-center gap-1.5">
            {t('trendFalling')} {'\uD83D\uDCC9'}
          </h4>
          {falling.length === 0 ? (
            <p className="text-xs text-slate-600">{t('trendStable')}</p>
          ) : (
            <div className="space-y-2">
              {falling.map(entry => (
                <div key={entry.brawlerId} className="flex items-center gap-3 brawl-row rounded-xl px-3 py-2">
                  <BrawlImg
                    src={getBrawlerPortraitUrl(entry.brawlerId)}
                    fallbackSrc={getBrawlerPortraitFallback(entry.brawlerId)}
                    alt={entry.name}
                    className="w-8 h-8 rounded-lg"
                  />
                  <span className="font-['Lilita_One'] text-xs text-white flex-1 truncate">
                    {entry.name}
                  </span>
                  <span className="text-xs font-bold text-red-400 tabular-nums">
                    {entry.delta7d.toFixed(1)}%
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
