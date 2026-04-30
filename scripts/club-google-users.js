#!/usr/bin/env node
/**
 * One-off utility: given a player tag, find out how many of their
 * clubmates are registered on BrawlVision AND signed in with Google.
 *
 * Flow:
 *   1. Fetch the player via the Brawl Stars API (through the VPS
 *      proxy) to get their club tag.
 *   2. Fetch the club's member list.
 *   3. Look up profiles.player_tag for each clubmate in Supabase
 *      (service role, to bypass RLS).
 *   4. For each matching profile, call the auth admin API to read
 *      the user's identities and check whether `google` is one of
 *      the linked providers.
 *
 * Run: node scripts/club-google-users.js "#YJU282PV"
 */

const fs = require('fs')
const path = require('path')

// Tiny .env loader — avoids pulling dotenv just for this one-off.
const envPath = path.join(__dirname, '..', '.env.local')
if (fs.existsSync(envPath)) {
  const raw = fs.readFileSync(envPath, 'utf-8')
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/i)
    if (m && !(m[1] in process.env)) {
      // Strip surrounding quotes if present.
      process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
    }
  }
}

const BRAWL_API_URL = process.env.BRAWLSTARS_API_URL || 'http://141.253.197.60:3001/v1'
const BRAWL_API_KEY = process.env.BRAWLSTARS_API_KEY
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!BRAWL_API_KEY || !SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing env: BRAWLSTARS_API_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

async function bsFetch(pathname) {
  const res = await fetch(`${BRAWL_API_URL}${pathname}`, {
    headers: { Accept: 'application/json', Authorization: `Bearer ${BRAWL_API_KEY}` },
  })
  if (!res.ok) throw new Error(`Brawl API ${pathname} → ${res.status}`)
  return res.json()
}

async function supabaseQuery(pathname) {
  const res = await fetch(`${SUPABASE_URL}${pathname}`, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      Accept: 'application/json',
    },
  })
  if (!res.ok) throw new Error(`Supabase ${pathname} → ${res.status}: ${await res.text()}`)
  return res.json()
}

async function main() {
  const rawTag = process.argv[2] || '#YJU282PV'
  const tag = rawTag.startsWith('#') ? rawTag : `#${rawTag}`
  const encoded = encodeURIComponent(tag)

  console.log(`\n→ Fetching player ${tag}…`)
  const player = await bsFetch(`/players/${encoded}`)
  const clubTag = player.club?.tag
  if (!clubTag) {
    console.log(`Player ${tag} is not in a club.`)
    return
  }
  console.log(`  Player: ${player.name} (${tag})`)
  console.log(`  Club:   ${player.club.name} (${clubTag})`)

  console.log(`\n→ Fetching club members…`)
  const club = await bsFetch(`/clubs/${encodeURIComponent(clubTag)}`)
  const members = club.members ?? []
  console.log(`  ${members.length} members`)

  // Step 3 — look up profiles by player_tag.
  // PostgREST `in.(...)` filter: commas separate, values are
  // double-quoted, and special chars (# is a URL fragment) must be
  // percent-encoded.
  const tagList = members
    .map((m) => `"${encodeURIComponent(m.tag)}"`)
    .join(',')
  console.log(`\n→ Matching profiles in Supabase…`)
  const profiles = await supabaseQuery(
    `/rest/v1/profiles?select=id,player_tag,created_at&player_tag=in.(${tagList})`,
  )
  console.log(`  ${profiles.length} registered on BrawlVision`)

  if (profiles.length === 0) {
    console.log('\n(no clubmates registered)')
    return
  }

  // Step 4 — for each profile, ask the auth admin API.
  // Batch in parallel, up to 10 at a time, to keep things snappy.
  console.log(`\n→ Checking auth providers for each registered member…`)
  const results = []
  const BATCH = 10
  for (let i = 0; i < profiles.length; i += BATCH) {
    const slice = profiles.slice(i, i + BATCH)
    const batch = await Promise.all(
      slice.map(async (p) => {
        const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${p.id}`, {
          headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
        })
        if (!res.ok) return { ...p, providers: ['<error>'], google: false }
        const user = await res.json()
        const providers = (user.identities ?? []).map((id) => id.provider)
        return { ...p, providers, google: providers.includes('google'), email: user.email }
      }),
    )
    results.push(...batch)
  }

  const google = results.filter((r) => r.google)
  const memberNames = new Map(members.map((m) => [m.tag, m.name]))

  console.log(`\n╔═══════════════════════════════════════════════════════════╗`)
  console.log(`║ ${google.length} / ${members.length} clubmates signed in with Google`.padEnd(60) + '║')
  console.log(`║ ${profiles.length} / ${members.length} clubmates have any BrawlVision account`.padEnd(60) + '║')
  console.log(`╚═══════════════════════════════════════════════════════════╝`)

  if (google.length > 0) {
    console.log(`\nGoogle users:`)
    for (const u of google) {
      const name = memberNames.get(u.player_tag) ?? '?'
      console.log(`  • ${name} (${u.player_tag}) — ${u.email ?? '<no email>'}`)
    }
  }

  const nonGoogle = results.filter((r) => !r.google)
  if (nonGoogle.length > 0) {
    console.log(`\nOther providers (registered but not via Google):`)
    for (const u of nonGoogle) {
      const name = memberNames.get(u.player_tag) ?? '?'
      console.log(`  • ${name} (${u.player_tag}) — providers=[${u.providers.join(',')}]`)
    }
  }
}

main().catch((err) => {
  console.error('\nError:', err.message)
  process.exit(1)
})
