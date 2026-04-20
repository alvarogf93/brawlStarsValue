import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { compute7dTrend } from '@/lib/brawler-detail/trend'

/**
 * GET /api/meta/brawler-trends
 *
 * Bulk endpoint: returns the 7-day WR trend delta for EVERY brawler
 * that has meta_stats in the last 14 days, in a single response.
 * The `/brawlers` roster page uses this to offer a "sort by trend"
 * option and show a mini-badge per card without fanning out one
 * request per brawler (that would be 100+ requests).
 *
 * Payload shape: { trends: { "<brawlerId>": number | null } }
 *
 * Size: ~100 brawlers × ~10 bytes = ~1 KB compressed. The source
 * query pulls ~10k rows (14 days × ~200 brawler-map combinations)
 * which is ~64 KB JSON — fine for a single server-side request
 * but we don't want clients doing it.
 *
 * Caching: ISR 5 minutes. The trend moves on a days scale, so
 * 5-minute staleness is imperceptible and protects Supabase from
 * repeated scans on every visitor hit.
 */

export const revalidate = 300 // 5 minutes

type Row = { brawler_id: number; date: string; wins: number; total: number }

export async function GET() {
  const supabase = await createServiceClient()
  const cutoff = new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10)

  const { data: rows, error } = await supabase
    .from('meta_stats')
    .select('brawler_id, date, wins, total')
    .gte('date', cutoff)

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch meta stats' }, { status: 500 })
  }

  // Group by brawler_id, then run compute7dTrend per group.
  const grouped = new Map<number, Row[]>()
  for (const r of (rows ?? []) as Row[]) {
    const existing = grouped.get(r.brawler_id)
    if (existing) existing.push(r)
    else grouped.set(r.brawler_id, [r])
  }

  const trends: Record<string, number | null> = {}
  for (const [brawlerId, group] of grouped) {
    trends[String(brawlerId)] = compute7dTrend(group)
  }

  return NextResponse.json({ trends })
}
