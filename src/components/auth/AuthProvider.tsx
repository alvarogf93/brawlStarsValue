'use client'

import { useState, useEffect, useCallback, type ReactNode } from 'react'
import { AuthContext, type AuthState } from '@/hooks/useAuth'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'
import type { Profile } from '@/lib/supabase/types'

/** Extract the player tag from URL path or localStorage */
function extractPlayerTag(): string | null {
  // Try URL: /es/profile/%23YJU282PV/battles → #YJU282PV
  const match = window.location.pathname.match(/\/profile\/([^/]+)/)
  if (match) {
    try {
      return decodeURIComponent(match[1])
    } catch { /* ignore */ }
  }

  // Fallback: localStorage
  try {
    return localStorage.getItem('brawlvalue:user')
  } catch { /* ignore */ }

  return null
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  const supabase = createClient()

  const fetchProfile = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (data) {
      setProfile(data as Profile)
      return
    }

    // First login — create profile with current player tag
    const currentTag = extractPlayerTag()
    if (!currentTag) {
      setProfile(null)
      return
    }

    const { data: newProfile } = await supabase
      .from('profiles')
      .insert({ id: userId, player_tag: currentTag })
      .select()
      .single()

    setProfile((newProfile as Profile) ?? null)
  }, [supabase])

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user: u } }) => {
      setUser(u)
      if (u) fetchProfile(u.id)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        const u = session?.user ?? null
        setUser(u)
        if (u) {
          await fetchProfile(u.id)
        } else {
          setProfile(null)
        }
        setLoading(false)
      }
    )

    return () => subscription.unsubscribe()
  }, [supabase, fetchProfile])

  const signIn = useCallback(async (redirectTo?: string) => {
    const redirectPath = redirectTo ?? window.location.pathname
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/api/auth/callback?next=${encodeURIComponent(redirectPath)}`,
      },
    })
  }, [supabase])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
  }, [supabase])

  const value: AuthState = { user, profile, loading, signIn, signOut }

  return (
    <AuthContext value={value}>
      {children}
    </AuthContext>
  )
}
