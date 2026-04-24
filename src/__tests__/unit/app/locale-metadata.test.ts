import { describe, it, expect } from 'vitest'
import { generateMetadata } from '@/app/[locale]/layout'

const LOCALES = ['es', 'en', 'fr', 'pt', 'de', 'it', 'ru', 'tr', 'pl', 'ar', 'ko', 'ja', 'zh']

async function meta(locale: string) {
  return generateMetadata({ params: Promise.resolve({ locale }) })
}

describe('[locale]/layout generateMetadata', () => {
  it('produces a non-empty title + description for every supported locale', async () => {
    for (const locale of LOCALES) {
      const m = await meta(locale)
      expect(m.title).toBeTruthy()
      expect(m.description).toBeTruthy()
    }
  })

  it('produces a distinct description per locale (no English fallback leak)', async () => {
    const descriptions = new Set<string>()
    for (const locale of LOCALES) {
      const m = await meta(locale)
      descriptions.add(String(m.description))
    }
    expect(descriptions.size).toBe(LOCALES.length)
  })

  it('localizes the openGraph title + description for every locale', async () => {
    for (const locale of LOCALES) {
      const m = await meta(locale)
      const ogTitle = m.openGraph?.title
      const ogDesc = m.openGraph?.description
      expect(ogTitle).toBe(m.title && typeof m.title === 'object' && 'absolute' in m.title ? m.title.absolute : m.title)
      expect(ogDesc).toBe(m.description)
    }
  })

  it('localizes the twitter title + description for every locale', async () => {
    for (const locale of LOCALES) {
      const m = await meta(locale)
      const tw = m.twitter as { title?: unknown; description?: unknown } | undefined
      expect(tw?.title).toBeTruthy()
      expect(tw?.description).toBeTruthy()
      expect(tw?.description).toBe(m.description)
    }
  })

  it('does NOT serve the English OG text to non-English locales', async () => {
    // The old bug: every locale had openGraph.description =
    // "Analyze your battles, track win rates, and calculate your gem value."
    const englishLeakPhrase = 'Analyze your battles, track win rates, and calculate your gem value'
    for (const locale of LOCALES) {
      if (locale === 'en') continue
      const m = await meta(locale)
      expect(String(m.openGraph?.description ?? '')).not.toContain(englishLeakPhrase)
    }
  })

  it('sets canonical to /<locale> and x-default to /es for every locale', async () => {
    for (const locale of LOCALES) {
      const m = await meta(locale)
      expect(m.alternates?.canonical).toBe(`https://brawlvision.com/${locale}`)
      const langs = m.alternates?.languages as Record<string, string> | undefined
      expect(langs?.['x-default']).toBe('https://brawlvision.com/es')
      expect(langs?.[locale]).toBe(`https://brawlvision.com/${locale}`)
    }
  })

  it('falls back to English copy for an unknown locale (defensive)', async () => {
    const unknown = await meta('xx')
    const en = await meta('en')
    expect(unknown.description).toBe(en.description)
  })
})
