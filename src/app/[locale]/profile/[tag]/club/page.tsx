'use client'

import { useState, useMemo } from 'react'
import { useParams } from 'next/navigation'
import { useTranslations, useLocale } from 'next-intl'
import Link from 'next/link'
import { usePlayerData } from '@/hooks/usePlayerData'
import { useClub } from '@/hooks/useClub'
import { useClubEnriched, type EnrichedMember } from '@/hooks/useClubEnriched'
import { AnimatedCounter } from '@/components/ui/AnimatedCounter'
import { GemIcon } from '@/components/ui/GemIcon'
import { AdPlaceholder } from '@/components/ui/AdPlaceholder'
import { ClubTrophyChart } from '@/components/club/ClubTrophyChart'
import { useClubTrophyChanges } from '@/hooks/useClubTrophyChanges'
import { formatPlaytime } from '@/lib/utils'
import { ClubSkeleton } from '@/components/ui/Skeleton'
import { Crown, Shield, Star, Users, Trophy, Lock, Unlock, Mail, TrendingUp, TrendingDown, BarChart3, UserCheck, ChevronDown, Gem, Swords, Clock } from 'lucide-react'

/* ── Sort options ─────────────────────────────────────────── */

type SortKey = 'trophies' | 'gems' | 'brawlers' | 'victories' | 'winrate' | 'hours' | 'prestige' | 'level'

const SORT_OPTIONS: { value: SortKey; labelKey: string; icon: typeof Trophy }[] = [
  { value: 'trophies', labelKey: 'sortTrophies', icon: Trophy },
  { value: 'gems', labelKey: 'sortGems', icon: Gem },
  { value: 'brawlers', labelKey: 'sortBrawlers', icon: Users },
  { value: 'victories', labelKey: 'sortVictories', icon: Swords },
  { value: 'winrate', labelKey: 'sortWinRate', icon: TrendingUp },
  { value: 'hours', labelKey: 'sortTimePlayed', icon: Clock },
  { value: 'prestige', labelKey: 'sortPrestige', icon: Crown },
  { value: 'level', labelKey: 'sortLevel', icon: Star },
]

function sortMembers(members: EnrichedMember[], key: SortKey): EnrichedMember[] {
  return [...members].sort((a, b) => {
    switch (key) {
      case 'trophies': return b.trophies - a.trophies
      case 'gems': return (b.totalGems ?? 0) - (a.totalGems ?? 0)
      case 'brawlers': return (b.brawlerCount ?? 0) - (a.brawlerCount ?? 0)
      case 'victories': return (b.totalVictories ?? 0) - (a.totalVictories ?? 0)
      case 'winrate': return (b.winRateUsed ?? 0) - (a.winRateUsed ?? 0)
      case 'hours': return (b.estimatedHoursPlayed ?? 0) - (a.estimatedHoursPlayed ?? 0)
      case 'prestige': return (b.totalPrestigeLevel ?? 0) - (a.totalPrestigeLevel ?? 0)
      case 'level': return (b.expLevel ?? 0) - (a.expLevel ?? 0)
      default: return 0
    }
  })
}

/* ── Role helpers ────────────────────────────────────────── */

const ROLE_CONFIG: Record<string, { icon: typeof Crown; color: string; bg: string; border: string }> = {
  president:     { icon: Crown,  color: 'text-yellow-300', bg: 'bg-yellow-500/20', border: 'border-yellow-500/40' },
  vicePresident: { icon: Crown,  color: 'text-slate-300',  bg: 'bg-slate-400/20',  border: 'border-slate-400/40' },
  senior:        { icon: Star,   color: 'text-blue-300',   bg: 'bg-blue-500/20',   border: 'border-blue-500/40' },
  member:        { icon: Shield, color: 'text-slate-400',  bg: 'bg-slate-600/20',  border: 'border-slate-600/40' },
}

