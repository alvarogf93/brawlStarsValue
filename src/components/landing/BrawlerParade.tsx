'use client'

import { useTranslations } from 'next-intl'
import { getBrawlerPortraitUrl, getBrawlerPortraitFallback } from '@/lib/utils'
import { BrawlImg } from '@/components/ui/BrawlImg'
import { BRAWLER_RARITY_MAP } from '@/lib/constants'
import type { BrawlerRarityName } from '@/lib/types'

const RARITY_COLORS: Record<BrawlerRarityName, string> = {
  'Trophy Road': '#9CA3AF',
  'Rare': '#4ADE80',
  'Super Rare': '#3B82F6',
  'Epic': '#A855F7',
  'Mythic': '#EF4444',
  'Legendary': '#FFC91B',
  'Chromatic': '#E879F9',
  'Ultra Legendary': '#FF6B35',
}

const ALL_IDS = Object.keys(BRAWLER_RARITY_MAP).map(Number)
const ROW1_IDS = ALL_IDS.filter((_, i) => i % 2 === 0)
const ROW2_IDS = ALL_IDS.filter((_, i) => i % 2 === 1)

function ParadeRow({ ids, direction }: { ids: number[]; direction: 'left' | 'right' }) {
  const cls = direction === 'left' ? 'parade-row-left' : 'parade-row-right'
  const items = [...ids, ...ids]

  return (
    <div className="overflow-hidden">
      <div className={`flex gap-3 w-max ${cls}`}>
        {items.map((id, i) => {
          const rarity = BRAWLER_RARITY_MAP[id] ?? 'Rare'
          const borderColor = RARITY_COLORS[rarity] ?? '#9CA3AF'
          return (
            <div
              key={`${id}-${i}`}
              className="w-16 h-16 shrink-0 rounded-xl overflow-hidden"
              style={{ border: `3px solid ${borderColor}` }}
            >
              <BrawlImg
                src={getBrawlerPortraitUrl(id)}
                fallbackSrc={getBrawlerPortraitFallback(id)}
                alt={`Brawler ${id}`}
                className="w-full h-full object-cover"
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function BrawlerParade() {
  const t = useTranslations('landing')

  return (
    <section className="w-full max-w-[1200px] mx-auto">
      <h2 className="text-4xl font-['Lilita_One'] text-white text-stroke-brawl text-center mb-8">
        {t('paradeTitle')}
      </h2>
      <div className="flex flex-col gap-3">
        <ParadeRow ids={ROW1_IDS} direction="left" />
        <ParadeRow ids={ROW2_IDS} direction="right" />
      </div>
    </section>
  )
}
