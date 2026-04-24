'use client'

import { useEffect } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'

/**
 * Global URL-query-string flash message handler.
 *
 * Fires a toast when the URL carries a known status flag and then cleans
 * the param so a browser refresh doesn't re-fire the toast. Motivated by
 * three silent-failure points that the funnel audit surfaced:
 *
 *   `?auth_error=1` — OAuth callback failed after the retry in
 *     `/api/auth/callback`. Previously the user ended up on the landing
 *     with no explanation whatsoever; now they see "Sign-in failed".
 *
 *   `?payment_error=1` — PayPal confirm route could not verify the
 *     subscription. Previously it redirected to the landing silently;
 *     now the user knows their payment didn't complete.
 *
 *   `?upgraded=true` — PayPal confirm redirected to the profile page
 *     after a successful upgrade. Previously no visual confirmation at
 *     all — the user paid and saw the same dashboard; now we celebrate.
 *
 * Mount once in the locale layout so every route covered by i18n
 * (landing, profile, brawler, subscribe) benefits without per-page
 * wiring.
 */
export function UrlFlashMessage() {
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()
  const t = useTranslations('flash')

  useEffect(() => {
    if (!searchParams) return

    const authError = searchParams.get('auth_error')
    const paymentError = searchParams.get('payment_error')
    const upgraded = searchParams.get('upgraded')

    if (!authError && !paymentError && !upgraded) return

    // Fire the most critical message first. Mutually exclusive in practice
    // but guarded here so an unusual combination surfaces as ONE toast.
    if (authError) {
      toast.error(t('authError'))
    } else if (paymentError) {
      toast.error(t('paymentError'))
    } else if (upgraded) {
      toast.success(t('upgraded'))
    }

    // Strip the flags so a refresh doesn't re-fire the toast. Preserve
    // any unrelated query params (e.g. locale negotiation, referral).
    const params = new URLSearchParams(searchParams.toString())
    params.delete('auth_error')
    params.delete('payment_error')
    params.delete('upgraded')
    const remaining = params.toString()
    router.replace(remaining ? `${pathname}?${remaining}` : pathname, { scroll: false })
  }, [searchParams, pathname, router, t])

  return null
}
