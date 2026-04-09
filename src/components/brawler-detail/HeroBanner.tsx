'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { BrawlImg } from '@/components/ui/BrawlImg'
import { getBrawlerPortraitUrl, getBrawlerPortraitFallback } from '@/lib/utils'
import { BRAWLER_RARITY_MAP, RARITY_COLORS } from '@/lib/constants'
import type { BrawlerRarityName } from '@/lib/types'
import type { BrawlerStat } from '@/lib/types'
import type { BrawlerEntry } from '@/lib/brawler-registry'

interface Props {
  brawlerId: number
  brawlerInfo: BrawlerEntry | null
  playerBrawler: BrawlerStat | null
}

export function HeroBanner({ brawlerId, brawlerInfo, playerBrawler }: Props) {
  const { tag, locale } = useParams<{ tag: string; locale: string }>()
  const t = useTranslations('brawlerDetail')

  const rarity: BrawlerRarityName = BRAWLER_RARITY_MAP[brawlerId] ?? 'Trophy Road'
  const rarityColor = RARITY_COLORS[rarity]
  const brawlerName = brawlerInfo?.name ?? playerBrawler?.name ?? `Brawler ${brawlerId}`
  const basePath = `/${locale}/profile/${tag}`

  return (
    <div
      className="brawl-card p-5 md:p-8 relative overflow-hidden"
      style={{
        background: `linear-gradient(135deg, ${rarityColor}20 0%, transparent 60%)`,
      }}
    >
      {/* Back link */}
      <Link
        href={`${basePath}/brawlers`}
        className="text-sm text-slate-400 hover:text-white transition-colors font-['Lilita_One'] inline-block mb-4"
      >
        &larr; {t('backToBrawlers')}
      </Link>

      <div className="flex flex-col sm:flex-row gap-5 md:gap-8 items-start sm:items-center">
        {/* Portrait */}
        <div
          className="w-[120px] h-[120px] md:w-[160px] md:h-[160px] rounded-2xl border-4 overflow-hidden shrink-0"
          style={{ borderColor: rarityColor }}
        >
          <BrawlImg
            src={getBrawlerPortraitUrl(brawlerId)}
            fallbackSrc={getBrawlerPortraitFallback(brawlerId)}
            alt={brawlerName}
            fallbackText={brawlerName}
            className="w-full h-full object-cover rounded-xl"
          />
        </div>

        {/* Info column */}
        <div className="flex flex-col gap-3">
          {/* Name */}
          <h1 className="text-3xl md:text-4xl text-white font-['Lilita_One'] leading-tight">
            {brawlerName}
          </h1>

          {/* Rarity badge */}
          <span
            className="inline-block self-start rounded-full px-3 py-1 text-xs font-['Lilita_One'] text-white border-2"
            style={{
              backgroundColor: `${rarityColor}66`,
              borderColor: rarityColor,
            }}
          >
            {rarity}
          </span>

          {/* Player stats or not-unlocked */}
          {playerBrawler ? (
            <div className="flex flex-wrap gap-3 mt-1">
              {/* Power badge */}
              <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-600/30 border border-purple-500/50 px-3 py-1 text-sm font-['Lilita_One'] text-purple-300">
                PWR {playerBrawler.power}
              </span>

              {/* Rank badge */}
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-600/30 border border-amber-500/50 px-3 py-1 text-sm font-['Lilita_One'] text-amber-300">
                RANK {playerBrawler.rank}
              </span>

              {/* Trophies */}
              <span className="inline-flex items-center gap-1.5 text-sm font-['Lilita_One'] text-white">
                🏆 {playerBrawler.trophies.toLocaleString()}
                <span className="text-slate-400">
                  ({playerBrawler.highestTrophies.toLocaleString()})
                </span>
              </span>
            </div>
          ) : (
            <p className="text-sm text-slate-500 font-['Lilita_One'] mt-1">
              {t('notUnlocked')}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
