/**
 * Coarse User-Agent classification — "mobile" / "tablet" / "desktop" / "bot".
 *
 * Used only as a hint for the anonymous-visit Telegram alert so the
 * on-call admin can tell traffic-source at a glance without opening
 * Vercel Analytics. Not a substitute for proper UA parsing — we don't
 * track this further than the alert text, so a misclassification has
 * zero downstream impact.
 *
 * Pure function, no I/O. Lives outside `src/lib/telegram/` because it's
 * potentially useful for other server-side log enrichment.
 */

const BOT_MARKERS = [
  'bot',
  'crawler',
  'spider',
  'preview',
  'curl/',
  'wget/',
  'python-requests',
  'node-fetch',
  'axios',
  'okhttp',
]

const TABLET_MARKERS = ['ipad', 'tablet']

const MOBILE_MARKERS = [
  'iphone',
  'ipod',
  'android', // narrowed below by tablet check
  'mobile',
  'phone',
  'opera mini',
  'iemobile',
]

export function classifyUserAgent(ua: string | null | undefined): string | null {
  if (!ua) return null
  const lc = ua.toLowerCase()

  if (BOT_MARKERS.some(m => lc.includes(m))) return 'bot'

  // Tablet check first — "android" matches mobile too, so bare 'android'
  // without 'mobile' typically means an Android tablet.
  if (TABLET_MARKERS.some(m => lc.includes(m))) return 'tablet'
  if (lc.includes('android') && !lc.includes('mobile')) return 'tablet'

  if (MOBILE_MARKERS.some(m => lc.includes(m))) return 'mobile'

  return 'desktop'
}
