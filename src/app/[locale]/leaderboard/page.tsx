'use client'

import { useState, useEffect } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { AnimatedCounter } from '@/components/ui/AnimatedCounter'
import { AdPlaceholder } from '@/components/ui/AdPlaceholder'
import { Link } from '@/i18n/routing'
import NextLink from 'next/link'
import { Home, Trophy, Loader2 } from 'lucide-react'
import type { RankedPlayer } from '@/lib/api'

export default function LeaderboardPage() {
  const t = useTranslations('leaderboard')
  const [players, setPlayers] = useState<RankedPlayer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [country, setCountry] = useState('global')
  const locale = useLocale()

  const profileUrl = (tag: string) =>
    `/${locale}/profile/${encodeURIComponent(tag)}`

  useEffect(() => {
    setLoading(true)
    setError('')
    fetch(`/api/rankings?country=${country}&limit=200`)
      .then(res => res.json())
      .then(data => {
        if (data.error) throw new Error(data.error)
        setPlayers(data.items || [])
      })
      .catch(() => setError(t('error')))
      .finally(() => setLoading(false))
  }, [country, t])

  const top3 = players.slice(0, 3)
  const rest = players.slice(3)
  const podiumOrder = [1, 0, 2] // 2nd, 1st, 3rd
  const podiumColors = ['#94A3B8', '#F59E0B', '#B45309']
  const podiumHeights = ['h-[200px]', 'h-[260px]', 'h-[170px]']
  const podiumWidths = ['w-1/3', 'w-[40%]', 'w-1/3']
  const medals = ['🥈', '🥇', '🥉']

  return (
    <div className="min-h-screen bg-transparent px-4 py-8 max-w-5xl mx-auto animate-fade-in w-full pb-32 relative">

      <div className="absolute top-4 left-4 md:top-8 md:left-8 z-50">
        <Link href="/" className="flex items-center gap-2 bg-[#121A2F] border-4 border-[#0F172A] text-white px-4 py-2 rounded-xl font-['Lilita_One'] hover:bg-[#1C5CF1] transition-colors shadow-[0_4px_0_0_#0F172A] active:translate-y-1 active:shadow-none">
          <Home size={20} strokeWidth={3} />
          <span>{t('home')}</span>
        </Link>
      </div>

      <AdPlaceholder className="mb-8 relative z-10" />

      <div className="text-center mb-10 relative z-10 w-full flex flex-col items-center">
        <div className="bg-[#1C5CF1] border-4 border-[#121A2F] rounded-[2rem] w-24 h-24 flex items-center justify-center shadow-[0_8px_0_0_#121A2F,inset_0_4px_0_rgba(255,255,255,0.3)] transform rotate-[-5deg] mb-6 hover:rotate-0 transition-transform">
          <Trophy className="w-12 h-12 text-white drop-shadow-md" strokeWidth={2.5} />
        </div>
        <h1 className="text-5xl md:text-7xl font-['Lilita_One'] tracking-wide text-white text-stroke-brawl uppercase transform rotate-[1deg] mb-3 drop-shadow-lg">
          {t('title')}
        </h1>
        <p className="font-['Inter'] font-bold text-[#E2E8F0] text-lg bg-[#121A2F]/50 px-6 py-2 rounded-full border-2 border-white/10 backdrop-blur-sm">
          {t('subtitle')}
        </p>
      </div>

      {/* Tabs */}
      <div className="flex justify-center mb-16 relative z-10">
        <div className="bg-[#121A2F] p-2 rounded-full flex border-4 border-black/50 shadow-[0_4px_0_0_rgba(0,0,0,0.5)]">
          <button
            onClick={() => setCountry('global')}
            className={`px-8 py-3 rounded-full font-['Lilita_One'] text-xl transition-all ${country === 'global' ? 'bg-[var(--color-brawl-gold)] text-[#121A2F] shadow-[0_4px_0_0_#B45309]' : 'text-slate-400 hover:text-white'}`}>
            {t('global')} 🌍
          </button>
          <button
            onClick={() => setCountry('ES')}
            className={`px-8 py-3 rounded-full font-['Lilita_One'] text-xl transition-all ${country === 'ES' ? 'bg-[var(--color-brawl-sky)] text-[#121A2F] shadow-[0_4px_0_0_#0284c7]' : 'text-slate-400 hover:text-white'}`}>
            {t('local')} 🇪🇸
          </button>
        </div>
      </div>

      {loading && (
        <div className="flex justify-center py-20">
          <Loader2 className="w-12 h-12 text-[#1C5CF1] animate-spin" />
        </div>
      )}

      {error && (
        <p className="text-center text-[var(--color-brawl-red)] font-['Lilita_One'] text-xl">{error}</p>
      )}

      {!loading && !error && top3.length >= 3 && (
        <>
          {/* TOP 3 Podium */}
          <div className="flex flex-row items-end justify-center h-[300px] gap-2 md:gap-4 mb-20 relative z-10 mx-auto w-full max-w-4xl px-2">
            {podiumOrder.map((idx, pos) => {
              const p = top3[idx]
              if (!p) return null
              const isFirst = idx === 0
              return (
                <NextLink href={profileUrl(p.tag)} key={p.tag} className={`${podiumWidths[pos]} flex flex-col items-center relative group brawl-tilt ${isFirst ? 'z-20 transform scale-105' : ''} cursor-pointer`}>
                  <div className={`absolute ${isFirst ? '-top-28' : '-top-16'} ${isFirst ? 'animate-float' : ''} z-30 flex flex-col items-center`}>
                    {isFirst && <span className="text-4xl mb-[-10px] z-40 transform rotate-12 drop-shadow-md">👑</span>}
                    <div className={`bg-white ${isFirst ? 'w-28 h-28 rounded-[2rem]' : 'w-20 h-20 rounded-3xl'} border-4 flex items-center justify-center text-4xl ${isFirst ? 'text-6xl' : ''} group-hover:scale-110 transition-transform`}
                      style={{ borderColor: podiumColors[pos], boxShadow: `0 0 20px ${podiumColors[pos]}60` }}>
                      {medals[pos]}
                    </div>
                  </div>
                  <div className={`absolute ${isFirst ? '-top-2 z-40 border-4 px-5 py-1.5 text-lg' : '-top-4 z-30 border-2 px-3 py-1 text-sm'} bg-[#121A2F] rounded-full font-['Lilita_One'] text-white text-center shadow-lg truncate max-w-[90%]`}
                    style={{ borderColor: isFirst ? podiumColors[pos] : 'white', color: isFirst ? podiumColors[pos] : 'white' }}>
                    {p.name}
                  </div>
                  <div className={`w-full border-4 border-[#121A2F] border-b-0 rounded-t-[2rem] ${isFirst ? 'rounded-t-[2.5rem]' : ''} ${podiumHeights[pos]} pt-12 pb-4 flex flex-col items-center relative z-10`}
                    style={{ background: `linear-gradient(to bottom, ${podiumColors[pos]}80, ${podiumColors[pos]})` }}>
                    <span className={`font-['Lilita_One'] text-white/40 ${isFirst ? 'text-9xl' : 'text-7xl'} absolute bottom-2`}>{idx + 1}</span>
                    <span className="font-['Lilita_One'] text-[#121A2F] text-xl flex flex-col items-center gap-1 mt-2 z-10">
                      <AnimatedCounter value={p.trophies} />
                      <Trophy className="w-5 h-5" />
                    </span>
                  </div>
                </NextLink>
              )
            })}
          </div>

          {/* Ad between podium and list */}
          <AdPlaceholder className="mb-8 max-w-4xl mx-auto" />

          {/* Rest of list */}
          <div className="flex flex-col gap-4 relative z-10 max-w-4xl mx-auto px-2">
            {rest.map((p) => (
              <NextLink key={p.tag} href={profileUrl(p.tag)} className="bg-white/5 border-4 border-white/10 backdrop-blur-md rounded-[2rem] p-4 flex items-center hover:bg-white/10 hover:border-white/30 transition-all duration-300 transform hover:-translate-y-1 group">
                <div className="w-14 h-14 rounded-2xl bg-[#121A2F] border-2 border-white/20 flex items-center justify-center shrink-0">
                  <span className="font-['Lilita_One'] text-2xl text-[var(--color-brawl-sky)]">{p.rank}</span>
                </div>
                <div className="flex-1 min-w-0 ml-4">
                  <h3 className="font-['Lilita_One'] text-2xl text-white truncate">{p.name}</h3>
                  <span className="font-['Inter'] text-sm font-bold text-slate-400 bg-black/30 px-2 py-0.5 rounded-full">
                    {p.club?.name || '—'}
                  </span>
                </div>
                <div className="brawl-card bg-[var(--color-brawl-blue)] px-4 py-2 shrink-0">
                  <span className="font-['Lilita_One'] text-xl md:text-2xl text-[var(--color-brawl-gold)] text-stroke-brawl flex items-center gap-2">
                    <AnimatedCounter value={p.trophies} /> <Trophy className="w-5 h-5 md:w-6 md:h-6" />
                  </span>
                </div>
              </NextLink>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
