/**
 * Pure builder for the editorial article body on
 * `/[locale]/brawler/[brawlerId]`.
 *
 * Returns five string-array sections (lead, maps, counters, upgrades,
 * trend) populated with localized copy interpolated against the
 * brawler's real `meta_stats` data. Each section can vary based on
 * data availability (high/low samples, trend rising/falling/stable),
 * so 104 brawlers × 13 locales × multiple template branches yields
 * thousands of unique pages — Google's "templated low-quality" alarm
 * is gated on near-identical text, not shared structure.
 *
 * The builder is intentionally framework-agnostic: it takes a `t()`
 * callable as input rather than reaching into next-intl directly,
 * so it's trivially unit-testable with a mock translator.
 */

import type { BrawlerMetaResponse } from './types'
import { MODE_DISPLAY_NAMES } from '@/lib/constants'

/**
 * Minimal subset of next-intl's translator that we need. Modeled this
 * way (rather than typing the full `useTranslations` return value) so
 * the builder stays usable from server components, client components,
 * and tests.
 */
export type Translator = (key: string, vars?: Record<string, string | number>) => string

export interface BrawlerArticleInput {
  name: string
  rarity: string | null
  brawlerClass: string | null
  /**
   * The aggregated meta response from `useBrawlerMeta` / the brawler
   * detail endpoint. May be null when the brawler is brand new and
   * no batches have been processed yet.
   */
  meta: BrawlerMetaResponse | null
  /**
   * Optional resolved opponent / teammate names. The page already
   * resolves these via the registry; passing them in keeps article.ts
   * pure (no async name lookups).
   */
  opponentName?: string | null
  weakOpponentName?: string | null
  bestTeammateName?: string | null
  t: Translator
}

export interface BrawlerArticle {
  leadParagraphs: string[]
  mapsParagraphs: string[]
  countersParagraphs: string[]
  upgradesParagraphs: string[]
  trendParagraphs: string[]
}

/** Threshold under which we consider a brawler's data "thin" and
 *  switch to no-stats template variants. Same constant as the
 *  metadata helper so the article and the meta description agree
 *  on what "we have data" means. */
const MIN_BATTLES_FOR_PROSE = 30

/** Bucket the 7-day trend into a label. The thresholds are 1pp and
 *  -1pp because the underlying smoothing rounds to 1 decimal anyway —
 *  anything tighter would be visual noise. */
function trendBucket(trend7d: number | null | undefined): 'rising' | 'falling' | 'stable' | 'unknown' {
  if (trend7d === null || trend7d === undefined) return 'unknown'
  if (trend7d > 1) return 'rising'
  if (trend7d < -1) return 'falling'
  return 'stable'
}

