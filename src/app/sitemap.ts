import type { MetadataRoute } from 'next'
import { createServerClient } from '@supabase/ssr'

const BASE_URL = 'https://brawlvision.com'
const LOCALES = ['es', 'en', 'fr', 'pt', 'de', 'it', 'ru', 'tr', 'pl', 'ar', 'ko', 'ja', 'zh']

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const pages: Array<{ path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[0]['changeFrequency'] }> = [
    { path: '', priority: 1, changeFrequency: 'daily' },
    { path: '/leaderboard', priority: 0.8, changeFrequency: 'hourly' },
    { path: '/picks', priority: 0.8, changeFrequency: 'hourly' },
    { path: '/privacy', priority: 0.3, changeFrequency: 'monthly' },
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

  // Dynamic: player profiles from DB (recently active users)
  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { cookies: { getAll: () => [], setAll: () => {} } },
    )

    const { data: profiles } = await supabase
      .from('profiles')
      .select('player_tag')
      .not('last_sync', 'is', null)
      .order('last_sync', { ascending: false })
      .limit(500)

    if (profiles) {
      for (const { player_tag } of profiles) {
        const encodedTag = encodeURIComponent(player_tag)
        for (const locale of LOCALES) {
          const alternates: Record<string, string> = {
            'x-default': `${BASE_URL}/es/profile/${encodedTag}`,
          }
          for (const alt of LOCALES) {
            alternates[alt] = `${BASE_URL}/${alt}/profile/${encodedTag}`
          }
          entries.push({
            url: `${BASE_URL}/${locale}/profile/${encodedTag}`,
            lastModified: new Date(),
            changeFrequency: 'daily',
            priority: 0.7,
            alternates: { languages: alternates },
          })
        }
      }
    }
  } catch {
    // If DB is unreachable, continue with static pages only
  }

  return entries
}
