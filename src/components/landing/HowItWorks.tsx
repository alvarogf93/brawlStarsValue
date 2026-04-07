import { Search, BarChart3, Trophy } from 'lucide-react'
import { useTranslations } from 'next-intl'

const STEPS = [
  { num: 1, icon: Search, key: 'step1' },
  { num: 2, icon: BarChart3, key: 'step2' },
  { num: 3, icon: Trophy, key: 'step3' },
] as const

export function HowItWorks() {
  const t = useTranslations('landing')

  return (
    <div className="flex flex-col md:flex-row items-stretch gap-4 max-w-[900px] w-full mx-auto">
      {STEPS.map((s, i) => (
        <div key={s.key} className="flex-1 flex flex-col items-center relative">
          <div className="brawl-card p-6 text-center w-full h-full flex flex-col items-center">
            <span className="text-5xl font-['Lilita_One'] text-stroke-brawl text-[var(--color-brawl-gold)] mb-3">
              {s.num}
            </span>
            <s.icon className="w-10 h-10 text-[var(--color-brawl-blue)] mb-3" />
            <h3 className="font-['Lilita_One'] text-lg text-[var(--color-brawl-dark)] mb-1">
              {t(`${s.key}Title`)}
            </h3>
            <p className="text-sm text-slate-600 font-['Inter']">
              {t(`${s.key}Desc`)}
            </p>
          </div>
          {i < STEPS.length - 1 && (
            <span className="hidden md:block absolute -right-5 top-1/2 -translate-y-1/2 text-3xl text-[var(--color-brawl-gold)] font-['Lilita_One'] z-10">
              →
            </span>
          )}
        </div>
      ))}
    </div>
  )
}
