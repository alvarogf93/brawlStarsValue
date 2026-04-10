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
  const b = playerBrawler

  // Trophy progress percentage (current / highest)
  const trophyPct = b && b.highestTrophies > 0
    ? Math.round((b.trophies / b.highestTrophies) * 100)
    : 0

  return (
    <div className="brawl-card p-0 overflow-hidden">
      {/* ═══ TOP: Dark hero section with portrait ═══ */}
      <div
        className="relative px-5 pt-4 pb-6 md:px-8 md:pt-5 md:pb-8"
        style={{
          background: `linear-gradient(135deg, #121A2F 0%, #1a2744 50%, ${rarityColor}25 100%)`,
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

        {/* Portrait + Name row */}
        <div className="flex items-center gap-5 md:gap-8">
          {/* Portrait with glow */}
          <div className="relative shrink-0">
            <div
              className="absolute -inset-2 rounded-3xl opacity-30 blur-xl"
              style={{ backgroundColor: rarityColor }}
            />
            <div
              className="relative w-[110px] h-[110px] md:w-[140px] md:h-[140px] rounded-2xl border-4 overflow-hidden shadow-[0_6px_0_rgba(0,0,0,0.4)]"
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

          {/* Name + rarity + class */}
          <div className="flex-1 min-w-0">
            <h1 className="text-3xl md:text-5xl text-white font-['Lilita_One'] leading-none text-stroke-brawl tracking-wide truncate">
              {name}
            </h1>
            <div className="flex items-center gap-2.5 mt-2.5">
              <span
                className="px-3 py-1 rounded-full text-[10px] font-['Lilita_One'] border-2 shadow-[0_2px_0_rgba(0,0,0,0.4)] uppercase tracking-wider"
                style={{ backgroundColor: rarityColor, borderColor: `${rarityColor}`, color: '#121A2F' }}
              >
                {rarity}
              </span>
              {brawlerInfo?.class && (
                <span className="text-xs text-slate-400 font-['Lilita_One'] uppercase tracking-wider">
                  {brawlerInfo.class}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ═══ BOTTOM: White section with stats + loadout ═══ */}
      {b ? (
        <div className="px-5 py-5 md:px-8 md:py-6 space-y-5">
          {/* ── STATS ROW ── */}
          <div className="grid grid-cols-4 gap-2">
            {/* Power */}
            <div className="bg-purple-600/10 rounded-xl p-3 text-center border-2 border-purple-500/20">
              <p className="text-[9px] text-purple-400 font-['Lilita_One'] uppercase">Power</p>
              <p className="text-2xl font-['Lilita_One'] text-purple-500">{b.power}</p>
            </div>
            {/* Rank */}
            <div className="bg-amber-500/10 rounded-xl p-3 text-center border-2 border-amber-400/20">
              <p className="text-[9px] text-amber-500 font-['Lilita_One'] uppercase">Rank</p>
              <p className="text-2xl font-['Lilita_One'] text-amber-500">{b.rank}</p>
            </div>
            {/* Trophies — with progress bar */}
            <div className="col-span-2 bg-[#121A2F]/5 rounded-xl p-3 border-2 border-slate-200/50">
              <div className="flex items-center justify-between mb-1">
                <p className="text-[9px] text-slate-500 font-['Lilita_One'] uppercase">🏆 Trophies</p>
                <p className="text-[9px] text-slate-400 font-['Inter']">max {b.highestTrophies.toLocaleString()}</p>
              </div>
              <p className="text-2xl font-['Lilita_One'] text-[var(--color-brawl-dark)]">{b.trophies.toLocaleString()}</p>
              {/* Progress bar */}
              <div className="mt-1.5 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${trophyPct}%`, backgroundColor: rarityColor }}
                />
              </div>
            </div>
          </div>

          {/* ── BADGES: Prestige + Win Streak ── */}
          {(b.prestigeLevel > 0 || b.maxWinStreak > 0) && (
            <div className="flex flex-wrap gap-2">
              {b.prestigeLevel > 0 && (
                <span className="px-3 py-1.5 rounded-xl bg-[#FFC91B] border-2 border-[#121A2F] text-[#121A2F] text-xs font-['Lilita_One'] shadow-[0_2px_0_rgba(18,26,47,1)]">
                  ⭐ Prestige {b.prestigeLevel}
                </span>
              )}
              {b.maxWinStreak > 0 && (
                <span className="px-3 py-1.5 rounded-xl bg-[var(--color-brawl-blue)] border-2 border-[#121A2F] text-white text-xs font-['Lilita_One'] shadow-[0_2px_0_rgba(18,26,47,1)]">
                  🔥 {b.maxWinStreak} Win Streak
                </span>
              )}
            </div>
          )}

          {/* ── LOADOUT: Star Powers + Gadgets ── */}
          {(b.starPowers.length > 0 || b.gadgets.length > 0) && (
            <div>
              <p className="text-[10px] text-slate-400 font-['Lilita_One'] uppercase tracking-[0.2em] mb-2.5 flex items-center gap-2">
                <span className="h-[1px] flex-1 bg-slate-200" />
                Loadout
                <span className="h-[1px] flex-1 bg-slate-200" />
              </p>
              <div className="grid grid-cols-2 gap-2">
                {b.starPowers.map(sp => (
                  <div key={sp.id} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#FFC91B] border-2 border-[#121A2F] shadow-[0_2px_0_rgba(18,26,47,1)]">
                    <img src={`/assets/star-powers/${sp.id}.png`} alt={sp.name} className="w-7 h-7" width={28} height={28} loading="lazy" />
                    <span className="text-xs text-[#121A2F] font-['Lilita_One'] truncate">{sp.name}</span>
                  </div>
                ))}
                {b.gadgets.map(g => (
                  <div key={g.id} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-green-500 border-2 border-[#121A2F] shadow-[0_2px_0_rgba(18,26,47,1)]">
                    <img src={`/assets/gadgets/${g.id}.png`} alt={g.name} className="w-7 h-7" width={28} height={28} loading="lazy" />
                    <span className="text-xs text-[#121A2F] font-['Lilita_One'] truncate">{g.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── EXTRAS: Hypercharges + Gears + Buffies ── */}
          {(b.hyperCharges.length > 0 || b.gears.length > 0 || b.buffies.gadget || b.buffies.starPower || b.buffies.hyperCharge) && (
            <div className="flex flex-wrap gap-2">
              {b.hyperCharges.map(hc => (
                <span key={hc.id} className="px-3 py-1.5 rounded-xl bg-purple-600 border-2 border-[#121A2F] text-xs text-white font-['Lilita_One'] shadow-[0_2px_0_rgba(18,26,47,1)] flex items-center gap-1">
                  ⚡ {hc.name}
                </span>
              ))}
              {b.gears.length > 0 && (
                <span className="px-3 py-1.5 rounded-xl bg-slate-600 border-2 border-[#121A2F] text-xs text-white font-['Lilita_One'] shadow-[0_2px_0_rgba(18,26,47,1)]">
                  🔩 {b.gears.length} Gears
                </span>
              )}
              {b.buffies.gadget && (
                <span className="px-3 py-1.5 rounded-xl bg-green-600 border-2 border-[#121A2F] text-xs text-white font-['Lilita_One'] shadow-[0_2px_0_rgba(18,26,47,1)]">🅱️G</span>
              )}
              {b.buffies.starPower && (
                <span className="px-3 py-1.5 rounded-xl bg-[#FFC91B] border-2 border-[#121A2F] text-xs text-[#121A2F] font-['Lilita_One'] shadow-[0_2px_0_rgba(18,26,47,1)]">🅱️S</span>
              )}
              {b.buffies.hyperCharge && (
                <span className="px-3 py-1.5 rounded-xl bg-purple-600 border-2 border-[#121A2F] text-xs text-white font-['Lilita_One'] shadow-[0_2px_0_rgba(18,26,47,1)]">🅱️H</span>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="px-5 py-6 md:px-8 text-center">
          <p className="text-sm text-slate-500 font-['Lilita_One']">{t('notUnlocked')}</p>
        </div>
      )}
    </div>
  )
}
