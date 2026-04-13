import { getTranslations } from 'next-intl/server'
import { PicksContent } from '@/components/picks/PicksContent'
import { createServiceClient } from '@/lib/supabase/server'
import { fetchEventRotation } from '@/lib/api'
import { isDraftMode, META_ROLLING_DAYS } from '@/lib/draft/constants'
import { bayesianWinRate } from '@/lib/draft/scoring'
import type { Metadata } from 'next'

export const revalidate = 1800 // ISR: 30 minutes

const BASE_URL = 'https://brawlvision.com'
const LOCALES = ['es', 'en', 'fr', 'pt', 'de', 'it', 'ru', 'tr', 'pl', 'ar', 'ko', 'ja', 'zh']

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'picks' })
  const languages: Record<string, string> = { 'x-default': `${BASE_URL}/es/picks` }
  for (const loc of LOCALES) {
    languages[loc] = `${BASE_URL}/${loc}/picks`
  }
  return {
    title: t('title') + ' | BrawlVision',
    description: t('subtitle'),
    alternates: {
      canonical: `${BASE_URL}/${locale}/picks`,
      languages,
    },
    openGraph: {
      title: t('title') + ' | BrawlVision',
      description: t('subtitle'),
      url: `${BASE_URL}/${locale}/picks`,
    },
  }
}

interface TopBrawler {
  brawlerId: number
  winRate: number
  pickCount: number
}

interface MetaEvent {
  mode: string
  map: string
  eventId: number
  startTime: string
  endTime: string
  totalBattles: number
  topBrawlers: TopBrawler[]
  source?: 'map-mode' | 'mode-fallback'
}

async function fetchMetaEvents(): Promise<MetaEvent[]> {
  try {
    const events = await fetchEventRotation()
    const draftEvents = events.filter(e => isDraftMode(e.event.mode))
    if (draftEvents.length === 0) return []

    const supabase = await createServiceClient()
    const cutoffDate = new Date(Date.now() - META_ROLLING_DAYS * 86400000).toISOString().slice(0, 10)
    const mapNames = [...new Set(draftEvents.map(e => e.event.map))]

    const { data: rawStats } = await supabase
      .from('meta_stats')
      .select('brawler_id, map, mode, wins, losses, total')
      .eq('source', 'global')
      .gte('date', cutoffDate)
      .in('map', mapNames)

    // Tier 1: aggregate per (map, mode)
    type AggStat = { wins: number; losses: number; total: number }
    const metaMap = new Map<string, Map<number, AggStat>>()
    for (const row of rawStats ?? []) {
      const key = `${row.map}|${row.mode}`
      if (!metaMap.has(key)) metaMap.set(key, new Map())
      const bm = metaMap.get(key)!
      const existing = bm.get(row.brawler_id)
      if (existing) { existing.wins += row.wins; existing.losses += row.losses; existing.total += row.total }
      else bm.set(row.brawler_id, { wins: row.wins, losses: row.losses, total: row.total })
    }

    // Detect sparse maps and collect their modes for Tier 2 fallback
    // A map is "sparse" if the sum of all its brawler totals is below
    // SPARSE_THRESHOLD. Collect distinct modes with at least one sparse map
    // so we can issue ONE batch Tier 2 query.
    const SPARSE_THRESHOLD = 30
    const sparseModes = new Set<string>()
    for (const event of draftEvents) {
      const key = `${event.event.map}|${event.event.mode}`
      const brawlers = metaMap.get(key)
      const total = brawlers
        ? Array.from(brawlers.values()).reduce((s, b) => s + b.total, 0)
        : 0
      if (total < SPARSE_THRESHOLD) {
        sparseModes.add(event.event.mode)
      }
    }

    // Tier 2: batch fallback query (one round-trip, mode-only)
    const modeFallback = new Map<string, Map<number, AggStat>>()
    if (sparseModes.size > 0) {
      const { data: modeStats } = await supabase
        .from('meta_stats')
        .select('brawler_id, mode, wins, losses, total')
        .eq('source', 'global')
        .gte('date', cutoffDate)
        .in('mode', Array.from(sparseModes))

      for (const row of modeStats ?? []) {
        if (!modeFallback.has(row.mode)) modeFallback.set(row.mode, new Map())
        const bm = modeFallback.get(row.mode)!
        const existing = bm.get(row.brawler_id)
        if (existing) { existing.wins += row.wins; existing.losses += row.losses; existing.total += row.total }
        else bm.set(row.brawler_id, { wins: row.wins, losses: row.losses, total: row.total })
      }
    }

    return draftEvents.map(event => {
      const key = `${event.event.map}|${event.event.mode}`
      let brawlers = metaMap.get(key)
      let totalBattles = brawlers
        ? Array.from(brawlers.values()).reduce((sum, s) => sum + s.total, 0)
        : 0
      let source: 'map-mode' | 'mode-fallback' = 'map-mode'

      // Fallback if this specific map is sparse
      if (totalBattles < SPARSE_THRESHOLD) {
        const fallback = modeFallback.get(event.event.mode)
        if (fallback && fallback.size > 0) {
          brawlers = fallback
          totalBattles = Array.from(fallback.values()).reduce((sum, s) => sum + s.total, 0)
          source = 'mode-fallback'
        }
      }

      let topBrawlers: TopBrawler[] = []
      if (brawlers && brawlers.size > 0) {
        topBrawlers = Array.from(brawlers.entries())
          .map(([brawlerId, s]) => ({
            brawlerId,
            winRate: Math.round(bayesianWinRate(s.wins, s.total) * 10) / 10,
            pickCount: s.total,
          }))
          .sort((a, b) => b.winRate - a.winRate)
          .slice(0, 10)
      }

      return {
        mode: event.event.mode,
        map: event.event.map,
        eventId: event.event.id,
        startTime: event.startTime,
        endTime: event.endTime,
        totalBattles,
        topBrawlers,
        source,
      }
    })
  } catch {
    return []
  }
}

export default async function PicksPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const allEvents = await fetchMetaEvents()
  // Only show maps that have actual data
  const events = allEvents.filter(e => e.topBrawlers.length > 0)

  return <PicksContent events={events} locale={locale} />
}
