import { describe, it, expect } from 'vitest'
import { mockNextIntl, MockIntlFormattingError } from '@/__tests__/helpers/mock-next-intl'

describe('mockNextIntl — strict translation mock helper', () => {
  it('returns the template verbatim when there are no interpolation markers', () => {
    const { useTranslations } = mockNextIntl({ title: 'Hello World' })
    const t = useTranslations()
    expect(t('title')).toBe('Hello World')
  })

  it('interpolates a single {param} when supplied', () => {
    const { useTranslations } = mockNextIntl({ greeting: 'Hi {name}' })
    const t = useTranslations()
    expect(t('greeting', { name: 'Alvar' })).toBe('Hi Alvar')
  })

  it('interpolates multiple params', () => {
    const { useTranslations } = mockNextIntl({
      summary: '{wins}W / {losses}L — {total} games',
    })
    const t = useTranslations()
    expect(t('summary', { wins: 5, losses: 3, total: 8 })).toBe('5W / 3L — 8 games')
  })

  it('coerces numeric params to strings', () => {
    const { useTranslations } = mockNextIntl({ score: 'Score: {n}' })
    const t = useTranslations()
    expect(t('score', { n: 42 })).toBe('Score: 42')
  })

  it('returns the key verbatim when it is not in the dictionary', () => {
    const { useTranslations } = mockNextIntl({ known: 'Known' })
    const t = useTranslations()
    // Unknown keys pass through so that components referencing new keys
    // still render in tests while i18n batches land.
    expect(t('unknown.key.name')).toBe('unknown.key.name')
  })

  it('THROWS when a {param} is referenced but params is omitted entirely', () => {
    const { useTranslations } = mockNextIntl({ seeMore: 'See more ({count})' })
    const t = useTranslations()
    expect(() => t('seeMore')).toThrow(MockIntlFormattingError)
    expect(() => t('seeMore')).toThrow(/count/)
  })

  it('THROWS when a {param} is referenced but is missing from the supplied params', () => {
    const { useTranslations } = mockNextIntl({ seeMore: 'See more ({count})' })
    const t = useTranslations()
    expect(() => t('seeMore', { other: 3 })).toThrow(MockIntlFormattingError)
    expect(() => t('seeMore', { other: 3 })).toThrow(/count/)
  })

  it('THROWS when a param value is undefined', () => {
    const { useTranslations } = mockNextIntl({ seeMore: 'See more ({count})' })
    const t = useTranslations()
    expect(() => t('seeMore', { count: undefined as unknown as number })).toThrow(
      MockIntlFormattingError,
    )
  })

  it('does NOT throw when a supplied param is 0 (falsy but defined)', () => {
    const { useTranslations } = mockNextIntl({ seeMore: 'See more ({count})' })
    const t = useTranslations()
    expect(t('seeMore', { count: 0 })).toBe('See more (0)')
  })
})
