'use client'

import { useState, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { X } from 'lucide-react'
import { getBrawlerPortraitUrl, getBrawlerPortraitFallback, wrColor } from '@/lib/utils'
import { BrawlImg } from '@/components/ui/BrawlImg'
import type { MatchupEntry } from '@/lib/analytics/types'
import { InfoTooltip } from '@/components/ui/InfoTooltip'

interface Props {
  data: MatchupEntry[]
  proMatchups?: Map<string, { winRate: number; total: number }> | null
}

const INITIAL_LIMIT = 20

// ─── Versus filter slot (reusable for "me" and "opponent") ───

type BrawlerOption = readonly [name: string, id: number]

interface FilterSlotProps {
  side: 'me' | 'opponent'
  label: string
  allLabel: string
  selectedName: string // 'all' | brawler name
  selectedId: number | null
  options: readonly BrawlerOption[]
  onChange: (name: string) => void
}

/**
 * A "portrait card" filter slot. The slot LOOKS like a big clickable
 * card with the selected brawler's portrait + name; under the hood
 * the native <select> is positioned invisibly over the slot so all
 * keyboard navigation, screen reader support and focus management
 * come for free. When a filter is active, a clear (X) button sits
 * on the top-right corner.
 */
function FilterSlot({
  side, label, allLabel, selectedName, selectedId, options, onChange,
}: FilterSlotProps) {
  const hasFilter = selectedName !== 'all' && selectedId !== null
  const accent = side === 'me' ? '#4EC0FA' : '#F82F41'
  const accentBg = side === 'me' ? 'bg-[#4EC0FA]/10' : 'bg-[#F82F41]/10'
  const accentBorder = hasFilter
    ? (side === 'me' ? 'border-[#4EC0FA]/60' : 'border-[#F82F41]/60')
    : 'border-white/10'

  return (
    <div
      className={`relative flex-1 min-w-0 brawl-row rounded-xl border-2 ${accentBorder} ${accentBg} transition-all hover:brightness-110`}
    >
      {/* Native select positioned invisibly over the card — gives us
          keyboard / screen reader a11y for free without reinventing
          a Combobox component. */}
      <select
        value={selectedName}
        onChange={(e) => onChange(e.target.value)}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
        aria-label={label}
      >
        <option value="all" className="bg-[#0B1120]">{allLabel}</option>
        {options.map(([name]) => (
          <option key={name} value={name} className="bg-[#0B1120]">{name}</option>
        ))}
      </select>

      <div className="flex items-center gap-3 p-3 pointer-events-none">
        {hasFilter && selectedId !== null ? (
          <BrawlImg
            src={getBrawlerPortraitUrl(selectedId)}
            fallbackSrc={getBrawlerPortraitFallback(selectedId)}
            alt={selectedName}
            className="w-11 h-11 rounded-lg ring-2"
          />
        ) : (
          <div
            className="w-11 h-11 rounded-lg border-2 border-dashed flex items-center justify-center text-xl shrink-0"
            style={{ borderColor: `${accent}60` }}
          >
            ⚔️
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p
            className="text-[9px] uppercase font-bold tracking-wider"
            style={{ color: accent }}
          >
            {label}
          </p>
          <p className="font-['Lilita_One'] text-sm text-white truncate">
            {hasFilter ? selectedName : allLabel}
          </p>
        </div>
      </div>

      {/* Clear button — only when a filter is active. Sits on top
          of the invisible select so users can one-click clear
          without opening the dropdown. */}
      {hasFilter && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onChange('all') }}
          className="absolute top-1.5 right-1.5 z-20 w-5 h-5 rounded-full bg-black/50 hover:bg-black/80 flex items-center justify-center transition-colors"
          aria-label="Clear filter"
        >
          <X size={12} className="text-white" />
        </button>
      )}
    </div>
  )
}






