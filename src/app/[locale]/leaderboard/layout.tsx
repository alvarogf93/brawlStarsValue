import type { Metadata } from 'next'

const BASE_URL = 'https://brawlvision.com'
const LOCALES = ['es', 'en', 'fr', 'pt', 'de', 'it', 'ru', 'tr', 'pl', 'ar', 'ko', 'ja', 'zh']

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  const languages: Record<string, string> = {}
  for (const loc of LOCALES) {
    languages[loc] = `${BASE_URL}/${loc}/leaderboard`
  }

  return {
    title: 'Global Leaderboard',
    description: 'Top Brawl Stars players ranked by Gem Value. Global and country leaderboards with real-time stats.',
    alternates: {
      canonical: `${BASE_URL}/${locale}/leaderboard`,
      languages,
    },
    openGraph: {
      title: 'Global Leaderboard | BrawlVision',
      description: 'Who has the most valuable Brawl Stars account? Check the global & local rankings.',
      url: `${BASE_URL}/${locale}/leaderboard`,
    },
  }
}

export default function LeaderboardLayout({ children }: { children: React.ReactNode }) {
  return children
}
