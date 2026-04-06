'use client'

import { createContext, useContext } from 'react'
import type { User } from '@supabase/supabase-js'
import type { Profile } from '@/lib/supabase/types'

export interface AuthState {
  user: User | null
  profile: Profile | null
  loading: boolean
  signIn: (redirectTo?: string) => Promise<void>
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthState>({
  user: null,
  profile: null,
  loading: true,
  signIn: async () => {},
  signOut: async () => {},
})

export function useAuth(): AuthState {
  return useContext(AuthContext)
}
