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

// 6 universal base gears that every brawler can equip
const BASE_GEAR_IDS = [62000000, 62000001, 62000002, 62000003, 62000004, 62000017]

function getGearImageUrl(id: number): string {
  return `https://cdn.brawlify.com/gears/regular/${id}.png`
}

export function HeroBanner({ brawlerId, brawlerInfo, playerBrawler }: Props) {
  const { tag, locale } = useParams<{ tag: string; locale: string }>()
  const t = useTranslations('brawlerDetail')

  const rarity: BrawlerRarityName = BRAWLER_RARITY_MAP[brawlerId] ?? 'Trophy Road'
  const rarityColor = RARITY_COLORS[rarity]
  const name = brawlerInfo?.name ?? playerBrawler?.name ?? `Brawler ${brawlerId}`
  const basePath = tag ? `/${locale}/profile/${tag}` : ''
  const b = playerBrawler

  const ownedGears = b?.gears ?? []
  const ownedGearIds = new Set(ownedGears.map(g => g.id))
  // Show base gears + any special gears the brawler owns that aren't in the base set
  const specialGears = ownedGears.filter(g => !BASE_GEAR_IDS.includes(g.id))
  const allDisplayGearIds = [...BASE_GEAR_IDS, ...specialGears.map(g => g.id)]
  const hasHC = (b?.hyperCharges?.length ?? 0) > 0

  return (
    <div
      className="rounded-3xl border-4 border-[var(--color-brawl-dark)] overflow-hidden relative"
      style={{ boxShadow: '4px 8px 0px var(--color-brawl-dark), inset 0px -6px 0px rgba(0,0,0,0.1), inset 0px 4px 0px rgba(255,255,255,0.7)' }}
    >
      {/* White dotted background layer */}
      <div
        className="absolute inset-0 z-0"
        style={{
          backgroundColor: 'white',
          backgroundImage: 'radial-gradient(circle, #c8ccd4 1px, transparent 1px)',
          backgroundSize: '18px 18px',
        }}
      />

      {/* Fade overlay: white near portrait → transparent at edges */}
      {/* Mobile: top→bottom fade. Desktop: top-left→bottom-right fade */}
      <div
        className="absolute inset-0 z-[1] pointer-events-none md:hidden"
        style={{
          background: 'linear-gradient(180deg, transparent 0%, transparent 30%, rgba(15,23,42,0.15) 50%, rgba(15,23,42,0.45) 70%, rgba(15,23,42,0.75) 85%, rgba(15,23,42,0.92) 100%)',
        }}
      />
      <div
        className="absolute inset-0 z-[1] pointer-events-none hidden md:block"
        style={{
          background: 'linear-gradient(135deg, transparent 0%, transparent 20%, rgba(15,23,42,0.1) 35%, rgba(15,23,42,0.3) 50%, rgba(15,23,42,0.55) 65%, rgba(15,23,42,0.78) 80%, rgba(15,23,42,0.92) 100%)',
        }}
      />

      {/* Content — above both layers */}
      <div className="relative z-[2]">

        {/* ═══ MOBILE LAYOUT ═══ */}
        <div className="md:hidden">
          {/* Portrait hero */}
          <div className="relative h-[200px] flex items-center justify-center overflow-hidden">
            <div className="absolute inset-0" style={{ background: `radial-gradient(ellipse at center 50%, ${rarityColor}18 0%, transparent 70%)` }} />

            <span
              className="absolute top-3 left-3 z-10 px-3 py-1 rounded-full text-[9px] font-['Lilita_One'] uppercase tracking-[1.5px] border-2 border-[var(--color-brawl-dark)]"
              style={{ backgroundColor: rarityColor, color: '#121A2F', boxShadow: '0 2px 0 rgba(0,0,0,0.3)' }}
            >
              {rarity}
            </span>
            {brawlerInfo?.class && (
              <span className="absolute top-3 right-3 z-10 text-[10px] text-slate-500 font-['Lilita_One'] uppercase tracking-[2px]">
                {brawlerInfo.class}
              </span>
            )}

            {basePath && (
              <Link
                href={`${basePath}/brawlers`}
                className="absolute top-3 left-3 mt-8 z-10 text-xs text-slate-400 hover:text-[var(--color-brawl-dark)] transition-colors font-['Lilita_One']"
              >
                &larr; {t('backToBrawlers')}
              </Link>
            )}

            <div className="relative z-[2]">
              <div className="absolute -inset-2 rounded-2xl opacity-30 blur-xl" style={{ backgroundColor: rarityColor }} />
              <div
                className="relative w-[130px] h-[130px] rounded-2xl border-4 overflow-hidden"
                style={{ borderColor: rarityColor, boxShadow: `0 0 40px ${rarityColor}40, 0 6px 0 rgba(0,0,0,0.3)` }}
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

            <h1 className="absolute bottom-2 left-4 z-10 text-3xl text-white font-['Lilita_One'] text-stroke-brawl tracking-wide">
              {name}
            </h1>
          </div>

          {/* Equipment */}
          {b && (
            <div className="px-4 py-4 space-y-3">
              {/* Star Powers — individual chips with dotted bg */}
              <div>
                <p className="text-[9px] text-slate-500 font-['Lilita_One'] uppercase tracking-[2px] mb-1">Star Powers</p>
                <div className="flex gap-2">
                  {[0, 1].map(i => {
                    const sp = b.starPowers[i]
                    return sp ? (
                      <div key={sp.id} className="flex-1 relative flex items-center gap-1.5 px-2 py-1.5 rounded-xl border-2 border-[var(--color-brawl-dark)] shadow-[0_2px_0_rgba(18,26,47,1)] overflow-hidden" style={{ backgroundColor: '#FFC91B' }}>
                        <div className="absolute inset-0 opacity-15 bg-[radial-gradient(#121A2F_1px,transparent_1px)] [background-size:8px_8px]" />
                        <img src={`/assets/star-powers/${sp.id}.png`} alt={sp.name} className="relative w-6 h-6 rounded" width={24} height={24} loading="lazy" />
                        <span className="relative text-[10px] text-[#121A2F] font-['Lilita_One'] truncate">{sp.name}</span>
                      </div>
                    ) : (
                      <div key={`empty-sp-${i}`} className="flex-1 flex items-center gap-1.5 px-2 py-1.5 rounded-xl bg-slate-200 border-2 border-slate-300 opacity-30">
                        <div className="w-6 h-6 rounded bg-slate-300" />
                        <span className="text-[10px] text-slate-400 font-['Lilita_One']">—</span>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Gadgets — individual chips with dotted bg */}
              <div>
                <p className="text-[9px] text-slate-500 font-['Lilita_One'] uppercase tracking-[2px] mb-1">Gadgets</p>
                <div className="flex gap-2">
                  {[0, 1].map(i => {
                    const g = b.gadgets[i]
                    return g ? (
                      <div key={g.id} className="flex-1 relative flex items-center gap-1.5 px-2 py-1.5 rounded-xl border-2 border-[var(--color-brawl-dark)] shadow-[0_2px_0_rgba(18,26,47,1)] overflow-hidden" style={{ backgroundColor: '#22c55e' }}>
                        <div className="absolute inset-0 opacity-15 bg-[radial-gradient(#121A2F_1px,transparent_1px)] [background-size:8px_8px]" />
                        <img src={`/assets/gadgets/${g.id}.png`} alt={g.name} className="relative w-6 h-6 rounded" width={24} height={24} loading="lazy" />
                        <span className="relative text-[10px] text-[#121A2F] font-['Lilita_One'] truncate">{g.name}</span>
                      </div>
                    ) : (
                      <div key={`empty-g-${i}`} className="flex-1 flex items-center gap-1.5 px-2 py-1.5 rounded-xl bg-slate-200 border-2 border-slate-300 opacity-30">
                        <div className="w-6 h-6 rounded bg-slate-300" />
                        <span className="text-[10px] text-slate-400 font-['Lilita_One']">—</span>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Gears + HC + Buffies */}
              <div>
                <p className="text-[9px] text-slate-500 font-['Lilita_One'] uppercase tracking-[2px] mb-1">Gears</p>
                <div className={`grid gap-1 ${allDisplayGearIds.length > 6 ? 'grid-cols-7' : 'grid-cols-6'}`}>
                  {allDisplayGearIds.map(gid => (
                    <div
                      key={gid}
                      className={`aspect-square rounded-lg border-2 flex items-center justify-center p-1 ${
                        ownedGearIds.has(gid)
                          ? 'bg-slate-600 border-[var(--color-brawl-dark)] shadow-[0_2px_0_rgba(18,26,47,1)]'
                          : 'bg-slate-200 border-slate-300 opacity-30'
                      }`}
                    >
                      <img src={getGearImageUrl(gid)} alt="" className="w-full h-full object-contain" loading="lazy" />
                    </div>
                  ))}
                </div>
                {/* HC + Buffies row */}
                <div className="flex gap-1 mt-1.5">
                  <div className={`flex items-center gap-1 px-2 py-1 rounded-lg border-2 text-[9px] font-['Lilita_One'] ${
                    hasHC
                      ? 'bg-purple-600 border-[var(--color-brawl-dark)] text-white shadow-[0_2px_0_rgba(18,26,47,1)]'
                      : 'bg-slate-200 border-slate-300 text-slate-400 opacity-30'
                  }`}>
                    ⚡ HC
                  </div>
                  <div className={`flex items-center gap-1 px-2 py-1 rounded-lg border-2 text-[9px] font-['Lilita_One'] ${
                    b.buffies.gadget
                      ? 'bg-green-500 border-[var(--color-brawl-dark)] text-[#121A2F] shadow-[0_2px_0_rgba(18,26,47,1)]'
                      : 'bg-slate-200 border-slate-300 text-slate-400 opacity-30'
                  }`}>
                    🅱️G
                  </div>
                  <div className={`flex items-center gap-1 px-2 py-1 rounded-lg border-2 text-[9px] font-['Lilita_One'] ${
                    b.buffies.starPower
                      ? 'bg-[#FFC91B] border-[var(--color-brawl-dark)] text-[#121A2F] shadow-[0_2px_0_rgba(18,26,47,1)]'
                      : 'bg-slate-200 border-slate-300 text-slate-400 opacity-30'
                  }`}>
                    🅱️S
                  </div>
                  <div className={`flex items-center gap-1 px-2 py-1 rounded-lg border-2 text-[9px] font-['Lilita_One'] ${
                    b.buffies.hyperCharge
                      ? 'bg-purple-600 border-[var(--color-brawl-dark)] text-white shadow-[0_2px_0_rgba(18,26,47,1)]'
                      : 'bg-slate-200 border-slate-300 text-slate-400 opacity-30'
                  }`}>
                    🅱️H
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Chips */}
          {b && (
            <div className="px-4 pb-4 flex flex-wrap gap-1.5">
              <span className="px-2.5 py-1 rounded-lg bg-purple-600 border-2 border-[var(--color-brawl-dark)] text-white text-[10px] font-['Lilita_One'] shadow-[0_2px_0_rgba(18,26,47,1)]">PWR {b.power}</span>
              <span className="px-2.5 py-1 rounded-lg bg-amber-500 border-2 border-[var(--color-brawl-dark)] text-[#121A2F] text-[10px] font-['Lilita_One'] shadow-[0_2px_0_rgba(18,26,47,1)]">RANK {b.rank}</span>
              <span className="px-2.5 py-1 rounded-lg bg-[#1e293b] border-2 border-[var(--color-brawl-dark)] text-white text-[10px] font-['Lilita_One'] shadow-[0_2px_0_rgba(18,26,47,1)]">🏆 {b.trophies.toLocaleString()}</span>
              {b.prestigeLevel > 0 && (
                <span className="px-2.5 py-1 rounded-lg bg-[#FFC91B] border-2 border-[var(--color-brawl-dark)] text-[#121A2F] text-[10px] font-['Lilita_One'] shadow-[0_2px_0_rgba(18,26,47,1)]">⭐ Prestige {b.prestigeLevel}</span>
              )}
              {b.maxWinStreak > 0 && (
                <span className="px-2.5 py-1 rounded-lg bg-blue-500 border-2 border-[var(--color-brawl-dark)] text-white text-[10px] font-['Lilita_One'] shadow-[0_2px_0_rgba(18,26,47,1)]">🔥 {b.maxWinStreak} Streak</span>
              )}
            </div>
          )}

          {!b && (
            <div className="px-4 py-6 text-center">
              <p className="text-sm text-slate-500 font-['Lilita_One']">{t('notUnlocked')}</p>
            </div>
          )}
        </div>

        {/* ═══ DESKTOP LAYOUT ═══ */}
        <div className="hidden md:block">
          {basePath && (
            <Link
              href={`${basePath}/brawlers`}
              className="absolute top-4 left-5 z-10 text-xs text-slate-400 hover:text-[var(--color-brawl-dark)] transition-colors font-['Lilita_One']"
            >
              &larr; {t('backToBrawlers')}
            </Link>
          )}

          <div className="flex items-start gap-5 p-5 pt-10">
            {/* Portrait column */}
            <div className="flex flex-col items-center gap-2 shrink-0">
              <div className="relative">
                <div className="absolute -inset-2 rounded-2xl opacity-25 blur-xl" style={{ backgroundColor: rarityColor }} />
                <div
                  className="relative w-[120px] h-[120px] rounded-2xl border-4 overflow-hidden"
                  style={{ borderColor: rarityColor, boxShadow: `0 0 30px ${rarityColor}40, 0 5px 0 rgba(0,0,0,0.3)` }}
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
              <span
                className="px-3 py-1 rounded-full text-[8px] font-['Lilita_One'] uppercase tracking-[1.5px] border-2 border-[var(--color-brawl-dark)]"
                style={{ backgroundColor: rarityColor, color: '#121A2F', boxShadow: '0 2px 0 rgba(0,0,0,0.3)' }}
              >
                {rarity}
              </span>
            </div>

            {/* Info column */}
            <div className="flex-1 min-w-0 flex flex-col gap-3">
              {/* Name + class */}
              <div className="flex items-baseline gap-3">
                <h1 className="text-4xl text-white font-['Lilita_One'] text-stroke-brawl tracking-wide truncate">{name}</h1>
                {brawlerInfo?.class && (
                  <span className="text-[10px] text-slate-500 font-['Lilita_One'] uppercase tracking-[2px] shrink-0">{brawlerInfo.class}</span>
                )}
              </div>

              {b ? (
                <>
                  {/* Equipment grid: 3 columns */}
                  <div className="grid grid-cols-3 gap-3">
                    {/* Star Powers */}
                    <div>
                      <p className="text-[9px] text-slate-500 font-['Lilita_One'] uppercase tracking-[2px] mb-1.5">Star Powers</p>
                      <div className="flex flex-col gap-1.5">
                        {[0, 1].map(i => {
                          const sp = b.starPowers[i]
                          return sp ? (
                            <div key={sp.id} className="relative flex items-center gap-1.5 px-2 py-1.5 rounded-xl border-2 border-[var(--color-brawl-dark)] shadow-[0_2px_0_rgba(18,26,47,1)] overflow-hidden" style={{ backgroundColor: '#FFC91B' }}>
                              <div className="absolute inset-0 opacity-15 bg-[radial-gradient(#121A2F_1px,transparent_1px)] [background-size:8px_8px]" />
                              <img src={`/assets/star-powers/${sp.id}.png`} alt={sp.name} className="relative w-6 h-6 rounded" width={24} height={24} loading="lazy" />
                              <span className="relative text-[10px] text-[#121A2F] font-['Lilita_One'] truncate">{sp.name}</span>
                            </div>
                          ) : (
                            <div key={`empty-sp-${i}`} className="flex items-center gap-1.5 px-2 py-1.5 rounded-xl bg-slate-200 border-2 border-slate-300 opacity-30">
                              <div className="w-6 h-6 rounded bg-slate-300" />
                              <span className="text-[10px] text-slate-400 font-['Lilita_One']">—</span>
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    {/* Gadgets */}
                    <div>
                      <p className="text-[9px] text-slate-500 font-['Lilita_One'] uppercase tracking-[2px] mb-1.5">Gadgets</p>
                      <div className="flex flex-col gap-1.5">
                        {[0, 1].map(i => {
                          const g = b.gadgets[i]
                          return g ? (
                            <div key={g.id} className="relative flex items-center gap-1.5 px-2 py-1.5 rounded-xl border-2 border-[var(--color-brawl-dark)] shadow-[0_2px_0_rgba(18,26,47,1)] overflow-hidden" style={{ backgroundColor: '#22c55e' }}>
                              <div className="absolute inset-0 opacity-15 bg-[radial-gradient(#121A2F_1px,transparent_1px)] [background-size:8px_8px]" />
                              <img src={`/assets/gadgets/${g.id}.png`} alt={g.name} className="relative w-6 h-6 rounded" width={24} height={24} loading="lazy" />
                              <span className="relative text-[10px] text-[#121A2F] font-['Lilita_One'] truncate">{g.name}</span>
                            </div>
                          ) : (
                            <div key={`empty-g-${i}`} className="flex items-center gap-1.5 px-2 py-1.5 rounded-xl bg-slate-200 border-2 border-slate-300 opacity-30">
                              <div className="w-6 h-6 rounded bg-slate-300" />
                              <span className="text-[10px] text-slate-400 font-['Lilita_One']">—</span>
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    {/* Gears + HC + Buffies */}
                    <div>
                      <p className="text-[9px] text-slate-500 font-['Lilita_One'] uppercase tracking-[2px] mb-1.5">Gears</p>
                      <div className={`grid gap-1 max-w-[180px] ${allDisplayGearIds.length > 6 ? 'grid-cols-7' : 'grid-cols-6'}`}>
                        {allDisplayGearIds.map(gid => (
                          <div
                            key={gid}
                            className={`aspect-square rounded-lg border-2 flex items-center justify-center p-0.5 ${
                              ownedGearIds.has(gid)
                                ? 'bg-slate-600 border-[var(--color-brawl-dark)] shadow-[0_2px_0_rgba(18,26,47,1)]'
                                : 'bg-slate-200 border-slate-300 opacity-30'
                            }`}
                          >
                            <img src={getGearImageUrl(gid)} alt="" className="w-full h-full object-contain" loading="lazy" />
                          </div>
                        ))}
                      </div>
                      <div className="flex gap-1 mt-1.5 max-w-[160px]">
                        <div className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-md border-2 text-[8px] font-['Lilita_One'] ${
                          hasHC ? 'bg-purple-600 border-[var(--color-brawl-dark)] text-white shadow-[0_2px_0_rgba(18,26,47,1)]' : 'bg-slate-200 border-slate-300 text-slate-400 opacity-30'
                        }`}>⚡</div>
                        <div className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-md border-2 text-[8px] font-['Lilita_One'] ${
                          b.buffies.gadget ? 'bg-green-500 border-[var(--color-brawl-dark)] text-[#121A2F] shadow-[0_2px_0_rgba(18,26,47,1)]' : 'bg-slate-200 border-slate-300 text-slate-400 opacity-30'
                        }`}>🅱️G</div>
                        <div className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-md border-2 text-[8px] font-['Lilita_One'] ${
                          b.buffies.starPower ? 'bg-[#FFC91B] border-[var(--color-brawl-dark)] text-[#121A2F] shadow-[0_2px_0_rgba(18,26,47,1)]' : 'bg-slate-200 border-slate-300 text-slate-400 opacity-30'
                        }`}>🅱️S</div>
                        <div className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-md border-2 text-[8px] font-['Lilita_One'] ${
                          b.buffies.hyperCharge ? 'bg-purple-600 border-[var(--color-brawl-dark)] text-white shadow-[0_2px_0_rgba(18,26,47,1)]' : 'bg-slate-200 border-slate-300 text-slate-400 opacity-30'
                        }`}>🅱️H</div>
                      </div>
                    </div>
                  </div>

                  {/* Chips */}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    <span className="px-2.5 py-1 rounded-lg bg-purple-600 border-2 border-[var(--color-brawl-dark)] text-white text-[10px] font-['Lilita_One'] shadow-[0_2px_0_rgba(18,26,47,1)]">PWR {b.power}</span>
                    <span className="px-2.5 py-1 rounded-lg bg-amber-500 border-2 border-[var(--color-brawl-dark)] text-[#121A2F] text-[10px] font-['Lilita_One'] shadow-[0_2px_0_rgba(18,26,47,1)]">RANK {b.rank}</span>
                    <span className="px-2.5 py-1 rounded-lg bg-[#1e293b] border-2 border-[var(--color-brawl-dark)] text-white text-[10px] font-['Lilita_One'] shadow-[0_2px_0_rgba(18,26,47,1)]">🏆 {b.trophies.toLocaleString()}</span>
                    {b.prestigeLevel > 0 && (
                      <span className="px-2.5 py-1 rounded-lg bg-[#FFC91B] border-2 border-[var(--color-brawl-dark)] text-[#121A2F] text-[10px] font-['Lilita_One'] shadow-[0_2px_0_rgba(18,26,47,1)]">⭐ Prestige {b.prestigeLevel}</span>
                    )}
                    {b.maxWinStreak > 0 && (
                      <span className="px-2.5 py-1 rounded-lg bg-blue-500 border-2 border-[var(--color-brawl-dark)] text-white text-[10px] font-['Lilita_One'] shadow-[0_2px_0_rgba(18,26,47,1)]">🔥 {b.maxWinStreak} Streak</span>
                    )}
                  </div>
                </>
              ) : (
                <p className="text-sm text-slate-500 font-['Lilita_One'] mt-2">{t('notUnlocked')}</p>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
