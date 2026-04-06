'use client'

import { useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { usePlayerData } from '@/hooks/usePlayerData'
import { GemIcon } from '@/components/ui/GemIcon'
import { GEM_COSTS } from '@/lib/constants'
import { formatPlaytime } from '@/lib/utils'
import { AdPlaceholder } from '@/components/ui/AdPlaceholder'

export default function StatsPage() {
  const params = useParams<{ tag: string }>()
  const t = useTranslations('profile')
  const tNav = useTranslations('nav')
  const tStats = useTranslations('stats')
  const tag = decodeURIComponent(params.tag)
  const { data, isLoading, error } = usePlayerData(tag)

  if (isLoading) {
    return (
      <div className="animate-pulse py-20 text-center">
        <p className="text-slate-400 font-['Lilita_One'] text-2xl">{tStats('loading')}</p>
      </div>
    )
  }

  if (error || !data?.player) {
    return (
      <div className="glass p-8 rounded-2xl text-center border-red-500/30">
        <p className="text-red-400">{error || tStats('error')}</p>
      </div>
    )
  }

  const player = data.player
  const bd = data.breakdown
  const st = data.stats
  const trophyPercent = st.highestTrophies > 0
    ? Math.min(100, Math.round((st.trophies / st.highestTrophies) * 100))
    : 0

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
              <path className="text-[var(--color-brawl-gold)]" strokeDasharray={`${data.totalGems > 0 ? Math.min(100, Math.round((bd.powerLevels.gems / data.totalGems) * 100)) : 0}, 100`}
                strokeWidth="4" strokeLinecap="round" stroke="currentColor" fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-['Lilita_One'] text-4xl text-white drop-shadow-[0_4px_0_rgba(0,0,0,0.8)] text-stroke-brawl" style={{ WebkitTextStroke: '2px #121A2F' }}>
                {data.totalGems.toLocaleString()}
              </span>
            </div>
          </div>

          {/* Gem breakdown bars */}
          <div className="w-full mt-8 space-y-3">
            {[
              { label: t('powerLevels'), value: bd.powerLevels.gems, color: '#F59E0B' },
              { label: t('gadgets'), value: bd.gadgets.gems, color: '#10B981' },
              { label: t('starPowers'), value: bd.starPowers.gems, color: '#8B5CF6' },
              { label: t('hypercharges'), value: bd.hypercharges.gems, color: '#EF4444' },
              { label: t('buffies'), value: bd.buffies.gems, color: '#EC4899' },
              { label: t('gears'), value: bd.gears.gems, color: '#6B7280' },
            ].map((v) => (
              <div key={v.label}>
                <div className="flex justify-between text-xs font-black uppercase tracking-wider mb-1">
                  <span className="text-slate-300">{v.label}</span>
                  <span className="text-slate-100">{v.value.toLocaleString()} 💎</span>
                </div>
                {/* Segmented/Trophy-Road style mini bar */}
                <div className="h-4 w-full bg-[#0D1321] rounded-sm overflow-hidden border-2 border-[#1E293B]">
                  <div
                    className="h-full rounded-sm transition-all duration-700 relative"
                    style={{ width: `${data.totalGems > 0 ? Math.max(2, Math.round((v.value / data.totalGems) * 100)) : 0}%`, backgroundColor: v.color }}
                  >
                    <div className="absolute inset-0 bg-[repeating-linear-gradient(90deg,transparent,transparent_8px,rgba(0,0,0,0.3)_8px,rgba(0,0,0,0.3)_12px)]" />
                    <div className="absolute top-0 inset-x-0 h-1/2 bg-white/20" />
                  </div>
                </div>
              </div>
            ))}
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
                  {tStats('highest')}<span className="text-yellow-400">{st.highestTrophies.toLocaleString()}</span>
                </p>
              </div>
              <span className="font-['Lilita_One'] text-4xl text-white text-stroke-brawl drop-shadow-[0_4px_4px_rgba(0,0,0,0.8)]">
                {st.trophies.toLocaleString()} 🏆
              </span>
            </div>

            {/* Segmented Progress Bar */}
            <div className="h-12 w-full bg-[#0D1321] border-4 border-[#1E293B] p-1 relative shadow-[inset_0px_6px_6px_rgba(0,0,0,0.6)] rounded-sm">
              <div
                className="h-full bg-gradient-to-r from-[#FFC91B] to-[#F82F41] relative overflow-hidden transition-all duration-1000 rounded-sm"
                style={{ width: `${trophyPercent}%` }}
              >
                {/* 3D Top bevel */}
                <div className="absolute inset-0 top-0 h-1/2 bg-white/25" />
                {/* Segmented black notches */}
                <div className="absolute inset-0 bg-[repeating-linear-gradient(90deg,transparent,transparent_20px,rgba(0,0,0,0.4)_20px,rgba(0,0,0,0.4)_26px)]" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 flex-1">
            <div className="brawl-card-dark border-[#0D1321] p-4 flex flex-col justify-center items-center hover:-translate-y-2 hover:shadow-[0_12px_20px_-8px_#1C5CF1] transition-all duration-200">
              <span className="text-4xl mb-2 filter drop-shadow-md">⚔️</span>
              <span className="text-3xl font-['Lilita_One'] text-white drop-shadow-[0_4px_0_rgba(0,0,0,0.8)] text-stroke-brawl">{st.threeVsThreeVictories.toLocaleString()}</span>
              <span className="text-[10px] uppercase font-black text-slate-400 tracking-wider">{tStats('wins3v3')}</span>
            </div>
            <div className="brawl-card-dark border-[#0D1321] p-4 flex flex-col justify-center items-center hover:-translate-y-2 hover:shadow-[0_12px_20px_-8px_#F82F41] transition-all duration-200">
              <span className="text-4xl mb-2 filter drop-shadow-md">👤</span>
              <span className="text-3xl font-['Lilita_One'] text-white drop-shadow-[0_4px_0_rgba(0,0,0,0.8)] text-stroke-brawl">{st.soloVictories.toLocaleString()}</span>
              <span className="text-[10px] uppercase font-black text-slate-400 tracking-wider">{tStats('soloWins')}</span>
            </div>
            <div className="brawl-card-dark border-[#0D1321] p-4 flex flex-col justify-center items-center hover:-translate-y-2 hover:shadow-[0_12px_20px_-8px_#10B981] transition-all duration-200">
              <span className="text-4xl mb-2 filter drop-shadow-md">👥</span>
              <span className="text-3xl font-['Lilita_One'] text-white drop-shadow-[0_4px_0_rgba(0,0,0,0.8)] text-stroke-brawl">{st.duoVictories.toLocaleString()}</span>
              <span className="text-[10px] uppercase font-black text-slate-400 tracking-wider">{tStats('duoWins')}</span>
            </div>
            <div 
              className="brawl-card-dark border-[#121A2F] p-4 flex flex-col justify-center items-center relative overflow-hidden group cursor-help"
              title={tStats('timeTooltip', { winRate: Math.round(st.winRateUsed * 100) })}
            >
              <div className="absolute inset-0 bg-[#4EC0FA]/20 group-hover:bg-[#4EC0FA]/40 transition-colors" />
              <span className="text-4xl filter drop-shadow-md relative z-10 mb-2">⏱️</span>
              <span className="text-2xl font-['Lilita_One'] text-white drop-shadow-[0_4px_0_rgba(0,0,0,0.8)] text-stroke-brawl relative z-10 border-b border-dashed border-[#A0AEC0]/50 pb-0.5">
                {formatPlaytime(st.estimatedHoursPlayed)}
              </span>
              <span className="text-[10px] uppercase font-black text-slate-300 relative z-10 tracking-wider">{tStats('timePlayed')}</span>
            </div>
          </div>

          {/* Unlock details */}
          <div className="brawl-card-dark p-6">
            <h3 className="font-['Lilita_One'] text-[var(--color-brawl-gold)] text-lg tracking-widest mb-4">{tStats('details')}</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: t('gadgets'), value: bd.gadgets.count, icon: '🔧' },
                { label: t('starPowers'), value: bd.starPowers.count, icon: '⭐' },
                { label: t('hypercharges'), value: bd.hypercharges.count, icon: '⚡' },
                { label: t('buffies'), value: bd.buffies.count, icon: '💪' },
                { label: t('gears'), value: bd.gears.count, icon: '🔩' },
                { label: t('prestige'), value: st.totalPrestigeLevel, icon: '👑' },
                { label: t('timePlayed'), value: formatPlaytime(st.estimatedHoursPlayed), icon: '⏱️' },
              ].map((item) => (
                <div key={item.label} className="bg-white/5 rounded-xl p-3 text-center">
                  <span className="text-2xl">{item.icon}</span>
                  <p className="font-['Lilita_One'] text-2xl text-white mt-1">{item.value}</p>
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
        <div className="flex items-center gap-3 mb-6">
          <GemIcon className="w-8 h-8" />
          <h2 className="font-['Lilita_One'] text-2xl text-[var(--color-brawl-gold)] tracking-widest">
            {tStats('gemBreakdown')}
          </h2>
        </div>

        <div className="space-y-1">
          <div className="grid grid-cols-[1fr_auto_auto] gap-4 px-4 py-2 text-xs font-bold uppercase text-slate-500">
            <span>{tStats('concept')}</span>
            <span className="text-right w-20">{tStats('quantity')}</span>
            <span className="text-right w-24">{tStats('gems')}</span>
          </div>

          {[
            { icon: '📈', label: `${t('powerLevels')}`, qty: `${bd.powerLevels.count}`, gems: bd.powerLevels.gems, color: 'border-l-yellow-500' },
            { icon: '🔧', label: `${t('gadgets')} (×${GEM_COSTS.gadget}💎)`, qty: `${bd.gadgets.count}`, gems: bd.gadgets.gems, color: 'border-l-green-500' },
            { icon: '⭐', label: `${t('starPowers')} (×${GEM_COSTS.starPower}💎)`, qty: `${bd.starPowers.count}`, gems: bd.starPowers.gems, color: 'border-l-purple-500' },
            { icon: '⚡', label: `${t('hypercharges')} (×${GEM_COSTS.hypercharge}💎)`, qty: `${bd.hypercharges.count}`, gems: bd.hypercharges.gems, color: 'border-l-red-500' },
            { icon: '💪', label: `${t('buffies')} (×${GEM_COSTS.buffie}💎)`, qty: `${bd.buffies.count}`, gems: bd.buffies.gems, color: 'border-l-pink-500' },
            { icon: '🔩', label: `${t('gears')} (×${GEM_COSTS.gear}💎)`, qty: `${bd.gears.count}`, gems: bd.gears.gems, color: 'border-l-gray-500' },
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
              {data.totalGems.toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      <AdPlaceholder className="my-6" />
    </div>
  )
}
