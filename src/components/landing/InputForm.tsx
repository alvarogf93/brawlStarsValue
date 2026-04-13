'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations, useLocale } from 'next-intl'
import { PLAYER_TAG_REGEX } from '@/lib/constants'
import { STORAGE_KEYS } from '@/lib/storage'

export function InputForm() {
  const t = useTranslations('landing')
  const locale = useLocale()
  const router = useRouter()

  const [tag, setTag] = useState('#')
  const [error, setError] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  /** Keep # prefix fixed, strip duplicates, uppercase */
  const handleTagChange = (raw: string) => {
    // Remove all # then re-add one at the start
    const stripped = raw.replace(/#/g, '').toUpperCase()
    setTag('#' + stripped)
    setError(false)
  }

  // Auto-redirect if user already saved
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.USER)
      if (saved) {
        router.replace(`/${locale}/profile/${encodeURIComponent(saved)}`)
      }
    } catch { /* ignore */ }
  }, [locale, router])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!PLAYER_TAG_REGEX.test(tag)) {
      setError(true)
      return
    }

    setError(false)
    setIsLoading(true)

    const formattedTag = tag.trim()

    // Persist user tag
    try { localStorage.setItem(STORAGE_KEYS.USER, formattedTag) } catch { /* ignore */ }

    // Push route
    router.push(`/${locale}/profile/${encodeURIComponent(formattedTag)}?from=landing`)
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5 w-full" role="search" aria-label="Player search">
      <div className="relative">
        <label htmlFor="player-tag-input" className="sr-only">Player Tag</label>
        <input
          id="player-tag-input"
          type="text"
          value={tag}
          onChange={(e) => handleTagChange(e.target.value)}
          placeholder={t('placeholder')}
          disabled={isLoading}
          aria-invalid={error}
          aria-describedby={error ? 'tag-error' : undefined}
          autoComplete="off"
          className={`w-full h-16 bg-white border-4 ${error ? 'border-red-500' : 'border-[var(--color-brawl-dark)]'} rounded-xl px-4 text-2xl outline-none text-center font-['Lilita_One'] placeholder:font-['Inter'] placeholder:text-slate-400 placeholder:text-base text-[var(--color-brawl-dark)] shadow-[3px_4px_0_0_rgba(18,26,47,1)] transition-transform focus:scale-[1.02] disabled:opacity-50`}
        />
        {error && (
          <p id="tag-error" role="alert" className="absolute -bottom-7 left-0 right-0 text-white font-['Lilita_One'] text-shadow-sm text-lg text-center animate-fade-in bg-red-500 rounded-lg mx-auto w-max px-3 border-2 border-[var(--color-brawl-dark)]">
            {t('invalidTag')}
          </p>
        )}
      </div>
      
      <button 
        type="submit"
        disabled={isLoading || tag.length < 2}
        className={`mt-2 w-full h-16 brawl-button text-2xl relative overflow-hidden flex items-center justify-center`}
      >
        <span className={`${isLoading ? 'opacity-0' : 'opacity-100'} transition-opacity`}>
          {t('cta')}
        </span>
        {isLoading && (
          <span className="absolute inset-0 flex items-center justify-center animate-pulse">
            {t('calculating')}
          </span>
        )}
      </button>
    </form>
  )
}
