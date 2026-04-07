'use client'

import { useState, useEffect, useCallback, useMemo, type ReactNode } from 'react'
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

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const supabase = useMemo(() => createClient(), [])

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

    // First login — validate tag exists before creating profile
    const currentTag = extractPlayerTag()
    if (!currentTag) {
      setProfile(null)
      return
    }

    // Verify the player actually exists in Brawl Stars API
    try {
      const res = await fetch('/api/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerTag: currentTag }),
      })
      if (!res.ok) {
        // Tag doesn't exist — don't associate it
        setProfile(null)
        return
      }
    } catch {
      setProfile(null)
      return
    }

    const { data: newProfile } = await supabase
      .from('profiles')
      .insert({ id: userId, player_tag: currentTag })
      .select()
      .single()

    setProfile(newProfile ? (newProfile as Profile) : null)
  }, [supabase])

  useEffect(() => {
    // Safety timeout: never stay in loading state more than 5s
    const timeout = setTimeout(() => setLoading(false), 5000)

    supabase.auth.getUser().then(({ data: { user: u } }: { data: { user: User | null } }) => {
      clearTimeout(timeout)
      setUser(u)
      if (u) fetchProfile(u.id)
      setLoading(false)
    }).catch(() => {
      clearTimeout(timeout)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event: string, session: { user: User | null } | null) => {
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
        queryParams: { prompt: 'select_account' },
      },
    })
  }, [supabase])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
    try { localStorage.removeItem('brawlvalue:user') } catch { /* ignore */ }
  }, [supabase])

  const value: AuthState = { user, profile, loading, signIn, signOut }

  return (
    <AuthContext value={value}>
      {children}
    </AuthContext>
  )
}
