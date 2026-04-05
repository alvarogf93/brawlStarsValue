'use client'

import { useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { usePlayerData } from '@/hooks/usePlayerData'

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
    </div>
  )
}
