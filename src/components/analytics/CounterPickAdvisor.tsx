'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useTranslations } from 'next-intl'

// ── Static brawler list for autocomplete ───────────────────────

const BRAWLER_NAMES = [
  'Shelly', 'Nita', 'Colt', 'Bull', 'Brock', 'El Primo', 'Barley', 'Poco',
  'Rosa', 'Jessie', 'Dynamike', 'Tick', 'Darryl', 'Penny', 'Rico', 'Carl',
  '8-Bit', 'Jacky', 'Gus', 'Bo', 'Emz', 'Stu', 'Piper', 'Pam', 'Frank',
  'Bibi', 'Bea', 'Nani', 'Edgar', 'Griff', 'Grom', 'Bonnie', 'Gale',
  'Colette', 'Belle', 'Ash', 'Lola', 'Sam', 'Mandy', 'Maisie', 'Hank',
  'Pearl', 'Larry & Lawrie', 'Angelo', 'Berry', 'Shade', 'Doug', 'Chuck',
  'Charlie', 'Mico', 'Kit', 'Draco', 'Kenji', 'Juju', 'Meeple', 'Clancy',
  'Melodie', 'Lily', 'Buzz', 'Fang', 'Eve', 'Janet', 'Otis', 'Buster',
  'Gray', 'R-T', 'Willow', 'Meg', 'Surge', 'Chester', 'Cordelius',
  'Mortis', 'Tara', 'Gene', 'Max', 'Mr. P', 'Sprout', 'Byron', 'Squeak',
  'Lou', 'Ruffs', 'Leon', 'Sandy', 'Amber', 'Spike', 'Crow',
]

import { getBrawlerPortraitUrl } from '@/lib/utils'

function wrColor(wr: number): string {
  if (wr >= 60) return 'text-green-400'
  if (wr >= 45) return 'text-[#FFC91B]'
  return 'text-red-400'
}

function barGradient(wr: number): string {
  if (wr >= 60) return 'from-green-500 to-green-400'
  if (wr >= 50) return 'from-[#FFC91B] to-yellow-300'
  return 'from-red-500 to-red-400'
}

// ── Types ──────────────────────────────────────────────────────

interface CounterResult {
  brawlerId: number
  brawlerName: string
  winRate: number
  gamesPlayed: number
  wilsonScore: number
  vsBreakdown: Array<{
    opponentName: string
    wins: number
    total: number
    winRate: number
  }>
}

interface EventSlot {
  startTime: string
  endTime: string
  event: { mode: string; map: string }
}

// ── Autocomplete input sub-component ───────────────────────────

