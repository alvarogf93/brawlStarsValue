'use client'

import { useState, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { X } from 'lucide-react'
import { getBrawlerPortraitUrl, getBrawlerPortraitFallback } from '@/lib/utils'
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

function wrColor(wr: number): string {
  if (wr >= 60) return 'text-green-400 drop-shadow-[0_0_5px_rgba(34,197,94,0.6)]'
  if (wr >= 45) return 'text-[#FFC91B] drop-shadow-[0_0_5px_rgba(255,201,27,0.6)]'
  return 'text-red-500 drop-shadow-[0_0_5px_rgba(239,68,68,0.6)]'
}

function FilterSlot({
  side, label, allLabel, selectedName, selectedId, options, onChange,
}: FilterSlotProps) {
  const hasFilter = selectedName !== 'all' && selectedId !== null
  const accent = side === 'me' ? '#4EC0FA' : '#F82F41'
  const accentGlow = side === 'me' ? 'rgba(78,192,250,0.5)' : 'rgba(248,47,65,0.5)'
  const accentBg = side === 'me' ? 'bg-[#4EC0FA]/5 hover:bg-[#4EC0FA]/10' : 'bg-[#F82F41]/5 hover:bg-[#F82F41]/10'
  const accentBorder = hasFilter
    ? (side === 'me' ? 'border-[#4EC0FA] shadow-[0_0_15px_rgba(78,192,250,0.3)]' : 'border-[#F82F41] shadow-[0_0_15px_rgba(248,47,65,0.3)]')
    : 'border-white/10 bg-black/40'

  return (
    <div
      className={`relative flex-1 min-w-0 rounded-lg border-2 ${accentBorder} ${accentBg} transition-all duration-300 transform ${hasFilter ? 'scale-[1.02]' : 'hover:border-white/30'}`}
      style={{ clipPath: side === 'me' ? 'polygon(0 0, 100% 0, 95% 100%, 0 100%)' : 'polygon(5% 0, 100% 0, 100% 100%, 0 100%)' }}
    >
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

      <div className={`flex items-center gap-3 p-3 pointer-events-none ${side === 'opponent' ? 'pl-6' : 'pr-6'}`}>
        {hasFilter && selectedId !== null ? (
          <div className="relative">
            <BrawlImg
              src={getBrawlerPortraitUrl(selectedId)}
              fallbackSrc={getBrawlerPortraitFallback(selectedId)}
              alt={selectedName}
              className="w-14 h-14 rounded-lg relative z-10"
              style={{ clipPath: 'polygon(15% 0, 100% 0, 100% 85%, 85% 100%, 0 100%, 0 15%)' }}
            />
            <div className="absolute inset-0 bg-[#fff] opacity-20 blur-md rounded-full pointer-events-none" style={{ backgroundColor: accent }} />
          </div>
        ) : (
          <div
            className="w-14 h-14 rounded-lg border-2 border-dashed flex items-center justify-center text-xl shrink-0 bg-black/30 backdrop-blur-md"
            style={{ borderColor: `${accent}40`, boxShadow: `inset 0 0 10px ${accent}20` }}
          >
            <span className="opacity-50 grayscale">⚔️</span>
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p
            className="text-[10px] uppercase font-black tracking-widest drop-shadow-md"
            style={{ color: accent, textShadow: `0 0 5px ${accentGlow}` }}
          >
            {label}
          </p>
          <p className="font-['Lilita_One'] text-lg text-white truncate drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]">
            {hasFilter ? selectedName : allLabel}
          </p>
        </div>
      </div>

      {hasFilter && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onChange('all') }}
          className={`absolute top-2 ${side === 'me' ? 'right-[6%]' : 'right-2'} z-20 w-6 h-6 rounded-full bg-black/80 hover:bg-white/20 border border-white/10 flex items-center justify-center transition-colors shadow-lg`}
          aria-label="Clear filter"
        >
          <X size={14} className="text-white drop-shadow-md" />
        </button>
      )}
    </div>
  )
}

