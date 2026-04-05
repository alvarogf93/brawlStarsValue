'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations, useLocale } from 'next-intl'
import { PLAYER_TAG_REGEX } from '@/lib/constants'

export function InputForm() {
  const t = useTranslations('landing')
  const locale = useLocale()
  const router = useRouter()
  
  const [tag, setTag] = useState('')
  const [error, setError] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!PLAYER_TAG_REGEX.test(tag)) {
      setError(true)
      return
    }
    
    setError(false)
    setIsLoading(true)

    // Format tag (uppercase and ensure #)
    let formattedTag = tag.toUpperCase().trim()
    if (!formattedTag.startsWith('#')) {
      formattedTag = '#' + formattedTag
    }
    
    // Push route
    router.push(`/${locale}/profile/${encodeURIComponent(formattedTag)}`)
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-full">
      <div className="relative">
        <input 
          type="text" 
          value={tag}
          onChange={(e) => {
            setTag(e.target.value)
            setError(false)
          }}
          placeholder={t('placeholder')} 
          disabled={isLoading}
          className={`w-full h-14 bg-white/5 border ${error ? 'border-red-500' : 'border-white/10'} rounded-xl px-4 text-xl outline-none focus:border-[var(--color-brawl-blue)] transition-colors text-center font-['Inter'] font-semibold placeholder:font-normal placeholder:text-slate-500 disabled:opacity-50`}
        />
        {error && (
          <p className="absolute -bottom-6 left-0 right-0 text-red-400 text-xs font-semibold text-center animate-fade-in">
            {t('invalidTag')}
          </p>
        )}
      </div>
      
      <button 
        type="submit"
        disabled={isLoading || !tag}
        className={`mt-2 w-full h-14 bg-[var(--color-brawl-gold)] hover:bg-yellow-500 text-black font-bold text-xl rounded-xl transition-all font-['Inter'] shadow-[0_0_20px_rgba(251,191,36,0.3)] hover:shadow-[0_0_30px_rgba(251,191,36,0.5)] disabled:opacity-50 disabled:shadow-none relative overflow-hidden group`}
      >
        <span className={`${isLoading ? 'opacity-0' : 'opacity-100'} transition-opacity`}>
          {t('cta')}
        </span>
        {isLoading && (
          <span className="absolute inset-0 flex items-center justify-center animate-pulse">
            {t('calculating')}
          </span>
        )}
        <div className="absolute inset-0 -translate-x-full group-hover:animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/30 to-transparent skew-x-12 hidden group-hover:block"></div>
      </button>
    </form>
  )
}
