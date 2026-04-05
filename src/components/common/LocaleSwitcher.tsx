'use client'

import { useLocale } from 'next-intl'
import { useRouter, usePathname } from 'next/navigation'

export function LocaleSwitcher() {
  const locale = useLocale()
  const router = useRouter()
  const pathname = usePathname()

  function switchLocale(newLocale: string) {
    const newPath = pathname.replace(`/${locale}`, `/${newLocale}`)
    router.push(newPath)
  }

  return (
    <div className="flex gap-1 text-xs font-bold font-['Righteous'] p-1 bg-white/5 rounded-lg border border-white/10">
      <button
        onClick={() => switchLocale('es')}
        className={`px-3 py-1.5 rounded-md transition-all ${
          locale === 'es' 
          ? 'bg-[var(--color-brawl-blue)] text-white shadow-lg' 
          : 'text-slate-500 hover:text-white'
        }`}
      >
        ES
      </button>
      <button
        onClick={() => switchLocale('en')}
        className={`px-3 py-1.5 rounded-md transition-all ${
          locale === 'en' 
          ? 'bg-[var(--color-brawl-blue)] text-white shadow-lg' 
          : 'text-slate-500 hover:text-white'
        }`}
      >
        EN
      </button>
    </div>
  )
}
