'use client'

import { useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { GemIcon } from '@/components/ui/GemIcon'
import { usePlayerData } from '@/hooks/usePlayerData'
import { BRAWLER_RARITY_MAP, RARITY_BASE_VALUE, POWER_LEVEL_GEM_COST, ENHANCE_VALUES } from '@/lib/constants'
import type { BrawlerStat, BrawlerRarityName } from '@/lib/types'

const RARITY_COLORS: Record<BrawlerRarityName, string> = {
  'Trophy Road': '#95A5A6',
  'Rare': '#27AE60',
  'Super Rare': '#3498DB',
  'Epic': '#8E44AD',
  'Mythic': '#E74C3C',
  'Legendary': '#F39C12',
  'Chromatic': '#E91E63',
  'Ultra Legendary': '#FFD700',
}

function calcBrawlerGemValue(b: BrawlerStat): number {
  const rarity = BRAWLER_RARITY_MAP[b.id] ?? 'Trophy Road'
  const rarityBase = RARITY_BASE_VALUE[rarity]
  const powerCost = POWER_LEVEL_GEM_COST[b.power] ?? 0
  const gadgets = b.gadgets.length * ENHANCE_VALUES.gadget
  const starPowers = b.starPowers.length * ENHANCE_VALUES.starPower
  const hypercharges = b.hyperCharges.length * ENHANCE_VALUES.hypercharge
  const buffies = [b.buffies?.gadget, b.buffies?.starPower, b.buffies?.hyperCharge].filter(Boolean).length * ENHANCE_VALUES.buffie
  const skin = (b.skin && b.skin.name !== b.name) ? ENHANCE_VALUES.skinEquipped : 0
  return rarityBase + powerCost + gadgets + starPowers + hypercharges + buffies + skin
}

export default function BrawlersPage() {
  const params = useParams<{ tag: string }>()
  const t = useTranslations('profile')
  const tag = decodeURIComponent(params.tag)
  const { data, isLoading, error } = usePlayerData(tag)

  if (isLoading) {
    return (
      <div className="animate-pulse py-20 text-center">
        <p className="text-slate-400 font-['Lilita_One'] text-2xl">Loading brawlers...</p>
      </div>
    )
  }

  if (error || !data?.player?.brawlers) {
    return (
      <div className="glass p-8 rounded-2xl text-center border-red-500/30">
        <p className="text-red-400">{error || 'Could not load brawler data.'}</p>
      </div>
    )
  }

  const brawlers = data.player.brawlers
  const sorted = [...brawlers].sort((a, b) => calcBrawlerGemValue(b) - calcBrawlerGemValue(a))

  return (
    <div className="animate-fade-in w-full pb-10">
      {/* Header Panel */}
      <div className="brawl-card p-6 md:p-8 mb-8 flex flex-col md:flex-row md:items-center justify-between bg-gradient-to-r from-[var(--color-brawl-blue)] to-[#121A2F]">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-[var(--color-brawl-gold)] border-4 border-[#121A2F] rounded-2xl flex items-center justify-center transform -rotate-6 shadow-[0_4px_0_0_#121A2F]">
            <span className="text-3xl">👥</span>
          </div>
          <div>
            <h1 className="text-4xl md:text-5xl font-['Lilita_One'] tracking-wide text-white text-stroke-brawl transform rotate-[-1deg]">
              {t('brawlerCount').toUpperCase()}
            </h1>
            <p className="font-['Inter'] font-semibold text-[var(--color-brawl-gold)]">
              {brawlers.length} / 101 Unlocked
            </p>
          </div>
        </div>
      </div>

      {/* Roster Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {sorted.map((brawler) => {
          const rarity = BRAWLER_RARITY_MAP[brawler.id] ?? 'Trophy Road'
          const gemValue = calcBrawlerGemValue(brawler)
          const color = RARITY_COLORS[rarity]
          const buffieCount = [brawler.buffies?.gadget, brawler.buffies?.starPower, brawler.buffies?.hyperCharge].filter(Boolean).length
          const hasCustomSkin = brawler.skin && brawler.skin.name !== brawler.name

          return (
            <div key={brawler.id} className="brawl-card group brawl-tilt">
              {/* Color header by rarity */}
              <div
                className="w-full h-36 border-b-4 border-[var(--color-brawl-dark)] flex flex-col items-center justify-end relative overflow-hidden p-3"
                style={{ backgroundColor: color }}
              >
                <div className="absolute inset-0 opacity-20 bg-[radial-gradient(black_2px,transparent_2px)] [background-size:12px_12px]" />
                <div className="w-24 h-24 bg-white/30 rounded-full blur-[20px] absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />

                {/* Prestige badge */}
                {brawler.prestigeLevel > 0 && (
                  <div className="absolute top-2 right-2 bg-black/60 rounded-lg px-2 py-1 text-xs font-bold text-yellow-400 z-10">
                    P{brawler.prestigeLevel} 👑
                  </div>
                )}

                <h2 className="text-2xl font-['Lilita_One'] text-white text-stroke-brawl uppercase relative z-10 transition-transform group-hover:scale-110 duration-200 group-hover:-translate-y-1">
                  {brawler.name}
                </h2>
                <span className="text-xs text-white/70 font-['Inter'] font-bold uppercase relative z-10">
                  {rarity}
                </span>
              </div>

              {/* Stats Body */}
              <div className="p-4 bg-[var(--color-brawl-light)]">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-['Lilita_One'] text-lg px-2 py-1 rounded-lg border-2 border-[var(--color-brawl-dark)] bg-[#B23DFF] text-white shadow-[0_2px_0_0_#121A2F]">
                    LVL {brawler.power}
                  </span>
                  <span className="font-['Lilita_One'] text-lg text-[var(--color-brawl-dark)] flex items-center gap-1">
                    {brawler.trophies.toLocaleString()} 🏆
                  </span>
                </div>

                {/* Unlock badges */}
                <div className="flex gap-1 mb-2 flex-wrap">
                  {brawler.starPowers.length > 0 && (
                    <span className="text-xs bg-yellow-500/20 text-yellow-700 px-1.5 py-0.5 rounded font-bold">
                      SP×{brawler.starPowers.length}
                    </span>
                  )}
                  {brawler.gadgets.length > 0 && (
                    <span className="text-xs bg-green-500/20 text-green-700 px-1.5 py-0.5 rounded font-bold">
                      G×{brawler.gadgets.length}
                    </span>
                  )}
                  {brawler.hyperCharges.length > 0 && (
                    <span className="text-xs bg-red-500/20 text-red-700 px-1.5 py-0.5 rounded font-bold">
                      HC
                    </span>
                  )}
                  {buffieCount > 0 && (
                    <span className="text-xs bg-purple-500/20 text-purple-700 px-1.5 py-0.5 rounded font-bold">
                      B×{buffieCount}
                    </span>
                  )}
                  {hasCustomSkin && (
                    <span className="text-xs bg-pink-500/20 text-pink-700 px-1.5 py-0.5 rounded font-bold">
                      🎨
                    </span>
                  )}
                </div>

                <div className="w-full h-px bg-[#121A2F] opacity-20 mb-2" />

                <div className="flex justify-between items-center">
                  <span className="font-['Inter'] font-bold text-[#1C5CF1] text-sm uppercase">Value</span>
                  <span className="font-['Lilita_One'] text-xl text-[var(--color-brawl-dark)] flex items-center gap-1 drop-shadow-sm">
                    {gemValue.toLocaleString()} <GemIcon className="w-5 h-5 mb-1" />
                  </span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
