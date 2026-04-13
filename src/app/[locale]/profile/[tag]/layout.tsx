import type { Metadata } from 'next'
import { DashboardLayoutClient } from './DashboardLayoutClient'

const BASE_URL = 'https://brawlvision.com'
const LOCALES = ['es', 'en', 'fr', 'pt', 'de', 'it', 'ru', 'tr', 'pl', 'ar', 'ko', 'ja', 'zh']

export async function generateMetadata({ params }: { params: Promise<{ tag: string; locale: string }> }): Promise<Metadata> {
  const { tag, locale } = await params
  const cleanTag = decodeURIComponent(tag).replace('#', '')
  const encodedTag = encodeURIComponent(`#${cleanTag.toUpperCase()}`)

  const languages: Record<string, string> = { 'x-default': `${BASE_URL}/es/profile/${encodedTag}` }
  for (const loc of LOCALES) {
    languages[loc] = `${BASE_URL}/${loc}/profile/${encodedTag}`
  }

  // Try to fetch real player data for richer metadata
  let playerName = ''
  let trophies = 0
  let brawlerCount = 0
  try {
    const apiUrl = process.env.BRAWLSTARS_API_URL || 'http://141.253.197.60:3001/v1'
    const res = await fetch(`${apiUrl}/players/${encodedTag}`, {
      headers: process.env.BRAWLSTARS_API_KEY
        ? { Authorization: `Bearer ${process.env.BRAWLSTARS_API_KEY}` }
        : {},
      next: { revalidate: 3600 },
    })
    if (res.ok) {
      const data = await res.json()
      playerName = data.name || ''
      trophies = data.trophies || 0
      brawlerCount = data.brawlers?.length || 0
    }
  } catch {
    // Fallback to generic metadata
  }

  const titleBase = playerName
    ? `${playerName} (#${cleanTag.toUpperCase()}) — ${trophies.toLocaleString()} Trophies`
    : `Player #${cleanTag.toUpperCase()} Stats`

  const descBase = playerName
    ? `Brawl Stars stats for ${playerName}. ${trophies.toLocaleString()} trophies, ${brawlerCount} brawlers. Battle analytics, win rates and gem value on BrawlVision.`
    : `Brawl Stars stats, battle analytics, win rates and gem value for player #${cleanTag.toUpperCase()} on BrawlVision.`

  return {
    title: titleBase,
    description: descBase,
    // All player profile pages (root and every sub-route under
    // /profile/[tag]) are noindex. Indexing player-specific pages
    // produces ~13 near-identical locale duplicates per player,
    // each of which is thin content (just aggregated stats), so
    // they hurt Google's view of the site more than they help:
    //   - Crawl budget wasted on low-value pages
    //   - Risk of "thin content" flags
    //   - Real valuable pages (brawler details, picks, leaderboard)
    //     compete with them for crawl priority
    // Users can still share direct links and the pages work
    // perfectly — they just don't show in Google results.
    robots: { index: false, follow: true },
    alternates: {
      canonical: `${BASE_URL}/${locale}/profile/${encodedTag}`,
      languages,
    },
    openGraph: {
      title: `${playerName || `#${cleanTag.toUpperCase()}`} — BrawlVision Stats`,
      description: descBase,
      url: `${BASE_URL}/${locale}/profile/${encodedTag}`,
    },
  }
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <DashboardLayoutClient>{children}</DashboardLayoutClient>
}
