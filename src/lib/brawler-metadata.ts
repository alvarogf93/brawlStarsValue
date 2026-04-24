/**
 * Per-brawler SEO metadata: title + description for `/[locale]/brawler/[id]`.
 *
 * Existed before as a boilerplate English template shared by all 114 brawlers,
 * which Google was flagging as near-duplicate content — the pages ranked in
 * positions 40-70 with 0% CTR. This module:
 *   1. Aggregates the brawler's best mode/map + Bayesian WR from `meta_stats`.
 *   2. Renders a locale-specific description that includes the real stats,
 *      so every page has a unique, keyword-rich snippet.
 *   3. Falls back to a localized generic template when stats are missing
 *      (new brawler, cold-start data).
 */

import { createServiceClient } from '@/lib/supabase/server'
import { bayesianWinRate } from '@/lib/draft/scoring'
import { MODE_DISPLAY_NAMES } from '@/lib/constants'
import { META_ROLLING_DAYS } from '@/lib/draft/constants'

/** Minimum battles required before a (map, mode) is considered for the summary.
 *  Lower than the detail API's MIN_GAMES because here we only need ONE
 *  qualifying row for the description, not a ranked list. */
const MIN_BATTLES_FOR_SUMMARY = 10

export interface MetaStatRow {
  map: string
  mode: string
  wins: number
  total: number
}

export interface BrawlerMetaSummary {
  mode: string
  map: string
  /** Bayesian WR expressed 0-100 with 1 decimal. */
  winRate: number
  totalBattles: number
}

/**
 * Reduce raw `meta_stats` rows for a single brawler into the best (map, mode)
 * combination ranked by Bayesian WR. Pure — no I/O.
 */
export function aggregateBestMap(rows: MetaStatRow[]): BrawlerMetaSummary | null {
  if (!rows || rows.length === 0) return null

  const agg = new Map<string, { map: string; mode: string; wins: number; total: number }>()
  for (const r of rows) {
    const key = `${r.map}|${r.mode}`
    const existing = agg.get(key)
    if (existing) {
      existing.wins += r.wins
      existing.total += r.total
    } else {
      agg.set(key, { map: r.map, mode: r.mode, wins: r.wins, total: r.total })
    }
  }

  let best: BrawlerMetaSummary | null = null
  for (const a of agg.values()) {
    if (a.total < MIN_BATTLES_FOR_SUMMARY) continue
    const wr = bayesianWinRate(a.wins, a.total)
    if (!best || wr > best.winRate) {
      best = {
        mode: a.mode,
        map: a.map,
        winRate: Math.round(wr * 10) / 10,
        totalBattles: a.total,
      }
    }
  }
  return best
}

// ── Module-level cache ──────────────────────────────────────────
// Same pattern as `getBrawlerName` in brawler/[brawlerId]/layout.tsx —
// one fetch per brawler, TTL'd so stats refresh periodically. Fluid
// Compute reuses function instances, so cache hits dominate after
// the first call per brawler per instance.

const CACHE_TTL_MS = 6 * 60 * 60 * 1000 // 6 hours — aligned with brawler_trends pg_cron
const cache = new Map<number, { at: number; summary: BrawlerMetaSummary | null }>()

/** Reset the module cache. Test-only — production never calls this. */
export function __resetBrawlerMetadataCache(): void {
  cache.clear()
}

/**
 * Fetch aggregated best-map summary from Supabase. Returns null when
 * the brawler has no qualifying rows (new brawler, cold meta, or data
 * outage). The caller must gracefully fall back to a generic template.
 */
export async function fetchBrawlerMetaSummary(
  brawlerId: number,
  window: number = META_ROLLING_DAYS,
): Promise<BrawlerMetaSummary | null> {
  const cached = cache.get(brawlerId)
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return cached.summary
  }

  try {
    const supabase = await createServiceClient()
    const cutoff = new Date(Date.now() - window * 86400000).toISOString().slice(0, 10)
    const { data, error } = await supabase
      .from('meta_stats')
      .select('map, mode, wins, total')
      .eq('brawler_id', brawlerId)
      .gte('date', cutoff)

    if (error) {
      // Don't cache failures — retry next request.
      return null
    }
    const summary = aggregateBestMap((data ?? []) as MetaStatRow[])
    cache.set(brawlerId, { at: Date.now(), summary })
    return summary
  } catch {
    // Network/service outage — don't block metadata generation.
    return null
  }
}

