import { createClient } from '@/lib/supabase/server'
import type { Profile } from '@/lib/supabase/types'
export { isPremium } from '@/lib/premium'

/** Get current authenticated user + their profile (if exists) */
export async function getProfile(): Promise<{
  user: { id: string } | null
  profile: Profile | null
}> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { user: null, profile: null }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  return { user: { id: user.id }, profile: profile ?? null }
}

/** Create a new profile (called after first login) */
export async function createProfile(userId: string, playerTag: string): Promise<Profile | null> {
  const supabase = await createClient()

  const { data } = await supabase
    .from('profiles')
    .insert({ id: userId, player_tag: playerTag })
    .select()
    .single()

  return data ?? null
}
