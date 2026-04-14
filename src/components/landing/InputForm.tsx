'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations, useLocale } from 'next-intl'
import { Loader2 } from 'lucide-react'
import { PLAYER_TAG_REGEX } from '@/lib/constants'
import { STORAGE_KEYS } from '@/lib/storage'
import { useAuth } from '@/hooks/useAuth'

export function InputForm() {
  const t = useTranslations('landing')
  const locale = useLocale()
  const router = useRouter()
  const { profile, loading: authLoading } = useAuth()

  const [tag, setTag] = useState('#')
  const [error, setError] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  // Shows a loading card instead of the form when we're either:
  //   (a) pre-emptively expecting a session (Supabase cookie present),
  //   (b) mid-redirect after AuthProvider resolved a profile/tag.
  // Starts false so SSR + first client render match (no hydration
  // warnings); the preemptive effect below sets it on mount.
  const [showRedirectLoading, setShowRedirectLoading] = useState(false)

  /** Keep # prefix fixed, strip duplicates, uppercase */
  const handleTagChange = (raw: string) => {
    // Remove all # then re-add one at the start
    const stripped = raw.replace(/#/g, '').toUpperCase()
    setTag('#' + stripped)
    setError(false)
  }

  // Pre-emptive loading signal: on mount, check for a Supabase auth
  // cookie. If one is present, we are almost certainly about to
  // redirect once AuthProvider resolves — flip `showRedirectLoading`
  // immediately to avoid flashing the form. If the cookie turns out
  // to be stale (expired, no matching profile), the main redirect
  // effect below will clear it once AuthProvider confirms `user=null`.
  //
  // SSR-safe because the state starts false and this effect only runs
  // on the client after hydration, so no hydration mismatch.
  useEffect(() => {
    if (typeof document !== 'undefined' && document.cookie.includes('sb-')) {
      setShowRedirectLoading(true)
    }
  }, [])

  // Auto-redirect for a KNOWN user. Two trigger paths, re-evaluated on
  // every render so no race condition:
  //
  //   1. Authenticated via Google OAuth → `profile.player_tag` becomes
  //      truthy once AuthProvider finishes resolving the session. This
  //      is the critical path after the `/api/auth/callback` redirect
  //      bounces the user to the landing — the callback has set the
  //      cookie but the client-side profile fetch is still in flight,
  //      so on the first render `profile` is null and localStorage
  //      is empty (fresh browser / post-canonical-flip). Without this
  //      reactive hook the user got stuck on the landing until they
  //      manually refreshed, which forced the cookie-backed session
  //      to resolve synchronously.
  //
  //   2. Unauthenticated but with a remembered tag → `STORAGE_KEYS.USER`
  //      is in localStorage from a prior session, covering the
  //      "I've been here before without signing in" case.
  //
  // Path 1 is preferred when both are available because `profile.player_tag`
  // is the source of truth (matches the logged-in user); localStorage
  // might be stale from a prior account.
  useEffect(() => {
    if (authLoading) return // don't bounce until AuthProvider resolves

    if (profile?.player_tag) {
      setShowRedirectLoading(true)
      router.replace(`/${locale}/profile/${encodeURIComponent(profile.player_tag)}`)
      return
    }

    try {
      const saved = localStorage.getItem(STORAGE_KEYS.USER)
      if (saved) {
        setShowRedirectLoading(true)
        router.replace(`/${locale}/profile/${encodeURIComponent(saved)}`)
        return
      }
    } catch { /* ignore */ }

    // Reached here = no profile, no saved tag. Clear any pre-emptive
    // loading (e.g. a stale Supabase cookie that didn't resolve to a
    // real user) so the form renders.
    setShowRedirectLoading(false)
  }, [authLoading, profile?.player_tag, locale, router])

  // Loading card rendered in place of the form when we're redirecting
  // or about to. Same min-height as the form to avoid layout shift.
  if (showRedirectLoading) {
    return (
      <div
        className="flex flex-col items-center justify-center gap-4 py-10 min-h-[180px]"
        role="status"
        aria-live="polite"
      >
        <Loader2 className="w-10 h-10 animate-spin text-[var(--color-brawl-dark)]" />
        <p className="font-['Lilita_One'] text-[var(--color-brawl-dark)] text-lg">
          {t('loadingDashboard')}
        </p>
      </div>
    )
  }

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
