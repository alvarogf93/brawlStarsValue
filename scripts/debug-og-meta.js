#!/usr/bin/env node
/**
 * Debug Open Graph / Twitter Card metadata on production.
 * Fetches the landing page as Twitterbot and prints all og:/twitter:
 * meta tags. Then probes the image URLs to check they resolve.
 */

const TB = 'Twitterbot/1.0'
const URLS_TO_CHECK = [
  'https://brawlvision.com/',
  'https://brawlvision.com/es',
  'https://brawlvision.com/en',
]

async function fetchHtml(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': TB },
    redirect: 'follow',
  })
  const html = await res.text()
  return { status: res.status, finalUrl: res.url, html }
}

function extractMetas(html) {
  const metas = []
  const re = /<meta[^>]+(?:property|name)=["'](og:[^"']+|twitter:[^"']+)["'][^>]*>/g
  let m
  while ((m = re.exec(html)) !== null) {
    const tag = m[0]
    const nameMatch = tag.match(/(?:property|name)=["']([^"']+)["']/)
    const contentMatch = tag.match(/content=["']([^"']+)["']/)
    if (nameMatch && contentMatch) {
      metas.push({ name: nameMatch[1], content: contentMatch[1] })
    }
  }
  return metas
}

async function probeImage(url) {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': TB } })
    const buf = await res.arrayBuffer()
    const ct = res.headers.get('content-type') || ''
    const first4 = Buffer.from(buf.slice(0, 8)).toString('hex')
    return {
      status: res.status,
      contentType: ct,
      bytes: buf.byteLength,
      first8bytes: first4,
      looksLikePNG: first4.startsWith('89504e47'),
    }
  } catch (err) {
    return { error: err.message }
  }
}

async function main() {
  for (const url of URLS_TO_CHECK) {
    console.log(`\n═══ ${url} ═══`)
    try {
      const { status, finalUrl, html } = await fetchHtml(url)
      console.log(`  status: ${status}`)
      if (finalUrl !== url) console.log(`  redirected to: ${finalUrl}`)
      const metas = extractMetas(html)
      if (metas.length === 0) {
        console.log('  ⚠ NO og:/twitter: meta tags found')
      } else {
        for (const m of metas) {
          console.log(`  ${m.name}: ${m.content}`)
        }
      }
    } catch (err) {
      console.log(`  ✗ ${err.message}`)
    }
  }

  // Probe the image URL directly
  const imageCandidates = [
    'https://brawlvision.com/opengraph-image',
    'https://brawlvision.com/opengraph-image.png',
    'https://brawlvision.com/es/opengraph-image',
  ]
  console.log('\n═══ Image URL probes ═══')
  for (const url of imageCandidates) {
    const r = await probeImage(url)
    console.log(`  ${url}`)
    console.log(`    → ${JSON.stringify(r)}`)
  }
}

main().catch((err) => {
  console.error('Unexpected error:', err)
  process.exit(1)
})
