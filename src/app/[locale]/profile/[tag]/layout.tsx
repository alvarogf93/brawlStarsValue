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

  return {
    title: `Player #${cleanTag.toUpperCase()} Stats`,
    description: `Brawl Stars stats, battle analytics, win rates and gem value for player #${cleanTag.toUpperCase()} on BrawlVision.`,
    alternates: {
      canonical: `${BASE_URL}/${locale}/profile/${encodedTag}`,
      languages,
    },
    openGraph: {
      title: `#${cleanTag.toUpperCase()} — BrawlVision Stats`,
      description: `Detailed brawler stats, win rates, and analytics for #${cleanTag.toUpperCase()}`,
      url: `${BASE_URL}/${locale}/profile/${encodedTag}`,
    },
  }
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <DashboardLayoutClient>{children}</DashboardLayoutClient>
}
