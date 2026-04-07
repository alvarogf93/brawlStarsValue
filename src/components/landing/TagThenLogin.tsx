'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useAuth } from '@/hooks/useAuth'
import { PLAYER_TAG_REGEX } from '@/lib/constants'
import { X } from 'lucide-react'

const STORAGE_KEY = 'brawlvalue:user'

interface TagThenLoginProps {
  open: boolean
  onClose: () => void
}

export function TagThenLogin({ open, onClose }: TagThenLoginProps) {
  const t = useTranslations('landing')
  const tAuth = useTranslations('auth')
  const { signIn } = useAuth()
  const [tag, setTag] = useState('#')
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(false)

  if (!open) return null

  const handleTagChange = (raw: string) => {
    const stripped = raw.replace(/#/g, '').toUpperCase()
    setTag('#' + stripped)
    setError(false)
  }

  const handleSubmit = async () => {
    if (!PLAYER_TAG_REGEX.test(tag)) {
      setError(true)
      return
    }
    setLoading(true)
    try { localStorage.setItem(STORAGE_KEY, tag.trim()) } catch { /* ignore */ }
    await signIn()
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      <div className="relative brawl-card p-8 max-w-sm w-full mx-4 animate-fade-in">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 text-slate-400 hover:text-[var(--color-brawl-dark)] transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center mb-5">
          <h2 className="font-['Lilita_One'] text-2xl text-[var(--color-brawl-dark)] text-stroke-brawl text-white">
            {t('step1Title')}
          </h2>
          <p className="text-sm text-slate-500 mt-1 font-['Inter']">
            {t('step1Desc')}
          </p>
        </div>

        <input
          type="text"
          value={tag}
          onChange={(e) => handleTagChange(e.target.value)}
          placeholder={t('placeholder')}
          disabled={loading}
          className={`w-full h-14 bg-white border-4 ${error ? 'border-red-500' : 'border-[var(--color-brawl-dark)]'} rounded-xl px-4 text-2xl outline-none text-center font-['Lilita_One'] placeholder:font-['Inter'] placeholder:text-slate-400 placeholder:text-base text-[var(--color-brawl-dark)] shadow-[3px_4px_0_0_rgba(18,26,47,1)] transition-transform focus:scale-[1.02] disabled:opacity-50`}
        />
        {error && (
          <p className="text-white font-['Lilita_One'] text-sm text-center mt-2 bg-red-500 rounded-lg px-3 py-1 border-2 border-[var(--color-brawl-dark)]">
            {t('invalidTag')}
          </p>
        )}

        <button
          onClick={handleSubmit}
          disabled={loading || tag.length < 2}
          className="w-full mt-4 flex items-center justify-center gap-3 px-6 py-3 bg-white text-gray-800 font-semibold rounded-xl hover:bg-gray-100 transition-colors disabled:opacity-50 border-4 border-[var(--color-brawl-dark)] shadow-[0_3px_0_0_rgba(18,26,47,1)]"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          {loading ? tAuth('loading') : tAuth('googleButton')}
        </button>

        <p className="text-[10px] text-slate-500 text-center mt-3">
          {tAuth('disclaimer')}
        </p>
      </div>
    </div>
  )
}
