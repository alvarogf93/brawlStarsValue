'use client'

import { useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { usePlayerData } from '@/hooks/usePlayerData'
import { GemIcon } from '@/components/ui/GemIcon'
import { ENHANCE_VALUES, GEM_DIVISOR } from '@/lib/constants'

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
  const totalVictories = player['3vs3Victories'] + player.soloVictories + player.duoVictories
  const trophyPercent = player.highestTrophies > 0
    ? Math.min(100, Math.round((player.trophies / player.highestTrophies) * 100))
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
              {/* Base slice */}
              <path className="text-[#3B82F6]" strokeDasharray={`${Math.round((bd.base.value / data.totalScore) * 100)}, 100`}
                strokeWidth="4" strokeLinecap="round" stroke="currentColor" fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-['Lilita_One'] text-4xl text-[var(--color-brawl-dark)] text-stroke-brawl" style={{ WebkitTextStroke: '2px #121A2F' }}>
                {data.gemEquivalent.toLocaleString()}
              </span>
              <span className="font-['Inter'] text-xs font-bold text-slate-500 uppercase mt-1">Gems</span>
            </div>
          </div>

          {/* Vector breakdown bars */}
          <div className="w-full mt-6 space-y-2">
            {[
              { label: t('base'), value: bd.base.value, color: '#3B82F6' },
              { label: t('assets'), value: bd.assets.value, color: '#F59E0B' },
              { label: t('enhance'), value: bd.enhance.value, color: '#8B5CF6' },
              { label: t('elite'), value: bd.elite.value, color: '#EF4444' },
            ].map((v) => (
              <div key={v.label}>
                <div className="flex justify-between text-xs font-bold mb-1">
                  <span className="text-slate-600">{v.label}</span>
                  <span className="text-slate-800">{v.value.toLocaleString()}</span>
                </div>
                <div className="h-3 w-full bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${Math.round((v.value / data.totalScore) * 100)}%`, backgroundColor: v.color }}
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
                  Highest: {player.highestTrophies.toLocaleString()}
                </p>
              </div>
              <span className="font-['Lilita_One'] text-3xl text-white text-stroke-brawl">
                {player.trophies.toLocaleString()} 🏆
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
              <span className="text-2xl font-['Lilita_One'] text-[#121A2F]">{player['3vs3Victories'].toLocaleString()}</span>
              <span className="text-[10px] uppercase font-bold text-slate-500">3v3 Wins</span>
            </div>
            <div className="brawl-card p-4 flex flex-col justify-center items-center">
              <span className="text-2xl mb-1 filter drop-shadow-md">👤</span>
              <span className="text-2xl font-['Lilita_One'] text-[#121A2F]">{player.soloVictories.toLocaleString()}</span>
              <span className="text-[10px] uppercase font-bold text-slate-500">Solo Wins</span>
            </div>
            <div className="brawl-card p-4 flex flex-col justify-center items-center">
              <span className="text-2xl mb-1 filter drop-shadow-md">👥</span>
              <span className="text-2xl font-['Lilita_One'] text-[#121A2F]">{player.duoVictories.toLocaleString()}</span>
              <span className="text-[10px] uppercase font-bold text-slate-500">Duo Wins</span>
            </div>
            <div className="brawl-card p-4 flex flex-col justify-center items-center bg-[#4EC0FA]">
              <span className="text-2xl font-bold font-['Inter'] text-white mb-1">⭐</span>
              <span className="text-2xl font-['Lilita_One'] text-white text-stroke-brawl" style={{ WebkitTextStroke: '1px #121A2F', textShadow: '0 2px 0 #121A2F' }}>
                P{player.totalPrestigeLevel}
              </span>
              <span className="text-[10px] uppercase font-bold text-white/80">{t('prestige')}</span>
            </div>
          </div>

          {/* Enhance details */}
          <div className="brawl-card-dark p-6">
            <h3 className="font-['Lilita_One'] text-[var(--color-brawl-gold)] text-lg tracking-widest mb-4">{t('enhance').toUpperCase()} DETAILS</h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {[
                { label: t('gadgets'), value: bd.enhance.gadgets, icon: '🔧' },
                { label: t('starPowers'), value: bd.enhance.starPowers, icon: '⭐' },
                { label: t('hypercharges'), value: bd.enhance.hypercharges, icon: '⚡' },
                { label: t('buffies'), value: bd.enhance.buffies, icon: '💪' },
                { label: t('skins'), value: bd.enhance.skins, icon: '🎨' },
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
          {/* Header */}
          <div className="grid grid-cols-[1fr_auto_auto] gap-4 px-4 py-2 text-xs font-bold uppercase text-slate-500">
            <span>Concepto</span>
            <span className="text-right w-20">Cantidad</span>
            <span className="text-right w-24">Gemas</span>
          </div>

          {(() => {
            const rows = [
              { icon: '🏆', label: `${t('trophies')} (×0.02)`, qty: player.trophies.toLocaleString(), gems: bd.base.trophies, category: 'base' },
              { icon: '⚔️', label: `${t('victories')} (×0.08)`, qty: player['3vs3Victories'].toLocaleString(), gems: bd.base.victories3vs3, category: 'base' },
              { icon: '🎴', label: `Rarity base value`, qty: `${bd.assets.brawlerCount} brawlers`, gems: null, category: 'divider' },
              { icon: '📈', label: `Power levels`, qty: `${bd.assets.brawlerCount} brawlers`, gems: bd.assets.value, category: 'assets' },
              { icon: '🔧', label: `${t('gadgets')} (×${ENHANCE_VALUES.gadget})`, qty: bd.enhance.gadgets.toString(), gems: bd.enhance.gadgets * ENHANCE_VALUES.gadget, category: 'enhance' },
              { icon: '⭐', label: `${t('starPowers')} (×${ENHANCE_VALUES.starPower})`, qty: bd.enhance.starPowers.toString(), gems: bd.enhance.starPowers * ENHANCE_VALUES.starPower, category: 'enhance' },
              { icon: '⚡', label: `${t('hypercharges')} (×${ENHANCE_VALUES.hypercharge})`, qty: bd.enhance.hypercharges.toString(), gems: bd.enhance.hypercharges * ENHANCE_VALUES.hypercharge, category: 'enhance' },
              { icon: '💪', label: `${t('buffies')} (×${ENHANCE_VALUES.buffie})`, qty: bd.enhance.buffies.toString(), gems: bd.enhance.buffies * ENHANCE_VALUES.buffie, category: 'enhance' },
              { icon: '🎨', label: `${t('skins')} (×${ENHANCE_VALUES.skinEquipped})`, qty: bd.enhance.skins.toString(), gems: bd.enhance.skins * ENHANCE_VALUES.skinEquipped, category: 'enhance' },
              { icon: '🥇', label: `${t('prestige')} 1 (×10,000)`, qty: bd.elite.prestige1.toString(), gems: bd.elite.prestige1 * 10000, category: 'elite' },
              { icon: '🥈', label: `${t('prestige')} 2 (×25,000)`, qty: bd.elite.prestige2.toString(), gems: bd.elite.prestige2 * 25000, category: 'elite' },
              { icon: '🥉', label: `${t('prestige')} 3 (×75,000)`, qty: bd.elite.prestige3.toString(), gems: bd.elite.prestige3 * 75000, category: 'elite' },
            ]

            const categoryColors: Record<string, string> = {
              base: 'border-l-blue-500',
              assets: 'border-l-yellow-500',
              enhance: 'border-l-purple-500',
              elite: 'border-l-red-500',
            }

            return rows.map((row, i) => (
              <div
                key={i}
                className={`grid grid-cols-[1fr_auto_auto] gap-4 px-4 py-3 rounded-lg border-l-4 ${categoryColors[row.category] || 'border-l-transparent'} ${i % 2 === 0 ? 'bg-white/5' : 'bg-white/[0.02]'}`}
              >
                <span className="flex items-center gap-2 text-sm text-slate-200">
                  <span>{row.icon}</span>
                  <span>{row.label}</span>
                </span>
                <span className="text-right text-sm text-slate-400 w-20">{row.qty}</span>
                <span className="text-right text-sm font-['Lilita_One'] text-white w-24">
                  {row.gems !== null ? row.gems.toLocaleString() : '—'}
                </span>
              </div>
            ))
          })()}

          {/* Total row */}
          <div className="grid grid-cols-[1fr_auto_auto] gap-4 px-4 py-4 mt-2 rounded-xl bg-[var(--color-brawl-gold)]/10 border-2 border-[var(--color-brawl-gold)]/30">
            <span className="flex items-center gap-2 font-['Lilita_One'] text-lg text-[var(--color-brawl-gold)]">
              <GemIcon className="w-5 h-5" />
              TOTAL SCORE
            </span>
            <span className="text-right text-sm text-slate-400 w-20">÷{GEM_DIVISOR}</span>
            <span className="text-right font-['Lilita_One'] text-xl text-[var(--color-brawl-gold)] w-24">
              {data.totalScore.toLocaleString()}
            </span>
          </div>

          <div className="grid grid-cols-[1fr_auto_auto] gap-4 px-4 py-4 rounded-xl bg-[var(--color-brawl-gold)]/20 border-2 border-[var(--color-brawl-gold)]">
            <span className="flex items-center gap-2 font-['Lilita_One'] text-xl text-white">
              <GemIcon className="w-6 h-6" />
              {t('gemEquivalent').toUpperCase()}
            </span>
            <span className="text-right text-sm text-white/60 w-20">=</span>
            <span className="text-right font-['Lilita_One'] text-2xl text-white w-24">
              {data.gemEquivalent.toLocaleString()}
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
