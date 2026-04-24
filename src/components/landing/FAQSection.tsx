import { useTranslations } from 'next-intl'

/** 5 questions is the right count for a landing-page FAQ: enough to
 *  capture the most common pre-signup doubts, few enough to stay visible
 *  above the final CTA without dominating the scroll. Kept as a literal
 *  tuple so TypeScript/autocomplete catches a missing question key. */
const QUESTION_IDS = [1, 2, 3, 4, 5] as const

export function FAQSection() {
  const t = useTranslations('landing.faq')

  const items = QUESTION_IDS.map((i) => ({
    question: t(`q${i}`),
    answer: t(`a${i}`),
  }))

  return (
    <section className="px-4 py-16">
      <div className="max-w-[720px] mx-auto">
        <h2 className="text-3xl md:text-4xl font-['Lilita_One'] text-white text-stroke-brawl text-center mb-8">
          {t('sectionTitle')}
        </h2>

        <ul className="space-y-3 list-none p-0">
          {items.map((item, idx) => (
            <li key={idx}>
              <details className="brawl-card-dark px-5 py-4 group cursor-pointer">
                <summary className="font-['Lilita_One'] text-lg md:text-xl text-white list-none flex justify-between items-center gap-4 [&::-webkit-details-marker]:hidden">
                  <span className="flex-1">{item.question}</span>
                  <span
                    aria-hidden="true"
                    className="text-[var(--color-brawl-gold)] text-3xl leading-none shrink-0 transition-transform group-open:rotate-45 select-none"
                  >
                    +
                  </span>
                </summary>
                <p className="mt-3 text-slate-300 font-['Inter'] leading-relaxed">
                  {item.answer}
                </p>
              </details>
            </li>
          ))}
        </ul>
      </div>

      {/* FAQPage JSON-LD — identical copy to the rendered questions so
          Google can surface them as rich-results without penalizing for
          mismatch. MUST stay in sync with the `items` above. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: items.map((item) => ({
              '@type': 'Question',
              name: item.question,
              acceptedAnswer: { '@type': 'Answer', text: item.answer },
            })),
          }),
        }}
      />
    </section>
  )
}
