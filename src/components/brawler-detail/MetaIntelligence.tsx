'use client'

import { useTranslations } from 'next-intl'
import { BrawlImg } from '@/components/ui/BrawlImg'
import {
  getBrawlerPortraitUrl,
  getBrawlerPortraitFallback,
  getGameModeImageUrl,
} from '@/lib/utils'
import { getCachedRegistry } from '@/lib/brawler-registry'
import type {
  BrawlerMetaResponse,
  MatchupStat,
  TeammateStat,
} from '@/lib/brawler-detail/types'

// ── WR color helpers (task-specific thresholds) ──────────────

function metaWrColor(wr: number): string {
  if (wr > 55) return 'text-green-400'
  if (wr >= 45) return 'text-amber-400'
  return 'text-red-400'
}

// ── Trend helpers ────────────────────────────────────────────

function trendArrow(delta: number): string {
  if (delta > 0) return '\u2191'
  if (delta < 0) return '\u2193'
  return '\u2192'
}

function trendColor(delta: number): string {
  if (delta > 0) return 'text-green-400'
  if (delta < 0) return 'text-red-400'
  return 'text-slate-400'
}

function trendLabel(
  delta: number,
  t: ReturnType<typeof useTranslations>,
): string {
  if (delta > 0) return t('rising')
  if (delta < 0) return t('falling')
  return t('stable')
}

// ── Name resolver ────────────────────────────────────────────

function resolveName(brawlerId: number): string {
  const registry = getCachedRegistry()
  return registry?.find((b) => b.id === brawlerId)?.name ?? 'Unknown'
}

// ── Sub-components ───────────────────────────────────────────

interface MatchupListProps {
  title: string
  entries: MatchupStat[]
}

