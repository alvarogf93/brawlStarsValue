'use client'

import { useState, useMemo } from 'react'
import { useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Search, ChevronDown } from 'lucide-react'
import { GemIcon } from '@/components/ui/GemIcon'
import { AdPlaceholder } from '@/components/ui/AdPlaceholder'
import { usePlayerData } from '@/hooks/usePlayerData'
import { BRAWLER_RARITY_MAP, POWER_LEVEL_GEM_COST, GEM_COSTS } from '@/lib/constants'
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
  const t = useTranslations('brawlers')
  const tProfile = useTranslations('profile')
  const tag = decodeURIComponent(params.tag)
  const { data, isLoading, error } = usePlayerData(tag)

  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<SortOption>('gems')
  const [activeRarities, setActiveRarities] = useState<Set<BrawlerRarityName>>(new Set())
  const [dropdownOpen, setDropdownOpen] = useState(false)

  const brawlers = data?.player?.brawlers ?? []

  const filteredAndSorted = useMemo(() => {
    let result = brawlers

    // Filter by search query
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase()
      result = result.filter((b) => b.name.toLowerCase().includes(q))
    }

    // Filter by rarity
    if (activeRarities.size > 0) {
      result = result.filter((b) => {
        const rarity = BRAWLER_RARITY_MAP[b.id] ?? 'Trophy Road'
        return activeRarities.has(rarity)
      })
    }

    // Sort
    return sortBrawlers(result, sortBy)
  }, [brawlers, searchQuery, activeRarities, sortBy])

  const filteredGemTotal = useMemo(() => {
    return filteredAndSorted.reduce((sum, b) => sum + calcBrawlerGemValue(b), 0)
  }, [filteredAndSorted])

  function toggleRarity(rarity: BrawlerRarityName) {
    setActiveRarities((prev) => {
      const next = new Set(prev)
      if (next.has(rarity)) {
        next.delete(rarity)
      } else {
        next.add(rarity)
      }
      return next
    })
  }

  function clearRarityFilter() {
    setActiveRarities(new Set())
  }

  if (isLoading) {
    return (
      <div className="animate-pulse py-20 text-center">
        <p className="text-slate-400 font-['Lilita_One'] text-2xl">{t('loading')}</p>
      </div>
    )
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
        {/* Search + Sort Row */}
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search Bar */}
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

          {/* Sort Dropdown */}
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
                    onClick={() => {
                      setSortBy(option.value)
                      setDropdownOpen(false)
                    }}
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

        {/* Rarity Filter Chips */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {/* All chip */}
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
                style={
                  isActive
                    ? { backgroundColor: color, borderColor: '#121A2F' }
                    : undefined
                }
              >
                <div className="skew-x-12 flex items-center gap-1">{rarity}</div>
              </button>
            )
          })}
        </div>

        {/* Quick Stats Bar */}
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

      {/* Empty state */}
      {filteredAndSorted.length === 0 && (
        <div className="brawl-card p-12 text-center">
          <p className="font-['Lilita_One'] text-2xl text-slate-400">{t('noResults')}</p>
        </div>
      )}

      {/* Roster Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {filteredAndSorted.map((brawler) => {
          const rarity = BRAWLER_RARITY_MAP[brawler.id] ?? 'Trophy Road'
          const gemValue = calcBrawlerGemValue(brawler)
          const color = RARITY_COLORS[rarity]
          const buffieCount = [brawler.buffies?.gadget, brawler.buffies?.starPower, brawler.buffies?.hyperCharge].filter(Boolean).length
          const hasCustomSkin = brawler.skin && brawler.skin.name !== brawler.name

          return (
            <div
              key={brawler.id}
              className="brawl-card group hover:-translate-y-2 hover:scale-[1.02] hover:shadow-[0_16px_24px_-8px_rgba(0,0,0,0.6)] transition-all duration-300 ease-out"
            >
              {/* Color header by rarity */}
              <div
                className="w-full h-40 border-b-[6px] border-[var(--color-brawl-dark)] flex flex-col items-center justify-end relative overflow-hidden p-3"
                style={{ backgroundColor: color }}
              >
                {/* Segmented diagonal cut */}
                <div className="absolute top-0 right-0 left-0 bottom-0 pointer-events-none">
                  <div className="absolute w-[150%] h-full bg-black/15 -skew-x-12 origin-bottom-left scale-110 -translate-x-1/4" />
                </div>
                
                <div className="absolute inset-0 opacity-20 bg-[radial-gradient(black_2px,transparent_2px)] [background-size:12px_12px]" />
                <div className="w-24 h-24 bg-white/30 rounded-full blur-[20px] absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />

                {/* Rank badge — top left */}
                <div className="absolute top-2 left-2 bg-black/60 rounded-lg px-2 py-1 text-xs font-bold text-white z-10 font-['Inter']">
                  R{brawler.rank}
                </div>

                {/* Prestige badge — top right */}
                {brawler.prestigeLevel > 0 && (
                  <div className="absolute top-2 right-2 bg-black/60 rounded-lg px-2 py-1 text-xs font-bold text-yellow-400 z-10">
                    P{brawler.prestigeLevel} 👑
                  </div>
                )}

                {/* Win streak badge — below prestige or top right area */}
                {brawler.currentWinStreak > 0 && (
                  <div className={`absolute ${brawler.prestigeLevel > 0 ? 'top-9' : 'top-2'} right-2 bg-orange-600/80 rounded-lg px-2 py-1 text-xs font-bold text-white z-10`}>
                    🔥 {brawler.currentWinStreak}
                  </div>
                )}

                <h2 className="text-3xl font-['Lilita_One'] text-white text-stroke-brawl uppercase relative z-10 transition-transform group-hover:scale-110 duration-200 group-hover:-translate-y-1 drop-shadow-md">
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
                  <div className="text-right">
                    <span className="font-['Lilita_One'] text-lg text-[var(--color-brawl-dark)] flex items-center gap-1">
                      {brawler.trophies.toLocaleString()} 🏆
                    </span>
                    <span className="font-['Inter'] text-xs text-slate-500 block leading-tight">
                      {t('labelBest')}{brawler.highestTrophies.toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Unlock badges */}
                <div className="flex gap-1.5 mb-3 flex-wrap">
                  {brawler.starPowers.length > 0 && (
                    <span className="text-[10px] bg-yellow-400 text-yellow-900 border-2 border-yellow-600 px-2 rounded-sm font-black shadow-sm uppercase">
                      SP ×{brawler.starPowers.length}
                    </span>
                  )}
                  {brawler.gadgets.length > 0 && (
                    <span className="text-[10px] bg-green-400 text-green-900 border-2 border-green-600 px-2 rounded-sm font-black shadow-sm uppercase">
                      G ×{brawler.gadgets.length}
                    </span>
                  )}
                  {brawler.hyperCharges.length > 0 && (
                    <span className="text-[10px] bg-purple-500 text-white border-2 border-purple-800 px-2 rounded-sm font-black shadow-sm uppercase">
                      HC ×{brawler.hyperCharges.length}
                    </span>
                  )}
                  {buffieCount > 0 && (
                    <span className="text-xs bg-purple-500/20 text-purple-700 px-1.5 py-0.5 rounded font-bold">
                      B×{buffieCount}
                    </span>
                  )}
                  {brawler.gears.length > 0 && (
                    <span className="text-xs bg-gray-500/20 text-gray-700 px-1.5 py-0.5 rounded font-bold">
                      🔩×{brawler.gears.length}
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
                  <span className="font-['Inter'] font-bold text-[#1C5CF1] text-sm uppercase">{t('labelValue')}</span>
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
