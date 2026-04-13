'use client'

import { useMemo } from 'react'
import { useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { usePlayerData } from '@/hooks/usePlayerData'
import { useBrawlerRegistry } from '@/hooks/useBrawlerRegistry'
import { GemIcon } from '@/components/ui/GemIcon'
import { GEM_COSTS, TROPHY_ROAD_MAX } from '@/lib/constants'
import { computeMaxGems, computeMaxCounts, completionPct, safeNumber } from '@/lib/stats-maxes'
import { formatPlaytime } from '@/lib/utils'
import { AdPlaceholder } from '@/components/ui/AdPlaceholder'
import { StatsSkeleton } from '@/components/ui/Skeleton'

export default function StatsPage() {
  const params = useParams<{ tag: string }>()
  const t = useTranslations('profile')
  const tNav = useTranslations('nav')
  const tStats = useTranslations('stats')
  const tag = decodeURIComponent(params.tag)
  const { data, isLoading, error } = usePlayerData(tag)
  const registry = useBrawlerRegistry()

  const maxGems = useMemo(() => computeMaxGems(registry), [registry])
  const maxCounts = useMemo(() => computeMaxCounts(registry), [registry])

  if (isLoading) {
    return <StatsSkeleton />
  }

  if (error || !data?.player) {
    return (
      <div className="glass p-8 rounded-2xl text-center border-red-500/30">
        <p className="text-red-400">{error || tStats('error')}</p>
      </div>
    )
  }

  const bd = data.breakdown
  const st = data.stats
  // Sanitize every numeric pulled from the GemScore payload — cached
  // localStorage objects from older versions of the type may be missing
  // fields, which would propagate as NaN through arithmetic and end up
  // as "NaN" in the rendered DOM. safeNumber maps undefined / null /
  // NaN / Infinity to 0 so the UI degrades gracefully.
  const totalGems = safeNumber(data.totalGems)
  const trophies = safeNumber(st.trophies)
  const highestTrophies = safeNumber(st.highestTrophies)
  const breakdown = {
    powerLevels: { count: safeNumber(bd.powerLevels?.count), gems: safeNumber(bd.powerLevels?.gems) },
    gadgets: { count: safeNumber(bd.gadgets?.count), gems: safeNumber(bd.gadgets?.gems) },
    starPowers: { count: safeNumber(bd.starPowers?.count), gems: safeNumber(bd.starPowers?.gems) },
    hypercharges: { count: safeNumber(bd.hypercharges?.count), gems: safeNumber(bd.hypercharges?.gems) },
    buffies: { count: safeNumber(bd.buffies?.count), gems: safeNumber(bd.buffies?.gems) },
    gears: { count: safeNumber(bd.gears?.count), gems: safeNumber(bd.gears?.gems) },
  }
  // Trophy road: player trophies / current game-wide cap (100k), NOT
  // player's personal highest — the bar should show progress toward
  // the absolute ceiling, not toward a moving personal best.
  const trophyPercent = completionPct(trophies, TROPHY_ROAD_MAX)
  // Main donut: overall account completion as a fraction of max possible
  // gems across every upgrade category (powerLevels + gadgets + SPs +
  // gears + HCs + buffies). Replaces the old "power level share of
  // total" which always showed ~50% and meant nothing.
  const completionPercent = completionPct(totalGems, maxGems.total)

  return (
    <div className="animate-fade-in w-full pb-10 space-y-6">

      {/* Banner Ad Space */}
      <AdPlaceholder />

      {/* Header Panel */}
      <div className="brawl-card p-6 md:p-8 mb-8 flex flex-col md:flex-row md:items-center justify-between bg-gradient-to-r from-[var(--color-brawl-purple)] to-[#121A2F]">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-[#4EC0FA] border-4 border-[#121A2F] rounded-2xl flex items-center justify-center transform rotate-6 shadow-[0_4px_0_0_#121A2F]">
            <span className="text-3xl">📊</span>
          </div>
          <div>
            <h1 className="text-4xl md:text-5xl font-['Lilita_One'] tracking-wide text-white text-stroke-brawl transform rotate-[-1deg]">
              {tNav('stats')}
            </h1>
            <p className="font-['Inter'] font-semibold text-[#4EC0FA]">
              {data.playerName}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Gem Score Breakdown */}
        <div className="brawl-card-dark border-[#090E17] p-6 flex flex-col items-center justify-center col-span-1 min-h-[300px]">
          <h2 className="font-['Lilita_One'] text-3xl text-[var(--color-brawl-gold)] text-center mb-6 tracking-wide drop-shadow-md">{tStats('gemScore')}</h2>
          <div className="relative w-48 h-48 flex items-center justify-center">
            <svg className="w-full h-full transform -rotate-90 drop-shadow-[0_4px_10px_rgba(255,201,27,0.2)]" viewBox="0 0 36 36">
              <path className="text-[#0D1321]" strokeWidth="4" stroke="currentColor" fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
              <path className="text-[var(--color-brawl-gold)]" strokeDasharray={`${completionPercent}, 100`}
                strokeWidth="4" strokeLinecap="round" stroke="currentColor" fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-['Lilita_One'] text-5xl text-[var(--color-brawl-gold)] drop-shadow-[0_4px_0_rgba(0,0,0,0.8)]" style={{ WebkitTextStroke: '2px #121A2F' }}>
                {completionPercent}%
              </span>
              <span className="font-['Inter'] text-[10px] uppercase font-bold text-slate-400 tracking-wider mt-1">
                {totalGems.toLocaleString()} / {maxGems.total.toLocaleString()} 💎
              </span>
            </div>
          </div>

          {/* Gem breakdown bars — each rellena contra su MAX de categoría */}
          <div className="w-full mt-8 space-y-3">
            {[
              { label: t('powerLevels'), value: breakdown.powerLevels.gems, max: maxGems.powerLevels, color: '#F59E0B' },
              { label: t('gadgets'), value: breakdown.gadgets.gems, max: maxGems.gadgets, color: '#10B981' },
              { label: t('starPowers'), value: breakdown.starPowers.gems, max: maxGems.starPowers, color: '#8B5CF6' },
              { label: t('hypercharges'), value: breakdown.hypercharges.gems, max: maxGems.hypercharges, color: '#EF4444' },
              { label: t('buffies'), value: breakdown.buffies.gems, max: maxGems.buffies, color: '#EC4899' },
              { label: t('gears'), value: breakdown.gears.gems, max: maxGems.gears, color: '#6B7280' },
            ].map((v) => {
              const pct = completionPct(v.value, v.max)
              return (
                <div key={v.label}>
                  <div className="flex justify-between text-xs font-black uppercase tracking-wider mb-1">
                    <span className="text-slate-300">{v.label}</span>
                    <span className="text-slate-100 tabular-nums">{pct}%</span>
                  </div>
                  <div className="h-4 w-full bg-[#0D1321] rounded-sm overflow-hidden border-2 border-[#1E293B] relative">
                    <div
                      className="h-full rounded-sm transition-all duration-700 relative"
                      style={{ width: `${pct}%`, backgroundColor: v.color }}
                    >
                      <div className="absolute inset-0 bg-[repeating-linear-gradient(90deg,transparent,transparent_8px,rgba(0,0,0,0.3)_8px,rgba(0,0,0,0.3)_12px)]" />
                      <div className="absolute top-0 inset-x-0 h-1/2 bg-white/20" />
                    </div>
                  </div>
                  <div className="flex justify-between text-[9px] text-slate-500 font-['Inter'] mt-0.5 tabular-nums">
                    <span>{v.value.toLocaleString()} 💎</span>
                    <span>{v.max.toLocaleString()} 💎</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Trophies & Victories */}
        <div className="lg:col-span-2 flex flex-col gap-6">

          <div className="brawl-card-dark border-[#090E17] p-6 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <span className="text-[120px] leading-none block">🏆</span>
            </div>
            <div className="flex justify-between items-end mb-4 relative z-10">
              <div>
                <h3 className="font-['Lilita_One'] text-[#F82F41] text-xl tracking-widest drop-shadow-[0_2px_0_rgba(0,0,0,0.8)]">{tStats('trophyRoad')}</h3>
                <p className="font-['Inter'] font-bold text-slate-300 text-sm tracking-wide">
                  {tStats('highest')}<span className="text-yellow-400">{highestTrophies.toLocaleString()}</span>
                </p>
              </div>
              <span className="font-['Lilita_One'] text-4xl text-white text-stroke-brawl drop-shadow-[0_4px_4px_rgba(0,0,0,0.8)]">
                {trophies.toLocaleString()} 🏆
              </span>
            </div>

            {/* Segmented Progress Bar — normalized to TROPHY_ROAD_MAX (100k) */}
            <div className="h-12 w-full bg-[#0D1321] border-4 border-[#1E293B] p-1 relative shadow-[inset_0px_6px_6px_rgba(0,0,0,0.6)] rounded-sm">
              <div
                className="h-full bg-gradient-to-r from-[#FFC91B] to-[#F82F41] relative overflow-hidden transition-all duration-1000 rounded-sm"
                style={{ width: `${trophyPercent}%` }}
              >
                <div className="absolute inset-0 top-0 h-1/2 bg-white/25" />
                <div className="absolute inset-0 bg-[repeating-linear-gradient(90deg,transparent,transparent_20px,rgba(0,0,0,0.4)_20px,rgba(0,0,0,0.4)_26px)]" />
              </div>
            </div>
            <p className="text-[10px] text-slate-500 font-['Inter'] font-bold mt-2 tabular-nums text-right">
              {trophyPercent}% / {TROPHY_ROAD_MAX.toLocaleString()} 🏆
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 flex-1">
            <div className="brawl-card-dark border-[#0D1321] p-4 flex flex-col justify-center items-center hover:-translate-y-2 hover:shadow-[0_12px_20px_-8px_#1C5CF1] transition-all duration-200">
              <span className="text-4xl mb-2 filter drop-shadow-md">⚔️</span>
              <span className="text-3xl font-['Lilita_One'] text-white drop-shadow-[0_4px_0_rgba(0,0,0,0.8)] text-stroke-brawl">{safeNumber(st.threeVsThreeVictories).toLocaleString()}</span>
              <span className="text-[10px] uppercase font-black text-slate-400 tracking-wider">{tStats('wins3v3')}</span>
            </div>
            <div className="brawl-card-dark border-[#0D1321] p-4 flex flex-col justify-center items-center hover:-translate-y-2 hover:shadow-[0_12px_20px_-8px_#F82F41] transition-all duration-200">
              <span className="text-4xl mb-2 filter drop-shadow-md">👤</span>
              <span className="text-3xl font-['Lilita_One'] text-white drop-shadow-[0_4px_0_rgba(0,0,0,0.8)] text-stroke-brawl">{safeNumber(st.soloVictories).toLocaleString()}</span>
              <span className="text-[10px] uppercase font-black text-slate-400 tracking-wider">{tStats('soloWins')}</span>
            </div>
            <div className="brawl-card-dark border-[#0D1321] p-4 flex flex-col justify-center items-center hover:-translate-y-2 hover:shadow-[0_12px_20px_-8px_#10B981] transition-all duration-200">
              <span className="text-4xl mb-2 filter drop-shadow-md">👥</span>
              <span className="text-3xl font-['Lilita_One'] text-white drop-shadow-[0_4px_0_rgba(0,0,0,0.8)] text-stroke-brawl">{safeNumber(st.duoVictories).toLocaleString()}</span>
              <span className="text-[10px] uppercase font-black text-slate-400 tracking-wider">{tStats('duoWins')}</span>
            </div>
            <div
              className="brawl-card-dark border-[#121A2F] p-4 flex flex-col justify-center items-center relative overflow-hidden group cursor-help"
              title={tStats('timeTooltip', { winRate: Math.round(safeNumber(st.winRateUsed) * 100) })}
            >
              <div className="absolute inset-0 bg-[#4EC0FA]/20 group-hover:bg-[#4EC0FA]/40 transition-colors" />
              <span className="text-4xl filter drop-shadow-md relative z-10 mb-2">⏱️</span>
              <span className="text-2xl font-['Lilita_One'] text-white drop-shadow-[0_4px_0_rgba(0,0,0,0.8)] text-stroke-brawl relative z-10 border-b border-dashed border-[#A0AEC0]/50 pb-0.5">
                {formatPlaytime(safeNumber(st.estimatedHoursPlayed))}
              </span>
              <span className="text-[10px] uppercase font-black text-slate-300 relative z-10 tracking-wider">{tStats('timePlayed')}</span>
            </div>
          </div>

          {/* Unlock details — muestra X / Y sobre el máximo del juego */}
          <div className="brawl-card-dark p-6">
            <h3 className="font-['Lilita_One'] text-[var(--color-brawl-gold)] text-lg tracking-widest mb-4">{tStats('details')}</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: t('gadgets'), value: breakdown.gadgets.count, max: maxCounts.gadgets, icon: '🔧' },
                { label: t('starPowers'), value: breakdown.starPowers.count, max: maxCounts.starPowers, icon: '⭐' },
                { label: t('hypercharges'), value: breakdown.hypercharges.count, max: maxCounts.hypercharges, icon: '⚡' },
                { label: t('buffies'), value: breakdown.buffies.count, max: maxCounts.buffies, icon: '💪' },
                { label: t('gears'), value: breakdown.gears.count, max: maxCounts.gears, icon: '🔩' },
                { label: t('prestige'), value: safeNumber(st.totalPrestigeLevel), max: null, icon: '👑' },
                { label: t('timePlayed'), value: formatPlaytime(safeNumber(st.estimatedHoursPlayed)), max: null, icon: '⏱️' },
              ].map((item) => (
                <div key={item.label} className="bg-white/5 rounded-xl p-3 text-center">
                  <span className="text-2xl">{item.icon}</span>
                  <p className="font-['Lilita_One'] text-2xl text-white mt-1 tabular-nums">
                    {item.value}
                    {item.max !== null && (
                      <span className="text-sm text-slate-500"> / {item.max}</span>
                    )}
                  </p>
                  <p className="text-xs text-slate-400 font-bold uppercase">{item.label}</p>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>

      <AdPlaceholder className="mb-2" />

      {/* Gem Breakdown Table */}
      <div className="brawl-card-dark p-6 sm:p-8 border-[#090E17]">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <GemIcon className="w-8 h-8" />
            <h2 className="font-['Lilita_One'] text-2xl text-[var(--color-brawl-gold)] tracking-widest">
              {tStats('gemBreakdown')}
            </h2>
          </div>
          <button
            onClick={() => {
              const rows = [
                [tStats('concept'), tStats('quantity'), tStats('gems')],
                [t('powerLevels'), String(breakdown.powerLevels.count), String(breakdown.powerLevels.gems)],
                [t('gadgets'), String(breakdown.gadgets.count), String(breakdown.gadgets.gems)],
                [t('starPowers'), String(breakdown.starPowers.count), String(breakdown.starPowers.gems)],
                [t('hypercharges'), String(breakdown.hypercharges.count), String(breakdown.hypercharges.gems)],
                [t('buffies'), String(breakdown.buffies.count), String(breakdown.buffies.gems)],
                [t('gears'), String(breakdown.gears.count), String(breakdown.gears.gems)],
                ['TOTAL', '', String(totalGems)],
              ]
              const csv = rows.map(r => r.join(',')).join('\n')
              const blob = new Blob([csv], { type: 'text/csv' })
              const url = URL.createObjectURL(blob)
              const a = document.createElement('a')
              a.href = url
              a.download = `${data.playerName}_gems.csv`
              a.click()
              URL.revokeObjectURL(url)
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:bg-white/10 transition-colors text-xs font-['Lilita_One']"
            title={tStats('exportCsv') || 'CSV'}
          >
            📥 CSV
          </button>
        </div>

        <div className="overflow-x-auto -mx-2 px-2">
        <div className="space-y-1 min-w-[320px]">
          <div className="grid grid-cols-[1fr_auto_auto] gap-4 px-4 py-2 text-xs font-bold uppercase text-slate-500">
            <span>{tStats('concept')}</span>
            <span className="text-right w-20">{tStats('quantity')}</span>
            <span className="text-right w-24">{tStats('gems')}</span>
          </div>

          {[
            { icon: '📈', label: `${t('powerLevels')}`, qty: `${breakdown.powerLevels.count}`, gems: breakdown.powerLevels.gems, color: 'border-l-yellow-500' },
            { icon: '🔧', label: `${t('gadgets')} (×${GEM_COSTS.gadget}💎)`, qty: `${breakdown.gadgets.count}`, gems: breakdown.gadgets.gems, color: 'border-l-green-500' },
            { icon: '⭐', label: `${t('starPowers')} (×${GEM_COSTS.starPower}💎)`, qty: `${breakdown.starPowers.count}`, gems: breakdown.starPowers.gems, color: 'border-l-purple-500' },
            { icon: '⚡', label: `${t('hypercharges')} (×${GEM_COSTS.hypercharge}💎)`, qty: `${breakdown.hypercharges.count}`, gems: breakdown.hypercharges.gems, color: 'border-l-red-500' },
            { icon: '💪', label: `${t('buffies')} (×${GEM_COSTS.buffie}💎)`, qty: `${breakdown.buffies.count}`, gems: breakdown.buffies.gems, color: 'border-l-pink-500' },
            { icon: '🔩', label: `${t('gears')} (×${GEM_COSTS.gear}💎)`, qty: `${breakdown.gears.count}`, gems: breakdown.gears.gems, color: 'border-l-gray-500' },
          ].map((row, i) => (
            <div key={i} className={`grid grid-cols-[1fr_auto_auto] gap-4 px-4 py-3 rounded-lg border-l-4 ${row.color} ${i % 2 === 0 ? 'bg-white/5' : 'bg-white/[0.02]'}`}>
              <span className="flex items-center gap-2 text-sm text-slate-200">
                <span>{row.icon}</span>
                <span>{row.label}</span>
              </span>
              <span className="text-right text-sm text-slate-400 w-20">{row.qty}</span>
              <span className="text-right text-sm font-['Lilita_One'] text-white w-24">
                {row.gems.toLocaleString()}
              </span>
            </div>
          ))}

          <div className="grid grid-cols-[1fr_auto_auto] gap-4 px-4 py-4 mt-2 rounded-xl bg-[var(--color-brawl-gold)]/20 border-2 border-[var(--color-brawl-gold)]">
            <span className="flex items-center gap-2 font-['Lilita_One'] text-xl text-white">
              <GemIcon className="w-6 h-6" />
              {tStats('totalGems')}
            </span>
            <span className="text-right text-sm text-white/60 w-20">=</span>
            <span className="text-right font-['Lilita_One'] text-2xl text-white w-24">
              {totalGems.toLocaleString()}
            </span>
          </div>
        </div>
        </div>
      </div>

      <AdPlaceholder className="my-6" />
    </div>
  )
}
