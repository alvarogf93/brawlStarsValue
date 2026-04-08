'use client'

import { createContext, useContext } from 'react'
import type { User } from '@supabase/supabase-js'
import type { Profile } from '@/lib/supabase/types'

export interface AuthState {
  user: User | null
  profile: Profile | null
  loading: boolean
  /** True when user is authenticated but has no player tag linked yet */
  needsTag: boolean
  signIn: (redirectTo?: string) => Promise<void>
  signOut: () => Promise<void>
  /** Link a player tag to the authenticated user (first-time setup) */
  linkTag: (tag: string) => Promise<{ ok: boolean; error?: string }>
}

export const AuthContext = createContext<AuthState>({
  user: null,
  profile: null,
  loading: true,
  needsTag: false,
  signIn: async () => {},
  signOut: async () => {},
  linkTag: async () => ({ ok: false }),
})

export function useAuth(): AuthState {
  return useContext(AuthContext)
}
