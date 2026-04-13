'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { BrawlImg } from '@/components/ui/BrawlImg'
import { ConfidenceBadge } from '@/components/ui/ConfidenceBadge'
import {
  getBrawlerPortraitUrl,
  getBrawlerPortraitFallback,
  getGameModeImageUrl,
} from '@/lib/utils'
import { getCachedRegistry, setCachedRegistry, type BrawlerEntry } from '@/lib/brawler-registry'
import { useMapImages } from '@/hooks/useMapImages'
import type {
  BrawlerMetaResponse,
  MatchupStat,
} from '@/lib/brawler-detail/types'

// ── WR color helper ─────────────────────────────────────────

function wrColor(wr: number): string {
  if (wr > 55) return 'text-green-400'
  if (wr >= 45) return 'text-amber-400'
  return 'text-red-400'
}

// ── Trend helpers ───────────────────────────────────────────

function trendArrow(delta: number): string {
  if (delta > 0) return '↑'
  if (delta < 0) return '↓'
  return '→'
}

function trendColor(delta: number): string {
  if (delta > 0) return 'text-green-400'
  if (delta < 0) return 'text-red-400'
  return 'text-slate-400'
}

function trendLabel(delta: number, t: ReturnType<typeof useTranslations>): string {
  if (delta > 0) return t('rising')
  if (delta < 0) return t('falling')
  return t('stable')
}

// ── Registry hook — auto-fetch if not cached ────────────────

