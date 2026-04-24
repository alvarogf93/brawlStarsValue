import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

// vi.mock is hoisted to the top of the file; vi.hoisted lets us share
// the dictionary with the test body without the "cannot access before
// initialization" error that a plain top-level const would trigger.
const { FAQ_COPY } = vi.hoisted(() => ({
  FAQ_COPY: {
    'landing.faq.sectionTitle': 'Preguntas frecuentes',
    'landing.faq.q1': '¿Cuántas batallas guarda Brawl Stars?',
    'landing.faq.a1': 'Solo las últimas 25.',
    'landing.faq.q2': '¿Cómo ver el historial completo?',
    'landing.faq.a2': 'Vincula tu cuenta y guardamos cada batalla.',
    'landing.faq.q3': '¿Es seguro?',
    'landing.faq.a3': 'Sí, usamos la API oficial de Supercell.',
    'landing.faq.q4': '¿Es gratis?',
    'landing.faq.a4': 'Sí, con plan premium opcional.',
    'landing.faq.q5': '¿Funciona para cualquier trofeo?',
    'landing.faq.a5': 'Sí, desde 0 trofeos.',
  },
}))

vi.mock('next-intl', () => ({
  useTranslations: (namespace?: string) =>
    (key: string): string => {
      const full = namespace ? `${namespace}.${key}` : key
      return FAQ_COPY[full as keyof typeof FAQ_COPY] ?? full
    },
}))

import { FAQSection } from '@/components/landing/FAQSection'

describe('<FAQSection>', () => {
  it('renders the section title', () => {
    render(<FAQSection />)
    expect(screen.getByRole('heading', { level: 2, name: 'Preguntas frecuentes' })).toBeInTheDocument()
  })

  it('renders all 5 questions as <summary>/<details> pairs', () => {
    const { container } = render(<FAQSection />)
    const details = container.querySelectorAll('details')
    expect(details).toHaveLength(5)

    for (let i = 1; i <= 5; i++) {
      expect(screen.getByText(FAQ_COPY[`landing.faq.q${i}` as keyof typeof FAQ_COPY])).toBeInTheDocument()
      expect(screen.getByText(FAQ_COPY[`landing.faq.a${i}` as keyof typeof FAQ_COPY])).toBeInTheDocument()
    }
  })

  it('emits an application/ld+json FAQPage schema with every Q/A pair', () => {
    const { container } = render(<FAQSection />)
    const scripts = container.querySelectorAll('script[type="application/ld+json"]')
    expect(scripts).toHaveLength(1)
    const json = JSON.parse(scripts[0].textContent ?? '{}')

    expect(json['@context']).toBe('https://schema.org')
    expect(json['@type']).toBe('FAQPage')
    expect(json.mainEntity).toHaveLength(5)

    for (let i = 0; i < 5; i++) {
      const entity = json.mainEntity[i]
      expect(entity['@type']).toBe('Question')
      expect(entity.name).toBe(FAQ_COPY[`landing.faq.q${i + 1}` as keyof typeof FAQ_COPY])
      expect(entity.acceptedAnswer['@type']).toBe('Answer')
      expect(entity.acceptedAnswer.text).toBe(FAQ_COPY[`landing.faq.a${i + 1}` as keyof typeof FAQ_COPY])
    }
  })

  it('keeps the JSON-LD entity content in sync with the visible question text', () => {
    // Regression lock: if someone edits the rendered question but forgets
    // the JSON-LD (or vice versa), Google treats the mismatch as an FAQ
    // policy violation and will drop the rich result. This test makes
    // the two sources diverge loudly.
    const { container } = render(<FAQSection />)
    const summaries = Array.from(container.querySelectorAll('summary')).map(
      (s) => s.textContent?.replace(/\+$/, '').trim() ?? '',
    )
    const schema = JSON.parse(container.querySelector('script[type="application/ld+json"]')!.textContent!)
    const schemaQuestions = schema.mainEntity.map((e: { name: string }) => e.name)

    expect(summaries).toEqual(schemaQuestions)
  })
})
