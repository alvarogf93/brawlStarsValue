import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  if (!code) {
    return NextResponse.redirect(`${origin}${next}`)
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

  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    console.error('[auth/callback] exchange failed:', error.message)
    // Retry once — incognito/cold sessions sometimes fail on first attempt
    const { error: retryError } = await supabase.auth.exchangeCodeForSession(code)
    if (retryError) {
      console.error('[auth/callback] retry also failed:', retryError.message)
      // Redirect to landing with error flag — don't send user to a page expecting auth
      const locale = next.split('/')[1] || 'es'
      return NextResponse.redirect(`${origin}/${locale}?auth_error=1`)
    }
  }

  return NextResponse.redirect(`${origin}${next}`)
}
