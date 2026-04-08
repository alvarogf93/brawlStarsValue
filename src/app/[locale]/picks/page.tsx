import { getTranslations } from 'next-intl/server'
import { PicksContent } from '@/components/picks/PicksContent'
import { createServiceClient } from '@/lib/supabase/server'
import { fetchEventRotation } from '@/lib/api'
import { isDraftMode, META_ROLLING_DAYS } from '@/lib/draft/constants'
import { bayesianWinRate } from '@/lib/draft/scoring'
import type { Metadata } from 'next'

export const revalidate = 1800 // ISR: 30 minutes

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'picks' })
  return {
    title: t('title') + ' | BrawlVision',
    description: t('subtitle'),
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

    const metaMap = new Map<string, Map<number, { wins: number; losses: number; total: number }>>()
    for (const row of rawStats ?? []) {
      const key = `${row.map}|${row.mode}`
      if (!metaMap.has(key)) metaMap.set(key, new Map())
      const bm = metaMap.get(key)!
      const existing = bm.get(row.brawler_id)
      if (existing) { existing.wins += row.wins; existing.losses += row.losses; existing.total += row.total }
      else bm.set(row.brawler_id, { wins: row.wins, losses: row.losses, total: row.total })
    }

    return draftEvents.map(event => {
      const key = `${event.event.map}|${event.event.mode}`
      const brawlers = metaMap.get(key)
      let topBrawlers: TopBrawler[] = []
      if (brawlers) {
        topBrawlers = Array.from(brawlers.entries())
          .map(([brawlerId, s]) => ({
            brawlerId,
            winRate: Math.round(bayesianWinRate(s.wins, s.total) * 10) / 10,
            pickCount: s.total,
          }))
          .sort((a, b) => b.winRate - a.winRate)
          .slice(0, 10)
      }
      const totalBattles = brawlers ? Array.from(brawlers.values()).reduce((sum, s) => sum + s.total, 0) : 0
      return {
        mode: event.event.mode, map: event.event.map, eventId: event.event.id,
        startTime: event.startTime, endTime: event.endTime, totalBattles, topBrawlers,
      }
    })
  } catch {
    return []
  }
}

export default async function PicksPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const events = await fetchMetaEvents()

  return <PicksContent events={events} locale={locale} />
}
