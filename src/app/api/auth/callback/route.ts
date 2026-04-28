import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// Locale whitelist. ⚠️ MUST stay in sync with `src/i18n/routing.ts`.
// Intentionally hardcoded — importing `routing` here pulls in
// `createNavigation` which crashes server bundles. Same pattern as
// `src/app/api/calculate/route.ts`.
const SUPPORTED_LOCALES = new Set<string>([
  'es', 'en', 'fr', 'pt', 'de', 'it', 'ru', 'tr', 'pl', 'ar', 'ko', 'ja', 'zh',
])
const DEFAULT_LOCALE = 'es'

// SEG-01 — reject open-redirect vectors. Only same-origin relative paths
// pass through; everything else falls back to '/'. The browser treats
// `${origin}//evil.com` as a navigation to evil.com, so a literal
// concat of unvalidated input here was a phishing primitive.
function safeNextPath(raw: string | null, origin: string): string {
  if (!raw || typeof raw !== 'string') return '/'
  if (raw.startsWith('//') || raw.startsWith('/\\') || raw.startsWith('\\')) return '/'
  if (!raw.startsWith('/')) return '/'
  try {
    const parsed = new URL(raw, origin)
    if (parsed.origin !== origin) return '/'
    return parsed.pathname + parsed.search + parsed.hash
  } catch {
    return '/'
  }
}

// SEG-03 — derive the locale from the validated path against the
// canonical SUPPORTED_LOCALES list, never from a substring split that
// trusts the attacker's input.
function localeFromPath(pathname: string): string {
  const segment = pathname.split('/')[1]
  return segment && SUPPORTED_LOCALES.has(segment) ? segment : DEFAULT_LOCALE
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const safePath = safeNextPath(searchParams.get('next'), origin)

  if (!code) {
    return NextResponse.redirect(`${origin}${safePath}`)
  }

  const cookieStore = await cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, {
              ...options,
              sameSite: 'lax',
              secure: process.env.NODE_ENV === 'production',
            })
          })
        },
      },
    }
  )

  // LOG-05 — no retry. PKCE codes are single-use; a second
  // exchangeCodeForSession on the same code is guaranteed to return
  // invalid_grant and would only mask the real cause of the first failure.
  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    console.error('[auth/callback] exchange failed:', error.message)
    const locale = localeFromPath(safePath)
    return NextResponse.redirect(`${origin}/${locale}?auth_error=1`)
  }

  return NextResponse.redirect(`${origin}${safePath}`)
}
