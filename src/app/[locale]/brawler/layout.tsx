import type { Metadata } from 'next'

const BASE_URL = 'https://brawlvision.com'
const LOCALES = ['es', 'en', 'fr', 'pt', 'de', 'it', 'ru', 'tr', 'pl', 'ar', 'ko', 'ja', 'zh']

/**
 * Metadata for the brawler INDEX page (`/[locale]/brawler`).
 *
 * Without this layout, the index page (a client component that can't
 * export `generateMetadata` itself) inherits the canonical from the
 * root `[locale]/layout.tsx`, which points at `/[locale]` (the
 * landing). Google then treats every brawler-index URL as a duplicate
 * of the landing and indexes only one of them — reported as
 * "Duplicada: el usuario no ha indicado ninguna versión canónica" in
 * Search Console (Sprint D 2026-04-13).
 *
 * The brawler DETAIL page (`/[locale]/brawler/[brawlerId]`) has its
 * own `[brawlerId]/layout.tsx` that overrides this metadata with a
 * brawler-specific canonical, so this layout does NOT affect detail
 * pages.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params

  const languages: Record<string, string> = {
    'x-default': `${BASE_URL}/es/brawler`,
  }
  for (const loc of LOCALES) {
    languages[loc] = `${BASE_URL}/${loc}/brawler`
  }

  const titles: Record<string, string> = {
    es: 'Todos los Brawlers de Brawl Stars — Stats, Counters y Mejores Mapas | BrawlVision',
    en: 'All Brawl Stars Brawlers — Stats, Counters & Best Maps | BrawlVision',
    fr: 'Tous les Brawlers de Brawl Stars — Stats, Counters & Meilleures Maps | BrawlVision',
    pt: 'Todos os Brawlers de Brawl Stars — Stats, Counters e Melhores Mapas | BrawlVision',
    de: 'Alle Brawl Stars Brawler — Stats, Counter & Beste Karten | BrawlVision',
  }

  const descriptions: Record<string, string> = {
    es: 'Explora los más de 100 brawlers de Brawl Stars con sus stats, counters, mejores mapas y meta PRO. Datos actualizados de los top 200 jugadores globales.',
    en: 'Browse all 100+ Brawl Stars brawlers with stats, counters, best maps and PRO meta. Live data from the top 200 global players.',
    fr: 'Découvre tous les Brawlers de Brawl Stars avec stats, counters, meilleures maps et méta PRO.',
    pt: 'Explore todos os Brawlers de Brawl Stars com stats, counters, melhores mapas e meta PRO.',
    de: 'Entdecke alle Brawl Stars Brawler mit Stats, Counters, besten Karten und PRO Meta.',
  }

  return {
    title: titles[locale] ?? titles.en,
    description: descriptions[locale] ?? descriptions.en,
    alternates: {
      canonical: `${BASE_URL}/${locale}/brawler`,
      languages,
    },
    openGraph: {
      title: titles[locale] ?? titles.en,
      description: descriptions[locale] ?? descriptions.en,
      url: `${BASE_URL}/${locale}/brawler`,
    },
  }
}

export default function BrawlerLayout({ children }: { children: React.ReactNode }) {
  return children
}
