'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useAuth } from '@/hooks/useAuth'
import { PLAYER_TAG_REGEX } from '@/lib/constants'
import { useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'

/**
 * Shown when user is authenticated with Google but has no player tag linked.
 * Cannot be dismissed — the tag is required to use the app.
 */
export function TagRequiredModal() {
  const { needsTag, linkTag, signOut } = useAuth()
  const t = useTranslations('auth')
  const locale = useLocale()
  const router = useRouter()
  const [tag, setTag] = useState('#')
  const [referralCode, setReferralCode] = useState(() => {
    try { return localStorage.getItem('brawlvalue:ref') ?? '' } catch { return '' }
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  if (!needsTag) return null

  const handleTagChange = (raw: string) => {
    const stripped = raw.replace(/#/g, '').toUpperCase()
    setTag('#' + stripped)
    setError('')
  }

  const handleSubmit = async () => {
    const trimmed = tag.trim()
    if (!PLAYER_TAG_REGEX.test(trimmed)) {
      setError(t('invalidTag'))
      return
    }

    setLoading(true)
    setError('')

    const result = await linkTag(trimmed)
    setLoading(false)

    if (result.ok) {
      // Redirect to the player's profile
      router.push(`/${locale}/profile/${encodeURIComponent(trimmed)}`)
    } else {
      setError(result.error || t('tagNotFound'))
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      <div className="relative brawl-card p-8 max-w-sm w-full mx-4 animate-fade-in">
        <div className="text-center mb-5">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[var(--color-brawl-gold)] border-4 border-[var(--color-brawl-dark)] flex items-center justify-center shadow-[0_4px_0_rgba(18,26,47,1)]">
            <span className="text-3xl">🎮</span>
          </div>
          <h2 className="font-['Lilita_One'] text-2xl text-white text-stroke-brawl">
            {t('linkTagTitle')}
          </h2>
          <p className="text-sm text-slate-400 mt-2">
            {t('linkTagDesc')}
          </p>
        </div>

        <input
          type="text"
          value={tag}
          onChange={(e) => handleTagChange(e.target.value)}
          placeholder="#2P0Q8C2C0"
          disabled={loading}
          autoComplete="off"
          className={`w-full h-14 bg-white border-4 ${error ? 'border-red-500' : 'border-[var(--color-brawl-dark)]'} rounded-xl px-4 text-2xl outline-none text-center font-['Lilita_One'] placeholder:text-slate-400 placeholder:text-base text-[var(--color-brawl-dark)] shadow-[3px_4px_0_0_rgba(18,26,47,1)] transition-transform focus:scale-[1.02] disabled:opacity-50`}
        />
        {error && (
          <p className="text-white font-['Lilita_One'] text-sm text-center mt-2 bg-red-500 rounded-lg px-3 py-1 border-2 border-[var(--color-brawl-dark)]">
            {error}
          </p>
        )}

        {/* Referral code (optional) */}
        <input
          type="text"
          value={referralCode}
          onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
          placeholder={t('referralCodePlaceholder')}
          disabled={loading}
          className="w-full mt-3 h-10 bg-white/5 border-2 border-white/10 rounded-lg px-3 text-sm text-white placeholder:text-slate-600 font-['Inter'] outline-none focus:border-[#FFC91B]/40 transition-colors disabled:opacity-50"
        />

        <button
          onClick={handleSubmit}
          disabled={loading || tag.length < 4}
          className="w-full mt-4 brawl-button py-3 text-lg disabled:opacity-50"
        >
          {loading ? t('loading') : t('linkTagButton')}
        </button>

        <button
          onClick={signOut}
          className="w-full mt-2 text-sm text-slate-500 hover:text-slate-300 transition-colors font-['Inter']"
        >
          {t('signOutInstead')}
        </button>
      </div>
    </div>
  )
}
