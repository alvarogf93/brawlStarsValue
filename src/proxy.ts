import { type NextRequest } from 'next/server'
import createIntlMiddleware from 'next-intl/middleware'
import { createServerClient } from '@supabase/ssr'
import { routing } from './i18n/routing'

const handleI18n = createIntlMiddleware(routing)

/**
 * Generate a request-correlation id (RES-04). Callers downstream read it
 * via `requestIdFrom(req)` from `@/lib/log` so every log line for the
 * request shares the same id.
 *
 * If the upstream proxy already injected one (Cloudflare's `cf-ray`,
 * Vercel's `x-vercel-id`), we prefer that — it makes log correlation
 * with the platform's own traces trivial. Otherwise we fall back to a
 * locally generated one.
 *
 * `crypto.randomUUID` is available natively in Edge / Node 24 and does
 * not need any import.
 */
function generateRequestId(request: NextRequest): string {
  const upstream =
    request.headers.get('x-request-id') ??
    request.headers.get('x-vercel-id') ??
    request.headers.get('cf-ray')
  if (upstream && upstream.length <= 200) return upstream
  return crypto.randomUUID()
}

export default async function proxy(request: NextRequest) {
  // 0. Tag every request with a stable correlation id BEFORE any auth /
  //    i18n work. Both the request headers (consumed by API routes via
  //    `requestIdFrom(req)`) and the response headers (visible to the
  //    browser, useful when a user reports "I got error X at this time")
  //    carry the same value.
  const requestId = generateRequestId(request)
  request.headers.set('x-request-id', requestId)

  // 1. Run i18n middleware (locale detection + rewriting)
  const response = handleI18n(request)
  response.headers.set('x-request-id', requestId)

  // 2. Refresh Supabase auth session (reads/writes cookies on request + response)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (supabaseUrl && supabaseAnonKey) {
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value)
          })
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, {
              ...options,
              sameSite: 'lax',
              secure: process.env.NODE_ENV === 'production',
            })
          })
        },
      },
    })

    // This refreshes the session if expired — the cookie changes
    // are written to the response via setAll above
    await supabase.auth.getUser()
  }

  return response
}

export const config = {
  // Exclude: api, _next, _vercel, static files (anything with a dot),
  // and the root-level metadata file conventions (icon, apple-icon,
  // opengraph-image, twitter-image, sitemap, robots, manifest).
  // Without these exclusions, the next-intl middleware redirects
  // e.g. `/icon/small` to `/es/icon/small`, which doesn't exist
  // because these files live at the app root, not under [locale].
  matcher: ['/((?!api|_next|_vercel|icon|apple-icon|opengraph-image|twitter-image|sitemap|robots|manifest|.*\\..*).*)'],
}
