'use client'

import { useState, useMemo, useCallback } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Search, ChevronDown } from 'lucide-react'
import { GemIcon } from '@/components/ui/GemIcon'
import { AdPlaceholder } from '@/components/ui/AdPlaceholder'
import { BrawlImg } from '@/components/ui/BrawlImg'
import { usePlayerData } from '@/hooks/usePlayerData'
import { getBrawlerPortraitUrl, getBrawlerPortraitFallback, getGadgetImageUrl, getStarPowerImageUrl } from '@/lib/utils'
import { BRAWLER_RARITY_MAP, POWER_LEVEL_GEM_COST, GEM_COSTS } from '@/lib/constants'
import type { BrawlerStat, BrawlerRarityName } from '@/lib/types'
import { BrawlersSkeleton } from '@/components/ui/Skeleton'

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

const ALL_RARITIES: BrawlerRarityName[] = [
  'Trophy Road', 'Rare', 'Super Rare', 'Epic',
  'Mythic', 'Legendary', 'Chromatic', 'Ultra Legendary',
]

type SortOption = 'gems' | 'trophies' | 'power' | 'name' | 'rank'

type SortLabelKey = 'sortValue' | 'sortTrophies' | 'sortPowerLevel' | 'sortName' | 'sortRank'

const SORT_OPTIONS: { value: SortOption; labelKey: SortLabelKey }[] = [
  { value: 'gems', labelKey: 'sortValue' },
  { value: 'trophies', labelKey: 'sortTrophies' },
  { value: 'power', labelKey: 'sortPowerLevel' },
  { value: 'name', labelKey: 'sortName' },
  { value: 'rank', labelKey: 'sortRank' },
]

function calcBrawlerGemValue(b: BrawlerStat): number {
  const powerCost = POWER_LEVEL_GEM_COST[b.power] ?? 0
  const gadgets = b.gadgets.length * GEM_COSTS.gadget
  const starPowers = b.starPowers.length * GEM_COSTS.starPower
  const hypercharges = b.hyperCharges.length * GEM_COSTS.hypercharge
  const buffies = [b.buffies?.gadget, b.buffies?.starPower, b.buffies?.hyperCharge].filter(Boolean).length * GEM_COSTS.buffie
  const gears = b.gears.length * GEM_COSTS.gear
  return powerCost + gadgets + starPowers + hypercharges + buffies + gears
}

function sortBrawlers(brawlers: BrawlerStat[], sortBy: SortOption): BrawlerStat[] {
  return [...brawlers].sort((a, b) => {
    switch (sortBy) {
      case 'gems':
        return calcBrawlerGemValue(b) - calcBrawlerGemValue(a)
      case 'trophies':
        return b.trophies - a.trophies
      case 'power':
        return b.power - a.power
      case 'name':
        return a.name.localeCompare(b.name)
      case 'rank':
        return b.rank - a.rank
      default:
        return 0
    }
  })
}

