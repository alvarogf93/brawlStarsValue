'use client'

import { useTranslations } from 'next-intl'
import { getBrawlerPortraitUrl, getBrawlerPortraitFallback } from '@/lib/utils'
import { BrawlImg } from '@/components/ui/BrawlImg'
import type { GapEntry } from '@/lib/draft/pro-analysis'

interface Props {
  gaps: GapEntry[]
}

function verdictBadge(verdict: 'above' | 'below' | 'on-par', t: (key: string) => string) {
  switch (verdict) {
    case 'above':
      return <span className="text-[10px] font-bold text-green-400 bg-green-400/10 px-2 py-0.5 rounded-full">{t('gapAbove')}</span>
    case 'below':
      return <span className="text-[10px] font-bold text-red-400 bg-red-400/10 px-2 py-0.5 rounded-full">{t('gapBelow')}</span>
    case 'on-par':
      return <span className="text-[10px] font-bold text-[#FFC91B] bg-[#FFC91B]/10 px-2 py-0.5 rounded-full">{t('gapOnPar')}</span>
  }
}

export function GapAnalysisCards({ gaps }: Props) {
  const t = useTranslations('metaPro')

  if (gaps.length === 0) {
    return (
      <div className="brawl-card-dark p-5 border-[#090E17] text-center">
        <p className="text-sm text-slate-500">{t('noDataForMap')}</p>
      </div>
    )
  }

  return (
    <div className="brawl-card-dark p-5 md:p-6 border-[#090E17]">
      <h3 className="font-['Lilita_One'] text-lg text-white mb-2 flex items-center gap-2">
        <span className="text-xl">{'\uD83C\uDFAF'}</span> {t('gapTitle')}
      </h3>
      <p className="text-[10px] text-slate-500 mb-4">{t('gapImprove')}</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {gaps.map(g => (
          <div key={g.brawlerId} className="flex items-center gap-3 brawl-row rounded-xl px-4 py-3">
            <BrawlImg
              src={getBrawlerPortraitUrl(g.brawlerId)}
              fallbackSrc={getBrawlerPortraitFallback(g.brawlerId)}
              alt={g.name}
              className="w-10 h-10 rounded-lg"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <p className="font-['Lilita_One'] text-xs text-white truncate">{g.name}</p>
                {verdictBadge(g.verdict, t)}
              </div>
              <div className="flex items-center gap-3 text-[11px]">
                <span className="text-white">
                  {t('yourWR', { wr: g.yourWR.toFixed(1) })}
                  <span className="text-slate-600 ml-1">({g.yourTotal})</span>
                </span>
                <span className="text-[#FFC91B]">
                  {t('proWR', { wr: g.proWR.toFixed(1) })}
                  <span className="text-slate-600 ml-1">({g.proTotal})</span>
                </span>
              </div>
            </div>
            <span className={`font-['Lilita_One'] text-sm tabular-nums ${
              g.gap > 3 ? 'text-green-400' : g.gap < -3 ? 'text-red-400' : 'text-[#FFC91B]'
            }`}>
              {g.gap > 0 ? '+' : ''}{g.gap.toFixed(1)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