function useRegistry(): BrawlerEntry[] {
  const [registry, setRegistry] = useState<BrawlerEntry[]>(() => getCachedRegistry() ?? [])

  useEffect(() => {
    if (registry.length > 0) return
    fetch('https://api.brawlapi.com/v1/brawlers')
      .then(r => { if (!r.ok) throw new Error(); return r.json() })
      .then(data => {
        const list = (data.list ?? data) as Array<{
          id: number; name: string; rarity?: { name: string }; class?: { name: string }; imageUrl2?: string; imageUrl?: string
        }>
        const entries: BrawlerEntry[] = list.map(b => ({
          id: b.id, name: b.name, rarity: b.rarity?.name ?? '',
          class: b.class?.name ?? '', imageUrl: b.imageUrl2 ?? b.imageUrl ?? '',
        }))
        setRegistry(entries)
        setCachedRegistry(entries)
      })
      .catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return registry
}

import { resolveBrawlerName } from '@/lib/brawler-name'

// ── Matchup List ────────────────────────────────────────────

interface MatchupListProps {
  title: string
  entries: MatchupStat[]
  registry: BrawlerEntry[]
  playerNames?: Map<number, string>
}

function MatchupList({ title, entries, playerNames }: MatchupListProps) {
  const t = useTranslations('brawlerDetail')

  if (entries.length === 0) {
    return (
      <div className="brawl-card-dark p-5 md:p-6 border-[#090E17]">
        <h3 className="font-['Lilita_One'] text-lg text-white mb-4 flex items-center gap-2">
          {title}
        </h3>
        <p className="text-sm text-slate-500">{t('matchupsEmptyContextual')}</p>
      </div>
    )
  }

  return (
    <div className="brawl-card-dark p-5 md:p-6 border-[#090E17]">
      <h3 className="font-['Lilita_One'] text-lg text-white mb-4 flex items-center gap-2">
        {title}
      </h3>
      <div className="space-y-2">
        {entries.slice(0, 5).map(entry => {
          const name = resolveBrawlerName(entry.opponentId, playerNames)
          return (
            <div
              key={entry.opponentId}
              className="flex items-center gap-3 rounded-xl bg-white/[0.03] p-2.5"
            >
              <BrawlImg
                src={getBrawlerPortraitUrl(entry.opponentId)}
                fallbackSrc={getBrawlerPortraitFallback(entry.opponentId)}
                alt={name}
                fallbackText={name}
                className="w-10 h-10 rounded-lg"
              />
              <span className="font-['Lilita_One'] text-sm text-white truncate flex-1">
                {name}
              </span>
              <ConfidenceBadge total={entry.totalBattles} />
              <span className={`font-['Lilita_One'] text-sm tabular-nums ${wrColor(entry.winRate)}`}>
                {entry.winRate.toFixed(1)}%
              </span>
              <span className="text-[10px] text-slate-500 tabular-nums">
                {t('sampleSize', { count: entry.totalBattles })}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Main component ──────────────────────────────────────────

interface Props {
  data: BrawlerMetaResponse
  /** Optional name map from player's own brawlers — fallback when BrawlAPI registry is incomplete */
  playerBrawlerNames?: Map<number, string>
}

export function MetaIntelligence({ data, playerBrawlerNames }: Props) {
  const t = useTranslations('brawlerDetail')
  const registry = useRegistry()
  const mapImages = useMapImages()
  const { globalStats, bestMaps, strongAgainst, weakAgainst, bestTeammates } = data

  return (
    <div className="space-y-6">
      {/* ── Stats Overview ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="brawl-card-dark p-5 md:p-6 border-[#090E17] text-center">
          <p className="text-xs text-slate-400 mb-1">{t('winRate')}</p>
          <p className={`font-['Lilita_One'] text-2xl tabular-nums ${wrColor(globalStats.winRate)}`}>
            {globalStats.winRate.toFixed(1)}%
          </p>
        </div>
        <div className="brawl-card-dark p-5 md:p-6 border-[#090E17] text-center">
          <p className="text-xs text-slate-400 mb-1">{t('pickRate')}</p>
          <p className="font-['Lilita_One'] text-2xl tabular-nums text-white">
            {globalStats.pickRate.toFixed(1)}%
          </p>
        </div>
        <div className="brawl-card-dark p-5 md:p-6 border-[#090E17] text-center">
          <p className="text-xs text-slate-400 mb-1">{t('totalBattles')}</p>
          <p className="font-['Lilita_One'] text-2xl tabular-nums text-white">
            {globalStats.totalBattles.toLocaleString()}
          </p>
        </div>
        <div className="brawl-card-dark p-5 md:p-6 border-[#090E17] text-center">
          <p className="text-xs text-slate-400 mb-1">{t('trending')}</p>
          <p className={`font-['Lilita_One'] text-2xl ${trendColor(globalStats.trend7d)}`}>
            {trendArrow(globalStats.trend7d)} {trendLabel(globalStats.trend7d, t)}
          </p>
        </div>
      </div>

      {/* ── Best Maps — card style with map background image ── */}
      <div className="brawl-card-dark p-5 md:p-6 border-[#090E17]">
        <h3 className="font-['Lilita_One'] text-lg text-white mb-4 flex items-center gap-2">
          🗺️ {t('bestMaps')}
        </h3>

        {bestMaps.length === 0 ? (
          <p className="text-sm text-slate-500">{t('bestMapsEmptyContextual')}</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {bestMaps.slice(0, 6).map(map => {
              const modeIconUrl = getGameModeImageUrl(map.mode)
              const mapImageUrl = mapImages[map.map]
              return (
                <div
                  key={`${map.map}-${map.mode}`}
                  className="relative rounded-xl overflow-hidden border-2 border-[#1E293B] group"
                >
                  {/* Map background image */}
                  {mapImageUrl ? (
                    <img
                      src={mapImageUrl}
                      alt={map.map}
                      className="w-full h-24 object-cover opacity-40 group-hover:opacity-60 transition-opacity"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-24 bg-[#1E293B]" />
                  )}

                  {/* Confidence badge — top-right corner */}
                  <div className="absolute top-1.5 right-1.5">
                    <ConfidenceBadge total={map.totalBattles} />
                  </div>

                  {/* Overlay data */}
                  <div className="absolute inset-0 flex flex-col justify-end p-2.5">
                    <div className="flex items-center gap-1.5 mb-1">
                      {modeIconUrl && (
                        <img src={modeIconUrl} alt={map.mode} className="w-4 h-4" width={16} height={16} />
                      )}
                      <span className="font-['Lilita_One'] text-xs text-white truncate">
                        {map.map}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className={`font-['Lilita_One'] text-lg ${wrColor(map.winRate)}`}>
                        {map.winRate.toFixed(1)}%
                      </span>
                      <span className="text-[9px] text-slate-300 tabular-nums">
                        {t('sampleSize', { count: map.totalBattles })}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Counters ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <MatchupList title={`💪 ${t('strongAgainst')}`} entries={strongAgainst} registry={registry} playerNames={playerBrawlerNames} />
        <MatchupList title={`⚠️ ${t('weakAgainst')}`} entries={weakAgainst} registry={registry} playerNames={playerBrawlerNames} />
      </div>

      {/* ── Best Teammates ── */}
      {/* bestTeammates intentionally omitted when empty — the section
          disappears silently because the globalStats grid already
          conveys enough context about this brawler's activity level. */}
      {bestTeammates.length > 0 && (
        <div className="brawl-card-dark p-5 md:p-6 border-[#090E17]">
          <h3 className="font-['Lilita_One'] text-lg text-white mb-4 flex items-center gap-2">
            🤝 {t('bestTeammates')}
          </h3>
          <div className="space-y-2">
            {bestTeammates.slice(0, 5).map(tm => {
              const name = resolveBrawlerName(tm.teammateId, playerBrawlerNames)
              return (
                <div key={tm.teammateId} className="flex items-center gap-3 rounded-xl bg-white/[0.03] p-2.5">
                  <BrawlImg
                    src={getBrawlerPortraitUrl(tm.teammateId)}
                    fallbackSrc={getBrawlerPortraitFallback(tm.teammateId)}
                    alt={name}
                    fallbackText={name}
                    className="w-10 h-10 rounded-lg"
                  />
                  {name && <span className="font-['Lilita_One'] text-sm text-white truncate flex-1">{name}</span>}
                  <ConfidenceBadge total={tm.totalBattles} />
                  <span className={`font-['Lilita_One'] text-sm tabular-nums ${wrColor(tm.winRate)}`}>
                    {tm.winRate.toFixed(1)}%
                  </span>
                  <span className="text-[10px] text-slate-500 tabular-nums">
                    {t('sampleSize', { count: tm.totalBattles })}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
