import { useTranslations } from 'next-intl'
import { InputForm } from '@/components/landing/InputForm'

export default function LandingPage() {
  const t = useTranslations('landing')

  return (
    <div className="flex flex-col min-h-screen">
      <main className="flex-1 flex flex-col items-center justify-center px-4 relative overflow-hidden">
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
      </main>
    </div>
  )
}
