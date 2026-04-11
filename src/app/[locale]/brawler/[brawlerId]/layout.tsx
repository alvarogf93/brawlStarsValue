import type { Metadata } from 'next'

const BASE_URL = 'https://brawlvision.com'
const LOCALES = ['es', 'en', 'fr', 'pt', 'de', 'it', 'ru', 'tr', 'pl', 'ar', 'ko', 'ja', 'zh']

// Server-side cache for brawler names (fetched once per build/deploy)
let brawlerNameCache: Map<number, string> | null = null

async function getBrawlerName(id: number): Promise<string> {
  if (!brawlerNameCache) {
    try {
      const res = await fetch('https://api.brawlapi.com/v1/brawlers', { next: { revalidate: 86400 } })
      if (res.ok) {
        const data = await res.json()
        const list = data.list ?? data
        brawlerNameCache = new Map()
        for (const b of list) {
          brawlerNameCache.set(b.id, b.name)
        }
      }
    } catch { /* fallback below */ }
  }
  return brawlerNameCache?.get(id) ?? `Brawler ${id}`
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; brawlerId: string }>
}): Promise<Metadata> {
  const { locale, brawlerId } = await params
  const id = parseInt(brawlerId, 10)
  const name = await getBrawlerName(id)

  const title = `${name} — Stats, Best Maps & Counters | BrawlVision`
  const description = `${name} win rate, best maps, counters, and matchups in Brawl Stars. Data from pro players.`

  const languages: Record<string, string> = { 'x-default': `${BASE_URL}/es/brawler/${id}` }
  for (const l of LOCALES) languages[l] = `${BASE_URL}/${l}/brawler/${id}`

  return {
    title,
    description,
    openGraph: {
      title: `${name} — Brawl Stars Stats | BrawlVision`,
      description,
      url: `${BASE_URL}/${locale}/brawler/${id}`,
      images: [{ url: `https://cdn.brawlify.com/brawler/${id}/avatar.png`, width: 200, height: 200, alt: name }],
    },
    twitter: {
      card: 'summary',
      title: `${name} Stats | BrawlVision`,
      description,
      images: [`https://cdn.brawlify.com/brawler/${id}/avatar.png`],
    },
    alternates: {
      canonical: `${BASE_URL}/${locale}/brawler/${id}`,
      languages,
    },
  }
}

export default function BrawlerLayout({ children }: { children: React.ReactNode }) {
  return children
}
