import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isPremium } from '@/lib/premium'
import { syncBattles } from '@/lib/battle-sync'
import type { Profile } from '@/lib/supabase/types'

// Rate limit: 1 sync per user per 2 minutes (uses profile.last_sync as natural limiter)
const MIN_SYNC_INTERVAL_MS = 2 * 60 * 1000

export async function POST() {
  // 1. Authenticate
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  // 2. Get profile + verify ownership and tier
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  if (!isPremium(profile as Profile)) {
    return NextResponse.json({ error: 'Premium subscription required' }, { status: 403 })
  }

  // 3. Rate limit: reject if last_sync was less than 2 minutes ago
  if (profile.last_sync) {
    const elapsed = Date.now() - new Date(profile.last_sync).getTime()
    if (elapsed < MIN_SYNC_INTERVAL_MS) {
      const waitSec = Math.ceil((MIN_SYNC_INTERVAL_MS - elapsed) / 1000)
      return NextResponse.json({ error: `Rate limited. Try again in ${waitSec}s` }, { status: 429 })
    }
  }

  // 4. Sync battles
  const result = await syncBattles(profile.player_tag)

  if (result.error) {
    const isApiDown = result.error.includes('fetch failed') || result.error.includes('ECONNREFUSED') || result.error.includes('ETIMEDOUT')
    return NextResponse.json(
      { error: isApiDown ? 'Brawl Stars API temporarily unavailable. Try again in a few minutes.' : result.error },
      { status: 502 },
    )
  }

  return NextResponse.json(result)
}