function BrawlerInput({
  value,
  onChange,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  placeholder: string
}) {
  const [focused, setFocused] = useState(false)
  const [highlightIdx, setHighlightIdx] = useState(-1)
  const wrapperRef = useRef<HTMLDivElement>(null)

  const suggestions = useMemo(() => {
    if (!value.trim()) return []
    const lower = value.toLowerCase()
    return BRAWLER_NAMES.filter(n => n.toLowerCase().includes(lower)).slice(0, 6)
  }, [value])

  const showSuggestions = focused && suggestions.length > 0

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setFocused(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const selectSuggestion = useCallback((name: string) => {
    onChange(name)
    setFocused(false)
    setHighlightIdx(-1)
  }, [onChange])

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!showSuggestions) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightIdx(prev => Math.min(prev + 1, suggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightIdx(prev => Math.max(prev - 1, 0))
    } else if (e.key === 'Enter' && highlightIdx >= 0) {
      e.preventDefault()
      selectSuggestion(suggestions[highlightIdx])
    } else if (e.key === 'Escape') {
      setFocused(false)
    }
  }

  return (
    <div ref={wrapperRef} className="relative">
      <input
        type="text"
        value={value}
        onChange={e => { onChange(e.target.value); setHighlightIdx(-1) }}
        onFocus={() => setFocused(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="w-full bg-[#0D1321] text-sm text-white border border-white/10 rounded-lg px-3 py-2 outline-none focus:border-[#FFC91B]/40 transition-colors placeholder:text-slate-600"
      />

      {/* Suggestions dropdown */}
      {showSuggestions && (
        <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-[#0D1321] border border-white/10 rounded-lg shadow-xl overflow-hidden">
          {suggestions.map((name, idx) => (
            <button
              key={name}
              type="button"
              onMouseDown={() => selectSuggestion(name)}
              className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                idx === highlightIdx
                  ? 'bg-[#FFC91B]/10 text-[#FFC91B]'
                  : 'text-slate-300 hover:bg-white/[0.05] hover:text-white'
              }`}
            >
              {name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────

export function CounterPickAdvisor() {
  const t = useTranslations('advancedAnalytics')
  const [enemies, setEnemies] = useState(['', '', ''])
  const [maps, setMaps] = useState<Array<{ map: string; mode: string }>>([])
  const [selectedMap, setSelectedMap] = useState('')
  const [results, setResults] = useState<CounterResult[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [eventsLoading, setEventsLoading] = useState(true)

  // Fetch current event rotation for the map dropdown
  useEffect(() => {
    let cancelled = false
    async function loadEvents() {
      try {
        const res = await fetch('/api/events')
        if (!res.ok) throw new Error('Failed to load events')
        const data: EventSlot[] = await res.json()
        if (!cancelled) {
          setMaps(data.map(e => ({ map: e.event.map, mode: e.event.mode })))
        }
      } catch {
        // Silently fail — map dropdown is optional
      } finally {
        if (!cancelled) setEventsLoading(false)
      }
    }
    loadEvents()
    return () => { cancelled = true }
  }, [])

  function updateEnemy(index: number, value: string) {
    setEnemies(prev => {
      const next = [...prev]
      next[index] = value
      return next
    })
  }

  const filledEnemies = enemies.filter(e => e.trim().length > 0)
  const canSubmit = filledEnemies.length >= 1 && !loading

  async function handleSubmit() {
    if (!canSubmit) return

    setLoading(true)
    setError(null)
    setResults(null)

    try {
      const res = await fetch('/api/analytics/counter-pick', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          opponents: filledEnemies,
          map: selectedMap || undefined,
        }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `Request failed (${res.status})`)
      }

      const json = await res.json()
      const data: CounterResult[] = json.results ?? json
      if (!data || data.length === 0) {
        setError(t('counterEmpty'))
      } else {
        setResults(data)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errorGeneric'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="brawl-card-dark p-5 md:p-6 border-[#090E17]">
      {/* Header */}
      <h3 className="font-['Lilita_One'] text-lg text-white mb-4 flex items-center gap-2">
        <span className="text-xl">🛡️</span> {t('counterTitle')}
      </h3>

      {/* ── Input section ────────────────────────────────────── */}
      <div className="space-y-3 mb-4">
        <p className="text-[11px] text-slate-500 uppercase font-bold">
          {t('enemyBrawlers')}
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {enemies.map((val, i) => (
            <BrawlerInput
              key={i}
              value={val}
              onChange={v => updateEnemy(i, v)}
              placeholder={`${t('enemy')} ${i + 1}`}
            />
          ))}
        </div>

        {/* Map filter (optional) */}
        <div>
          <p className="text-[11px] text-slate-500 uppercase font-bold mb-1.5">
            {t('mapOptional')}
          </p>
          <select
            value={selectedMap}
            onChange={e => setSelectedMap(e.target.value)}
            disabled={eventsLoading}
            className="w-full sm:w-auto bg-[#0D1321] text-sm text-slate-300 border border-white/10 rounded-lg px-3 py-2 outline-none focus:border-[#FFC91B]/40 transition-colors disabled:opacity-50"
          >
            <option value="" className="bg-[#0B1120]">{t('anyMap')}</option>
            {maps.map(m => (
              <option key={`${m.mode}-${m.map}`} value={m.map} className="bg-[#0B1120]">
                {m.map} ({m.mode})
              </option>
            ))}
          </select>
        </div>

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className={`font-['Lilita_One'] text-sm px-5 py-2.5 rounded-lg transition-all ${
            canSubmit
              ? 'bg-[#FFC91B] text-[#090E17] hover:bg-[#FFD84D] active:scale-95'
              : 'bg-white/[0.06] text-slate-600 cursor-not-allowed'
          }`}
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 border-2 border-[#090E17]/30 border-t-[#090E17] rounded-full animate-spin" />
              {t('analyzing')}
            </span>
          ) : (
            <span>🎯 {t('findCounter')}</span>
          )}
        </button>
      </div>

      {/* ── Error state ──────────────────────────────────────── */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 mb-4">
          <p className="text-sm text-red-400 flex items-center gap-2">
            <span>⚠️</span> {error}
          </p>
        </div>
      )}

      {/* ── Loading state ────────────────────────────────────── */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-10">
          <div className="w-8 h-8 border-3 border-[#FFC91B]/30 border-t-[#FFC91B] rounded-full animate-spin mb-3" />
          <p className="text-sm text-slate-500">{t('crunchingData')}</p>
        </div>
      )}

      {/* ── Results ──────────────────────────────────────────── */}
      {results && results.length > 0 && (
        <div>
          <p className="text-[11px] text-slate-500 uppercase font-bold mb-3">
            {t('yourBestPicks')}
          </p>
          <div className="space-y-2">
            {results.map((r, i) => (
              <div
                key={r.brawlerId}
                className="brawl-row rounded-xl px-4 py-3"
              >
                {/* Main row */}
                <div className="flex items-center gap-3">
                  {/* Rank */}
                  <span className="font-['Lilita_One'] text-xs text-slate-600 w-5 text-right tabular-nums flex-shrink-0">
                    {i + 1}
                  </span>

                  {/* Portrait */}
                  <img
                    src={getBrawlerPortraitUrl(r.brawlerId)}
                    alt={r.brawlerName}
                    className="w-9 h-9 rounded-lg flex-shrink-0"
                    loading="lazy"
                  />

                  {/* Name + games */}
                  <div className="flex-1 min-w-0">
                    <p className="font-['Lilita_One'] text-sm text-white truncate">
                      {r.brawlerName}
                    </p>
                    <p className="text-[10px] text-slate-500">
                      {r.gamesPlayed} {t('games')}
                    </p>
                  </div>

                  {/* Overall WR */}
                  <span className={`font-['Lilita_One'] text-sm tabular-nums flex-shrink-0 ${wrColor(r.winRate)}`}>
                    {r.winRate.toFixed(1)}%
                  </span>
                </div>

                {/* Per-opponent breakdown bars */}
                {r.vsBreakdown.length > 0 && (
                  <div className="mt-2.5 pl-8 space-y-1.5">
                    {r.vsBreakdown.map(vs => (
                      <div key={vs.opponentName} className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-500 w-20 truncate flex-shrink-0">
                          vs {vs.opponentName}
                        </span>
                        <div className="flex-1 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full bg-gradient-to-r ${barGradient(vs.winRate)}`}
                            style={{ width: `${Math.min(vs.winRate, 100)}%` }}
                          />
                        </div>
                        <span className={`text-[10px] font-bold tabular-nums w-10 text-right flex-shrink-0 ${wrColor(vs.winRate)}`}>
                          {vs.total > 0 ? `${vs.winRate.toFixed(0)}%` : '--'}
                        </span>
                        <span className="text-[9px] text-slate-600 w-8 text-right flex-shrink-0">
                          {vs.total}g
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Empty state (no results yet, not loading, no error) ── */}
      {!loading && !error && !results && (
        <div className="flex flex-col items-center justify-center py-6 text-center">
          <span className="text-3xl mb-2 opacity-40">⚔️</span>
          <p className="text-[11px] text-slate-600">
            {t('enterEnemiesHint')}
          </p>
        </div>
      )}
    </div>
  )
}
