#!/usr/bin/env node
/**
 * Empirical probe for the Damian (or any new brawler) discoverability bug.
 *
 *   1. Hits Supercell /brawlers — the canonical roster.
 *   2. Hits Supercell /players/#TAG — what the user owns.
 *   3. Diffs them.
 *   4. HEADs the image URLs we use to confirm what's loadable today.
 */
const fs = require('fs')
const path = require('path')

const envPath = path.join(__dirname, '..', '.env.local')
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf-8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/i)
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
  }
}

const BASE = process.env.BRAWLSTARS_API_URL || 'http://141.253.197.60:3001/v1'
const KEY = process.env.BRAWLSTARS_API_KEY
const TAG = process.argv[2] || '#YJU282PV'

if (!KEY) { console.error('Missing BRAWLSTARS_API_KEY'); process.exit(1) }

async function bs(p) {
  const r = await fetch(`${BASE}${p}`, {
    headers: { Accept: 'application/json', Authorization: `Bearer ${KEY}` },
  })
  if (!r.ok) throw new Error(`${p} → ${r.status} ${await r.text()}`)
  return r.json()
}

async function head(url) {
  try {
    const r = await fetch(url, { method: 'HEAD' })
    return { status: r.status, len: r.headers.get('content-length') }
  } catch (e) { return { status: 'ERR', err: e.message } }
}

;(async () => {
  console.log(`\nProbing target: ${TAG}\n`)

  console.log('1. Supercell roster (/brawlers)')
  const roster = await bs('/brawlers')
  const all = roster.items ?? []
  console.log(`   total brawlers in game: ${all.length}`)
  const last5 = all.slice(-5)
  console.log(`   last 5: ${last5.map(b => `${b.id}(${b.name})`).join(', ')}`)
  console.log('')

  console.log(`2. Player ownership (/players/${encodeURIComponent(TAG)})`)
  const player = await bs(`/players/${encodeURIComponent(TAG)}`)
  const owned = player.brawlers ?? []
  console.log(`   owned: ${owned.length}`)
  console.log(`   ratio: ${owned.length}/${all.length} (${Math.round(owned.length/all.length*100)}%)`)
  console.log('')

  console.log('3. Diff: what is in roster but NOT owned')
  const ownedIds = new Set(owned.map(b => b.id))
  const missing = all.filter(b => !ownedIds.has(b.id))
  if (missing.length === 0) {
    console.log('   none — you own every brawler')
  } else {
    for (const m of missing) {
      console.log(`   ${m.id} ${m.name}`)
    }
  }
  console.log('')

  console.log('4. Image availability for the missing brawlers')
  const imgRoots = [
    (id) => `https://cdn.brawlify.com/brawler/${id}/avatar.png`,
    (id) => `https://cdn.brawlify.com/brawlers/${id}/avatar.png`,
    (id) => `https://cdn.brawlify.com/brawler-portraits/${id}.png`,
  ]
  for (const m of missing.slice(0, 3)) {
    console.log(`   ${m.id} ${m.name}:`)
    // Brawlify uses a different ID system — sometimes the id is short (16000102),
    // sometimes the modulo (102). Try the local asset path AND brawlify with
    // both forms.
    const shortId = m.id - 16000000
    const localUrl = `https://brawlvision.com/assets/brawlers/${m.id}.png`
    console.log(`     local prod : ${JSON.stringify(await head(localUrl))} ${localUrl}`)
    for (const root of imgRoots) {
      const url = root(m.id)
      console.log(`     ${url}: ${JSON.stringify(await head(url))}`)
    }
    for (const root of imgRoots) {
      const url = root(shortId)
      console.log(`     ${url}: ${JSON.stringify(await head(url))}`)
    }
  }
})().catch(e => { console.error('Fatal:', e.message); process.exit(2) })
