'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useBattlelog } from '@/hooks/useBattlelog'
import { TrophyChart } from '@/components/battles/TrophyChart'
import { AdPlaceholder } from '@/components/ui/AdPlaceholder'
import { BrawlImg } from '@/components/ui/BrawlImg'
import { BlurredTeaser } from '@/components/premium/BlurredTeaser'
import { useAuth } from '@/hooks/useAuth'
import { isPremium } from '@/lib/premium'
import { getBrawlerPortraitUrl } from '@/lib/utils'
import { ChevronDown } from 'lucide-react'
import type { Profile } from '@/lib/supabase/types'
import type { BattlelogEntry } from '@/lib/api'

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
  const params = useParams<{ tag: string; locale: string }>()
  const t = useTranslations('battles')
  const tag = decodeURIComponent(params.tag)
  const { data, isLoading, error } = useBattlelog(tag)
  const { profile } = useAuth()
  const hasPremium = isPremium(profile as Profile | null)

  if (isLoading) {
    return <div className="animate-pulse py-20 text-center"><p className="text-slate-400 font-['Lilita_One'] text-2xl">{t('loading')}</p></div>
  }

  if (error || !data) {
    return <div className="glass p-8 rounded-2xl text-center border-red-500/30"><p className="text-red-400">{error || t('error')}</p></div>
  }

  const RESULT_TEXT: Record<string, string> = {
    victory: t('resultVictory'),
    defeat: t('resultDefeat'),
    draw: t('resultDraw'),
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

      {/* Star Player + extra stats row */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="brawl-card-dark p-4 text-center border-[#090E17]">
          <span className="text-3xl block mb-1">⭐</span>
          <p className="font-['Lilita_One'] text-2xl text-[#FFC91B]">{data.starPlayerPct}%</p>
          <p className="text-[10px] uppercase font-bold text-slate-500">{t('starPlayer')}</p>
          <p className="text-[10px] text-slate-600">{data.starPlayerCount}/{data.battles.length}</p>
        </div>
        <div className="brawl-card-dark p-4 text-center border-[#090E17]">
          <span className="text-3xl block mb-1">🏆</span>
          <p className={`font-['Lilita_One'] text-2xl ${data.trophyChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {data.trophyChange >= 0 ? '+' : ''}{data.trophyChange}
          </p>
          <p className="text-[10px] uppercase font-bold text-slate-500">{t('trophyChange')}</p>
        </div>
        {data.teammates.length > 0 && (
          <div className="brawl-card-dark p-4 text-center border-[#090E17] col-span-2 md:col-span-1">
            <span className="text-3xl block mb-1">👥</span>
            <p className="font-['Lilita_One'] text-lg text-[#4EC0FA] truncate">{data.teammates[0].name}</p>
            <p className="text-[10px] uppercase font-bold text-slate-500">{t('topTeammate')}</p>
            <p className="text-[10px] text-slate-600">{data.teammates[0].gamesPlayed} {t('gamesShort')} · {data.teammates[0].winRate}% WR</p>
          </div>
        )}
      </div>

      {/* Win Rate by Mode */}
      {data.modeWinRates.length > 0 && (
        <div className="brawl-card-dark p-5 md:p-6 border-[#090E17]">
          <h3 className="font-['Lilita_One'] text-lg text-white mb-4 flex items-center gap-2">
            <span className="text-xl">📊</span> {t('winRateByMode')}
          </h3>
          <div className="space-y-2.5">
            {data.modeWinRates.map(m => {
              const icon = MODE_ICONS[m.mode] || '🎮'
              return (
                <div key={m.mode} className="flex items-center gap-3">
                  <span className="text-lg w-7 text-center">{icon}</span>
                  <span className="font-['Lilita_One'] text-sm text-slate-300 w-28 truncate">{m.mode}</span>
                  <div className="flex-1 h-5 bg-[#0D1321] rounded-full overflow-hidden relative">
                    <div
                      className="h-full rounded-full relative overflow-hidden transition-all duration-700"
                      style={{
                        width: `${m.winRate}%`,
                        background: m.winRate >= 60 ? 'linear-gradient(to right, #4ade80, #22c55e)' : m.winRate >= 45 ? 'linear-gradient(to right, #FFC91B, #F59E0B)' : 'linear-gradient(to right, #f87171, #ef4444)',
                      }}
                    >
                      <div className="absolute inset-0 top-0 h-1/3 bg-white/25 rounded-full" />
                    </div>
                  </div>
                  <span className={`font-['Lilita_One'] text-sm w-12 text-right tabular-nums ${m.winRate >= 60 ? 'text-green-400' : m.winRate >= 45 ? 'text-[#FFC91B]' : 'text-red-400'}`}>
                    {m.winRate}%
                  </span>
                  <span className="text-[10px] text-slate-600 w-8 text-right">{m.total}g</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Frequent Teammates */}
      {data.teammates.length > 1 && (
        <div className="brawl-card-dark p-5 md:p-6 border-[#090E17]">
          <h3 className="font-['Lilita_One'] text-lg text-white mb-4 flex items-center gap-2">
            <span className="text-xl">👥</span> {t('topTeammates')}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {data.teammates.map((tm, i) => (
              <div key={tm.tag} className="flex items-center gap-3 bg-white/[0.03] rounded-xl px-4 py-3">
                <span className={`font-['Lilita_One'] text-lg ${i === 0 ? 'text-[#FFC91B]' : i === 1 ? 'text-slate-300' : 'text-slate-500'}`}>
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-['Lilita_One'] text-sm text-white truncate">{tm.name}</p>
                  <p className="text-[10px] text-slate-500">{tm.gamesPlayed} {t('gamesShort')}</p>
                </div>
                <span className={`font-['Lilita_One'] text-sm ${tm.winRate >= 60 ? 'text-green-400' : tm.winRate >= 45 ? 'text-[#FFC91B]' : 'text-red-400'}`}>
                  {tm.winRate}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Trophy progression chart */}
      <TrophyChart battles={data.battles} playerTag={tag} />

      {/* Battle list — expandable */}
      <BattleList battles={data.battles} playerTag={tag} resultText={RESULT_TEXT} />

      {/* Blurred teaser for non-premium users */}
      {!hasPremium && (
        <BlurredTeaser redirectTo={`/${params.locale}/profile/${params.tag}/battles`}>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="p-4 rounded-xl border-2 bg-white/5 border-white/10 flex items-center gap-4">
                <span className="text-2xl">🎮</span>
                <div className="flex-1">
                  <div className="h-4 bg-white/10 rounded w-32 mb-2" />
                  <div className="h-3 bg-white/5 rounded w-20" />
                </div>
                <div className="h-4 bg-white/10 rounded w-16" />
              </div>
            ))}
          </div>
        </BlurredTeaser>
      )}

      {/* Ad space */}
      <AdPlaceholder className="mb-8" />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Battle list with expandable detail panels                         */
/* ------------------------------------------------------------------ */

function BattleList({ battles, playerTag, resultText }: {
  battles: BattlelogEntry[]
  playerTag: string
  resultText: Record<string, string>
}) {
  const [expanded, setExpanded] = useState<number | null>(null)
  const t = useTranslations('battles')

  return (
    <div className="space-y-3">
      {battles.map((battle, i) => {
        const result = battle.battle.result
        const mode = battle.battle.mode || battle.event.mode
        const icon = MODE_ICONS[mode] || '🎮'
        const isOpen = expanded === i
        const teams = battle.battle.teams || []
        const starTag = battle.battle.starPlayer?.tag

        return (
          <div key={i}>
            {/* Battle row — clickable */}
            <button
              onClick={() => setExpanded(isOpen ? null : i)}
              className={`w-full p-4 rounded-xl border-2 ${RESULT_STYLES[result] || 'bg-white/5 border-white/10'} flex items-center gap-4 text-left transition-all ${isOpen ? 'rounded-b-none' : ''}`}
            >
              <span className="text-2xl">{icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-['Lilita_One'] text-sm uppercase">{mode}</span>
                  <span className="text-xs text-slate-400">{battle.event.map}</span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">{formatBattleTime(battle.battleTime)}</p>
              </div>
              <div className="text-right flex items-center gap-2">
                <div>
                  <span className="font-['Lilita_One'] uppercase text-sm">{resultText[result] ?? result}</span>
                  {battle.battle.trophyChange !== undefined && (
                    <p className={`text-xs font-bold ${battle.battle.trophyChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {battle.battle.trophyChange >= 0 ? '+' : ''}{battle.battle.trophyChange}🏆
                    </p>
                  )}
                </div>
                <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
              </div>
            </button>

            {/* Expanded detail panel */}
            {isOpen && teams.length > 0 && (
              <div className={`border-2 border-t-0 rounded-b-xl p-4 space-y-3 ${RESULT_STYLES[result]?.replace(/rounded/g, '') || 'bg-white/5 border-white/10'} animate-fade-in`}>
                {/* Duration */}
                {battle.battle.duration > 0 && (
                  <p className="text-[10px] uppercase font-bold text-slate-500 text-center">
                    {Math.floor(battle.battle.duration / 60)}:{String(battle.battle.duration % 60).padStart(2, '0')} min
                  </p>
                )}

                {teams.map((team, teamIdx) => (
                  <div key={teamIdx}>
                    <p className="text-[10px] uppercase font-bold text-slate-500 mb-1.5">
                      {teamIdx === 0 ? (t('teamBlue') || 'Team Blue') : (t('teamRed') || 'Team Red')}
                    </p>
                    <div className="space-y-1">
                      {team.map(player => {
                        const isStar = player.tag === starTag
                        const isMe = player.tag === `#${playerTag.replace('#', '')}`
                        return (
                          <div
                            key={player.tag}
                            className={`flex items-center gap-2.5 px-3 py-2 rounded-lg ${isMe ? 'bg-white/10 border border-white/20' : 'bg-white/[0.03]'}`}
                          >
                            <BrawlImg
                              src={getBrawlerPortraitUrl(player.brawler.id)}
                              alt={player.brawler.name}
                              fallbackText={player.brawler.name}
                              className="w-9 h-9 rounded-lg"
                            />
                            <div className="flex-1 min-w-0">
                              <p className={`font-['Lilita_One'] text-sm truncate ${isMe ? 'text-[#4EC0FA]' : 'text-white'}`}>
                                {player.name} {isStar && '⭐'}
                              </p>
                              <p className="text-[10px] text-slate-500">
                                {player.brawler.name} · P{player.brawler.power} · {player.brawler.trophies}🏆
                              </p>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Showdown: players array instead of teams */}
            {isOpen && !teams.length && battle.battle.players && (
              <div className={`border-2 border-t-0 rounded-b-xl p-4 ${RESULT_STYLES[result]?.replace(/rounded/g, '') || 'bg-white/5 border-white/10'} animate-fade-in`}>
                <div className="space-y-1">
                  {battle.battle.players.map(player => {
                    const isMe = player.tag === `#${playerTag.replace('#', '')}`
                    return (
                      <div
                        key={player.tag}
                        className={`flex items-center gap-2.5 px-3 py-2 rounded-lg ${isMe ? 'bg-white/10 border border-white/20' : 'bg-white/[0.03]'}`}
                      >
                        <BrawlImg
                          src={getBrawlerPortraitUrl(player.brawler.id)}
                          alt={player.brawler.name}
                          fallbackText={player.brawler.name}
                          className="w-9 h-9 rounded-lg"
                        />
                        <div className="flex-1 min-w-0">
                          <p className={`font-['Lilita_One'] text-sm truncate ${isMe ? 'text-[#4EC0FA]' : 'text-white'}`}>
                            {player.name}
                          </p>
                          <p className="text-[10px] text-slate-500">
                            {player.brawler.name} · P{player.brawler.power} · {player.brawler.trophies}🏆
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
