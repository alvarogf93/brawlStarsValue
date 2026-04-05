'use client'

import { useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useBattlelog } from '@/hooks/useBattlelog'

const MODE_ICONS: Record<string, string> = {
  brawlBall: '⚽', gemGrab: '💎', showdown: '💀', duoShowdown: '💀',
  heist: '🔒', bounty: '⭐', siege: '🤖', hotZone: '🔥',
  knockout: '🥊', wipeout: '💥', payload: '🚚', paintBrawl: '🎨',
  trophyThieves: '🏆', duels: '⚔️', ranked: '🏅',
}

function formatBattleTime(iso: string): string {
  // "20260405T171604.000Z" → readable
  try {
    const y = iso.slice(0, 4), m = iso.slice(4, 6), d = iso.slice(6, 8)
    const h = iso.slice(9, 11), min = iso.slice(11, 13)
    return `${d}/${m} ${h}:${min}`
  } catch { return iso }
}

const RESULT_STYLES: Record<string, string> = {
  victory: 'bg-green-500/20 text-green-400 border-green-500/30',
  defeat: 'bg-red-500/20 text-red-400 border-red-500/30',
  draw: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
}

export default function BattlesPage() {
  const params = useParams<{ tag: string }>()
  const t = useTranslations('battles')
  const tag = decodeURIComponent(params.tag)
  const { data, isLoading, error } = useBattlelog(tag)

  if (isLoading) {
    return <div className="animate-pulse py-20 text-center"><p className="text-slate-400 font-['Lilita_One'] text-2xl">Loading battles...</p></div>
  }

  if (error || !data) {
    return <div className="glass p-8 rounded-2xl text-center border-red-500/30"><p className="text-red-400">{error || 'Could not load battles.'}</p></div>
  }

  return (
    <div className="animate-fade-in w-full pb-10 space-y-6">

      {/* Header */}
      <div className="brawl-card p-6 md:p-8 bg-gradient-to-r from-[#F82F41] to-[#121A2F]">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-[var(--color-brawl-gold)] border-4 border-[#121A2F] rounded-2xl flex items-center justify-center transform rotate-3 shadow-[0_4px_0_0_#121A2F]">
            <span className="text-3xl">⚔️</span>
          </div>
          <div>
            <h1 className="text-4xl md:text-5xl font-['Lilita_One'] tracking-wide text-white text-stroke-brawl transform rotate-[-1deg]">
              {t('title')}
            </h1>
            <p className="font-['Inter'] font-semibold text-[var(--color-brawl-gold)]">
              {t('subtitle', { count: data.battles.length.toString() })}
            </p>
          </div>
        </div>
      </div>

      {/* Stats summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="brawl-card p-4 text-center">
          <p className="font-['Lilita_One'] text-3xl text-green-500">{data.winRate}%</p>
          <p className="text-[10px] uppercase font-bold text-slate-500">{t('winRate')}</p>
        </div>
        <div className="brawl-card p-4 text-center">
          <p className="font-['Lilita_One'] text-xl text-[var(--color-brawl-dark)]">
            <span className="text-green-600">{data.recentWins}W</span>
            {' / '}
            <span className="text-red-500">{data.recentLosses}L</span>
          </p>
          <p className="text-[10px] uppercase font-bold text-slate-500">{t('record')}</p>
        </div>
        <div className="brawl-card p-4 text-center">
          <p className="font-['Lilita_One'] text-xl text-[var(--color-brawl-dark)]">{data.mostPlayedMode}</p>
          <p className="text-[10px] uppercase font-bold text-slate-500">{t('favMode')}</p>
        </div>
        <div className="brawl-card p-4 text-center">
          <p className="font-['Lilita_One'] text-xl text-[var(--color-brawl-dark)]">{data.mostPlayedBrawler}</p>
          <p className="text-[10px] uppercase font-bold text-slate-500">{t('favBrawler')}</p>
        </div>
      </div>

      {/* Trophy change */}
      <div className="brawl-card-dark p-4 text-center">
        <span className={`font-['Lilita_One'] text-3xl ${data.trophyChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
          {data.trophyChange >= 0 ? '+' : ''}{data.trophyChange} 🏆
        </span>
        <p className="text-xs text-slate-400 font-bold uppercase mt-1">{t('trophyChange')}</p>
      </div>

      {/* Battle list */}
      <div className="space-y-3">
        {data.battles.map((battle, i) => {
          const result = battle.battle.result
          const mode = battle.battle.mode || battle.event.mode
          const icon = MODE_ICONS[mode] || '🎮'

          return (
            <div key={i} className={`p-4 rounded-xl border-2 ${RESULT_STYLES[result] || 'bg-white/5 border-white/10'} flex items-center gap-4`}>
              <span className="text-2xl">{icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-['Lilita_One'] text-sm uppercase">{mode}</span>
                  <span className="text-xs text-slate-400">{battle.event.map}</span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">{formatBattleTime(battle.battleTime)}</p>
              </div>
              <div className="text-right">
                <span className="font-['Lilita_One'] uppercase text-sm">{result}</span>
                {battle.battle.trophyChange !== undefined && (
                  <p className={`text-xs font-bold ${battle.battle.trophyChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {battle.battle.trophyChange >= 0 ? '+' : ''}{battle.battle.trophyChange}🏆
                  </p>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Ad space */}
      <div className="w-full min-h-[250px] bg-slate-800/50 border-2 border-dashed border-slate-600/50 rounded-xl flex items-center justify-center">
        <span className="text-slate-500 font-['Lilita_One'] tracking-wider">AD SPACE</span>
      </div>
    </div>
  )
}
