'use client'

import { useLocale } from 'next-intl'
import { useRouter, usePathname } from 'next/navigation'
import { useState, useRef, useEffect } from 'react'
import { Globe } from 'lucide-react'

const SUPPORTED_LOCALES = [
  { code: 'es', label: 'Español' },
  { code: 'en', label: 'English' },
  { code: 'fr', label: 'Français' },
  { code: 'pt', label: 'Português' },
  { code: 'de', label: 'Deutsch' },
  { code: 'it', label: 'Italiano' },
  { code: 'ru', label: 'Русский' },
  { code: 'tr', label: 'Türkçe' },
  { code: 'pl', label: 'Polski' },
  { code: 'ar', label: 'العربية' },
  { code: 'ko', label: '한국어' },
  { code: 'ja', label: '日本語' },
  { code: 'zh', label: '中文' },
]

export function LocaleSwitcher() {
  const locale = useLocale()
  const router = useRouter()
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  function switchLocale(newLocale: string) {
    if (newLocale === locale) return;
    
    // Bulletproof manual path replacement
    const segments = pathname.split('/')
    if (segments.length > 1) {
      segments[1] = newLocale
    }
    const newPath = segments.join('/')
    
    router.push(newPath)
    setIsOpen(false)
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 bg-[var(--color-brawl-blue)] border-4 border-[var(--color-brawl-dark)] rounded-xl text-white font-['Lilita_One'] tracking-wider shadow-[0_4px_0_0_var(--color-brawl-dark)] active:translate-y-1 active:shadow-[0_0px_0_0_var(--color-brawl-dark)] transition-all"
        title="Change Language"
      >
        <Globe strokeWidth={2.5} size={20} />
        {locale.toUpperCase()}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-48 max-h-80 overflow-y-auto bg-white border-4 border-[#121A2F] rounded-2xl p-2 flex flex-col gap-1 z-50 shadow-[4px_6px_0_0_#121A2F] transform origin-top-right animate-fade-in">
          {SUPPORTED_LOCALES.map((loc) => (
            <button
              key={loc.code}
              onClick={() => switchLocale(loc.code)}
              className={`text-left px-4 py-3 rounded-xl font-['Lilita_One'] transition-colors ${
                locale === loc.code 
                  ? 'bg-[var(--color-brawl-gold)] text-[#121A2F] border-2 border-[#121A2F] shadow-[0_2px_0_0_#121A2F]' 
                  : 'text-slate-600 hover:bg-slate-100 hover:text-[#121A2F] border-2 border-transparent'
              }`}
            >
              {loc.label} <span className="float-right text-sm opacity-50 font-['Inter']">{loc.code.toUpperCase()}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
