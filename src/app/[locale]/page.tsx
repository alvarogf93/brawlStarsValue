import { useTranslations, useLocale } from 'next-intl'
import { InputForm } from '@/components/landing/InputForm'
import { HeroBrawlers } from '@/components/landing/HeroBrawlers'
import { HeroSignIn } from '@/components/landing/HeroSignIn'
import { FeaturesGrid } from '@/components/landing/FeaturesGrid'
import { TrialBanner } from '@/components/landing/TrialBanner'
import { ExploreSection } from '@/components/landing/ExploreSection'
import { BrawlerParade } from '@/components/landing/BrawlerParade'
import { PremiumTeaser } from '@/components/landing/PremiumTeaser'
import { FAQSection } from '@/components/landing/FAQSection'
import { FinalCTA } from '@/components/landing/FinalCTA'
import { SectionReveal } from '@/components/landing/SectionReveal'
import { LocaleSwitcher } from '@/components/common/LocaleSwitcher'
import { ScrollIndicator } from '@/components/landing/ScrollIndicator'
import { RefCapture } from '@/components/landing/RefCapture'
import { FeatureShowcase } from '@/components/premium/FeatureShowcase'
import Link from 'next/link'

export default function LandingPage() {
  const t = useTranslations('landing')
  const locale = useLocale()

  return (
    <div className="flex flex-col min-h-screen">
      <RefCapture />

      {/* 1. Hero — logo, search, trial CTA */}
      <section className="min-h-screen flex flex-col items-center justify-center px-4 py-12 relative overflow-hidden">
        <HeroBrawlers />

        <div className="text-center brawl-card p-10 max-w-[500px] w-full animate-fade-in relative z-10">
          <div className="absolute top-3 right-3 z-50">
            <LocaleSwitcher />
          </div>

          <div className="mb-4 flex justify-center">
            <img src="/assets/brand/logo-full.png" alt="BrawlVision" width={200} height={96} className="h-24 w-auto drop-shadow-[0_4px_8px_rgba(0,0,0,0.5)]" />
          </div>

          <h1 className="text-5xl leading-[1.1] font-bold font-['Lilita_One'] mb-2 text-stroke-brawl text-white">
            {t('title')}
          </h1>
          <p className="mt-4 text-[var(--color-brawl-dark)] font-['Inter'] font-semibold mb-8 text-lg">
            {t('subtitle')}
          </p>

          <InputForm />
          <HeroSignIn />
        </div>

        {/* Feature showcase carousel — sits below the hero card so
            the tag input + CTA remain the primary above-the-fold
            action, and the carousel teases the Premium analytics
            preview as the visitor scrolls (or glances) further. */}
        <div className="w-full max-w-[640px] mt-6 animate-fade-in relative z-10">
          <FeatureShowcase />
        </div>

        <ScrollIndicator />
      </section>

      {/* 2. Trial Banner — free vs trial PRO */}
      <SectionReveal className="px-4 py-16">
        <TrialBanner />
      </SectionReveal>

      {/* 3. Features Grid — 4-6 cards con imágenes */}
      <SectionReveal className="px-4 py-16">
        <FeaturesGrid />
      </SectionReveal>

      {/* 4. Explore — picks + brawler stats con imágenes de fondo */}
      <SectionReveal className="px-4 py-8">
        <ExploreSection />
      </SectionReveal>

      {/* 5. Brawler Parade — scroll infinito clickable */}
      <SectionReveal className="py-16 px-4 overflow-hidden">
        <BrawlerParade />
      </SectionReveal>

      {/* 6. Premium Teaser — features PRO */}
      <SectionReveal className="px-4 py-16">
        <PremiumTeaser />
      </SectionReveal>

      {/* 7. FAQ — answers the pre-signup doubts we see in SERP queries
          ("how many battles does the game save", "is it safe", "is it
          free") and emits FAQPage JSON-LD so Google can surface rich
          results on those exact queries. */}
      <SectionReveal>
        <FAQSection />
      </SectionReveal>

      {/* 8. Final CTA */}
      <SectionReveal className="px-4 py-16">
        <FinalCTA />
      </SectionReveal>

      {/* 8. Footer */}
      <footer className="py-4 px-4">
        <div className="brawl-card-dark px-6 py-3 max-w-[720px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-3 text-xs font-['Lilita_One'] flex-wrap justify-center">
            <Link href={`/${locale}/methodology`} className="text-slate-400 hover:text-[var(--color-brawl-gold)] transition-colors">
              {t('methodologyLink')}
            </Link>
            <span className="text-slate-600">·</span>
            <Link href={`/${locale}/about`} className="text-slate-400 hover:text-[var(--color-brawl-gold)] transition-colors">
              {t('aboutLink')}
            </Link>
            <span className="text-slate-600">·</span>
            <Link href={`/${locale}/battle-history`} className="text-slate-400 hover:text-[var(--color-brawl-gold)] transition-colors">
              {t('battleHistoryLink')}
            </Link>
            <span className="text-slate-600">·</span>
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
