import type { MetadataRoute } from 'next'

const locales = ['es', 'en']

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://brawlvalue.com'
  const pages = ['', '/leaderboard']
  const entries: MetadataRoute.Sitemap = []

  for (const locale of locales) {
    for (const page of pages) {
      entries.push({
        url: `${baseUrl}/${locale}${page}`,
        lastModified: new Date(),
        changeFrequency: 'daily',
        priority: page === '' ? 1 : 0.8,
      })
    }
  }

  return entries
}
