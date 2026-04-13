import type { MetadataRoute } from 'next'
import { BRAWLER_RARITY_MAP } from '@/lib/constants'

const BASE_URL = 'https://brawlvision.com'
const LOCALES = ['es', 'en', 'fr', 'pt', 'de', 'it', 'ru', 'tr', 'pl', 'ar', 'ko', 'ja', 'zh']

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Only high-value public pages go in the sitemap. Profiles and
  // /privacy are noindex (see their layout.tsx files), so there's
  // no point advertising them to Google. Profile URLs used to be
  // here (100 × 13 locales = 1300 entries) which bloated the
  // sitemap and produced the "Discovered, currently not indexed"
  // noise in Search Console — removing them cuts the sitemap
  // down to ~70 entries total (5 pages × 13 locales + brawler
  // details × 13 locales), all of which are content Google
  // actually wants to rank.
  const pages: Array<{ path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[0]['changeFrequency'] }> = [
    { path: '', priority: 1, changeFrequency: 'daily' },
    { path: '/leaderboard', priority: 0.8, changeFrequency: 'hourly' },
    { path: '/picks', priority: 0.8, changeFrequency: 'hourly' },
    { path: '/brawler', priority: 0.9, changeFrequency: 'weekly' },
  ]

  const entries: MetadataRoute.Sitemap = []

  // Static pages × locales
  for (const page of pages) {
    for (const locale of LOCALES) {
      const url = `${BASE_URL}/${locale}${page.path}`
      const alternates: Record<string, string> = {
        'x-default': `${BASE_URL}/es${page.path}`,
      }
      for (const alt of LOCALES) {
        alternates[alt] = `${BASE_URL}/${alt}${page.path}`
      }

      entries.push({
        url,
        lastModified: new Date(),
        changeFrequency: page.changeFrequency,
        priority: page.priority,
        alternates: { languages: alternates },
      })
    }
  }

  // Brawler detail pages (public, ~100+ brawlers × 13 locales)
  const brawlerIds = Object.keys(BRAWLER_RARITY_MAP).map(Number)
  for (const brawlerId of brawlerIds) {
    for (const locale of LOCALES) {
      const alternates: Record<string, string> = {
        'x-default': `${BASE_URL}/es/brawler/${brawlerId}`,
      }
      for (const alt of LOCALES) {
        alternates[alt] = `${BASE_URL}/${alt}/brawler/${brawlerId}`
      }
      entries.push({
        url: `${BASE_URL}/${locale}/brawler/${brawlerId}`,
        lastModified: new Date(),
        changeFrequency: 'weekly',
        priority: 0.6,
        alternates: { languages: alternates },
      })
    }
  }

  // Sprint D 2026-04-13: player profile URLs have been removed
  // from the sitemap entirely. Profile pages are now noindex via
  // their layout's metadata.robots, so advertising them in the
  // sitemap would contradict the noindex directive and waste
  // Google's crawl budget. The previous 500-then-100 player cap
  // was a half-fix — this is the full one.

  return entries
}
