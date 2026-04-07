import { useTranslations, useLocale } from 'next-intl'
import { InputForm } from '@/components/landing/InputForm'
import { LocaleSwitcher } from '@/components/common/LocaleSwitcher'
import Link from 'next/link'

export default function LandingPage() {
  const t = useTranslations('landing')
  const locale = useLocale()

  return (
    <div className="flex flex-col min-h-screen">
      {/* Language selector */}
      <div className="absolute top-4 right-4 z-50">
        <LocaleSwitcher />
      </div>

      <main className="flex-1 flex flex-col items-center justify-center px-4 py-12 relative overflow-hidden">
        {/* Hero card */}
        <div className="text-center brawl-card p-10 max-w-[500px] w-full animate-fade-in relative z-10">
          <div className="mb-6 flex justify-center">
            <div className="w-24 h-24 rounded-full bg-[var(--color-brawl-sky)] border-4 border-[var(--color-brawl-dark)] flex items-center justify-center p-[2px] shadow-[0_6px_0_rgba(18,26,47,1)] overflow-hidden">
              <span className="text-5xl translate-y-1">💎</span>
            </div>
          </div>

          <h1 className="text-5xl leading-[1.1] font-bold font-['Lilita_One'] mb-2 text-stroke-brawl text-white">
            {t('title')}
          </h1>
          <p className="mt-4 text-[var(--color-brawl-dark)] font-['Inter'] font-semibold mb-8 text-lg">
            {t('subtitle')}
          </p>

          <InputForm />
        </div>

        {/* Features — brawl cards style */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-[720px] w-full mt-10">
          {[
            { emoji: '💎', key: 'feature1', color: 'var(--color-brawl-gold)' },
            { emoji: '📊', key: 'feature2', color: 'var(--color-brawl-sky)' },
            { emoji: '🤝', key: 'feature3', color: '#4ade80' },
            { emoji: '🛡️', key: 'feature4', color: 'var(--color-brawl-red)' },
          ].map(f => (
            <div key={f.key} className="brawl-card-dark p-4 text-center">
              <div
                className="w-12 h-12 mx-auto mb-2 rounded-xl border-4 border-[var(--color-brawl-dark)] flex items-center justify-center shadow-[0_3px_0_0_rgba(18,26,47,1)]"
                style={{ backgroundColor: f.color + '30' }}
              >
                <span className="text-2xl">{f.emoji}</span>
              </div>
              <p className="font-['Lilita_One'] text-xs text-white tracking-wide">{t(f.key)}</p>
            </div>
          ))}
        </div>
      </main>

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
