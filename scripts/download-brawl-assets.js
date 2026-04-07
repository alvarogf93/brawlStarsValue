#!/usr/bin/env node
/**
 * Download all brawler assets from BrawlAPI to public/assets/
 * Run: node scripts/download-brawl-assets.js
 */
const fs = require('fs')
const path = require('path')
const https = require('https')

const BASE = path.join(__dirname, '..', 'public', 'assets')
const DIRS = ['brawlers', 'star-powers', 'gadgets']

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
}

function download(url, dest) {
  return new Promise((resolve) => {
    if (fs.existsSync(dest)) { resolve('skip'); return }
    const file = fs.createWriteStream(dest)
    https.get(url, (res) => {
      if (res.statusCode !== 200) { file.close(); fs.unlinkSync(dest); resolve('404'); return }
      res.pipe(file)
      file.on('finish', () => { file.close(); resolve('ok') })
    }).on('error', () => { resolve('error') })
  })
}

async function main() {
  DIRS.forEach(d => ensureDir(path.join(BASE, d)))

  console.log('Fetching brawler list from BrawlAPI...')
  const res = await fetch('https://api.brawlapi.com/v1/brawlers')
  const data = await res.json()
  const brawlers = data.list || data

  let ok = 0, skip = 0, fail = 0

  for (const b of brawlers) {
    // Brawler portrait
    if (b.imageUrl) {
      const dest = path.join(BASE, 'brawlers', `${b.id}.png`)
      const r = await download(b.imageUrl, dest)
      if (r === 'ok') { ok++; console.log(`  OK ${b.name} portrait`) }
      else if (r === 'skip') skip++
      else { fail++; console.log(`  FAIL ${b.name} portrait (${b.imageUrl})`) }
    }

    // Star Powers
    for (const sp of (b.starPowers || [])) {
      if (sp.imageUrl) {
        const dest = path.join(BASE, 'star-powers', `${sp.id}.png`)
        const r = await download(sp.imageUrl, dest)
        if (r === 'ok') { ok++; console.log(`  OK ${b.name} SP: ${sp.name}`) }
        else if (r === 'skip') skip++
        else { fail++; console.log(`  FAIL ${b.name} SP: ${sp.name}`) }
      }
    }

    // Gadgets
    for (const g of (b.gadgets || [])) {
      if (g.imageUrl) {
        const dest = path.join(BASE, 'gadgets', `${g.id}.png`)
        const r = await download(g.imageUrl, dest)
        if (r === 'ok') { ok++; console.log(`  OK ${b.name} Gadget: ${g.name}`) }
        else if (r === 'skip') skip++
        else { fail++; console.log(`  FAIL ${b.name} Gadget: ${g.name}`) }
      }
    }

    // Rate limit
    await new Promise(r => setTimeout(r, 50))
  }

  console.log(`\nDone: ${ok} downloaded, ${skip} skipped (exist), ${fail} failed (404)`)
}

main().catch(console.error)
