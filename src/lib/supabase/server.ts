import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, {
                ...options,
                sameSite: 'lax',
                secure: process.env.NODE_ENV === 'production',
              })
            })
          } catch {
            // setAll is called from Server Component — ignore.
            // Middleware will refresh the session on next request.
          }
        },
      },
    }
  )
}

/** Server client with service role (bypasses RLS). Only use in API routes. */
export async function createServiceClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, {
                ...options,
                sameSite: 'lax',
                secure: process.env.NODE_ENV === 'production',
              })
            })
          } catch {
            // Ignored in Server Components
          }
        },
      },
    }
  )
}

/**
 * ARQ-12 — Service-role client with NO cookie wiring. For crons and
 * other contexts where there is no incoming session: avoids the
 * Next 16 `cookies()` async access entirely. Multiple routes had been
 * inlining `createServerClient(URL, SERVICE_KEY, { cookies: no-op })`
 * — they should now consume this helper so any future change to
 * sameSite/secure/domain stays single-sourced.
 */
export function createServiceClientNoCookies() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } },
  )
}
