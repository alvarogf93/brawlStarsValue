'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useTranslations, useLocale } from 'next-intl'
import { useBattlelog } from '@/hooks/useBattlelog'
import { TrophyChart } from '@/components/battles/TrophyChart'
import { AdPlaceholder } from '@/components/ui/AdPlaceholder'
import { BrawlImg } from '@/components/ui/BrawlImg'
import { BlurredTeaser } from '@/components/premium/BlurredTeaser'
import { useAuth } from '@/hooks/useAuth'
import { isPremium } from '@/lib/premium'
import { getBrawlerPortraitUrl, getBrawlerPortraitFallback, getMapImageUrl } from '@/lib/utils'
import { ChevronDown } from 'lucide-react'
import type { Profile } from '@/lib/supabase/types'
import type { BattlelogEntry } from '@/lib/api'
import { BattlesSkeleton } from '@/components/ui/Skeleton'

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

const RESULT_COLORS: Record<string, { bg: string; border: string; text: string; accent: string; glow: string }> = {
  victory: { bg: 'bg-green-500/10', border: 'border-green-500/30', text: 'text-green-400', accent: '#22c55e', glow: 'shadow-[0_0_12px_rgba(34,197,94,0.15)]' },
  defeat: { bg: 'bg-red-500/10', border: 'border-red-500/30', text: 'text-red-400', accent: '#ef4444', glow: 'shadow-[0_0_12px_rgba(239,68,68,0.15)]' },
  draw: { bg: 'bg-yellow-500/10', border: 'border-yellow-500/30', text: 'text-yellow-400', accent: '#eab308', glow: 'shadow-[0_0_12px_rgba(234,179,8,0.15)]' },
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
    return <BattlesSkeleton />
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
      <div className="brawl-card-dark p-4 md:p-5 border-[#090E17]">
        <BattleList battles={data.battles} playerTag={tag} resultText={RESULT_TEXT} />
      </div>

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
/*  Player row inside expanded battle detail                          */
/* ------------------------------------------------------------------ */

function PlayerRow({ player, isMe, isStar, isOpponent, onCompare }: {
  player: { tag: string; name: string; brawler: { id: number; name: string; power: number; trophies: number } }
  isMe: boolean
  isStar: boolean
  isOpponent?: boolean
  onCompare?: (tag: string) => void
}) {
  const Tag = isOpponent && onCompare ? 'button' : 'div'
  return (
    <Tag
      {...(isOpponent && onCompare ? { onClick: () => onCompare(player.tag) } : {})}
      className={`brawl-row flex items-center gap-3 rounded-xl px-3 py-2 w-full text-left ${isMe ? 'ring-2 ring-[#4EC0FA]/50 bg-[#4EC0FA]/10' : ''} ${isOpponent && onCompare ? 'cursor-pointer hover:bg-white/10 active:bg-white/15 transition-colors' : ''}`}
    >
      <BrawlImg
        src={getBrawlerPortraitUrl(player.brawler.id)}
        fallbackSrc={getBrawlerPortraitFallback(player.brawler.id)}
        alt={player.brawler.name}
        fallbackText={player.brawler.name}
        className="w-11 h-11 rounded-xl border-2 border-black/30 shadow-[0_2px_0_rgba(0,0,0,0.3)]"
      />
      <div className="flex-1 min-w-0">
        <p className={`font-['Lilita_One'] text-sm truncate ${isMe ? 'text-[#4EC0FA]' : 'text-white'}`}>
          {player.name} {isStar && <span className="inline-block ml-0.5 animate-pulse">⭐</span>}
        </p>
        <p className="text-[10px] text-slate-500 font-['Inter'] font-semibold">
          {player.brawler.name}
        </p>
      </div>
      <div className="text-right shrink-0">
        <span className="font-['Lilita_One'] text-xs text-[#B23DFF] bg-[#B23DFF]/15 px-2 py-0.5 rounded-md border border-[#B23DFF]/30">
          P{player.brawler.power}
        </span>
      </div>
      <div className="text-right shrink-0 w-14">
        <span className="font-['Lilita_One'] text-xs text-[#FFC91B]">
          {player.brawler.trophies}🏆
        </span>
      </div>
      {isOpponent && onCompare && (
        <span className="text-[10px] text-slate-600 shrink-0">⚔️</span>
      )}
    </Tag>
  )
}

/* ------------------------------------------------------------------ */
/*  Battle list with expandable detail panels — Brawl Stars style     */
/* ------------------------------------------------------------------ */

function BattleList({ battles, playerTag, resultText }: {
  battles: BattlelogEntry[]
  playerTag: string
  resultText: Record<string, string>
}) {
  const [expanded, setExpanded] = useState<number | null>(null)
  const t = useTranslations('battles')
  const locale = useLocale()
  const router = useRouter()
  const cleanTag = `#${playerTag.replace('#', '')}`

  const handleCompare = (opponentTag: string) => {
    router.push(`/${locale}/profile/${encodeURIComponent(cleanTag)}/compare?vs=${encodeURIComponent(opponentTag)}`)
  }

  return (
    <div className="space-y-2.5">
      {battles.map((battle, i) => {
        const result = battle.battle.result
        const mode = battle.battle.mode || battle.event.mode
        const icon = MODE_ICONS[mode] || '🎮'
        const isOpen = expanded === i
        const teams = battle.battle.teams || []
        const starTag = battle.battle.starPlayer?.tag
        const colors = RESULT_COLORS[result] || RESULT_COLORS.draw

        return (
          <div key={i} className={`${isOpen ? colors.glow : ''} rounded-2xl transition-shadow`}>
            {/* Battle row — clickable */}
            <button
              onClick={() => setExpanded(isOpen ? null : i)}
              className={`w-full brawl-row backdrop-blur-[10px] rounded-2xl ${isOpen ? 'rounded-b-none' : ''} px-4 py-3 flex items-center gap-3 text-left transition-all group`}
              style={{ borderLeft: `4px solid ${colors.accent}` }}
            >
              {/* Mode icon */}
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-2xl"
                style={{ backgroundColor: `${colors.accent}20` }}>
                {icon}
              </div>

              {/* Mode + Map + Time */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-['Lilita_One'] text-sm text-white uppercase">{mode}</span>
                  {battle.event.map && (
                    <span className="text-[10px] text-[#FFC91B] font-['Inter'] font-semibold truncate hidden sm:inline">
                      {battle.event.map}
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-[#FFC91B]/70 font-['Inter']">{formatBattleTime(battle.battleTime)}</p>
              </div>

              {/* Result badge */}
              <div className={`font-['Lilita_One'] text-xs uppercase px-3 py-1.5 rounded-lg border ${colors.bg} ${colors.border} ${colors.text}`}>
                {resultText[result] ?? result}
              </div>

              {/* Trophy change */}
              {battle.battle.trophyChange !== undefined && (
                <span className={`font-['Lilita_One'] text-sm tabular-nums w-10 text-right ${battle.battle.trophyChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {battle.battle.trophyChange >= 0 ? '+' : ''}{battle.battle.trophyChange}
                </span>
              )}

              {/* Chevron */}
              <ChevronDown className={`w-4 h-4 text-slate-600 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''} group-hover:text-slate-400`} />
            </button>

            {/* Expanded detail — Team mode */}
            {isOpen && teams.length > 0 && (() => {
              const mapUrl = battle.event.id ? getMapImageUrl(battle.event.id) : null
              // Determine which team the player is on
              const myTeamIdx = teams.findIndex(team => team.some(p => p.tag === cleanTag))

              return (
                <div className="relative brawl-row rounded-b-2xl rounded-t-none px-4 pb-4 pt-2 animate-fade-in overflow-hidden"
                  style={{ borderLeft: `4px solid ${colors.accent}` }}>

                  {/* Map background */}
                  {mapUrl && (
                    <div className="absolute inset-0 z-0">
                      <img src={mapUrl} alt="" className="w-full h-full object-cover opacity-40" onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                      <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[#0F172A]/90" />
                    </div>
                  )}

                  <div className="relative z-10">
                    {/* Map name + Duration */}
                    <div className="flex items-center justify-center gap-3 mb-3">
                      {battle.event.map && (
                        <span className="text-[10px] uppercase font-bold text-[#FFC91B] font-['Lilita_One']">
                          {battle.event.map}
                        </span>
                      )}
                      {battle.battle.duration > 0 && (
                        <span className="text-[10px] uppercase font-bold text-slate-500 bg-black/30 px-3 py-1 rounded-full">
                          {Math.floor(battle.battle.duration / 60)}:{String(battle.battle.duration % 60).padStart(2, '0')}
                        </span>
                      )}
                    </div>

                    {/* VS layout */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {teams.map((team, teamIdx) => {
                        const isMyTeam = teamIdx === myTeamIdx
                        const teamColor = isMyTeam ? '#4EC0FA' : '#F82F41'
                        return (
                          <div key={teamIdx}>
                            <div className="flex items-center gap-2 mb-2">
                              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: teamColor }} />
                              <span className="text-[10px] uppercase font-bold font-['Lilita_One']" style={{ color: teamColor }}>
                                {isMyTeam ? t('teamBlue') : t('teamRed')}
                              </span>
                            </div>
                            <div className="space-y-1.5">
                              {team.map(player => {
                                const isOpponent = !isMyTeam
                                return (
                                  <PlayerRow
                                    key={player.tag}
                                    player={player}
                                    isMe={player.tag === cleanTag}
                                    isStar={player.tag === starTag}
                                    isOpponent={isOpponent}
                                    onCompare={isOpponent ? handleCompare : undefined}
                                  />
                                )
                              })}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )
            })()}

            {/* Expanded detail — Showdown */}
            {isOpen && !teams.length && battle.battle.players && (
              <div className="brawl-row rounded-b-2xl rounded-t-none px-4 pb-4 pt-2 animate-fade-in"
                style={{ borderLeft: `4px solid ${colors.accent}` }}>
                <div className="space-y-1.5">
                  {battle.battle.players.map(player => {
                    const isOpponent = player.tag !== cleanTag
                    return (
                      <PlayerRow
                        key={player.tag}
                        player={player}
                        isMe={player.tag === cleanTag}
                        isStar={false}
                        isOpponent={isOpponent}
                        onCompare={isOpponent ? handleCompare : undefined}
                      />
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
