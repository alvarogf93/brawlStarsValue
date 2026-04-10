'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { BrawlImg } from '@/components/ui/BrawlImg'
import { getBrawlerPortraitUrl, getBrawlerPortraitFallback } from '@/lib/utils'
import { BRAWLER_RARITY_MAP, RARITY_COLORS } from '@/lib/constants'
import type { BrawlerRarityName, BrawlerStat } from '@/lib/types'
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
  const name = brawlerInfo?.name ?? playerBrawler?.name ?? `Brawler ${brawlerId}`
  const basePath = tag ? `/${locale}/profile/${tag}` : ''

  const b = playerBrawler // shorthand

  return (
    <div className="brawl-card p-0 relative overflow-hidden">
      {/* Rarity accent strip — top edge */}
      <div className="h-1.5 w-full" style={{ backgroundColor: rarityColor }} />

      <div className="p-5 md:p-8">
        {/* Back link */}
        {basePath && (
          <Link
            href={`${basePath}/brawlers`}
            className="text-sm text-slate-400 hover:text-[var(--color-brawl-dark)] transition-colors font-['Lilita_One'] inline-block mb-5"
          >
            &larr; {t('backToBrawlers')}
          </Link>
        )}

        {/* === MAIN LAYOUT: Portrait left + Info right === */}
        <div className="flex flex-col sm:flex-row gap-6">

          {/* ── LEFT: Portrait + Rarity ── */}
          <div className="flex flex-col items-center gap-3 shrink-0">
            {/* Portrait with rarity glow */}
            <div className="relative">
              <div
                className="absolute -inset-1 rounded-2xl opacity-40 blur-md"
                style={{ backgroundColor: rarityColor }}
              />
              <div
                className="relative w-[130px] h-[130px] md:w-[150px] md:h-[150px] rounded-2xl border-4 overflow-hidden"
                style={{ borderColor: rarityColor }}
              >
                <BrawlImg
                  src={getBrawlerPortraitUrl(brawlerId)}
                  fallbackSrc={getBrawlerPortraitFallback(brawlerId)}
                  alt={name}
                  fallbackText={name}
                  className="w-full h-full object-cover"
                />
              </div>
            </div>

            {/* Rarity badge under portrait */}
            <span
              className="px-4 py-1.5 rounded-full text-xs font-['Lilita_One'] border-2 shadow-[0_2px_0_rgba(18,26,47,1)] tracking-wide uppercase"
              style={{ backgroundColor: rarityColor, borderColor: '#121A2F', color: '#121A2F' }}
            >
              {rarity}
            </span>
          </div>

          {/* ── RIGHT: Name + Stats + Equipment ── */}
          <div className="flex-1 min-w-0 flex flex-col gap-4">

            {/* Name + Class */}
            <div>
              <h1 className="text-3xl md:text-4xl text-white font-['Lilita_One'] leading-tight text-stroke-brawl transform -rotate-[0.5deg]">
                {name}
              </h1>
              {brawlerInfo?.class && (
                <p className="text-sm text-slate-500 font-['Lilita_One'] mt-1 tracking-wide uppercase">
                  {brawlerInfo.class}
                </p>
              )}
            </div>

            {b ? (
              <>
                {/* ── STATS ROW: Power / Rank / Trophies / Prestige ── */}
                <div className="grid grid-cols-3 gap-2 max-w-xs">
                  {/* Power */}
                  <div className="brawl-card-dark px-3 py-2 text-center border-[#090E17]">
                    <p className="text-[9px] text-slate-500 font-['Lilita_One'] uppercase">Power</p>
                    <p className="text-xl font-['Lilita_One'] text-purple-400">{b.power}</p>
                  </div>
                  {/* Rank */}
                  <div className="brawl-card-dark px-3 py-2 text-center border-[#090E17]">
                    <p className="text-[9px] text-slate-500 font-['Lilita_One'] uppercase">Rank</p>
                    <p className="text-xl font-['Lilita_One'] text-amber-400">{b.rank}</p>
                  </div>
                  {/* Trophies */}
                  <div className="brawl-card-dark px-3 py-2 text-center border-[#090E17]">
                    <p className="text-[9px] text-slate-500 font-['Lilita_One'] uppercase">🏆</p>
                    <p className="text-xl font-['Lilita_One'] text-white">{b.trophies.toLocaleString()}</p>
                    <p className="text-[8px] text-slate-600 font-['Inter']">max {b.highestTrophies.toLocaleString()}</p>
                  </div>
                </div>

                {/* Prestige + Win Streak inline */}
                {(b.prestigeLevel > 0 || b.maxWinStreak > 0) && (
                  <div className="flex flex-wrap gap-2">
                    {b.prestigeLevel > 0 && (
                      <span className="px-3 py-1 rounded-xl bg-[#FFC91B] border-2 border-[#121A2F] text-[#121A2F] text-xs font-['Lilita_One'] shadow-[0_2px_0_rgba(18,26,47,1)]">
                        ⭐ Prestige {b.prestigeLevel}
                      </span>
                    )}
                    {b.maxWinStreak > 0 && (
                      <span className="px-3 py-1 rounded-xl bg-[var(--color-brawl-blue)] border-2 border-[#121A2F] text-white text-xs font-['Lilita_One'] shadow-[0_2px_0_rgba(18,26,47,1)]">
                        🔥 {b.maxWinStreak} Win Streak
                      </span>
                    )}
                  </div>
                )}

                {/* ── LOADOUT: Star Powers + Gadgets ── */}
                {(b.starPowers.length > 0 || b.gadgets.length > 0) && (
                  <div className="border-t-2 border-dashed border-slate-200 pt-4 mt-1">
                    <p className="text-[10px] text-slate-400 font-['Lilita_One'] uppercase tracking-widest mb-2">Loadout</p>
                    <div className="flex flex-wrap gap-2">
                      {b.starPowers.map(sp => (
                        <div key={sp.id} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-[#FFC91B] border-2 border-[#121A2F] shadow-[0_2px_0_rgba(18,26,47,1)]">
                          <img src={`/assets/star-powers/${sp.id}.png`} alt={sp.name} className="w-6 h-6" width={24} height={24} loading="lazy" />
                          <span className="text-xs text-[#121A2F] font-['Lilita_One']">{sp.name}</span>
                        </div>
                      ))}
                      {b.gadgets.map(g => (
                        <div key={g.id} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-green-500 border-2 border-[#121A2F] shadow-[0_2px_0_rgba(18,26,47,1)]">
                          <img src={`/assets/gadgets/${g.id}.png`} alt={g.name} className="w-6 h-6" width={24} height={24} loading="lazy" />
                          <span className="text-xs text-[#121A2F] font-['Lilita_One']">{g.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ── EXTRAS: Hypercharges + Gears + Buffies ── */}
                {(b.hyperCharges.length > 0 || b.gears.length > 0 || b.buffies.gadget || b.buffies.starPower || b.buffies.hyperCharge) && (
                  <div className="flex flex-wrap gap-1.5">
                    {b.hyperCharges.map(hc => (
                      <span key={hc.id} className="px-2.5 py-1 rounded-xl bg-purple-600 border-2 border-[#121A2F] text-xs text-white font-['Lilita_One'] shadow-[0_2px_0_rgba(18,26,47,1)] flex items-center gap-1">
                        ⚡ {hc.name}
                      </span>
                    ))}
                    {b.gears.length > 0 && (
                      <span className="px-2.5 py-1 rounded-xl bg-slate-600 border-2 border-[#121A2F] text-xs text-white font-['Lilita_One'] shadow-[0_2px_0_rgba(18,26,47,1)]">
                        🔩 {b.gears.length} Gears
                      </span>
                    )}
                    {b.buffies.gadget && (
                      <span className="px-2.5 py-1 rounded-xl bg-green-600 border-2 border-[#121A2F] text-xs text-white font-['Lilita_One'] shadow-[0_2px_0_rgba(18,26,47,1)]">🅱️G</span>
                    )}
                    {b.buffies.starPower && (
                      <span className="px-2.5 py-1 rounded-xl bg-[#FFC91B] border-2 border-[#121A2F] text-xs text-[#121A2F] font-['Lilita_One'] shadow-[0_2px_0_rgba(18,26,47,1)]">🅱️S</span>
                    )}
                    {b.buffies.hyperCharge && (
                      <span className="px-2.5 py-1 rounded-xl bg-purple-600 border-2 border-[#121A2F] text-xs text-white font-['Lilita_One'] shadow-[0_2px_0_rgba(18,26,47,1)]">🅱️H</span>
                    )}
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-slate-500 font-['Lilita_One'] mt-2">
                {t('notUnlocked')}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
