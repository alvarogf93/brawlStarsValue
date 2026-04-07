import { useTranslations, useLocale } from 'next-intl'
import { InputForm } from '@/components/landing/InputForm'
import { LocaleSwitcher } from '@/components/common/LocaleSwitcher'
import Link from 'next/link'
import { BarChart3, Shield, Users, Zap } from 'lucide-react'

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

        {/* Features grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-[700px] w-full mt-10">
          <div className="text-center">
            <div className="w-10 h-10 mx-auto mb-2 rounded-xl bg-[#FFC91B]/10 flex items-center justify-center">
              <Zap className="w-5 h-5 text-[#FFC91B]" />
            </div>
            <p className="text-xs font-bold text-slate-400">{t('feature1')}</p>
          </div>
          <div className="text-center">
            <div className="w-10 h-10 mx-auto mb-2 rounded-xl bg-[#4EC0FA]/10 flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-[#4EC0FA]" />
            </div>
            <p className="text-xs font-bold text-slate-400">{t('feature2')}</p>
          </div>
          <div className="text-center">
            <div className="w-10 h-10 mx-auto mb-2 rounded-xl bg-green-500/10 flex items-center justify-center">
              <Users className="w-5 h-5 text-green-400" />
            </div>
            <p className="text-xs font-bold text-slate-400">{t('feature3')}</p>
          </div>
          <div className="text-center">
            <div className="w-10 h-10 mx-auto mb-2 rounded-xl bg-[#F82F41]/10 flex items-center justify-center">
              <Shield className="w-5 h-5 text-[#F82F41]" />
            </div>
            <p className="text-xs font-bold text-slate-400">{t('feature4')}</p>
          </div>
        </div>
      </main>

      {/* Footer with privacy + contact */}
      <footer className="py-6 px-4 text-center border-t border-white/5">
        <div className="flex items-center justify-center gap-4 text-xs text-slate-500">
          <Link href={`/${locale}/privacy`} className="hover:text-white transition-colors">
            {t('privacyLink')}
          </Link>
          <span>·</span>
          <a href="mailto:contact@brawlvision.com" className="hover:text-white transition-colors">
            {t('contact')}
          </a>
          <span>·</span>
          <span>© {new Date().getFullYear()} BrawlVision</span>
        </div>
        <p className="text-[10px] text-slate-600 mt-2">{t('disclaimer')}</p>
      </footer>
    </div>
  )
}
