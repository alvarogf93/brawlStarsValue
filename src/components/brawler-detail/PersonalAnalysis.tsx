'use client'

import { useMemo } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { useBattlelog } from '@/hooks/useBattlelog'
import { BlurredTeaser } from '@/components/premium/BlurredTeaser'
import { ActivityCalendar } from './ActivityCalendar'
import { MasteryTimeline } from './MasteryTimeline'
import { BrawlerRecommendations } from './BrawlerRecommendations'
import { BrawlImg } from '@/components/ui/BrawlImg'
import { ModeIcon } from '@/components/ui/ModeIcon'
import { getBrawlerPortraitUrl, getBrawlerPortraitFallback, wrColor } from '@/lib/utils'
import { bucketBattlesToCalendar, generateRecommendations } from '@/lib/brawler-detail/compute'
import type { AdvancedAnalytics } from '@/lib/analytics/types'
import type { BrawlerMetaResponse } from '@/lib/brawler-detail/types'

interface Props {
  brawlerId: number
  analytics: AdvancedAnalytics | null
  metaData: BrawlerMetaResponse | null
  hasPremium: boolean
  tag: string
}

export function PersonalAnalysis({
  brawlerId,
  analytics,
  metaData,
  hasPremium,
  tag,
}: Props) {
  const t = useTranslations('brawlerDetail')
  const locale = useLocale()
  const { data: battleData } = useBattlelog(tag)

  // ── Filter analytics data for this brawler ──────────────────

  const brawlerStats = useMemo(
    () => analytics?.byBrawler.find(b => b.id === brawlerId) ?? null,
    [analytics, brawlerId],
  )

  const mapMatrix = useMemo(
    () => analytics?.brawlerMapMatrix.filter(b => b.brawlerId === brawlerId) ?? [],
    [analytics, brawlerId],
  )

  const matchups = useMemo(
    () => analytics?.matchups.filter(m => m.myBrawlerId === brawlerId) ?? [],
    [analytics, brawlerId],
  )

  const mastery = useMemo(
    () => analytics?.brawlerMastery.find(b => b.brawlerId === brawlerId) ?? null,
    [analytics, brawlerId],
  )

  const comfort = useMemo(
    () => analytics?.brawlerComfort.find(b => b.brawlerId === brawlerId),
    [analytics, brawlerId],
  )

  // ── Calendar data from battlelog ────────────────────────────

  const calendarDays = useMemo(() => {
    if (!battleData?.battles) return []
    return bucketBattlesToCalendar(battleData.battles, brawlerId, tag)
  }, [battleData, brawlerId, tag])

  // ── Recommendations ─────────────────────────────────────────

  const recommendations = useMemo(() => {
    const brawlerName = brawlerStats?.name ?? metaData?.brawlerName ?? ''
    return generateRecommendations(
      brawlerId,
      brawlerName,
      mapMatrix,
      matchups,
      metaData ?? null,
      comfort,
      mastery ?? undefined,
    )
  }, [brawlerId, brawlerStats, metaData, mapMatrix, matchups, comfort, mastery])

  // ── Guard: no analytics data at all ─────────────────────────

  if (!analytics || !brawlerStats) return null

  const brawlerName = brawlerStats.name
  const yourWR = brawlerStats.winRate
  const metaWR = metaData?.globalWinRate ?? null
  const wrDiff = metaWR !== null ? yourWR - metaWR : null

  const redirectPath = `/${locale}/profile/${encodeURIComponent(tag)}/subscribe`

  // ── Top matchups (sorted by games, top 8) ───────────────────
  const topMatchups = useMemo(
    () => [...matchups].sort((a, b) => b.total - a.total).slice(0, 8),
    [matchups],
  )

  // ── Top maps (sorted by games, top 8) ───────────────────────
  const topMaps = useMemo(
    () => [...mapMatrix].sort((a, b) => b.total - a.total).slice(0, 8),
    [mapMatrix],
  )

  // ── Premium content block ───────────────────────────────────

  const premiumContent = (
    <div className="space-y-6">
      {/* Personal Map Performance */}
      {topMaps.length > 0 && (
        <div className="brawl-card-dark p-5 md:p-6 border-[#090E17]">
          <h4 className="font-['Lilita_One'] text-lg text-white mb-4 flex items-center gap-2">
            <span className="text-xl">🗺️</span> {t('mapPerformanceTitle')}
          </h4>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-slate-500 text-xs uppercase">
                  <th className="text-left font-bold pb-2 pr-3">{t('colMap')}</th>
                  <th className="text-left font-bold pb-2 pr-3">{t('colMode')}</th>
                  <th className="text-right font-bold pb-2 pr-3">{t('colGames')}</th>
                  <th className="text-right font-bold pb-2 pr-3">{t('colYourWR')}</th>
                  {metaData && (
                    <th className="text-right font-bold pb-2 pr-3">{t('colMetaWR')}</th>
                  )}
                  {metaData && (
                    <th className="text-right font-bold pb-2">{t('colDiff')}</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {topMaps.map((entry, i) => {
                  const metaMap = metaData?.mapWinRates.find(
                    m => m.map === entry.map && m.mode === entry.mode,
                  )
                  const diff = metaMap ? entry.winRate - metaMap.winRate : null

                  return (
                    <tr key={i} className="border-t border-white/5">
                      <td className="py-2 pr-3 text-white font-medium truncate max-w-[140px]">
                        {entry.map}
                      </td>
                      <td className="py-2 pr-3">
                        <ModeIcon mode={entry.mode} size={16} />
                      </td>
                      <td className="py-2 pr-3 text-right text-slate-400 tabular-nums">
                        {entry.total}
                      </td>
                      <td className={`py-2 pr-3 text-right font-bold tabular-nums ${wrColor(entry.winRate)}`}>
                        {entry.winRate.toFixed(1)}%
                      </td>
                      {metaData && (
                        <td className="py-2 pr-3 text-right text-slate-400 tabular-nums">
                          {metaMap ? `${metaMap.winRate.toFixed(1)}%` : '-'}
                        </td>
                      )}
                      {metaData && (
                        <td className={`py-2 text-right font-bold tabular-nums ${
                          diff !== null
                            ? diff > 0 ? 'text-green-400' : diff < 0 ? 'text-red-400' : 'text-slate-400'
                            : 'text-slate-600'
                        }`}>
                          {diff !== null ? `${diff > 0 ? '+' : ''}${diff.toFixed(1)}%` : '-'}
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Personal Matchups */}
      {topMatchups.length > 0 && (
        <div className="brawl-card-dark p-5 md:p-6 border-[#090E17]">
          <h4 className="font-['Lilita_One'] text-lg text-white mb-4 flex items-center gap-2">
            <span className="text-xl">⚔️</span> {t('matchupsTitle')}
          </h4>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-slate-500 text-xs uppercase">
                  <th className="text-left font-bold pb-2 pr-3">{t('colOpponent')}</th>
                  <th className="text-right font-bold pb-2 pr-3">{t('colGames')}</th>
                  <th className="text-right font-bold pb-2 pr-3">{t('colYourWR')}</th>
                  {metaData && (
                    <th className="text-right font-bold pb-2 pr-3">{t('colMetaWR')}</th>
                  )}
                  {metaData && (
                    <th className="text-right font-bold pb-2">{t('colDiff')}</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {topMatchups.map((mu, i) => {
                  const metaMu = metaData?.matchupWinRates.find(
                    m => m.opponentBrawlerId === mu.opponentBrawlerId,
                  )
                  const diff = metaMu ? mu.winRate - metaMu.winRate : null

                  return (
                    <tr key={i} className="border-t border-white/5">
                      <td className="py-2 pr-3">
                        <div className="flex items-center gap-2">
                          <BrawlImg
                            src={getBrawlerPortraitUrl(mu.opponentBrawlerId)}
                            fallbackSrc={getBrawlerPortraitFallback(mu.opponentBrawlerId)}
                            alt={mu.opponentBrawlerName}
                            className="w-7 h-7 rounded-md"
                          />
                          <span className="text-white font-medium truncate">
                            {mu.opponentBrawlerName}
                          </span>
                        </div>
                      </td>
                      <td className="py-2 pr-3 text-right text-slate-400 tabular-nums">
                        {mu.total}
                      </td>
                      <td className={`py-2 pr-3 text-right font-bold tabular-nums ${wrColor(mu.winRate)}`}>
                        {mu.winRate.toFixed(1)}%
                      </td>
                      {metaData && (
                        <td className="py-2 pr-3 text-right text-slate-400 tabular-nums">
                          {metaMu ? `${metaMu.winRate.toFixed(1)}%` : '-'}
                        </td>
                      )}
                      {metaData && (
                        <td className={`py-2 text-right font-bold tabular-nums ${
                          diff !== null
                            ? diff > 0 ? 'text-green-400' : diff < 0 ? 'text-red-400' : 'text-slate-400'
                            : 'text-slate-600'
                        }`}>
                          {diff !== null ? `${diff > 0 ? '+' : ''}${diff.toFixed(1)}%` : '-'}
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Activity Calendar */}
      <ActivityCalendar calendarDays={calendarDays} />

      {/* Mastery Timeline */}
      <MasteryTimeline mastery={mastery} />

      {/* Recommendations */}
      <BrawlerRecommendations recommendations={recommendations} />
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Section Title */}
      <h3 className="font-['Lilita_One'] text-lg text-white flex items-center gap-2">
        <span className="text-xl">📊</span> {t('personalTitle', { brawler: brawlerName })}
      </h3>

      {/* Teaser cards — visible to everyone */}
      <div className="grid grid-cols-2 gap-4">
        {/* Your WR */}
        <div className="brawl-card-dark p-5 md:p-6 border-[#090E17] text-center">
          <p className="font-['Lilita_One'] text-xs uppercase text-slate-500 mb-1">
            {t('yourWR')}
          </p>
          <p className={`font-['Lilita_One'] text-3xl tabular-nums ${wrColor(yourWR)}`}>
            {yourWR.toFixed(1)}%
          </p>
          <p className="text-[10px] text-slate-500 mt-1">
            {brawlerStats.total} {t('games')}
          </p>
        </div>

        {/* Meta WR */}
        <div className="brawl-card-dark p-5 md:p-6 border-[#090E17] text-center">
          <p className="font-['Lilita_One'] text-xs uppercase text-slate-500 mb-1">
            {t('metaWR')}
          </p>
          {metaWR !== null ? (
            <>
              <p className={`font-['Lilita_One'] text-3xl tabular-nums ${wrColor(metaWR)}`}>
                {metaWR.toFixed(1)}%
              </p>
              <p className={`text-[10px] mt-1 font-bold ${
                wrDiff !== null
                  ? wrDiff > 0 ? 'text-green-400' : wrDiff < 0 ? 'text-red-400' : 'text-slate-400'
                  : 'text-slate-500'
              }`}>
                {wrDiff !== null && wrDiff > 0 && '+'}{wrDiff !== null ? `${wrDiff.toFixed(1)}% ${t('vsMeta')}` : ''}
              </p>
            </>
          ) : (
            <p className="font-['Lilita_One'] text-3xl text-slate-600">-</p>
          )}
        </div>
      </div>

      {/* Premium content — gated */}
      {hasPremium ? (
        premiumContent
      ) : (
        <BlurredTeaser redirectTo={redirectPath}>
          {premiumContent}
        </BlurredTeaser>
      )}
    </div>
  )
}