export function MatchupMatrix({ data, proMatchups }: Props) {
  const t = useTranslations('advancedAnalytics')
  const [selectedBrawler, setSelectedBrawler] = useState<string>('all')
  const [selectedOpponent, setSelectedOpponent] = useState<string>('all')
  // Default to "strengths first" (bestFirst = true) — users want to
  // see what they're good at before what they're bad at.
  const [bestFirst, setBestFirst] = useState(true)
  const [showAll, setShowAll] = useState(false)

  const brawlerOptions = useMemo(() => {
    const names = new Map<string, number>()
    for (const d of data) {
      if (!names.has(d.myBrawlerName)) {
        names.set(d.myBrawlerName, d.myBrawlerId)
      }
    }
    return Array.from(names.entries())
      .sort(([a], [b]) => a.localeCompare(b))
  }, [data])

  const opponentOptions = useMemo(() => {
    const names = new Map<string, number>()
    for (const d of data) {
      if (!names.has(d.opponentBrawlerName)) {
        names.set(d.opponentBrawlerName, d.opponentBrawlerId)
      }
    }
    return Array.from(names.entries())
      .sort(([a], [b]) => a.localeCompare(b))
  }, [data])

  const filtered = useMemo(() => {
    const list = data.filter(d => {
      if (selectedBrawler !== 'all' && d.myBrawlerName !== selectedBrawler) return false
      if (selectedOpponent !== 'all' && d.opponentBrawlerName !== selectedOpponent) return false
      return true
    })

    return [...list].sort((a, b) =>
      bestFirst
        ? b.wilsonScore - a.wilsonScore
        : a.wilsonScore - b.wilsonScore
    )
  }, [data, selectedBrawler, selectedOpponent, bestFirst])

  const visible = showAll ? filtered : filtered.slice(0, INITIAL_LIMIT)
  const hasMore = filtered.length > INITIAL_LIMIT

  if (data.length === 0) {
    return (
      <div className="brawl-card-dark p-5 md:p-6 border-[#090E17]">
        <h3 className="font-['Lilita_One'] text-lg text-white mb-4 flex items-center gap-2">
          <span className="text-xl">⚔️</span> {t('matchupsTitleExplicit')}
        </h3>
        <div className="flex flex-col items-center py-8 text-center">
          <span className="text-3xl mb-2">🎯</span>
          <p className="font-['Lilita_One'] text-sm text-slate-400">{t('matchupsEmpty')}</p>
          <p className="text-[11px] text-slate-600 mt-1">{t('matchupsEmptyHint')}</p>
        </div>
      </div>
    )
  }

  // Resolve selected IDs from names — needed to render the portrait
  // in the filter slot without re-scanning data on every render.
  const selectedBrawlerId =
    selectedBrawler === 'all'
      ? null
      : brawlerOptions.find(([n]) => n === selectedBrawler)?.[1] ?? null
  const selectedOpponentId =
    selectedOpponent === 'all'
      ? null
      : opponentOptions.find(([n]) => n === selectedOpponent)?.[1] ?? null

  const hasActiveFilters = selectedBrawler !== 'all' || selectedOpponent !== 'all'

  return (
    <div className="brawl-card-dark p-5 md:p-6 border-[#090E17]">
      {/* Title */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-['Lilita_One'] text-lg text-white flex items-center gap-2">
          <span className="text-xl">⚔️</span> {t('matchupsTitleExplicit')}
          <InfoTooltip className="ml-1.5" text={t('tipMatchups')} />
        </h3>
      </div>

      {/* Versus filter banner — two portrait slots paired with a
          central "VS" divider. Sort toggle below. */}
      <div className="mb-5">
        <div className="flex flex-col sm:flex-row items-stretch gap-2 sm:gap-3">
          <FilterSlot
            side="me"
            label={t('matchupYou')}
            allLabel={t('allBrawlers')}
            selectedName={selectedBrawler}
            selectedId={selectedBrawlerId}
            options={brawlerOptions}
            onChange={(name) => { setSelectedBrawler(name); setShowAll(false) }}
          />
          <div className="flex items-center justify-center shrink-0 px-1">
            <span className="font-['Lilita_One'] text-[#FFC91B] text-xl drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]">
              VS
            </span>
          </div>
          <FilterSlot
            side="opponent"
            label={t('matchupVs')}
            allLabel={t('allOpponents')}
            selectedName={selectedOpponent}
            selectedId={selectedOpponentId}
            options={opponentOptions}
            onChange={(name) => { setSelectedOpponent(name); setShowAll(false) }}
          />
        </div>

        {/* Sort toggles — default to Fortalezas per user request */}
        <div className="flex items-center justify-between gap-2 mt-3">
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => { setBestFirst(true); setShowAll(false) }}
              className={`px-3 py-1.5 text-[10px] font-bold rounded-lg transition-colors ${
                bestFirst
                  ? 'bg-green-500/20 text-green-400 ring-1 ring-green-400/40'
                  : 'text-slate-500 hover:text-white hover:bg-white/5'
              }`}
            >
              {t('strengths')} 💪
            </button>
            <button
              type="button"
              onClick={() => { setBestFirst(false); setShowAll(false) }}
              className={`px-3 py-1.5 text-[10px] font-bold rounded-lg transition-colors ${
                !bestFirst
                  ? 'bg-red-500/20 text-red-400 ring-1 ring-red-400/40'
                  : 'text-slate-500 hover:text-white hover:bg-white/5'
              }`}
            >
              {t('weaknesses')} ☠️
            </button>
          </div>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={() => {
                setSelectedBrawler('all')
                setSelectedOpponent('all')
                setShowAll(false)
              }}
              className="text-[10px] font-bold text-slate-500 hover:text-white transition-colors inline-flex items-center gap-1"
            >
              <X size={11} />
              {t('clearFilters')}
            </button>
          )}
        </div>
      </div>

      {/* Matchup table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[9px] text-slate-500 uppercase tracking-wider">
              <th className="text-left pb-2 pl-1 font-bold">{t('matchupYou')}</th>
              <th className="text-left pb-2 font-bold">vs</th>
              <th className="text-right pb-2 font-bold">WR</th>
              <th className="text-right pb-2 font-bold hidden sm:table-cell">W/L</th>
              <th className="text-right pb-2 font-bold hidden sm:table-cell">{t('matchupGames')}</th>
              {proMatchups && <th className="text-right pb-2 font-bold">PRO</th>}
              {proMatchups && <th className="text-right pb-2 pr-1 font-bold hidden sm:table-cell">Diff</th>}
            </tr>
          </thead>
          <tbody>
            {visible.map(m => {
              const losses = m.total - m.wins
              const proEntry = proMatchups?.get(`${m.myBrawlerId}|${m.opponentBrawlerId}`)
              const diff = proEntry ? m.winRate - proEntry.winRate : null
              return (
                <tr
                  key={`${m.myBrawlerId}-${m.opponentBrawlerId}`}
                  className={`border-t border-white/5 hover:bg-white/[0.03] transition-colors ${m.total < 3 ? 'opacity-40' : ''}`}
                >
                  {/* My brawler */}
                  <td className="py-1.5 pl-1">
                    <div className="flex items-center gap-1.5">
                      <BrawlImg
                        src={getBrawlerPortraitUrl(m.myBrawlerId)}
                        fallbackSrc={getBrawlerPortraitFallback(m.myBrawlerId)}
                        alt={m.myBrawlerName}
                        className="w-6 h-6 rounded-md"
                      />
                      <span className="text-xs text-white font-['Lilita_One'] truncate max-w-[70px]">{m.myBrawlerName}</span>
                    </div>
                  </td>

                  {/* Opponent */}
                  <td className="py-1.5">
                    <div className="flex items-center gap-1.5">
                      <BrawlImg
                        src={getBrawlerPortraitUrl(m.opponentBrawlerId)}
                        fallbackSrc={getBrawlerPortraitFallback(m.opponentBrawlerId)}
                        alt={m.opponentBrawlerName}
                        className="w-6 h-6 rounded-md"
                      />
                      <span className="text-xs text-slate-300 truncate max-w-[70px]">{m.opponentBrawlerName}</span>
                    </div>
                  </td>

                  {/* Win Rate */}
                  <td className={`py-1.5 text-right font-['Lilita_One'] text-sm tabular-nums ${wrColor(m.winRate)}`}>
                    {m.winRate.toFixed(1)}%
                  </td>

                  {/* W/L */}
                  <td className="py-1.5 text-right text-[10px] text-slate-400 tabular-nums hidden sm:table-cell">
                    <span className="text-green-400">{m.wins}</span>
                    <span className="text-slate-600">/</span>
                    <span className="text-red-400">{losses}</span>
                  </td>

                  {/* Games */}
                  <td className="py-1.5 text-right text-[10px] text-slate-500 tabular-nums hidden sm:table-cell">
                    {m.total}
                  </td>

                  {/* PRO WR */}
                  {proMatchups && (
                    <td className="py-1.5 text-right text-[10px] tabular-nums">
                      {proEntry ? (
                        <span className="text-[#FFC91B]">{proEntry.winRate.toFixed(1)}%</span>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>
                  )}

                  {/* Diff vs PRO */}
                  {proMatchups && (
                    <td className="py-1.5 pr-1 text-right text-[10px] font-bold tabular-nums hidden sm:table-cell">
                      {diff !== null ? (
                        <span className={diff > 0 ? 'text-green-400' : diff < 0 ? 'text-red-400' : 'text-slate-500'}>
                          {diff > 0 ? '+' : ''}{diff.toFixed(1)}%
                        </span>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Show all / collapse */}
      {hasMore && (
        <button
          onClick={() => setShowAll(prev => !prev)}
          className="mt-3 w-full text-center text-[11px] font-bold text-slate-500 hover:text-[#FFC91B] transition-colors py-1.5"
        >
          {showAll ? t('showLess') : `${t('showAll')} (${filtered.length})`}
        </button>
      )}

      {/* Empty state — differentiate "no data at all" from
          "active filters yield zero rows" so the user knows what
          to do next. */}
      {visible.length === 0 && (
        <div className="text-center py-8">
          <p className="text-3xl mb-2">🎯</p>
          {hasActiveFilters ? (
            <>
              <p className="text-sm text-slate-400 font-['Lilita_One']">
                {t('matchupsEmptyFiltered')}
              </p>
              <button
                type="button"
                onClick={() => { setSelectedBrawler('all'); setSelectedOpponent('all') }}
                className="mt-2 text-xs font-bold text-[#FFC91B] hover:underline"
              >
                {t('clearFilters')}
              </button>
            </>
          ) : (
            <p className="text-sm text-slate-500">{t('matchupsEmpty')}</p>
          )}
        </div>
      )}
    </div>
  )
}
