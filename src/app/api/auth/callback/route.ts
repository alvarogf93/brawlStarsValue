import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  console.log('[auth/callback] origin:', origin, '| code:', code ? 'present' : 'MISSING', '| next:', next)

  if (!code) {
    console.error('[auth/callback] No code parameter')
    return NextResponse.redirect(`${origin}${next}`)
  }

  const cookieStore = await cookies()
  const allCookies = cookieStore.getAll()
  console.log('[auth/callback] cookies received:', allCookies.map(c => c.name).join(', '))

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
              secure: true,
            })
          })
        },
      },
    }
  )

  const { data, error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    console.error('[auth/callback] EXCHANGE FAILED:', error.message, '| code:', error.code, '| status:', error.status)
  } else {
    console.log('[auth/callback] SUCCESS — user:', data.user?.email, '| session:', data.session?.access_token ? 'valid' : 'missing')
  }

  return NextResponse.redirect(`${origin}${next}`)
}
