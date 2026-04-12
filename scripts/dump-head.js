#!/usr/bin/env node
// Dump the full <head> of brawlvision.com as fetched by Twitterbot.
// Used to confirm which og:/twitter:/link/meta tags are actually rendered.

async function main() {
  const res = await fetch('https://brawlvision.com/es', {
    headers: { 'User-Agent': 'Twitterbot/1.0' },
    redirect: 'follow',
  })
  const html = await res.text()
  const match = html.match(/<head[^>]*>([\s\S]*?)<\/head>/i)
  if (!match) {
    console.log('NO <head> found')
    return
  }
  const head = match[1]
  // Print only <meta>, <link>, and <title>
  const lines = head.split(/(?=<(?:meta|link|title)\b)/i).filter(l => /<(meta|link|title)\b/i.test(l))
  for (const l of lines) {
    // Trim trailing junk after the self-closing >
    const m = l.match(/^(<[^>]+>)/)
    if (m) console.log(m[1])
  }
}

main().catch(e => { console.error(e); process.exit(1) })