export function MatchupMatrix({ data, proMatchups }: Props) {
  const t = useTranslations('advancedAnalytics')
  const [selectedBrawler, setSelectedBrawler] = useState<string>('all')
  const [selectedOpponent, setSelectedOpponent] = useState<string>('all')
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
      <div className="relative overflow-hidden bg-[#090E17]/80 backdrop-blur-md rounded-xl p-5 md:p-6 border-b-[4px] border-[#06090E] shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_8px_16px_rgba(0,0,0,0.6)]">
        <h3 className="font-['Lilita_One'] text-lg text-white mb-4 flex items-center gap-2 drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]">
          <span className="text-xl drop-shadow-md">⚔️</span> {t('matchupsTitleExplicit')}
        </h3>
        <div className="flex flex-col items-center py-8 text-center relative z-10">
          <span className="text-4xl mb-3 grayscale opacity-30">🎯</span>
          <p className="font-['Lilita_One'] text-sm text-slate-500 uppercase tracking-widest">{t('matchupsEmpty')}</p>
          <p className="text-[11px] text-slate-600 mt-1">{t('matchupsEmptyHint')}</p>
        </div>
      </div>
    )
  }

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
    <div className="relative overflow-hidden bg-[#090E17]/80 backdrop-blur-md rounded-xl p-5 md:p-6 border-b-[4px] border-[#06090E] shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_8px_16px_rgba(0,0,0,0.6)]">
      {/* Background diagonal lines */}
      <div className="absolute inset-0 opacity-[0.02] bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,1)_25%,rgba(255,255,255,1)_50%,transparent_50%,transparent_75%,rgba(255,255,255,1)_75%,rgba(255,255,255,1)_100%)] bg-[length:40px_40px] pointer-events-none" />

      {/* Title */}
      <div className="flex items-center justify-between mb-5 relative z-10">
        <h3 className="font-['Lilita_One'] text-lg text-white flex items-center gap-2 drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]">
          <span className="text-xl drop-shadow-[0_0_5px_rgba(255,255,255,0.8)]">⚔️</span> {t('matchupsTitleExplicit')}
          <InfoTooltip className="ml-1.5 opacity-70 hover:opacity-100" text={t('tipMatchups')} />
        </h3>
      </div>

      {/* Versus filter banner */}
      <div className="mb-6 relative z-10 w-full max-w-2xl mx-auto">
        <div className="flex flex-col sm:flex-row items-stretch justify-center relative">
          <FilterSlot
            side="me"
            label={t('matchupYou')}
            allLabel={t('allBrawlers')}
            selectedName={selectedBrawler}
            selectedId={selectedBrawlerId}
            options={brawlerOptions}
            onChange={(name) => { setSelectedBrawler(name); setShowAll(false) }}
          />
          
          <div className="relative sm:absolute sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 z-20 flex justify-center py-2 sm:py-0">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-[#090E17] border-2 border-[#FFC91B] rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(255,201,27,0.4)]">
              <span className="font-['Lilita_One'] text-[#FFC91B] text-sm sm:text-base drop-shadow-[0_0_5px_rgba(255,201,27,0.8)]">
                VS
              </span>
            </div>
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

        {/* Sort toggles */}
        <div className="flex items-center justify-center gap-4 mt-6">
          <div className="flex bg-[#0A0E1A] p-1 rounded-lg border border-white/5 shadow-inner">
            <button
              type="button"
              onClick={() => { setBestFirst(true); setShowAll(false) }}
              className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-md transition-all duration-300 ${
                bestFirst
                  ? 'bg-green-500/20 text-green-400 shadow-[0_0_10px_rgba(34,197,94,0.3)]'
                  : 'text-slate-500 hover:text-white hover:bg-white/5'
              }`}
            >
              <span className="mr-1 drop-shadow-md">💪</span> {t('strengths')}
            </button>
            <button
              type="button"
              onClick={() => { setBestFirst(false); setShowAll(false) }}
              className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-md transition-all duration-300 ${
                !bestFirst
                  ? 'bg-red-500/20 text-red-500 shadow-[0_0_10px_rgba(239,68,68,0.3)]'
                  : 'text-slate-500 hover:text-white hover:bg-white/5'
              }`}
            >
              <span className="mr-1 drop-shadow-md">☠️</span> {t('weaknesses')}
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
              className="text-[10px] font-bold text-slate-500 hover:text-white transition-colors flex items-center gap-1 uppercase tracking-widest bg-white/5 px-3 py-2 rounded-lg hover:bg-white/10 border border-white/10"
            >
              <X size={12} />
              {t('clearFilters')}
            </button>
          )}
        </div>
      </div>

      {/* Matchup table - Fighter Roster style */}
      <div className="overflow-x-auto relative z-10 bg-black/40 rounded-xl border border-white/5 shadow-[inset_0_4px_20px_rgba(0,0,0,0.5)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[10px] text-slate-500 uppercase tracking-widest border-b border-white/10 bg-black/60">
              <th className="text-left font-black p-3 rounded-tl-xl">{t('matchupYou')}</th>
              <th className="text-left font-black p-3 text-[#FFC91B]">VS</th>
              <th className="text-right font-black p-3">WR</th>
              <th className="text-right font-black p-3 hidden sm:table-cell">W/L</th>
              <th className="text-right font-black p-3 hidden sm:table-cell">{t('matchupGames')}</th>
              {proMatchups && <th className="text-right font-black p-3">PRO</th>}
              {proMatchups && <th className="text-right p-3 font-black hidden sm:table-cell rounded-tr-xl">Diff</th>}
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
                  className={`border-b border-white/5 hover:bg-white/[0.05] transition-colors group ${m.total < 3 ? 'opacity-50 grayscale hover:grayscale-0 transition-all focus-within:grayscale-0' : ''}`}
                >
                  {/* My brawler */}
                  <td className="p-2">
                    <div className="flex items-center gap-3">
                      <BrawlImg
                        src={getBrawlerPortraitUrl(m.myBrawlerId)}
                        fallbackSrc={getBrawlerPortraitFallback(m.myBrawlerId)}
                        alt={m.myBrawlerName}
                        className="w-8 h-8 rounded-md border border-[#4EC0FA]/50 shadow-[0_0_5px_rgba(78,192,250,0.2)]"
                        style={{ clipPath: 'polygon(15% 0, 100% 0, 100% 85%, 85% 100%, 0 100%, 0 15%)' }}
                      />
                      <span className="text-sm text-white font-['Lilita_One'] truncate max-w-[90px] drop-shadow-md">{m.myBrawlerName}</span>
                    </div>
                  </td>

                  {/* Opponent */}
                  <td className="p-2">
                    <div className="flex items-center gap-3">
                      <BrawlImg
                        src={getBrawlerPortraitUrl(m.opponentBrawlerId)}
                        fallbackSrc={getBrawlerPortraitFallback(m.opponentBrawlerId)}
                        alt={m.opponentBrawlerName}
                        className="w-8 h-8 rounded-md border border-[#F82F41]/30 opacity-80 group-hover:opacity-100 transition-opacity"
                        style={{ clipPath: 'polygon(15% 0, 100% 0, 100% 85%, 85% 100%, 0 100%, 0 15%)' }}
                      />
                      <span className="text-sm text-slate-300 font-['Lilita_One'] truncate max-w-[90px] group-hover:text-white transition-colors">{m.opponentBrawlerName}</span>
                    </div>
                  </td>

                  {/* Win Rate */}
                  <td className={`p-3 text-right font-['Lilita_One'] text-lg tabular-nums tracking-wide ${wrColor(m.winRate)}`}>
                    {m.winRate.toFixed(1)}%
                  </td>

                  {/* W/L */}
                  <td className="p-3 text-right text-[11px] uppercase tracking-widest font-black text-slate-500 tabular-nums hidden sm:table-cell">
                    <span className="text-green-400 drop-shadow-[0_0_2px_rgba(34,197,94,0.5)]">{m.wins}W</span>
                    <span className="mx-1 opacity-50">-</span>
                    <span className="text-red-500 drop-shadow-[0_0_2px_rgba(239,68,68,0.5)]">{losses}L</span>
                  </td>

                  {/* Games */}
                  <td className="p-3 text-right text-[11px] font-bold text-slate-400 tabular-nums hidden sm:table-cell">
                    <span className="bg-white/5 border border-white/10 px-2 py-1 rounded-md">{m.total}</span>
                  </td>

                  {/* PRO WR */}
                  {proMatchups && (
                    <td className="p-3 text-right font-['Lilita_One'] text-base tabular-nums">
                      {proEntry ? (
                        <span className="text-[#FFC91B] drop-shadow-[0_0_3px_rgba(255,201,27,0.5)]">{proEntry.winRate.toFixed(1)}%</span>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>
                  )}

                  {/* Diff vs PRO */}
                  {proMatchups && (
                    <td className="p-3 text-right text-[11px] font-black tabular-nums hidden sm:table-cell">
                      {diff !== null ? (
                        <span className={`inline-block px-1.5 py-0.5 rounded ${diff > 0 ? 'bg-green-500/10 text-green-400 border border-green-500/20' : diff < 0 ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'text-slate-500'}`}>
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
          className="mt-4 w-full text-center text-[10px] uppercase font-black tracking-widest text-[#FFC91B] hover:text-white hover:bg-[#FFC91B]/10 border border-[#FFC91B]/30 transition-all py-3 rounded-xl relative z-10 shadow-[0_0_10px_rgba(255,201,27,0.1)]"
        >
          {showAll ? t('showLess') : `${t('showAll')} (${filtered.length})`}
        </button>
      )}

      {/* Empty state */}
      {visible.length === 0 && (
        <div className="text-center py-12 relative z-10">
          <p className="text-5xl mb-4 grayscale opacity-20">🎯</p>
          {hasActiveFilters ? (
            <>
              <p className="text-sm text-slate-400 font-['Lilita_One'] tracking-wide">
                {t('matchupsEmptyFiltered')}
              </p>
              <button
                type="button"
                onClick={() => { setSelectedBrawler('all'); setSelectedOpponent('all') }}
                className="mt-4 text-[11px] uppercase font-black tracking-widest text-[#FFC91B] border border-[#FFC91B]/50 px-4 py-2 rounded-lg hover:bg-[#FFC91B]/10 transition-colors"
              >
                {t('clearFilters')}
              </button>
            </>
          ) : (
            <p className="text-sm text-slate-500 font-bold uppercase tracking-widest">{t('matchupsEmpty')}</p>
          )}
        </div>
      )}
    </div>
  )
}
