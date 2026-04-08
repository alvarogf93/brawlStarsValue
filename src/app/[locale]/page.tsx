import { useTranslations, useLocale } from 'next-intl'
import { InputForm } from '@/components/landing/InputForm'
import { HeroBrawlers } from '@/components/landing/HeroBrawlers'
import { HeroSignIn } from '@/components/landing/HeroSignIn'
import { StatsTicker } from '@/components/landing/StatsTicker'
import { FeaturesGrid } from '@/components/landing/FeaturesGrid'
import { BrawlerParade } from '@/components/landing/BrawlerParade'
import { HowItWorks } from '@/components/landing/HowItWorks'
import { PremiumTeaser } from '@/components/landing/PremiumTeaser'
import { FinalCTA } from '@/components/landing/FinalCTA'
import { SectionReveal } from '@/components/landing/SectionReveal'
import { LocaleSwitcher } from '@/components/common/LocaleSwitcher'
import { ScrollIndicator } from '@/components/landing/ScrollIndicator'
import Link from 'next/link'

export default function LandingPage() {
  const t = useTranslations('landing')
  const locale = useLocale()

  return (
    <div className="flex flex-col min-h-screen">
      {/* Section 1: Hero */}
      <section className="min-h-screen flex flex-col items-center justify-center px-4 py-12 relative overflow-hidden">
        <HeroBrawlers />

        <div className="text-center brawl-card p-10 max-w-[500px] w-full animate-fade-in relative z-10">
          {/* Language selector — inside the card, top-right */}
          <div className="absolute top-3 right-3 z-50">
            <LocaleSwitcher />
          </div>

          <div className="mb-4 flex justify-center">
            <div className="w-20 h-20 rounded-full bg-[var(--color-brawl-sky)] border-4 border-[var(--color-brawl-dark)] flex items-center justify-center p-[2px] shadow-[0_6px_0_rgba(18,26,47,1)] overflow-hidden">
              <span className="text-4xl translate-y-1">💎</span>
            </div>
          </div>

          <h2 className="text-2xl font-['Lilita_One'] text-stroke-brawl text-[var(--color-brawl-gold)] mb-1 tracking-wider">
            BRAWLVISION
          </h2>

          <h1 className="text-5xl leading-[1.1] font-bold font-['Lilita_One'] mb-2 text-stroke-brawl text-white">
            {t('title')}
          </h1>
          <p className="mt-4 text-[var(--color-brawl-dark)] font-['Inter'] font-semibold mb-8 text-lg">
            {t('subtitle')}
          </p>

          <InputForm />
          <HeroSignIn />
        </div>

        <ScrollIndicator />
      </section>

      {/* Section 2: Stats Ticker */}
      <SectionReveal className="px-4 -mt-6 relative z-20">
        <StatsTicker />
      </SectionReveal>

      {/* Section 3: Features Grid */}
      <SectionReveal className="px-4 py-16">
        <FeaturesGrid />
      </SectionReveal>

      {/* Section 4: Best Picks Banner */}
      <SectionReveal className="px-4 py-8">
        <Link
          href={`/${locale}/picks`}
          className="block max-w-[900px] mx-auto brawl-card-dark p-6 md:p-8 border-[#FFC91B]/20 hover:border-[#FFC91B]/40 transition-all hover:scale-[1.01] group"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="text-4xl">⚔️</span>
              <div>
                <h3 className="font-['Lilita_One'] text-xl md:text-2xl text-white">{t('picksTitle')}</h3>
                <p className="text-sm text-slate-400 mt-0.5">{t('picksDesc')}</p>
              </div>
            </div>
            <span className="font-['Lilita_One'] text-[#FFC91B] text-2xl group-hover:translate-x-1 transition-transform">→</span>
          </div>
        </Link>
      </SectionReveal>

      {/* Section 5: Brawler Parade */}
      <SectionReveal className="py-16 px-4 overflow-hidden">
        <BrawlerParade />
      </SectionReveal>

      {/* Section 5: How It Works */}
      <SectionReveal className="px-4 py-16">
        <HowItWorks />
      </SectionReveal>

      {/* Section 6: Premium Teaser */}
      <SectionReveal className="px-4 py-16">
        <PremiumTeaser />
      </SectionReveal>

      {/* Section 7: Final CTA */}
      <SectionReveal className="px-4 py-16">
        <FinalCTA />
      </SectionReveal>

      {/* Footer */}
      <footer className="py-4 px-4">
        <div className="brawl-card-dark px-6 py-3 max-w-[720px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-3 text-xs font-['Lilita_One']">
            <Link href={`/${locale}/privacy`} className="text-slate-400 hover:text-[var(--color-brawl-gold)] transition-colors">
              {t('privacyLink')}
            </Link>
            <span className="text-slate-600">·</span>
            <a href="mailto:contact@brawlvision.com" className="text-slate-400 hover:text-[var(--color-brawl-gold)] transition-colors">
              {t('contact')}
            </a>
          </div>
          <p className="text-[10px] text-slate-500 text-center sm:text-right">
            © {new Date().getFullYear()} BrawlVision · {t('disclaimer')}
          </p>
        </div>
      </footer>
    </div>
  )
}