// ── Localized templates ─────────────────────────────────────────
// Plain Spanish is the default locale (es). Unknown locales fall back
// to English because that has the widest ASCII compatibility for
// snippet preview when the search engine can't detect the page lang.

type Template = (vars: { name: string; mode: string; map: string; wr: number }) => string
type TemplateGeneric = (vars: { name: string }) => string

/** Template when we HAVE meta_stats data for the brawler. */
const DESCRIPTION_WITH_DATA: Record<string, Template> = {
  es: ({ name, mode, map, wr }) =>
    `${name}: ${wr}% de WR en ${mode} (${map}). Mejores mapas, counters y matchups — con historial completo de tus partidas con ${name} en BrawlVision.`,
  en: ({ name, mode, map, wr }) =>
    `${name}: ${wr}% WR in ${mode} (${map}). Best maps, counters and matchups — plus unlimited battle history with ${name} on BrawlVision.`,
  fr: ({ name, mode, map, wr }) =>
    `${name} : ${wr}% de WR en ${mode} (${map}). Meilleures cartes, counters et matchups — avec l'historique complet de vos parties avec ${name} sur BrawlVision.`,
  pt: ({ name, mode, map, wr }) =>
    `${name}: ${wr}% de WR em ${mode} (${map}). Melhores mapas, counters e matchups — com histórico completo das suas partidas com ${name} no BrawlVision.`,
  de: ({ name, mode, map, wr }) =>
    `${name}: ${wr}% WR in ${mode} (${map}). Beste Maps, Counter und Matchups — mit unbegrenztem Kampfverlauf für ${name} auf BrawlVision.`,
  it: ({ name, mode, map, wr }) =>
    `${name}: ${wr}% WR in ${mode} (${map}). Migliori mappe, counter e matchup — con cronologia completa delle tue battaglie con ${name} su BrawlVision.`,
  ru: ({ name, mode, map, wr }) =>
    `${name}: винрейт ${wr}% в ${mode} (${map}). Лучшие карты, контры и матчапы — с полной историей твоих боёв за ${name} на BrawlVision.`,
  tr: ({ name, mode, map, wr }) =>
    `${name}: ${mode} modunda %${wr} WR (${map}). En iyi haritalar, counter ve eşleşmeler — ${name} ile tam savaş geçmişin BrawlVision'da.`,
  pl: ({ name, mode, map, wr }) =>
    `${name}: ${wr}% WR w ${mode} (${map}). Najlepsze mapy, countery i matchupy — oraz pełna historia walk z ${name} na BrawlVision.`,
  ar: ({ name, mode, map, wr }) =>
    `${name}: معدل فوز ${wr}% في ${mode} (${map}). أفضل الخرائط، الكاونترز والمواجهات — مع السجل الكامل لمعاركك بـ${name} على BrawlVision.`,
  ko: ({ name, mode, map, wr }) =>
    `${name}: ${mode} (${map}) 승률 ${wr}%. 최적 맵, 카운터, 상성 데이터 — BrawlVision에서 ${name}의 모든 전투 기록 확인.`,
  ja: ({ name, mode, map, wr }) =>
    `${name}: ${mode} (${map}) で勝率 ${wr}%。ベストマップ、カウンター、相性データ — ${name} の全戦闘履歴を BrawlVision で。`,
  zh: ({ name, mode, map, wr }) =>
    `${name}：在 ${mode} (${map}) 胜率 ${wr}%。最佳地图、克制关系和对局数据 — BrawlVision 保存你所有 ${name} 战斗记录。`,
}

