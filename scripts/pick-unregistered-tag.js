#!/usr/bin/env node
/**
 * Picks a valid Brawl Stars tag from the global top-players leaderboard
 * that is NOT currently registered in our `profiles` table. Used as the
 * smoke-test fixture for anonymous_visits tracking.
 *
 * Strategy:
 *   1. Call the project's Brawl Stars proxy for /rankings/global/players
 *   2. Scan top 200 players (already paginated upstream)
 *   3. Pick the first whose tag is NOT in public.profiles
 *   4. Print the tag (no other secrets)
 */

const fs = require('fs')
const path = require('path')
const { createClient } = require('@supabase/supabase-js')

const envPath = path.join(__dirname, '..', '.env.local')
const envContent = fs.readFileSync(envPath, 'utf-8')
for (const line of envContent.split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (m && !process.env[m[1]]) {
    process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}

const API_BASE = process.env.BRAWLSTARS_API_URL || 'http://141.253.197.60:3001/v1'
const API_KEY = process.env.BRAWLSTARS_API_KEY

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
)

async function main() {
  console.log('\n── Picking an unregistered tag from the global top leaderboard ──\n')

  // 1. Fetch top players from the proxy
  const url = `${API_BASE}/rankings/global/players`
  const headers = { Accept: 'application/json' }
  if (API_KEY) headers.Authorization = `Bearer ${API_KEY}`

  let data
  try {
    const res = await fetch(url, { headers })
    if (!res.ok) {
      console.error(`✗ Proxy returned ${res.status}`)
      process.exit(1)
    }
    data = await res.json()
  } catch (err) {
    console.error('✗ Failed to reach the Brawl Stars proxy:', err.message)
    process.exit(1)
  }

  const players = data?.items ?? []
  if (!players.length) {
    console.error('✗ Leaderboard response contained no players')
    process.exit(1)
  }
  console.log(`✓ Fetched ${players.length} top-players from ${API_BASE}`)

  // 2. Scan for the first one NOT in profiles
  for (const p of players) {
    const tag = p.tag  // already in '#XYZ' format
    if (!tag) continue

    const { data: hit, error } = await admin
      .from('profiles')
      .select('id')
      .eq('player_tag', tag)
      .maybeSingle()
    if (error) {
      console.error(`  ? profiles lookup error for ${tag}:`, error.message)
      continue
    }

    if (!hit) {
      console.log(`\n✓ FOUND: ${tag} (${p.name ?? 'unknown'}) — not in profiles\n`)
      console.log('TAG=' + tag)  // machine-readable output
      return
    }
  }

  console.error('\n✗ All scanned top players are already in profiles. Broaden the search.')
  process.exit(1)
}

main().catch((err) => {
  console.error('✗ Unexpected error:', err)
  process.exit(1)
})
