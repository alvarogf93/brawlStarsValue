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
  const basePath = tag ? `/${locale}/profile/${tag}` : ''

  return (
    <div
      className="brawl-card p-5 md:p-8 relative overflow-hidden"
      style={{
        background: `linear-gradient(135deg, ${rarityColor}20 0%, transparent 60%)`,
      }}
    >
      {/* Back link */}
      {basePath && (
        <Link
          href={`${basePath}/brawlers`}
          className="text-sm text-slate-400 hover:text-white transition-colors font-['Lilita_One'] inline-block mb-4"
        >
          &larr; {t('backToBrawlers')}
        </Link>
      )}

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
        <div className="flex flex-col gap-3 flex-1 min-w-0">
          {/* Name + class */}
          <div>
            <h1 className="text-3xl md:text-4xl text-white font-['Lilita_One'] leading-tight">
              {brawlerName}
            </h1>
            {brawlerInfo?.class && (
              <p className="text-sm text-slate-400 mt-0.5">{brawlerInfo.class}</p>
            )}
          </div>

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

          {/* Player stats */}
          {playerBrawler ? (
            <div className="space-y-3">
              {/* Row 1: Power, Rank, Trophies */}
              <div className="flex flex-wrap gap-2">
                <span className="px-2.5 py-1 rounded-lg bg-purple-600/30 border border-purple-500/50 text-purple-300 text-xs font-['Lilita_One']">
                  PWR {playerBrawler.power}
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-amber-600/30 border border-amber-500/50 text-amber-300 text-xs font-['Lilita_One']">
                  RANK {playerBrawler.rank}
                </span>
                <span className="text-sm text-white font-['Lilita_One'] flex items-center gap-1">
                  🏆 {playerBrawler.trophies.toLocaleString()}
                  <span className="text-xs text-slate-500">
                    (max {playerBrawler.highestTrophies.toLocaleString()})
                  </span>
                </span>
                {playerBrawler.prestigeLevel > 0 && (
                  <span className="px-2.5 py-1 rounded-lg bg-[#FFC91B]/20 border border-[#FFC91B]/50 text-[#FFC91B] text-xs font-['Lilita_One']">
                    ⭐ Prestige {playerBrawler.prestigeLevel}
                  </span>
                )}
              </div>

              {/* Row 2: Star Powers */}
              {playerBrawler.starPowers.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] text-slate-500 font-['Lilita_One'] uppercase tracking-wider">Star Powers:</span>
                  {playerBrawler.starPowers.map(sp => (
                    <div key={sp.id} className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[#FFC91B]/10 border border-[#FFC91B]/30">
                      <img src={`/assets/star-powers/${sp.id}.png`} alt={sp.name} className="w-5 h-5" width={20} height={20} loading="lazy" />
                      <span className="text-xs text-[#FFC91B] font-['Lilita_One']">{sp.name}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Row 3: Gadgets */}
              {playerBrawler.gadgets.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] text-slate-500 font-['Lilita_One'] uppercase tracking-wider">Gadgets:</span>
                  {playerBrawler.gadgets.map(g => (
                    <div key={g.id} className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-green-500/10 border border-green-500/30">
                      <img src={`/assets/gadgets/${g.id}.png`} alt={g.name} className="w-5 h-5" width={20} height={20} loading="lazy" />
                      <span className="text-xs text-green-400 font-['Lilita_One']">{g.name}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Row 4: Hypercharges + Gears + Buffies */}
              <div className="flex flex-wrap items-center gap-1.5">
                {playerBrawler.hyperCharges.length > 0 && playerBrawler.hyperCharges.map(hc => (
                  <span key={hc.id} className="px-2 py-0.5 rounded-lg bg-purple-500/10 border border-purple-500/30 text-xs text-purple-300 font-['Lilita_One'] flex items-center gap-1">
                    ⚡ {hc.name}
                  </span>
                ))}
                {playerBrawler.gears.length > 0 && (
                  <span className="px-2 py-0.5 rounded-lg bg-slate-500/10 border border-slate-500/30 text-xs text-slate-300 font-['Lilita_One']">
                    🔩 {playerBrawler.gears.length} Gears
                  </span>
                )}
                {playerBrawler.buffies.gadget && (
                  <span className="px-2 py-0.5 rounded-lg bg-green-500/10 border border-green-500/30 text-xs text-green-300 font-['Lilita_One']">
                    🅱️G
                  </span>
                )}
                {playerBrawler.buffies.starPower && (
                  <span className="px-2 py-0.5 rounded-lg bg-[#FFC91B]/10 border border-[#FFC91B]/30 text-xs text-[#FFC91B] font-['Lilita_One']">
                    🅱️S
                  </span>
                )}
                {playerBrawler.buffies.hyperCharge && (
                  <span className="px-2 py-0.5 rounded-lg bg-purple-500/10 border border-purple-500/30 text-xs text-purple-300 font-['Lilita_One']">
                    🅱️H
                  </span>
                )}
              </div>
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
