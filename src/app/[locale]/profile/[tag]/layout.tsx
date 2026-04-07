import type { Metadata } from 'next'
import { DashboardLayoutClient } from './DashboardLayoutClient'

const BASE_URL = 'https://brawlvision.com'
const LOCALES = ['es', 'en', 'fr', 'pt', 'de', 'it', 'ru', 'tr', 'pl', 'ar', 'ko', 'ja', 'zh']

export async function generateMetadata({ params }: { params: Promise<{ tag: string; locale: string }> }): Promise<Metadata> {
  const { tag, locale } = await params
  const cleanTag = decodeURIComponent(tag).replace('#', '')
  const encodedTag = encodeURIComponent(`#${cleanTag.toUpperCase()}`)

  const languages: Record<string, string> = {}
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
