import type { MetadataRoute } from 'next'

const BASE_URL = 'https://brawlvision.com'
const LOCALES = ['es', 'en', 'fr', 'pt', 'de', 'it', 'ru', 'tr', 'pl', 'ar', 'ko', 'ja', 'zh']

export default function sitemap(): MetadataRoute.Sitemap {
  const pages: Array<{ path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[0]['changeFrequency'] }> = [
    { path: '', priority: 1, changeFrequency: 'daily' },
    { path: '/leaderboard', priority: 0.8, changeFrequency: 'hourly' },
    { path: '/privacy', priority: 0.3, changeFrequency: 'monthly' },
  ]

  const entries: MetadataRoute.Sitemap = []

  for (const page of pages) {
    for (const locale of LOCALES) {
      const url = `${BASE_URL}/${locale}${page.path}`
      const alternates: Record<string, string> = {}
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

  return entries
}
