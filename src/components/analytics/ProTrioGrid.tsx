'use client'

import { useTranslations } from 'next-intl'
import { getBrawlerPortraitUrl, getBrawlerPortraitFallback, wrColor } from '@/lib/utils'
import { BrawlImg } from '@/components/ui/BrawlImg'
import { useMapImages } from '@/hooks/useMapImages'
import type { ProTrioEntry } from '@/lib/draft/pro-analysis'

interface Props {
  trios: ProTrioEntry[]
  mapName: string
}

function medal(i: number): string {
  if (i === 0) return '\uD83E\uDD47'
  if (i === 1) return '\uD83E\uDD48'
  if (i === 2) return '\uD83E\uDD49'
  return ''
}

export function ProTrioGrid({ trios, mapName }: Props) {
  const t = useTranslations('metaPro')
  const mapImages = useMapImages()
  const mapImageUrl = mapImages[mapName] ?? null

  if (trios.length === 0) {
    return (
      <div className="brawl-card-dark p-5 border-[#090E17] text-center">
        <p className="text-sm text-slate-500">{t('noDataForMap')}</p>
      </div>
    )
  }

  return (
    <div className="brawl-card-dark p-5 md:p-6 border-[#090E17]">
      <h3 className="font-['Lilita_One'] text-lg text-white mb-4 flex items-center gap-2">
        <span className="text-xl">{'\uD83E\uDD1D'}</span> {t('proTriosTitle')}
      </h3>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        {trios.map((trio, i) => (
          <div key={trio.brawlers.map(b => b.id).join('-')} className="relative rounded-xl overflow-hidden border border-white/10">
            {mapImageUrl && (
              <>
                <img src={mapImageUrl} alt={mapName} className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0A0E1A] via-[#0A0E1A]/75 to-[#0A0E1A]/30" />
              </>
            )}
            <div className={`relative p-3 flex flex-col items-center gap-2 ${!mapImageUrl ? 'brawl-row' : ''}`}>
              {i < 3 && <span className="absolute top-1.5 left-2 text-sm">{medal(i)}</span>}
              <div className="flex items-center -space-x-1.5">
                {trio.brawlers.map(b => (
                  <BrawlImg key={b.id} src={getBrawlerPortraitUrl(b.id)} fallbackSrc={getBrawlerPortraitFallback(b.id)} alt={b.name} className="w-9 h-9 rounded-lg ring-2 ring-[#090E17]" />
                ))}
              </div>
              <span className={`font-['Lilita_One'] text-lg tabular-nums drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] ${wrColor(trio.winRate)}`}>
                {trio.winRate.toFixed(1)}%
              </span>
              <span className="text-[10px] text-slate-400">{trio.total} games</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
