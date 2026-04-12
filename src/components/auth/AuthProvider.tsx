'use client'

import { useState, useEffect, useCallback, useMemo, type ReactNode } from 'react'
import { AuthContext, type AuthState } from '@/hooks/useAuth'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'
import type { Profile } from '@/lib/supabase/types'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [needsTag, setNeedsTag] = useState(false)

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
      setNeedsTag(false)
      // Restore localStorage tag so InputForm auto-redirects on next visit
      try { localStorage.setItem('brawlvalue:user', data.player_tag) } catch { /* ignore */ }
      return
    }

    // No profile yet — user needs to link a player tag
    setProfile(null)
    setNeedsTag(true)
  }, [supabase])

  /** Link a player tag to the authenticated user (called from TagRequiredModal) */
  const linkTag = useCallback(async (tag: string): Promise<{ ok: boolean; error?: string }> => {
    if (!user) return { ok: false, error: 'Not authenticated' }

    // Validate tag exists in Brawl Stars API
    try {
      const res = await fetch('/api/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerTag: tag }),
      })
      if (!res.ok) return { ok: false, error: 'Tag not found' }
    } catch {
      return { ok: false, error: 'Connection error' }
    }

    // Profile insert with referral code collision retry
    // DB trigger auto-generates referral_code via md5(random())
    // If unique constraint fails (extremely rare), retry once
    // Auto-activate 3-day PRO trial for new users
    const trialEnds = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString()

    let insertResult = await supabase
      .from('profiles')
      .insert({ id: user.id, player_tag: tag, trial_ends_at: trialEnds })
      .select()
      .single()

    if (insertResult.error?.code === '23505' && insertResult.error.message.includes('referral_code')) {
      insertResult = await supabase
        .from('profiles')
        .insert({ id: user.id, player_tag: tag, trial_ends_at: trialEnds })
        .select()
        .single()
    }

    if (insertResult.error || !insertResult.data) {
      return { ok: false, error: insertResult.error?.message || 'Could not create profile' }
    }

    setProfile(insertResult.data as Profile)
    setNeedsTag(false)
    try { localStorage.setItem('brawlvalue:user', tag) } catch { /* ignore */ }

    // Apply referral code (best-effort, non-blocking)
    const refCode = (() => { try { return localStorage.getItem('brawlvalue:ref') } catch { return null } })()
    if (refCode) {
      try {
        await supabase.rpc('apply_referral', {
          p_new_user_id: user.id,
          p_referral_code: refCode,
        })
        localStorage.removeItem('brawlvalue:ref')
      } catch { /* referral is best-effort */ }
    }

    // Notify admin of new signup (fire-and-forget)
    fetch('/api/notify/signup', { method: 'POST' }).catch(() => {})

    return { ok: true }
  }, [user, supabase])

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
      async (event: string, session: { user: User | null } | null) => {
        const u = session?.user ?? null
        setUser(u)
        if (u) {
          await fetchProfile(u.id)

          // After sign-in, if user has a profile and we're on landing, redirect to their profile
          if (event === 'SIGNED_IN') {
            const { data: prof } = await supabase.from('profiles').select('player_tag').eq('id', u.id).single()
            if (prof?.player_tag) {
              const path = window.location.pathname
              const isLanding = path === '/' || /^\/[a-z]{2}\/?$/.test(path) || /^\/api\/auth\/callback/.test(path)
              if (isLanding) {
                const locale = window.location.pathname.split('/')[1] || 'es'
                window.location.href = `/${locale}/profile/${encodeURIComponent(prof.player_tag)}`
                return
              }
            }
          }
        } else {
          setProfile(null)
          setNeedsTag(false)
        }
        setLoading(false)
      }
    )

    return () => subscription.unsubscribe()
  }, [supabase, fetchProfile])

  // Periodic profile refresh — keeps "last sync" time accurate
  // and invalidates stale player data cache when new sync detected
  useEffect(() => {
    if (!user) return

    const POLL_INTERVAL = 5 * 60 * 1000 // 5 minutes
    let lastKnownSync = profile?.last_sync ?? null

    const interval = setInterval(async () => {
      try {
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single()

        if (!data) return

        const newSync = (data as Profile).last_sync
        if (newSync && newSync !== lastKnownSync) {
          lastKnownSync = newSync
          setProfile(data as Profile)

          // Invalidate player data cache so next navigation fetches fresh data
          try {
            for (let i = localStorage.length - 1; i >= 0; i--) {
              const key = localStorage.key(i)
              if (key?.startsWith('brawlvalue:player:')) {
                localStorage.removeItem(key)
              }
            }
          } catch { /* ignore */ }
        }
      } catch { /* ignore — polling is best-effort */ }
    }, POLL_INTERVAL)

    return () => clearInterval(interval)
  }, [user, supabase, profile?.last_sync])

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
    setNeedsTag(false)
    try { localStorage.removeItem('brawlvalue:user') } catch { /* ignore */ }
  }, [supabase])

  const value: AuthState = { user, profile, loading, needsTag, signIn, signOut, linkTag }

  return (
    <AuthContext value={value}>
      {children}
    </AuthContext>
  )
}
