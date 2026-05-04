import { getTranslations } from 'next-intl/server'
import { PicksContent } from '@/components/picks/PicksContent'
import { createServiceClient } from '@/lib/supabase/server'
import { fetchEventRotation } from '@/lib/api'
import { isDraftMode } from '@/lib/draft/constants'
import { buildEventsWithCascade, type MetaEventResult } from '@/lib/meta/cascade'
import { filterRegularRotation } from '@/lib/meta/rotation-filter'
import type { Metadata } from 'next'

export const revalidate = 1800 // ISR: 30 minutes

const BASE_URL = 'https://brawlvision.com'
const LOCALES = ['es', 'en', 'fr', 'pt', 'de', 'it', 'ru', 'tr', 'pl', 'ar', 'ko', 'ja', 'zh']

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'picks' })
  const languages: Record<string, string> = { 'x-default': `${BASE_URL}/es/picks` }
  for (const loc of LOCALES) {
    languages[loc] = `${BASE_URL}/${loc}/picks`
  }
  return {
    title: t('title') + ' | BrawlVision',
    description: t('subtitle'),
    alternates: {
      canonical: `${BASE_URL}/${locale}/picks`,
      languages,
    },
    openGraph: {
      title: t('title') + ' | BrawlVision',
      description: t('subtitle'),
      url: `${BASE_URL}/${locale}/picks`,
    },
  }
}

async function fetchMetaEvents(): Promise<MetaEventResult[]> {
  try {
    const events = await fetchEventRotation()
    // Drop ranked / extended slots (216h) and short specials (2h) so
    // the public picks page only shows the maps the player actually
    // sees in the regular game tab. Same dedup helper as MapSelector.
    // Bug 2026-05-04 — see rotation-filter.ts header.
    const draftEvents = filterRegularRotation(events).filter(e => isDraftMode(e.event.mode))
    if (draftEvents.length === 0) return []

    const supabase = await createServiceClient()
    return await buildEventsWithCascade(supabase, draftEvents)
  } catch {
    // Public page — fail open with no events. The empty branch in
    // PicksContent is already designed to render a neutral state.
    return []
  }
}

export default async function PicksPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const allEvents = await fetchMetaEvents()
  // Only show maps that have actual data
  const events = allEvents.filter(e => e.topBrawlers.length > 0)

  return <PicksContent events={events} locale={locale} />
}
