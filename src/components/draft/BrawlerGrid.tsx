'use client'

import { useState, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { Search } from 'lucide-react'
import type { BrawlerEntry } from '@/lib/brawler-registry'

interface Props {
  brawlers: BrawlerEntry[]
  pickedIds: Set<number>
  userBrawlerIds?: Set<number>
  userBrawlerPower?: Map<number, number>
  onSelect: (brawlerId: number) => void
}

const CLASS_FILTERS = ['All', 'Damage Dealer', 'Tank', 'Assassin', 'Support', 'Controller', 'Marksman', 'Artillery', 'Unknown'] as const

export function BrawlerGrid({ brawlers, pickedIds, userBrawlerIds, userBrawlerPower, onSelect }: Props) {
  const t = useTranslations('draft')
  const [search, setSearch] = useState('')
  const [classFilter, setClassFilter] = useState<string>('All')

  const filtered = useMemo(() => {
    let list = brawlers
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(b => b.name.toLowerCase().includes(q))
    }
    if (classFilter !== 'All') {
      list = list.filter(b => b.class === classFilter)
    }
    return list.sort((a, b) => a.name.localeCompare(b.name))
  }, [brawlers, search, classFilter])

  // Determine which classes actually exist in our data
  const availableClasses = useMemo(() => {
    const classes = new Set(brawlers.map(b => b.class))
    return CLASS_FILTERS.filter(c => c === 'All' || classes.has(c))
  }, [brawlers])

  return (
    <div className="flex flex-col gap-2">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={t('searchBrawler')}
          className="w-full pl-9 pr-3 py-2 text-sm bg-white/[0.06] text-white border border-white/10 rounded-lg outline-none focus:border-[#FFC91B]/40 placeholder:text-slate-600 transition-colors"
        />
      </div>

      {/* Class filter tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-hide">
        {availableClasses.map(cls => (
          <button
            key={cls}
            onClick={() => setClassFilter(cls)}
            className={`px-2.5 py-1 text-[10px] font-bold rounded-lg whitespace-nowrap transition-colors ${
              classFilter === cls
                ? 'bg-[#FFC91B]/20 text-[#FFC91B]'
                : 'text-slate-500 hover:text-white hover:bg-white/5'
            }`}
          >
            {cls === 'All' ? t('allClasses') : cls}
          </button>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 gap-1.5 max-h-[300px] overflow-y-auto pr-1 scrollbar-hide">
        {filtered.map(b => {
          const isPicked = pickedIds.has(b.id)
          const isOwned = !userBrawlerIds || userBrawlerIds.has(b.id)
          const power = userBrawlerPower?.get(b.id)
          const isLowPower = power !== undefined && power < 7

          return (
            <button
              key={b.id}
              onClick={() => !isPicked && onSelect(b.id)}
              disabled={isPicked}
              title={`${b.name}${power ? ` (PWR ${power})` : ''}`}
              className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                isPicked
                  ? 'opacity-20 cursor-not-allowed border-transparent grayscale'
                  : !isOwned
                  ? 'opacity-40 border-white/5 hover:opacity-60 cursor-pointer'
                  : 'border-white/10 hover:border-[#FFC91B]/50 hover:scale-105 cursor-pointer active:scale-95'
              }`}
            >
              <img
                src={b.imageUrl}
                alt={b.name}
                className="w-full h-full object-cover"
                loading="lazy"
                width={64}
                height={64}
              />

              {/* Picked overlay */}
              {isPicked && (
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                  <span className="text-lg">✕</span>
                </div>
              )}

              {/* Not owned lock */}
              {!isOwned && !isPicked && (
                <div className="absolute top-0.5 right-0.5 w-3.5 h-3.5 bg-black/60 rounded-full flex items-center justify-center">
                  <span className="text-[8px]">🔒</span>
                </div>
              )}

              {/* Low power warning */}
              {isOwned && isLowPower && !isPicked && (
                <div className="absolute bottom-0 inset-x-0 bg-amber-500/80 text-[7px] text-center font-bold text-black leading-tight py-px">
                  PWR {power}
                </div>
              )}
            </button>
          )
        })}
      </div>

      {filtered.length === 0 && (
        <p className="text-center text-sm text-slate-500 py-4">{t('noBrawlersFound')}</p>
      )}
    </div>
  )
}