/** Template when we DON'T have meta_stats data (new brawler, cold start). */
const DESCRIPTION_GENERIC: Record<string, TemplateGeneric> = {
  es: ({ name }) =>
    `${name} en Brawl Stars: win rate, mejores mapas, counters y matchups. Guarda tu historial completo de partidas con ${name} en BrawlVision.`,
  en: ({ name }) =>
    `${name} in Brawl Stars: win rate, best maps, counters and matchups. Save your unlimited battle history with ${name} on BrawlVision.`,
  fr: ({ name }) =>
    `${name} dans Brawl Stars : WR, meilleures cartes, counters et matchups. Gardez l'historique complet de vos parties avec ${name} sur BrawlVision.`,
  pt: ({ name }) =>
    `${name} no Brawl Stars: WR, melhores mapas, counters e matchups. Guarde o histórico completo das suas partidas com ${name} no BrawlVision.`,
  de: ({ name }) =>
    `${name} in Brawl Stars: WR, beste Maps, Counter und Matchups. Speichere deinen unbegrenzten Kampfverlauf mit ${name} auf BrawlVision.`,
  it: ({ name }) =>
    `${name} in Brawl Stars: WR, migliori mappe, counter e matchup. Conserva la cronologia completa delle tue battaglie con ${name} su BrawlVision.`,
  ru: ({ name }) =>
    `${name} в Brawl Stars: винрейт, лучшие карты, контры и матчапы. Сохрани полную историю боёв за ${name} на BrawlVision.`,
  tr: ({ name }) =>
    `${name} Brawl Stars'ta: WR, en iyi haritalar, counter ve eşleşmeler. ${name} ile tam savaş geçmişini BrawlVision'da sakla.`,
  pl: ({ name }) =>
    `${name} w Brawl Stars: WR, najlepsze mapy, countery i matchupy. Zachowaj pełną historię walk z ${name} na BrawlVision.`,
  ar: ({ name }) =>
    `${name} في Brawl Stars: معدل الفوز، أفضل الخرائط، الكاونترز والمواجهات. احفظ السجل الكامل لمعاركك بـ${name} على BrawlVision.`,
  ko: ({ name }) =>
    `Brawl Stars의 ${name}: 승률, 최적 맵, 카운터, 상성. BrawlVision에서 ${name}의 모든 전투 기록을 저장하세요.`,
  ja: ({ name }) =>
    `Brawl Stars の ${name}：勝率、ベストマップ、カウンター、相性データ。${name} の全戦闘履歴を BrawlVision に保存。`,
  zh: ({ name }) =>
    `Brawl Stars 中的 ${name}：胜率、最佳地图、克制关系和对局数据。在 BrawlVision 保存你所有 ${name} 战斗记录。`,
}

/** Localized `<title>` for the brawler detail page. */
const TITLE: Record<string, (name: string) => string> = {
  es: (n) => `${n} — Stats, Mejores Mapas y Counters | BrawlVision`,
  en: (n) => `${n} — Stats, Best Maps & Counters | BrawlVision`,
  fr: (n) => `${n} — Stats, Meilleures Cartes et Counters | BrawlVision`,
  pt: (n) => `${n} — Stats, Melhores Mapas e Counters | BrawlVision`,
  de: (n) => `${n} — Stats, Beste Maps & Counter | BrawlVision`,
  it: (n) => `${n} — Stats, Migliori Mappe e Counter | BrawlVision`,
  ru: (n) => `${n} — Статистика, Лучшие Карты и Контры | BrawlVision`,
  tr: (n) => `${n} — İstatistikler, En İyi Haritalar ve Counterlar | BrawlVision`,
  pl: (n) => `${n} — Statystyki, Najlepsze Mapy i Countery | BrawlVision`,
  ar: (n) => `${n} — إحصائيات، أفضل الخرائط والكاونترز | BrawlVision`,
  ko: (n) => `${n} — 스탯, 최적 맵과 카운터 | BrawlVision`,
  ja: (n) => `${n} — スタッツ、ベストマップ、カウンター | BrawlVision`,
  zh: (n) => `${n} — 数据、最佳地图和克制 | BrawlVision`,
}

function fallbackLocale(locale: string): string {
  return locale in TITLE ? locale : 'en'
}

/** Build the localized `<title>` for a brawler detail page. */
export function buildBrawlerMetaTitle(locale: string, name: string): string {
  const l = fallbackLocale(locale)
  return TITLE[l](name)
}

/** Build the localized `<meta description>` for a brawler detail page. */
export function buildBrawlerMetaDescription(
  locale: string,
  name: string,
  summary: BrawlerMetaSummary | null,
): string {
  const l = fallbackLocale(locale)
  if (summary) {
    const modeDisplay = MODE_DISPLAY_NAMES[summary.mode] ?? summary.mode
    return DESCRIPTION_WITH_DATA[l]({
      name,
      mode: modeDisplay,
      map: summary.map,
      wr: summary.winRate,
    })
  }
  return DESCRIPTION_GENERIC[l]({ name })
}

/** All locales supported by the metadata helpers. Exported so tests
 *  can assert every locale is covered without hardcoding a separate list. */
export const SUPPORTED_LOCALES = Object.keys(TITLE) as ReadonlyArray<string>