export default function BrawlersPage() {
  const params = useParams<{ tag: string }>()
  const searchParams = useSearchParams()
  const router = useRouter()
  const t = useTranslations('brawlers')
  const tProfile = useTranslations('profile')
  const tag = decodeURIComponent(params.tag)
  const { data, isLoading, error } = usePlayerData(tag)

  // Read filter state from URL search params
  const searchQuery = searchParams.get('search') ?? ''
  const sortBy: SortOption = (SORT_OPTIONS.some(o => o.value === searchParams.get('sort'))
    ? searchParams.get('sort') as SortOption
    : 'gems')
  const activeRarities = useMemo(() => {
    const raw = searchParams.get('rarity') ?? ''
    if (!raw) return new Set<BrawlerRarityName>()
    const names = raw.split(',').filter((r): r is BrawlerRarityName =>
      ALL_RARITIES.includes(r as BrawlerRarityName)
    )
    return new Set<BrawlerRarityName>(names)
  }, [searchParams])
  const [dropdownOpen, setDropdownOpen] = useState(false)

  // Helper to update URL search params without full navigation
  const updateParams = useCallback((updates: Record<string, string | null>) => {
    const next = new URLSearchParams(searchParams.toString())
    for (const [key, value] of Object.entries(updates)) {
      if (value === null || value === '') {
        next.delete(key)
      } else {
        next.set(key, value)
      }
    }
    const qs = next.toString()
    router.replace(`?${qs}`, { scroll: false })
  }, [searchParams, router])

  const setSearchQuery = useCallback((value: string) => {
    updateParams({ search: value || null })
  }, [updateParams])

  const setSortBy = useCallback((value: SortOption) => {
    updateParams({ sort: value === 'gems' ? null : value })
  }, [updateParams])

  const setActiveRarities = useCallback((updater: Set<BrawlerRarityName> | ((prev: Set<BrawlerRarityName>) => Set<BrawlerRarityName>)) => {
    const next = typeof updater === 'function' ? updater(activeRarities) : updater
    const serialized = Array.from(next).join(',')
    updateParams({ rarity: serialized || null })
  }, [updateParams, activeRarities])

  const brawlers = data?.player?.brawlers ?? []

  const filteredAndSorted = useMemo(() => {
    let result = brawlers

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase()
      result = result.filter((b) => b.name.toLowerCase().includes(q))
    }

    if (activeRarities.size > 0) {
      result = result.filter((b) => {
        const rarity = BRAWLER_RARITY_MAP[b.id] ?? 'Trophy Road'
        return activeRarities.has(rarity)
      })
    }

    return sortBrawlers(result, sortBy)
  }, [brawlers, searchQuery, activeRarities, sortBy])

  const filteredGemTotal = useMemo(() => {
    return filteredAndSorted.reduce((sum, b) => sum + calcBrawlerGemValue(b), 0)
  }, [filteredAndSorted])

  function toggleRarity(rarity: BrawlerRarityName) {
    setActiveRarities((prev) => {
      const next = new Set(prev)
      if (next.has(rarity)) next.delete(rarity)
      else next.add(rarity)
      return next
    })
  }

  function clearRarityFilter() {
    setActiveRarities(new Set())
  }

  if (isLoading) {
    return <BrawlersSkeleton />
  }

  if (error || !data?.player?.brawlers) {
    return (
      <div className="glass p-8 rounded-2xl text-center border-red-500/30">
        <p className="text-red-400">{error || t('error')}</p>
      </div>
    )
  }

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
              {tProfile('brawlerCount').toUpperCase()}
            </h1>
            <p className="font-['Inter'] font-semibold text-[var(--color-brawl-gold)]">
              {brawlers.length} / {Object.keys(BRAWLER_RARITY_MAP).length}
            </p>
          </div>
        </div>
      </div>

      {/* Sticky Toolbar */}
      <div className="bg-[#24355B] border-4 border-[var(--color-brawl-dark)] rounded-3xl shadow-[4px_8px_0px_var(--color-brawl-dark),inset_0px_-6px_0px_rgba(0,0,0,0.3),inset_0px_4px_0px_rgba(255,255,255,0.1)] sticky top-0 z-30 p-4 md:p-6 mb-6 space-y-4" style={{ overflow: 'visible' }}>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('searchPlaceholder')}
              className="w-full pl-10 pr-4 py-3 bg-[#121A2F] border-4 border-[#0D1321] rounded-2xl text-white font-['Lilita_One'] text-lg placeholder:text-slate-500 placeholder:font-['Lilita_One'] focus:outline-none focus:border-[var(--color-brawl-blue)] shadow-[0_4px_0_0_#0D1321] transition-colors"
            />
          </div>

          <div className="relative">
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-2 px-5 py-3 bg-[#121A2F] border-4 border-[#0D1321] rounded-2xl text-white font-['Lilita_One'] text-lg shadow-[0_4px_0_0_#0D1321] hover:bg-[#1a2540] transition-colors w-full sm:w-auto justify-between sm:justify-start min-w-[180px]"
            >
              <span>{t(SORT_OPTIONS.find((o) => o.value === sortBy)?.labelKey ?? 'sortValue')}</span>
              <ChevronDown className={`w-5 h-5 transition-transform duration-200 ${dropdownOpen ? 'rotate-180' : ''}`} />
            </button>
            {dropdownOpen && (
              <div className="absolute top-full left-0 right-0 sm:right-auto mt-2 bg-[#121A2F] border-4 border-[#0D1321] rounded-2xl overflow-hidden shadow-[0_8px_0_0_#0D1321] z-40 min-w-[180px]">
                {SORT_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => { setSortBy(option.value); setDropdownOpen(false) }}
                    className={`w-full text-left px-5 py-3 font-['Lilita_One'] text-base transition-colors ${
                      sortBy === option.value
                        ? 'bg-[var(--color-brawl-blue)] text-white'
                        : 'text-slate-300 hover:bg-[#1a2540] hover:text-white'
                    }`}
                  >
                    {t(option.labelKey)}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          <button
            onClick={clearRarityFilter}
            className={`shrink-0 px-5 py-2.5 rounded-sm font-['Lilita_One'] text-sm uppercase tracking-wide border-4 shadow-[0_4px_0_0_#0D1321] transition-all duration-150 -skew-x-12 ${
              activeRarities.size === 0
                ? 'bg-white text-[#121A2F] border-[#121A2F] active:translate-y-[4px] active:shadow-none'
                : 'bg-[#1a2540] text-slate-400 border-[#0D1321] hover:text-white hover:-translate-y-1 active:translate-y-[4px] active:shadow-none'
            }`}
          >
            <div className="skew-x-12">{t('filterAll')}</div>
          </button>
          {ALL_RARITIES.map((rarity) => {
            const isActive = activeRarities.has(rarity)
            const color = RARITY_COLORS[rarity]
            return (
              <button
                key={rarity}
                onClick={() => toggleRarity(rarity)}
                className={`shrink-0 px-5 py-2.5 rounded-sm font-['Lilita_One'] text-sm uppercase tracking-wide border-4 shadow-[0_4px_0_0_#0D1321] transition-all duration-150 -skew-x-12 ${
                  isActive
                    ? 'text-white active:translate-y-[4px] active:shadow-none'
                    : 'bg-[#1a2540] text-slate-400 border-[#0D1321] hover:text-white hover:-translate-y-1 active:translate-y-[4px] active:shadow-none'
                }`}
                style={isActive ? { backgroundColor: color, borderColor: '#121A2F' } : undefined}
              >
                <div className="skew-x-12 flex items-center gap-1">{rarity}</div>
              </button>
            )
          })}
        </div>

        <div className="flex flex-wrap items-center gap-4 pt-1 border-t border-white/10">
          <span className="font-['Inter'] font-bold text-slate-300 text-sm">
            {filteredAndSorted.length} / {brawlers.length} {tProfile('brawlerCount').toLowerCase()}
          </span>
          <span className="font-['Lilita_One'] text-lg text-white flex items-center gap-1">
            {filteredGemTotal.toLocaleString()} <GemIcon className="w-5 h-5 mb-0.5" />
          </span>
        </div>
      </div>

      <AdPlaceholder className="mb-6" />

      {filteredAndSorted.length === 0 && (
        <div className="brawl-card p-12 text-center">
          <p className="font-['Lilita_One'] text-2xl text-slate-400">{t('noResults')}</p>
        </div>
      )}

      {/* Roster Grid — 3D Pop-Out Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-5">
        {filteredAndSorted.map((brawler) => {
          const rarity = BRAWLER_RARITY_MAP[brawler.id] ?? 'Trophy Road'
          const gemValue = calcBrawlerGemValue(brawler)
          const color = RARITY_COLORS[rarity]
          return (
            <div
              key={brawler.id}
              className="group relative pt-6"
            >
              {/* Brawler portrait — always normal image */}
              <BrawlImg
                src={getBrawlerPortraitUrl(brawler.id)}
                fallbackSrc={getBrawlerPortraitFallback(brawler.id)}
                alt={brawler.name}
                fallbackText={brawler.name}
                className="absolute -top-1 left-1/2 -translate-x-1/2 z-20 drop-shadow-[0_6px_12px_rgba(0,0,0,0.6)] transition-transform duration-300 group-hover:scale-115 group-hover:-translate-y-2 w-[100px] h-[100px] rounded-xl"
              />

              {/* Card body */}
              <div
                className="brawl-card relative overflow-visible transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-[0_16px_24px_-8px_rgba(0,0,0,0.6)]"
              >
                {/* Rarity color header */}
                <div
                  className="w-full h-20 border-b-4 border-[var(--color-brawl-dark)] relative"
                  style={{ backgroundColor: color }}
                >
                  <div className="absolute inset-0 opacity-20 bg-[radial-gradient(black_2px,transparent_2px)] [background-size:12px_12px]" />
                  <div className="absolute w-[150%] h-full bg-black/15 -skew-x-12 origin-bottom-left" />

                  {/* Rank badge */}
                  <div className="absolute top-1.5 left-1.5 bg-black/60 rounded-lg px-1.5 py-0.5 text-[10px] font-bold text-white z-10 font-['Inter']">
                    R{brawler.rank}
                  </div>

                  {/* Power level badge */}
                  <div className="absolute top-1.5 right-1.5 bg-[#B23DFF] rounded-lg px-1.5 py-0.5 text-[10px] font-bold text-white z-10 font-['Lilita_One'] border-2 border-[var(--color-brawl-dark)] shadow-[0_1px_0_0_#121A2F]">
                    {brawler.power}
                  </div>

                  {/* Prestige badge — uses Brawlify CDN tiered prestige icons */}
                  {brawler.prestigeLevel > 0 && (
                    <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 z-30">
                      <img
                        src={`https://cdn.brawlify.com/tiers/tiered/prestige-${brawler.prestigeLevel}/${brawler.id}.png`}
                        alt={`Prestige ${brawler.prestigeLevel}`}
                        className="w-10 h-10 drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]"
                        width={40}
                        height={40}
                      />
                    </div>
                  )}
                </div>

                {/* Name + Rarity */}
                <div className="px-3 pt-2 pb-1 text-center">
                  <h2 className="text-lg font-['Lilita_One'] text-[var(--color-brawl-dark)] uppercase leading-tight truncate" style={{ textShadow: '0 1px 0 rgba(0,0,0,0.1)' }}>
                    {brawler.name}
                  </h2>
                  <span className="text-[9px] font-['Inter'] font-bold uppercase tracking-wider" style={{ color }}>
                    {rarity}
                  </span>
                </div>

                {/* Trophies */}
                <div className="px-3 flex justify-between items-center">
                  <span className="font-['Lilita_One'] text-sm text-[var(--color-brawl-dark)]">
                    {brawler.trophies.toLocaleString()} 🏆
                  </span>
                  <span className="text-[9px] text-slate-500 font-['Inter'] font-bold">
                    {t('labelBest')}{brawler.highestTrophies.toLocaleString()}
                  </span>
                </div>

                {/* Upgrade icons — real CDN images */}
                <div className="px-3 py-2 flex items-center gap-1 flex-wrap">
                  {/* Star Powers */}
                  {brawler.starPowers.map(sp => (
                    <BrawlImg
                      key={sp.id}
                      src={getStarPowerImageUrl(sp.id)}
                      alt={sp.name}
                      fallbackText="SP"
                      className="w-5 h-5 rounded-sm"
                    />
                  ))}

                  {/* Gadgets */}
                  {brawler.gadgets.map(g => (
                    <BrawlImg
                      key={g.id}
                      src={getGadgetImageUrl(g.id)}
                      alt={g.name}
                      fallbackText="G"
                      className="w-5 h-5 rounded-sm"
                    />
                  ))}

                  {/* Hypercharges — icon + count */}
                  {brawler.hyperCharges.length > 0 && (
                    <span className="text-[10px] bg-purple-500 text-white border-2 border-purple-800 px-1.5 rounded-sm font-black shadow-sm flex items-center gap-0.5" style={{ textShadow: '0 1px 0 rgba(0,0,0,0.3)' }}>
                      ⚡ {brawler.hyperCharges.length}
                    </span>
                  )}

                  {/* Buffies — individual indicators */}
                  {brawler.buffies?.gadget && (
                    <span className="text-[10px] bg-green-600 text-white border-2 border-green-800 px-1 rounded-sm font-black shadow-sm" title="Gadget Buffy" style={{ textShadow: '0 1px 0 rgba(0,0,0,0.4)' }}>
                      🅱️G
                    </span>
                  )}
                  {brawler.buffies?.starPower && (
                    <span className="text-[10px] bg-yellow-500 text-[#1a1a1a] border-2 border-yellow-700 px-1 rounded-sm font-black shadow-sm">
                      🅱️S
                    </span>
                  )}
                  {brawler.buffies?.hyperCharge && (
                    <span className="text-[10px] bg-purple-600 text-white border-2 border-purple-800 px-1 rounded-sm font-black shadow-sm" title="HyperCharge Buffy" style={{ textShadow: '0 1px 0 rgba(0,0,0,0.4)' }}>
                      🅱️H
                    </span>
                  )}

                  {/* Gears — icon + count */}
                  {brawler.gears.length > 0 && (
                    <span className="text-[10px] bg-slate-600 text-white border-2 border-slate-800 px-1.5 rounded-sm font-black shadow-sm flex items-center gap-0.5" style={{ textShadow: '0 1px 0 rgba(0,0,0,0.3)' }}>
                      🔩 ×{brawler.gears.length}
                    </span>
                  )}
                </div>

                {/* Gem Value footer */}
                <div className="px-3 pb-3 pt-1 border-t-2 border-[var(--color-brawl-dark)]/10 flex justify-between items-center">
                  <span className="font-['Inter'] font-bold text-[#1C5CF1] text-[10px] uppercase">{t('labelValue')}</span>
                  <span className="font-['Lilita_One'] text-base text-[var(--color-brawl-dark)] flex items-center gap-0.5">
                    {gemValue.toLocaleString()} <GemIcon className="w-4 h-4" />
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
