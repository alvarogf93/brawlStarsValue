'use client'

import { useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { usePlayerData } from '@/hooks/usePlayerData'
import { GemIcon } from '@/components/ui/GemIcon'
import { GEM_COSTS } from '@/lib/constants'

export default function StatsPage() {
  const params = useParams<{ tag: string }>()
  const t = useTranslations('profile')
  const tNav = useTranslations('nav')
  const tag = decodeURIComponent(params.tag)
  const { data, isLoading, error } = usePlayerData(tag)

  if (isLoading) {
    return (
      <div className="animate-pulse py-20 text-center">
        <p className="text-slate-400 font-['Lilita_One'] text-2xl">Loading stats...</p>
      </div>
    )
  }

  if (error || !data?.player) {
    return (
      <div className="glass p-8 rounded-2xl text-center border-red-500/30">
        <p className="text-red-400">{error || 'Could not load stats.'}</p>
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
      <div className="w-full h-[90px] bg-slate-800/50 border-2 border-dashed border-slate-600/50 rounded-xl flex items-center justify-center">
        <span className="text-slate-500 font-['Lilita_One'] tracking-wider">AD SPACE (728x90)</span>
      </div>

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
        <div className="brawl-card p-6 flex flex-col items-center justify-center col-span-1 min-h-[300px]">
          <h2 className="font-['Lilita_One'] text-2xl text-[var(--color-brawl-dark)] text-center mb-6">GEM SCORE</h2>
          <div className="relative w-48 h-48 flex items-center justify-center">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
              <path className="text-[#E2E8F0]" strokeWidth="4" stroke="currentColor" fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
              <path className="text-[var(--color-brawl-gold)]" strokeDasharray={`${data.totalGems > 0 ? Math.min(100, Math.round((bd.powerLevels.gems / data.totalGems) * 100)) : 0}, 100`}
                strokeWidth="4" strokeLinecap="round" stroke="currentColor" fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-['Lilita_One'] text-3xl text-[var(--color-brawl-dark)] text-stroke-brawl" style={{ WebkitTextStroke: '2px #121A2F' }}>
                {data.totalGems.toLocaleString()}
              </span>
              <span className="font-['Inter'] text-xs font-bold text-slate-500 uppercase mt-1">💎 {t('totalGems')}</span>
            </div>
          </div>

          {/* Gem breakdown bars */}
          <div className="w-full mt-6 space-y-2">
            {[
              { label: t('brawlerCount'), value: bd.unlocks.gems, color: '#3B82F6' },
              { label: 'Power Levels', value: bd.powerLevels.gems, color: '#F59E0B' },
              { label: t('gadgets'), value: bd.gadgets.gems, color: '#10B981' },
              { label: t('starPowers'), value: bd.starPowers.gems, color: '#8B5CF6' },
              { label: t('hypercharges'), value: bd.hypercharges.gems, color: '#EF4444' },
              { label: t('buffies'), value: bd.buffies.gems, color: '#EC4899' },
              { label: t('skins'), value: bd.skins.gems, color: '#F97316' },
            ].map((v) => (
              <div key={v.label}>
                <div className="flex justify-between text-xs font-bold mb-1">
                  <span className="text-slate-600">{v.label}</span>
                  <span className="text-slate-800">{v.value.toLocaleString()} 💎</span>
                </div>
                <div className="h-3 w-full bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${data.totalGems > 0 ? Math.max(2, Math.round((v.value / data.totalGems) * 100)) : 0}%`, backgroundColor: v.color }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Trophies & Victories */}
        <div className="lg:col-span-2 flex flex-col gap-6">

          <div className="brawl-card-dark p-6">
            <div className="flex justify-between items-end mb-4">
              <div>
                <h3 className="font-['Lilita_One'] text-[#F82F41] text-lg tracking-widest">TROPHY ROAD</h3>
                <p className="font-['Inter'] font-semibold text-slate-300 text-sm">
                  Highest: {st.highestTrophies.toLocaleString()}
                </p>
              </div>
              <span className="font-['Lilita_One'] text-3xl text-white text-stroke-brawl">
                {st.trophies.toLocaleString()} 🏆
              </span>
            </div>

            {/* Progress Bar */}
            <div className="h-10 w-full bg-[#121A2F] border-4 border-[#121A2F] rounded-full p-1 relative overflow-hidden shadow-[inset_0px_4px_4px_rgba(0,0,0,0.5)]">
              <div
                className="h-full bg-gradient-to-r from-[#FFC91B] to-[#F82F41] rounded-full relative overflow-hidden transition-all duration-1000"
                style={{ width: `${trophyPercent}%` }}
              >
                <div className="absolute inset-0 top-0 h-1/3 bg-white/40" />
                <div className="absolute inset-0 bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,rgba(255,255,255,0.2)_10px,rgba(255,255,255,0.2)_20px)]" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 flex-1">
            <div className="brawl-card p-4 flex flex-col justify-center items-center">
              <span className="text-2xl mb-1 filter drop-shadow-md">⚔️</span>
              <span className="text-2xl font-['Lilita_One'] text-[#121A2F]">{st.threeVsThreeVictories.toLocaleString()}</span>
              <span className="text-[10px] uppercase font-bold text-slate-500">3v3 Wins</span>
            </div>
            <div className="brawl-card p-4 flex flex-col justify-center items-center">
              <span className="text-2xl mb-1 filter drop-shadow-md">👤</span>
              <span className="text-2xl font-['Lilita_One'] text-[#121A2F]">{st.soloVictories.toLocaleString()}</span>
              <span className="text-[10px] uppercase font-bold text-slate-500">Solo Wins</span>
            </div>
            <div className="brawl-card p-4 flex flex-col justify-center items-center">
              <span className="text-2xl mb-1 filter drop-shadow-md">👥</span>
              <span className="text-2xl font-['Lilita_One'] text-[#121A2F]">{st.duoVictories.toLocaleString()}</span>
              <span className="text-[10px] uppercase font-bold text-slate-500">Duo Wins</span>
            </div>
            <div className="brawl-card p-4 flex flex-col justify-center items-center bg-[#4EC0FA]">
              <span className="text-2xl font-bold font-['Inter'] text-white mb-1">⏱️</span>
              <span className="text-2xl font-['Lilita_One'] text-white text-stroke-brawl" style={{ WebkitTextStroke: '1px #121A2F', textShadow: '0 2px 0 #121A2F' }}>
                {st.estimatedHoursPlayed}h
              </span>
              <span className="text-[10px] uppercase font-bold text-white/80">Time Played</span>
            </div>
          </div>

          {/* Unlock details */}
          <div className="brawl-card-dark p-6">
            <h3 className="font-['Lilita_One'] text-[var(--color-brawl-gold)] text-lg tracking-widest mb-4">DETALLES</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: t('gadgets'), value: bd.gadgets.count, icon: '🔧' },
                { label: t('starPowers'), value: bd.starPowers.count, icon: '⭐' },
                { label: t('hypercharges'), value: bd.hypercharges.count, icon: '⚡' },
                { label: t('buffies'), value: bd.buffies.count, icon: '💪' },
                { label: t('skins'), value: bd.skins.count, icon: '🎨' },
                { label: t('prestige'), value: st.totalPrestigeLevel, icon: '👑' },
                { label: t('unlocks'), value: bd.unlocks.count, icon: '🎴' },
                { label: t('timePlayed'), value: `${st.estimatedHoursPlayed}h`, icon: '⏱️' },
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

      {/* Gem Breakdown Table */}
      <div className="brawl-card-dark p-6 md:p-8">
        <div className="flex items-center gap-3 mb-6">
          <GemIcon className="w-8 h-8" />
          <h2 className="font-['Lilita_One'] text-2xl text-[var(--color-brawl-gold)] tracking-widest">
            GEM BREAKDOWN
          </h2>
        </div>

        <div className="space-y-1">
          <div className="grid grid-cols-[1fr_auto_auto] gap-4 px-4 py-2 text-xs font-bold uppercase text-slate-500">
            <span>Concepto</span>
            <span className="text-right w-20">Cantidad</span>
            <span className="text-right w-24">Gemas</span>
          </div>

          {[
            { icon: '🎴', label: `${t('brawlerCount')} (desbloqueo)`, qty: `${bd.unlocks.count}`, gems: bd.unlocks.gems, color: 'border-l-blue-500' },
            { icon: '📈', label: `Power Levels (mejora)`, qty: `${bd.powerLevels.count}`, gems: bd.powerLevels.gems, color: 'border-l-yellow-500' },
            { icon: '🔧', label: `${t('gadgets')} (×${GEM_COSTS.gadget}💎)`, qty: `${bd.gadgets.count}`, gems: bd.gadgets.gems, color: 'border-l-green-500' },
            { icon: '⭐', label: `${t('starPowers')} (×${GEM_COSTS.starPower}💎)`, qty: `${bd.starPowers.count}`, gems: bd.starPowers.gems, color: 'border-l-purple-500' },
            { icon: '⚡', label: `${t('hypercharges')} (×${GEM_COSTS.hypercharge}💎)`, qty: `${bd.hypercharges.count}`, gems: bd.hypercharges.gems, color: 'border-l-red-500' },
            { icon: '💪', label: `${t('buffies')} (×${GEM_COSTS.buffie}💎)`, qty: `${bd.buffies.count}`, gems: bd.buffies.gems, color: 'border-l-pink-500' },
            { icon: '🎨', label: `${t('skins')} (×${GEM_COSTS.skin}💎)`, qty: `${bd.skins.count}`, gems: bd.skins.gems, color: 'border-l-orange-500' },
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
              TOTAL GEMAS REALES
            </span>
            <span className="text-right text-sm text-white/60 w-20">=</span>
            <span className="text-right font-['Lilita_One'] text-2xl text-white w-24">
              {data.totalGems.toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {/* Ad Placeholder */}
      <div className="w-full min-h-[250px] bg-slate-800/50 border-2 border-dashed border-slate-600/50 rounded-xl flex items-center justify-center">
        <span className="text-slate-500 font-['Lilita_One'] tracking-wider">AD SPACE (300x250)</span>
      </div>
    </div>
  )
}