function MatchupList({ title, entries }: MatchupListProps) {
  const t = useTranslations('brawlerDetail')

  if (entries.length === 0) {
    return (
      <div className="brawl-card-dark p-5 md:p-6 border-[#090E17]">
        <h3 className="font-['Lilita_One'] text-lg text-white mb-4 flex items-center gap-2">
          {title}
        </h3>
        <p className="text-sm text-slate-500">{t('insufficientData')}</p>
      </div>
    )
  }

  return (
    <div className="brawl-card-dark p-5 md:p-6 border-[#090E17]">
      <h3 className="font-['Lilita_One'] text-lg text-white mb-4 flex items-center gap-2">
        {title}
      </h3>
      <div className="space-y-2">
        {entries.slice(0, 5).map((entry) => {
          const name = resolveName(entry.opponentId)
          return (
            <div
              key={entry.opponentId}
              className="flex items-center gap-3 rounded-xl bg-white/[0.03] p-2.5"
            >
              <BrawlImg
                src={getBrawlerPortraitUrl(entry.opponentId)}
                fallbackSrc={getBrawlerPortraitFallback(entry.opponentId)}
                alt={name}
                className="w-10 h-10 rounded-lg"
              />
              <span className="font-['Lilita_One'] text-sm text-white truncate flex-1">
                {name}
              </span>
              <span
                className={`font-['Lilita_One'] text-sm tabular-nums ${metaWrColor(entry.winRate)}`}
              >
                {entry.winRate.toFixed(1)}%
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

interface TeammateListProps {
  teammates: TeammateStat[]
}

function TeammateList({ teammates }: TeammateListProps) {
  const t = useTranslations('brawlerDetail')

  return (
    <div className="brawl-card-dark p-5 md:p-6 border-[#090E17]">
      <h3 className="font-['Lilita_One'] text-lg text-white mb-4 flex items-center gap-2">
        {'\uD83E\uDD1D'} {t('bestTeammates')}
      </h3>
      <div className="space-y-2">
        {teammates.slice(0, 5).map((tm) => {
          const name = resolveName(tm.teammateId)
          return (
            <div
              key={tm.teammateId}
              className="flex items-center gap-3 rounded-xl bg-white/[0.03] p-2.5"
            >
              <BrawlImg
                src={getBrawlerPortraitUrl(tm.teammateId)}
                fallbackSrc={getBrawlerPortraitFallback(tm.teammateId)}
                alt={name}
                className="w-10 h-10 rounded-lg"
              />
              <span className="font-['Lilita_One'] text-sm text-white truncate flex-1">
                {name}
              </span>
              <span
                className={`font-['Lilita_One'] text-sm tabular-nums ${metaWrColor(tm.winRate)}`}
              >
                {tm.winRate.toFixed(1)}%
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Main component ───────────────────────────────────────────

interface Props {
  data: BrawlerMetaResponse
}

export function MetaIntelligence({ data }: Props) {
  const t = useTranslations('brawlerDetail')
  const { globalStats, bestMaps, strongAgainst, weakAgainst, bestTeammates } =
    data

  return (
    <div className="space-y-6">
      {/* ── Section 1: Stats Overview ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Win Rate */}
        <div className="brawl-card-dark p-5 md:p-6 border-[#090E17] text-center">
          <p className="text-xs text-slate-400 mb-1">{t('winRate')}</p>
          <p
            className={`font-['Lilita_One'] text-2xl tabular-nums ${metaWrColor(globalStats.winRate)}`}
          >
            {globalStats.winRate.toFixed(1)}%
          </p>
        </div>

        {/* Pick Rate */}
        <div className="brawl-card-dark p-5 md:p-6 border-[#090E17] text-center">
          <p className="text-xs text-slate-400 mb-1">{t('pickRate')}</p>
          <p className="font-['Lilita_One'] text-2xl tabular-nums text-white">
            {globalStats.pickRate.toFixed(1)}%
          </p>
        </div>

        {/* Total Battles */}
        <div className="brawl-card-dark p-5 md:p-6 border-[#090E17] text-center">
          <p className="text-xs text-slate-400 mb-1">{t('totalBattles')}</p>
          <p className="font-['Lilita_One'] text-2xl tabular-nums text-white">
            {globalStats.totalBattles.toLocaleString()}
          </p>
        </div>

        {/* Trending */}
        <div className="brawl-card-dark p-5 md:p-6 border-[#090E17] text-center">
          <p className="text-xs text-slate-400 mb-1">{t('trending')}</p>
          <p
            className={`font-['Lilita_One'] text-2xl ${trendColor(globalStats.trend7d)}`}
          >
            {trendArrow(globalStats.trend7d)}{' '}
            {trendLabel(globalStats.trend7d, t)}
          </p>
        </div>
      </div>

      {/* ── Section 2: Best Maps ── */}
      <div className="brawl-card-dark p-5 md:p-6 border-[#090E17]">
        <h3 className="font-['Lilita_One'] text-lg text-white mb-4 flex items-center gap-2">
          {'\uD83D\uDDFA\uFE0F'} {t('bestMaps')}
        </h3>

        {bestMaps.length === 0 ? (
          <p className="text-sm text-slate-500">{t('insufficientData')}</p>
        ) : (
          <div className="space-y-2">
            {bestMaps.slice(0, 5).map((map) => {
              const modeIconUrl = getGameModeImageUrl(map.mode)
              return (
                <div
                  key={map.eventId}
                  className="flex items-center gap-3 rounded-xl bg-white/[0.03] p-2.5"
                >
                  {modeIconUrl && (
                    <BrawlImg
                      src={modeIconUrl}
                      alt={map.mode}
                      className="w-7 h-7"
                    />
                  )}
                  <span className="text-sm text-white truncate flex-1">
                    {map.mapName}
                  </span>
                  <span
                    className={`font-['Lilita_One'] text-sm tabular-nums ${metaWrColor(map.winRate)}`}
                  >
                    {map.winRate.toFixed(1)}%
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Section 3: Counters ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <MatchupList
          title={`\uD83D\uDCAA ${t('strongAgainst')}`}
          entries={strongAgainst}
        />
        <MatchupList
          title={`\u26A0\uFE0F ${t('weakAgainst')}`}
          entries={weakAgainst}
        />
      </div>

      {/* ── Section 4: Best Teammates ── */}
      {bestTeammates.length > 0 && <TeammateList teammates={bestTeammates} />}
    </div>
  )
}
