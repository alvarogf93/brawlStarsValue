import { type NextRequest } from 'next/server'
import createIntlMiddleware from 'next-intl/middleware'
import { createServerClient } from '@supabase/ssr'
import { routing } from './i18n/routing'

const handleI18n = createIntlMiddleware(routing)

export default async function proxy(request: NextRequest) {
  // 1. Run i18n middleware (locale detection + rewriting)
  const response = handleI18n(request)

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