function RoleBadge({ role, t }: { role: string; t: (key: string) => string }) {
  const cfg = ROLE_CONFIG[role] ?? ROLE_CONFIG.member
  const Icon = cfg.icon
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${cfg.bg} ${cfg.border} ${cfg.color}`}>
      <Icon size={10} />
      {t(role)}
    </span>
  )
}

const TYPE_CONFIG: Record<string, { icon: typeof Unlock; color: string; bg: string }> = {
  open:       { icon: Unlock, color: 'text-green-400',  bg: 'bg-green-500/20' },
  inviteOnly: { icon: Mail,   color: 'text-yellow-400', bg: 'bg-yellow-500/20' },
  closed:     { icon: Lock,   color: 'text-red-400',    bg: 'bg-red-500/20' },
}

/* ── Main Page ───────────────────────────────────────────── */

export default function ClubPage() {
  const params = useParams<{ tag: string }>()
  const t = useTranslations('club')
  const locale = useLocale()
  const tag = decodeURIComponent(params.tag)
  const [sortBy, setSortBy] = useState<SortKey>('trophies')
  const [dropdownOpen, setDropdownOpen] = useState(false)

  const { data: playerData, isLoading: playerLoading } = usePlayerData(tag)

  const clubTag = playerData?.player?.club && 'tag' in playerData.player.club && playerData.player.club.tag
    ? playerData.player.club.tag
    : null

  const { data: club, isLoading: clubLoading, error: clubError } = useClub(clubTag)
  const { members: enrichedMembers, progress, isLoading: enrichLoading, totalLoaded } = useClubEnriched(club?.members ?? null)
  const { data: trophyChanges, progress: tcProgress, isLoading: tcLoading } = useClubTrophyChanges(club?.members ?? null)

  const isLoading = playerLoading || clubLoading

  const sorted = useMemo(() => sortMembers(enrichedMembers, sortBy), [enrichedMembers, sortBy])

  const playerNormalized = `#${tag.replace('#', '').toUpperCase()}`
  const playerIndex = sorted.findIndex(m => m.tag.toUpperCase() === playerNormalized)
  const playerRank = playerIndex >= 0 ? playerIndex + 1 : null

  /* ── Loading ──── */
  if (isLoading) {
    return <ClubSkeleton />
  }

  if (clubError) {
    return <div className="brawl-card-dark p-8 rounded-2xl text-center border border-red-500/30"><p className="text-red-400">{clubError}</p></div>
  }

  if (!clubTag || !club) {
    return (
      <div className="animate-fade-in w-full pb-10">
        <div className="brawl-card-dark p-12 text-center flex flex-col items-center gap-4">
          <Users size={36} className="text-slate-500" />
          <h2 className="font-['Lilita_One'] text-3xl text-white text-stroke-brawl">{t('noClub')}</h2>
          <p className="text-slate-400 text-sm">{t('noClubDescription')}</p>
        </div>
      </div>
    )
  }

  const highestMember = sorted[0]
  const lowestMember = sorted[sorted.length - 1]
  const avgTrophies = Math.round(sorted.reduce((s, m) => s + m.trophies, 0) / sorted.length)
  const trophySpread = highestMember && lowestMember ? highestMember.trophies - lowestMember.trophies : 0

  const typeCfg = TYPE_CONFIG[club.type] ?? TYPE_CONFIG.closed
  const TypeIcon = typeCfg.icon

  return (
    <div className="animate-fade-in w-full pb-10 space-y-6">

      {/* Club Header */}
      <div className="brawl-card p-6 md:p-8 bg-gradient-to-r from-[#6C3CE0] to-[#121A2F] relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-[var(--color-brawl-gold)] border-4 border-[#121A2F] rounded-2xl flex items-center justify-center transform rotate-6 shadow-[0_4px_0_0_#121A2F] shrink-0">
              <Shield size={28} className="text-[#121A2F]" />
            </div>
            <div>
              <h1 className="text-3xl md:text-5xl font-['Lilita_One'] tracking-wide text-white text-stroke-brawl">{club.name}</h1>
              {club.description && (
                <p className="text-sm text-slate-300/80 font-['Inter'] mt-1 max-w-md">{club.description}</p>
              )}
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase ${typeCfg.bg} ${typeCfg.color}`}>
                  <TypeIcon size={12} />{t(club.type)}
                </span>
                {club.requiredTrophies > 0 && (
                  <span className="text-[10px] font-bold text-orange-300">🏆 {club.requiredTrophies.toLocaleString()} {t('required')}</span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-center">
              <p className="text-xs font-bold uppercase text-slate-400">{t('totalTrophies')}</p>
              <p className="font-['Lilita_One'] text-2xl text-[var(--color-brawl-gold)]"><AnimatedCounter value={club.trophies} /></p>
            </div>
            <div className="text-center">
              <p className="text-xs font-bold uppercase text-slate-400">{t('members')}</p>
              <p className="font-['Lilita_One'] text-2xl text-[#4EC0FA]">{club.members.length}<span className="text-lg text-slate-500">/30</span></p>
            </div>
          </div>
        </div>
      </div>

      {/* Player position */}
      {playerRank !== null && (
        <div className="brawl-card p-5 border-2 border-[var(--color-brawl-gold)]/40 bg-gradient-to-r from-[var(--color-brawl-gold)]/10 to-transparent">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-[var(--color-brawl-gold)] rounded-xl flex items-center justify-center shadow-lg shadow-yellow-500/20">
                <span className="font-['Lilita_One'] text-xl text-[#121A2F]">#{playerRank}</span>
              </div>
              <div>
                <p className="font-['Lilita_One'] text-xl text-[var(--color-brawl-dark)]">{t('yourPosition')}</p>
                <p className="text-sm text-slate-500">{t('positionDescription', { rank: playerRank, total: club.members.length })}</p>
              </div>
            </div>
            <span className="font-['Lilita_One'] text-2xl text-[var(--color-brawl-dark)] flex items-center gap-1">
              <Trophy size={18} className="text-[var(--color-brawl-gold)]" />
              {sorted[playerIndex]?.trophies.toLocaleString()}
            </span>
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="brawl-card-dark p-4 text-center">
          <BarChart3 size={20} className="text-[#4EC0FA] mx-auto mb-1" />
          <p className="font-['Lilita_One'] text-xl text-white"><AnimatedCounter value={avgTrophies} /></p>
          <p className="text-[10px] uppercase font-bold text-slate-500">{t('avgTrophies')}</p>
        </div>
        <div className="brawl-card-dark p-4 text-center">
          <TrendingUp size={20} className="text-green-400 mx-auto mb-1" />
          <p className="font-['Lilita_One'] text-xl text-white"><AnimatedCounter value={highestMember?.trophies ?? 0} /></p>
          <p className="text-[10px] uppercase font-bold text-slate-500 truncate">{highestMember?.name ?? '-'}</p>
        </div>
        <div className="brawl-card-dark p-4 text-center">
          <TrendingDown size={20} className="text-red-400 mx-auto mb-1" />
          <p className="font-['Lilita_One'] text-xl text-white"><AnimatedCounter value={lowestMember?.trophies ?? 0} /></p>
          <p className="text-[10px] uppercase font-bold text-slate-500 truncate">{lowestMember?.name ?? '-'}</p>
        </div>
        <div className="brawl-card-dark p-4 text-center">
          <UserCheck size={20} className="text-[var(--color-brawl-gold)] mx-auto mb-1" />
          <p className="font-['Lilita_One'] text-xl text-white"><AnimatedCounter value={trophySpread} /></p>
          <p className="text-[10px] uppercase font-bold text-slate-500">{t('trophySpread')}</p>
        </div>
      </div>

      {/* Club Trophy Changes Chart */}
      <ClubTrophyChart
        members={trophyChanges}
        playerTag={tag}
        progress={tcProgress}
        isLoading={tcLoading}
      />

      {/* Loading progress + ad space */}
      {enrichLoading && (
        <div className="space-y-4">
          <div className="brawl-card-dark p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-bold text-slate-400">{t('loadingMembers')}</p>
              <p className="font-['Lilita_One'] text-sm text-[#4EC0FA]">{totalLoaded}/{club.members.length}</p>
            </div>
            <div className="h-3 bg-[#0D1321] rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#4EC0FA] to-[var(--color-brawl-gold)] rounded-full transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
          <AdPlaceholder />
        </div>
      )}

      {/* Primary Ad above Leaderboard */}
      {!enrichLoading && <AdPlaceholder className="mb-6" />}

      {/* ═══ LEADERBOARD CARD ═══ */}
      <div
        className="brawl-card-dark pb-32 border-[#090E17]"
        style={{ overflow: 'visible' }}
      >
        {/* Toolbar: title + sort */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-5 pb-4 bg-gradient-to-r from-[#0F172A] via-[#1E293B] to-[#0F172A] border-b-4 border-[#090E17] relative z-20 shadow-[0_8px_16px_rgba(0,0,0,0.4)]">
          <h2 className="font-['Lilita_One'] text-2xl text-white flex items-center gap-2 drop-shadow-md mb-3 sm:mb-0">
            <Users size={24} className="text-[#4EC0FA]" />
            {t('leaderboard')}
          </h2>

          {/* Sort dropdown */}
          <div className="relative">
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-2 bg-[#090E17] border-2 border-slate-700 hover:border-[#4EC0FA] hover:bg-[#121A2F] text-slate-300 px-4 py-2 rounded-xl transition-all font-bold min-w-[160px] justify-between shadow-inner"
            >
              <div className="flex items-center gap-2">
                {(() => {
                  const selected = SORT_OPTIONS.find(o => o.value === sortBy)
                  if (!selected) return null
                  const Icon = selected.icon
                  return (
                    <>
                      <Icon size={16} className="text-[#4EC0FA]" />
                      {t(selected.labelKey)}
                    </>
                  )
                })()}
              </div>
              <ChevronDown size={16} className={`transition-transform duration-300 ${dropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown Menu */}
            {dropdownOpen && (
              <div className="absolute right-0 top-full mt-2 w-48 bg-[#0F172A] border-2 border-slate-700 rounded-xl shadow-2xl p-2 z-50 flex flex-col gap-1 overflow-hidden animate-[fadeSlideIn_0.2s_ease_forwards]">
                {SORT_OPTIONS.map((o) => (
                  <button
                    key={o.value}
                    onClick={() => { setSortBy(o.value); setDropdownOpen(false) }}
                    className={`flex items-center text-left w-full px-3 py-2 rounded-lg text-sm font-bold transition-colors ${o.value === sortBy ? 'bg-[#4EC0FA]/20 text-[#4EC0FA]' : 'text-slate-400 hover:bg-[#1E293B] hover:text-white'}`}
                  >
                    {t(o.labelKey)}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* --- SCROLLABLE TABLE WRAPPER --- */}
        <div className="w-full overflow-x-auto pb-4 custom-scrollbar">
          <div className="min-w-[820px]">
            <div className="hidden sm:grid grid-cols-[2.5rem_minmax(11rem,1fr)_6.5rem_6.5rem_4rem_5rem_4rem_5rem] gap-2 px-5 py-4 bg-[#090E17] border-y-4 border-[#05080E] text-[12px] font-black uppercase text-[#4EC0FA] tracking-widest sticky top-0 z-30 shadow-[0_12px_20px_-8px_rgba(0,0,0,0.9)] mb-3 items-center">
              <span className="text-center font-['Lilita_One'] text-slate-400">#</span>
              <span className="text-left pl-1">{t('sortName')}</span>
              <span className="text-right text-[10px]">{t('sortTrophies')}</span>
              <span className="text-right text-sm leading-none drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)] pr-1">💎</span>
              <span className="text-center">{t('columnWR')}</span>
              <span className="text-right text-sm leading-none drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]">⚔️</span>
              <span className="text-center text-sm leading-none drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]">👑</span>
              <span className="text-right text-sm leading-none drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]">⏱️</span>
            </div>

        {/* Member rows */}
        <div className="p-3 sm:px-5 sm:py-2 flex flex-col gap-2.5">
          {sorted.map((member, i) => {
            const isMe = playerIndex === i
            const wr = member.winRateUsed ? Math.round(member.winRateUsed * 100) : null
            const compareUrl = `/${locale}/profile/${encodeURIComponent(tag)}/compare?vs=${encodeURIComponent(member.tag)}`

            return (
              <Link
                href={isMe ? '#' : compareUrl}
                key={member.tag}
                className={`group grid grid-cols-[2.5rem_1fr] sm:grid-cols-[2.5rem_minmax(11rem,1fr)_6.5rem_6.5rem_4rem_5rem_4rem_5rem] gap-2 items-center px-4 sm:px-5 py-3 rounded-lg transition-transform duration-200 opacity-0 animate-[fadeSlideIn_0.4s_ease_forwards] border-b-[4px] relative overflow-hidden shadow-md ${
                  isMe
                    ? 'bg-[#FFC91B]/20 border-[#FFC91B]/80 hover:-translate-y-1 hover:shadow-[0_12px_20px_-8px_rgba(255,201,27,0.5)]'
                    : 'bg-[#121A2F] border-[#090E17] hover:bg-[#1A2542] hover:-translate-y-1 hover:shadow-[0_12px_20px_-8px_rgba(0,0,0,0.8)] hover:border-[#1C5CF1]'
                } ${isMe ? 'cursor-default' : 'cursor-pointer'} text-slate-200`}
                style={{ animationDelay: `${i * 20}ms` }}
                onClick={isMe ? (e) => e.preventDefault() : undefined}
              >
                {/* Me Overlay */}
                {isMe && <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_left,rgba(255,201,27,0.15)_0%,transparent_70%)] pointer-events-none" />}

                {/* Rank */}
                <span className={`relative z-10 font-['Lilita_One'] text-xl text-center text-stroke-none ${
                    i === 0 ? 'text-[#FFC91B] drop-shadow-[0_2px_4px_rgba(255,201,27,0.8)] text-2xl' : 
                    i === 1 ? 'text-slate-300 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] text-xl' : 
                    i === 2 ? 'text-[#F97316] drop-shadow-[0_2px_4px_rgba(249,115,22,0.8)] text-xl' : 
                    'text-slate-500'
                }`}>
                  {i + 1}
                </span>

                {/* Name + role + mobile stats */}
                <div className="relative z-10 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`font-['Lilita_One'] text-[21px] tracking-wide truncate text-stroke-none transition-colors ${
                        isMe ? 'text-[#FFC91B] drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]' :
                        'text-white drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)] group-hover:text-[#4EC0FA]'
                    }`}>
                      {member.name}
                    </span>
                    <RoleBadge role={member.role} t={t} />
                  </div>

                  {/* Mobile-only compact stats row */}
                  <div className="flex sm:hidden items-center gap-3 mt-1 text-xs font-bold">
                    <span className="flex items-center gap-1 text-[#FFC91B]">
                      <Trophy size={12} />
                      {member.trophies.toLocaleString()}
                    </span>
                    {member.loaded && wr !== null && (
                      <span className={`${wr >= 55 ? 'text-[#4ADE80]' : wr <= 45 ? 'text-[#F87171]' : 'text-slate-300'}`}>
                        {wr}%
                      </span>
                    )}
                    {member.loaded && member.totalGems != null && (
                      <span className="flex items-center gap-0.5 text-white/70">
                        <GemIcon className="w-3 h-3" />
                        {member.totalGems.toLocaleString()}
                      </span>
                    )}
                    {member.loaded && member.totalVictories != null && (
                      <span className="flex items-center gap-0.5 text-slate-400">
                        <Swords size={11} />
                        {member.totalVictories.toLocaleString()}
                      </span>
                    )}
                    {!member.loaded && (
                      <span className="h-3 w-20 bg-[#090E17] rounded animate-pulse" />
                    )}
                  </div>
                </div>

                {/* Trophies */}
                <span className="relative z-10 hidden sm:block text-right text-xl font-['Lilita_One'] text-stroke-none text-[#FFC91B] drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)] tabular-nums">
                  {member.trophies.toLocaleString()}
                </span>

                {/* Gems */}
                {member.loaded ? (
                  <span className="relative z-10 hidden sm:flex items-center justify-end gap-1 text-[17px] font-['Lilita_One'] text-white drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)] text-stroke-none tabular-nums">
                    {(member.totalGems ?? 0).toLocaleString()}
                    <GemIcon className="w-5 h-5 shrink-0 drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]" />
                  </span>
                ) : (
                  <span className="hidden sm:block h-5 w-14 bg-[#090E17] rounded animate-pulse ml-auto" />
                )}

                {/* Win Rate */}
                {member.loaded ? (
                  <span className={`relative z-10 hidden sm:block text-center text-[15px] font-black tabular-nums text-stroke-none drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)] ${wr !== null && wr >= 55 ? 'text-[#4ADE80]' : wr !== null && wr <= 45 ? 'text-[#F87171]' : 'text-slate-300'}`}>
                    {wr !== null ? `${wr}%` : '-'}
                  </span>
                ) : (
                  <span className="hidden sm:block h-5 w-8 bg-[#090E17] rounded animate-pulse mx-auto" />
                )}

                {/* Battles */}
                {member.loaded ? (
                  <span className="relative z-10 hidden sm:block text-right text-[15px] font-black text-slate-300 tabular-nums text-stroke-none drop-shadow-md">
                    {(member.totalVictories ?? 0).toLocaleString()}
                  </span>
                ) : (
                  <span className="hidden sm:block h-5 w-12 bg-[#090E17] rounded animate-pulse ml-auto" />
                )}

                {/* Prestige */}
                {member.loaded ? (
                  <span className={`hidden sm:block text-center text-sm font-['Lilita_One'] text-stroke-none drop-shadow-md tabular-nums ${(member.totalPrestigeLevel ?? 0) > 0 ? 'text-[#D8B4FE]' : 'text-slate-600'}`}>
                    {(member.totalPrestigeLevel ?? 0) > 0 ? `P${member.totalPrestigeLevel}` : '-'}
                  </span>
                ) : (
                  <span className="hidden sm:block h-4 w-6 bg-[#090E17] rounded animate-pulse mx-auto" />
                )}

                {/* Time */}
                {member.loaded ? (
                  <span 
                    className="relative z-10 hidden sm:block text-right text-[14px] text-[#A0AEC0] cursor-help hover:text-[#4EC0FA] font-bold tabular-nums text-stroke-none border-b border-dashed border-[#A0AEC0]/50 drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]"
                    title={t('timeTooltip', { winRate: wr ?? 50 })}
                  >
                    {member.estimatedHoursPlayed ? formatPlaytime(member.estimatedHoursPlayed) : '-'}
                  </span>
                ) : (
                  <span className="hidden sm:block h-4 w-10 bg-[#090E17] rounded animate-pulse ml-auto" />
                )}
              </Link>
            )
          })}
        </div>
        </div>
      </div>

      {/* Footer hint */}
      <div className="px-5 py-3 border-t border-white/10 bg-[#090E17]/60 rounded-b-[1.25rem] text-center absolute bottom-0 left-0 right-0">
        <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest text-stroke-none">
          {t('clickToCompare')}
        </p>
      </div>
    </div>
    
    <AdPlaceholder className="mt-8" />
  </div>
  )
}