export function buildBrawlerArticle(input: BrawlerArticleInput): BrawlerArticle {
  const {
    name,
    rarity,
    brawlerClass,
    meta,
    opponentName,
    weakOpponentName,
    bestTeammateName,
    t,
  } = input

  const hasData = !!meta && meta.globalStats.totalBattles >= MIN_BATTLES_FOR_PROSE

  // ── Lead ────────────────────────────────────────────────────
  const leadParagraphs: string[] = []
  if (rarity && brawlerClass) {
    leadParagraphs.push(t('article.leadFull', { name, rarity, class: brawlerClass }))
  } else if (rarity) {
    leadParagraphs.push(t('article.leadRarity', { name, rarity }))
  } else {
    leadParagraphs.push(t('article.leadGeneric', { name }))
  }

  if (hasData && meta) {
    leadParagraphs.push(
      t('article.leadStats', {
        name,
        wr: meta.globalStats.winRate.toFixed(1),
        pr: meta.globalStats.pickRate.toFixed(1),
        total: meta.globalStats.totalBattles.toLocaleString(),
      }),
    )
  } else {
    leadParagraphs.push(t('article.leadStatsThin', { name }))
  }

  // ── Maps section ────────────────────────────────────────────
  const mapsParagraphs: string[] = []
  if (hasData && meta && meta.bestMaps.length > 0) {
    const top = meta.bestMaps[0]
    const topMode = MODE_DISPLAY_NAMES[top.mode] ?? top.mode
    mapsParagraphs.push(
      t('article.mapsIntro', {
        name,
        map: top.map,
        mode: topMode,
        wr: top.winRate.toFixed(1),
      }),
    )

    if (meta.bestMaps.length > 1) {
      const second = meta.bestMaps[1]
      const secondMode = MODE_DISPLAY_NAMES[second.mode] ?? second.mode
      mapsParagraphs.push(
        t('article.mapsRunnerUp', {
          name,
          map: second.map,
          mode: secondMode,
          wr: second.winRate.toFixed(1),
        }),
      )
    }

    if (meta.worstMaps.length > 0) {
      const worst = meta.worstMaps[0]
      const worstMode = MODE_DISPLAY_NAMES[worst.mode] ?? worst.mode
      mapsParagraphs.push(
        t('article.mapsAvoid', {
          name,
          map: worst.map,
          mode: worstMode,
          wr: worst.winRate.toFixed(1),
        }),
      )
    }
  } else {
    mapsParagraphs.push(t('article.mapsEmpty', { name }))
  }

  // ── Counters section ────────────────────────────────────────
  const countersParagraphs: string[] = []
  if (hasData && meta && (meta.strongAgainst.length > 0 || meta.weakAgainst.length > 0)) {
    if (meta.strongAgainst.length > 0) {
      const strong = meta.strongAgainst[0]
      countersParagraphs.push(
        t('article.countersStrong', {
          name,
          opponent: opponentName ?? strong.opponentName ?? t('article.someOpponent'),
          wr: strong.winRate.toFixed(1),
          total: strong.totalBattles.toLocaleString(),
        }),
      )
    }
    if (meta.weakAgainst.length > 0) {
      const weak = meta.weakAgainst[0]
      countersParagraphs.push(
        t('article.countersWeak', {
          name,
          opponent: weakOpponentName ?? weak.opponentName ?? t('article.someOpponent'),
          wr: weak.winRate.toFixed(1),
          total: weak.totalBattles.toLocaleString(),
        }),
      )
    }
    countersParagraphs.push(t('article.countersClosing', { name }))
  } else {
    countersParagraphs.push(t('article.countersEmpty', { name }))
  }

  // ── Upgrades section ────────────────────────────────────────
  const upgradesParagraphs: string[] = []
  upgradesParagraphs.push(t('article.upgradesIntro', { name }))
  upgradesParagraphs.push(t('article.upgradesPriority', { name }))
  if (bestTeammateName) {
    upgradesParagraphs.push(
      t('article.upgradesTeammate', {
        name,
        teammate: bestTeammateName,
      }),
    )
  }

  // ── Weekly trend section ────────────────────────────────────
  const trendParagraphs: string[] = []
  const bucket = trendBucket(meta?.globalStats.trend7d)
  switch (bucket) {
    case 'rising':
      trendParagraphs.push(
        t('article.trendRising', {
          name,
          delta: (meta!.globalStats.trend7d as number).toFixed(1),
        }),
      )
      break
    case 'falling':
      trendParagraphs.push(
        t('article.trendFalling', {
          name,
          delta: Math.abs(meta!.globalStats.trend7d as number).toFixed(1),
        }),
      )
      break
    case 'stable':
      trendParagraphs.push(t('article.trendStable', { name }))
      break
    case 'unknown':
      trendParagraphs.push(t('article.trendNone', { name }))
      break
  }
  trendParagraphs.push(t('article.trendMethodology'))

  return {
    leadParagraphs,
    mapsParagraphs,
    countersParagraphs,
    upgradesParagraphs,
    trendParagraphs,
  }
}
