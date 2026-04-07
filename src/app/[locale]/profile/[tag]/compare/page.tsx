'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { usePlayerData } from '@/hooks/usePlayerData'
import { useBattlelog } from '@/hooks/useBattlelog'
import { GemIcon } from '@/components/ui/GemIcon'
import { AnimatedCounter } from '@/components/ui/AnimatedCounter'
import { CompareTrophyChart } from '@/components/battles/CompareTrophyChart'
import { formatPlaytime } from '@/lib/utils'
import { PLAYER_TAG_REGEX } from '@/lib/constants'
import type { GemScore } from '@/lib/types'
import { StatsSkeleton } from '@/components/ui/Skeleton'

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface ComparisonCategory {
  key: string
  label: string
  icon: string
  left: number
  right: number
  format?: (v: number) => string
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function countWins(categories: ComparisonCategory[]): { left: number; right: number; draw: number } {
  let left = 0
  let right = 0
  let draw = 0
  for (const c of categories) {
    if (c.left > c.right) left++
    else if (c.right > c.left) right++
    else draw++
  }
  return { left, right, draw }
}

function fmt(n: number): string {
  return n.toLocaleString('en-US')
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function VsBadge() {
  return (
    <div className="relative flex items-center justify-center z-10">
      <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-gradient-to-br from-[#FFC91B] to-[#F82F41] border-4 border-[#121A2F] flex items-center justify-center shadow-[0_6px_0_rgba(18,26,47,1)] animate-[pulse_2s_ease-in-out_infinite]">
        <span className="font-['Lilita_One'] text-2xl md:text-3xl text-white text-stroke-brawl select-none">
          VS
        </span>
      </div>
      {/* Glow ring */}
      <div className="absolute inset-0 w-16 h-16 md:w-20 md:h-20 rounded-full bg-[#FFC91B]/20 animate-ping" />
    </div>
  )
}

function ComparisonBar({
  category,
  index,
  visible,
}: {
  category: ComparisonCategory
  index: number
  visible: boolean
}) {
  const { label, icon, left, right, format } = category
  const max = Math.max(left, right, 1)
  const leftPct = (left / max) * 100
  const rightPct = (right / max) * 100

  const leftWins = left > right
  const rightWins = right > left
  const tie = left === right

  const display = format ?? fmt

  return (
    <div
      className="transition-all duration-700 ease-out"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(20px)',
        transitionDelay: `${index * 80}ms`,
      }}
    >
      {/* Label row */}
      <div className="flex items-center justify-center gap-2 mb-1">
        <span className="text-lg">{icon}</span>
        <span className="font-['Lilita_One'] text-sm md:text-base text-white uppercase tracking-wider">
          {label}
        </span>
      </div>

      {/* Bar row */}
      <div className="flex items-center gap-2 md:gap-3">
        {/* Left value */}
        <span
          className={`min-w-[70px] md:min-w-[90px] text-right font-['Lilita_One'] text-sm md:text-lg transition-all duration-500 ${
            leftWins || tie
              ? 'text-[#FFC91B] drop-shadow-[0_0_8px_rgba(255,201,27,0.6)]'
              : 'text-slate-400'
          }`}
        >
          {display(left)}
        </span>

        {/* Left bar (grows right-to-left) */}
        <div className="flex-1 h-6 md:h-8 bg-[#121A2F] rounded-l-full overflow-hidden relative">
          <div
            className="absolute right-0 top-0 h-full rounded-l-full transition-all duration-1000 ease-out"
            style={{
              width: visible ? `${leftPct}%` : '0%',
              transitionDelay: `${index * 80 + 200}ms`,
              background: leftWins
                ? 'linear-gradient(to left, #4EC0FA, #2563EB)'
                : tie
                  ? 'linear-gradient(to left, #FFC91B, #F59E0B)'
                  : 'linear-gradient(to left, #4EC0FA80, #2563EB60)',
            }}
          >
            {leftWins && (
              <div className="absolute inset-0 top-0 h-1/3 bg-white/30 rounded-l-full" />
            )}
          </div>
        </div>

        {/* Right bar (grows left-to-right) */}
        <div className="flex-1 h-6 md:h-8 bg-[#121A2F] rounded-r-full overflow-hidden relative">
          <div
            className="absolute left-0 top-0 h-full rounded-r-full transition-all duration-1000 ease-out"
            style={{
              width: visible ? `${rightPct}%` : '0%',
              transitionDelay: `${index * 80 + 200}ms`,
              background: rightWins
                ? 'linear-gradient(to right, #F82F41, #DC2626)'
                : tie
                  ? 'linear-gradient(to right, #FFC91B, #F59E0B)'
                  : 'linear-gradient(to right, #F82F4180, #DC262660)',
            }}
          >
            {rightWins && (
              <div className="absolute inset-0 top-0 h-1/3 bg-white/30 rounded-r-full" />
            )}
          </div>
        </div>

        {/* Right value */}
        <span
          className={`min-w-[70px] md:min-w-[90px] text-left font-['Lilita_One'] text-sm md:text-lg transition-all duration-500 ${
            rightWins || tie
              ? 'text-[#FFC91B] drop-shadow-[0_0_8px_rgba(255,201,27,0.6)]'
              : 'text-slate-400'
          }`}
        >
          {display(right)}
        </span>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Main Page                                                          */
/* ------------------------------------------------------------------ */

export default function ComparePage() {
  const params = useParams<{ tag: string }>()
  const searchParams = useSearchParams()
  const t = useTranslations('compare')
  const tNav = useTranslations('nav')
  const tag = decodeURIComponent(params.tag)
  const { data: player1, isLoading: p1Loading, error: p1Error } = usePlayerData(tag)
  const { data: p1Battles } = useBattlelog(tag)

  const vsParam = searchParams.get('vs') || ''
  const [opponentInput, setOpponentInput] = useState(vsParam || '#')
  const [autoTriggered, setAutoTriggered] = useState(false)
  const [inputError, setInputError] = useState<string | null>(null)
  const [opponentData, setOpponentData] = useState<GemScore | null>(null)
  const [opponentLoading, setOpponentLoading] = useState(false)
  const [opponentError, setOpponentError] = useState<string | null>(null)
  const [opponentTag, setOpponentTag] = useState<string | null>(null)
  const { data: p2Battles } = useBattlelog(opponentTag ?? '')
  const [barsVisible, setBarsVisible] = useState(false)

  // Trigger bar animation when both players are loaded
  // Auto-trigger comparison from ?vs= param
  useEffect(() => {
    if (vsParam && !autoTriggered && player1 && !opponentData && !opponentLoading) {
      setAutoTriggered(true)
      setOpponentInput(vsParam)
      // Small delay to let state settle, then trigger fetch
      const timer = setTimeout(() => {
        fetchOpponentDirect(vsParam)
      }, 100)
      return () => clearTimeout(timer)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vsParam, autoTriggered, player1])

  useEffect(() => {
    if (player1 && opponentData) {
      const timer = setTimeout(() => setBarsVisible(true), 100)
      return () => clearTimeout(timer)
    }
    setBarsVisible(false)
  }, [player1, opponentData])

  const fetchOpponentDirect = useCallback(async (rawTag: string) => {
    let formatted = rawTag.toUpperCase().trim()
    if (!formatted.startsWith('#')) formatted = '#' + formatted

    if (!PLAYER_TAG_REGEX.test(formatted)) {
      setInputError(t('invalidTag'))
      return
    }

    if (formatted === tag.toUpperCase().replace(/^#?/, '#')) {
      setInputError(t('cannotCompareSelf'))
      return
    }

    setInputError(null)
    setOpponentError(null)
    setOpponentData(null)
    setOpponentLoading(true)

    // Check sessionStorage cache first
    const cacheKey = `brawlvalue:compare:${formatted}`
    try {
      const cached = sessionStorage.getItem(cacheKey)
      if (cached) {
        const result: GemScore = JSON.parse(cached)
        setOpponentData(result)
        setOpponentTag(formatted)
        setOpponentLoading(false)
        return
      }
    } catch {
      // Ignore sessionStorage errors (e.g. quota, disabled)
    }

    try {
      const res = await fetch('/api/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerTag: formatted }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `Error ${res.status}`)
      }

      const result: GemScore = await res.json()
      setOpponentData(result)
      setOpponentTag(formatted)

      // Cache in sessionStorage
      try {
        sessionStorage.setItem(cacheKey, JSON.stringify(result))
      } catch {
        // Ignore storage errors
      }
    } catch (err) {
      setOpponentError(err instanceof Error ? err.message : t('fetchError'))
    } finally {
      setOpponentLoading(false)
    }
  }, [tag, t])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    fetchOpponentDirect(opponentInput)
  }

  /* ---- Loading state for current player ---- */
  if (p1Loading) {
    return <StatsSkeleton />
  }

  if (p1Error || !player1) {
    return (
      <div className="glass p-8 rounded-2xl text-center border-red-500/30">
        <p className="text-red-400">{p1Error || t('errorLoad')}</p>
      </div>
    )
  }

  /* ---- Build comparison categories ---- */
  const categories: ComparisonCategory[] = opponentData
    ? [
        { key: 'totalGems', label: t('totalGems'), icon: '💎', left: player1.totalGems, right: opponentData.totalGems },
        { key: 'trophies', label: t('trophies'), icon: '🏆', left: player1.stats.trophies, right: opponentData.stats.trophies },
        { key: 'highestTrophies', label: t('highestTrophies'), icon: '🥇', left: player1.stats.highestTrophies, right: opponentData.stats.highestTrophies },
        {
          key: 'totalVictories',
          label: t('totalVictories'),
          icon: '⚔️',
          left: player1.stats.totalVictories,
          right: opponentData.stats.totalVictories,
        },
        { key: 'prestige', label: t('prestige'), icon: '👑', left: player1.stats.totalPrestigeLevel, right: opponentData.stats.totalPrestigeLevel },
        {
          key: 'timePlayed',
          label: t('timePlayed'),
          icon: '⏱️',
          left: player1.stats.estimatedHoursPlayed,
          right: opponentData.stats.estimatedHoursPlayed,
          format: (v: number) => formatPlaytime(v),
        },
        { key: 'powerLevels', label: t('powerLevels'), icon: '📈', left: player1.breakdown.powerLevels.gems, right: opponentData.breakdown.powerLevels.gems },
        { key: 'gadgets', label: t('gadgets'), icon: '🔧', left: player1.breakdown.gadgets.gems, right: opponentData.breakdown.gadgets.gems },
        { key: 'starPowers', label: t('starPowers'), icon: '⭐', left: player1.breakdown.starPowers.gems, right: opponentData.breakdown.starPowers.gems },
        { key: 'hypercharges', label: t('hypercharges'), icon: '⚡', left: player1.breakdown.hypercharges.gems, right: opponentData.breakdown.hypercharges.gems },
        { key: 'buffies', label: t('buffies'), icon: '💪', left: player1.breakdown.buffies.gems, right: opponentData.breakdown.buffies.gems },
        { key: 'gears', label: t('gears'), icon: '🔩', left: player1.breakdown.gears.gems, right: opponentData.breakdown.gears.gems },
      ]
    : []

  const wins = categories.length > 0 ? countWins(categories) : { left: 0, right: 0, draw: 0 }

  return (
    <div className="animate-fade-in w-full pb-10 space-y-6">
      {/* ============ HEADER ============ */}
      <div className="brawl-card-dark p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between bg-gradient-to-r from-[#2563EB] via-[#121A2F] to-[#DC2626]">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-gradient-to-br from-[#FFC91B] to-[#F82F41] border-4 border-[#121A2F] rounded-2xl flex items-center justify-center transform rotate-6 shadow-[0_4px_0_0_#121A2F]">
            <span className="text-3xl">⚔️</span>
          </div>
          <div>
            <h1 className="text-4xl md:text-5xl font-['Lilita_One'] tracking-wide text-white text-stroke-brawl transform rotate-[-1deg]">
              {tNav('compare')}
            </h1>
            <p className="font-['Inter'] font-semibold text-[#4EC0FA]">
              {player1.playerName}
            </p>
          </div>
        </div>
      </div>

      {/* ============ INPUT FORM ============ */}
      <div className="brawl-card p-6 md:p-8">
        <p className="font-['Inter'] font-semibold text-[var(--color-brawl-dark)] mb-4 text-center">
          {t('enterOpponent')}
        </p>
        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 items-stretch">
          <div className="relative flex-1">
            <input
              type="text"
              value={opponentInput}
              onChange={(e) => {
                const stripped = e.target.value.replace(/#/g, '').toUpperCase()
                setOpponentInput('#' + stripped)
                setInputError(null)
              }}
              placeholder="#2P0Q8C2C0"
              disabled={opponentLoading}
              className={`w-full h-14 bg-white border-4 ${
                inputError ? 'border-red-500' : 'border-[var(--color-brawl-dark)]'
              } rounded-xl px-4 text-xl outline-none text-center font-['Lilita_One'] placeholder:font-['Inter'] placeholder:text-slate-400 placeholder:text-base text-[var(--color-brawl-dark)] shadow-[3px_4px_0_0_rgba(18,26,47,1)] transition-transform focus:scale-[1.02] disabled:opacity-50`}
            />
            {inputError && (
              <p className="absolute -bottom-7 left-0 right-0 text-white font-['Lilita_One'] text-sm text-center animate-fade-in bg-red-500 rounded-lg mx-auto w-max px-3 border-2 border-[var(--color-brawl-dark)]">
                {inputError}
              </p>
            )}
          </div>
          <button
            type="submit"
            disabled={opponentLoading || !opponentInput.trim()}
            className="h-14 px-8 brawl-button text-xl whitespace-nowrap relative overflow-hidden flex items-center justify-center"
          >
            <span className={`${opponentLoading ? 'opacity-0' : 'opacity-100'} transition-opacity`}>
              {t('compareBtn')}
            </span>
            {opponentLoading && (
              <span className="absolute inset-0 flex items-center justify-center animate-pulse font-['Lilita_One'] text-white">
                {t('loading')}
              </span>
            )}
          </button>
        </form>
        {opponentError && (
          <p className="mt-4 text-center text-red-400 font-['Inter'] font-semibold animate-fade-in">
            {opponentError}
          </p>
        )}
      </div>

      {/* ============ COMPARISON RESULTS ============ */}
      {opponentData && (
        <>
          {/* Score Summary */}
          <div className="brawl-card p-6 md:p-8 text-center relative overflow-hidden">
            {/* Background decoration */}
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 via-transparent to-red-500/5" />
            <div className="relative z-10">
              <div className="flex items-center justify-center gap-4 md:gap-8 mb-4">
                {/* Player 1 score */}
                <div className="flex flex-col items-center">
                  <span className="text-4xl md:text-6xl font-['Lilita_One'] text-[#4EC0FA] text-stroke-brawl">
                    <AnimatedCounter value={wins.left} fromZero />
                  </span>
                  <span className="font-['Inter'] font-bold text-sm text-[var(--color-brawl-dark)] truncate max-w-[120px] md:max-w-none">
                    {player1.playerName}
                  </span>
                </div>

                {/* Trophy / Medal */}
                <div className="flex flex-col items-center gap-1">
                  <span className="text-3xl md:text-4xl">
                    {wins.left > wins.right ? '🏆' : wins.right > wins.left ? '🏆' : '🤝'}
                  </span>
                  <span className="font-['Lilita_One'] text-xs md:text-sm text-slate-500 uppercase">
                    {t('of', { total: categories.length })}
                  </span>
                </div>

                {/* Player 2 score */}
                <div className="flex flex-col items-center">
                  <span className="text-4xl md:text-6xl font-['Lilita_One'] text-[#F82F41] text-stroke-brawl">
                    <AnimatedCounter value={wins.right} fromZero />
                  </span>
                  <span className="font-['Inter'] font-bold text-sm text-[var(--color-brawl-dark)] truncate max-w-[120px] md:max-w-none">
                    {opponentData.playerName}
                  </span>
                </div>
              </div>

              {/* Winner banner */}
              <div className="inline-block px-6 py-2 rounded-full bg-[var(--color-brawl-gold)]/20 border-2 border-[var(--color-brawl-gold)]">
                <span className="font-['Lilita_One'] text-lg md:text-xl text-[var(--color-brawl-dark)]">
                  {wins.left > wins.right
                    ? t('playerWins', { name: player1.playerName, count: wins.left, total: categories.length })
                    : wins.right > wins.left
                      ? t('playerWins', { name: opponentData.playerName, count: wins.right, total: categories.length })
                      : t('itsATie')}
                </span>
              </div>
            </div>
          </div>

          {/* VS Names Header */}
          <div className="flex items-center justify-center gap-4 md:gap-6">
            <div className="flex-1 text-right">
              <div className="brawl-card p-4 inline-block bg-gradient-to-r from-transparent to-blue-500/10 border-l-4 border-[#4EC0FA]">
                <span className="font-['Lilita_One'] text-xl md:text-2xl text-[#4EC0FA] text-stroke-brawl">
                  {player1.playerName}
                </span>
              </div>
            </div>

            <VsBadge />

            <div className="flex-1 text-left">
              <div className="brawl-card p-4 inline-block bg-gradient-to-l from-transparent to-red-500/10 border-r-4 border-[#F82F41]">
                <span className="font-['Lilita_One'] text-xl md:text-2xl text-[#F82F41] text-stroke-brawl">
                  {opponentData.playerName}
                </span>
              </div>
            </div>
          </div>

          {/* Comparison Bars */}
          <div className="brawl-card-dark p-6 md:p-8 space-y-5">
            <div className="flex items-center gap-3 mb-2">
              <GemIcon className="w-7 h-7" />
              <h2 className="font-['Lilita_One'] text-xl md:text-2xl text-[var(--color-brawl-gold)] tracking-widest uppercase">
                {t('breakdown')}
              </h2>
            </div>

            {categories.map((cat, i) => (
              <ComparisonBar
                key={cat.key}
                category={cat}
                index={i}
                visible={barsVisible}
              />
            ))}
          </div>

          {/* Trophy Chart Comparison */}
          {p1Battles?.battles && p2Battles?.battles && (
            <CompareTrophyChart
              player1Battles={p1Battles.battles}
              player2Battles={p2Battles.battles}
              player1Name={player1.playerName}
              player2Name={opponentData.playerName}
              player1Tag={tag}
              player2Tag={opponentTag ?? ''}
            />
          )}
        </>
      )}
    </div>
  )
}
