#!/usr/bin/env node
/**
 * Insert a space after the slash in price-period strings across all
 * 13 locales, to prevent Googlebot from treating tokens like `/mes`,
 * `/mo`, `/año`, `/شهر`, `/月`… as relative URLs.
 *
 * Background (2026-04-20): Search Console reported 4 "404" URLs
 * (`/$`, `/mes`, `/año`, `/mo`) that Googlebot had invented by
 * parsing plain-text price copy like `€2.99/mes` as if `/mes` were
 * a relative path. Adding a single space after the slash
 * (`€2.99/ mes`) breaks the token so Google's link extractor no
 * longer treats it as a URL, while the visual change is minimal.
 *
 * Keys touched (explicit allowlist — no other keys are inspected):
 *   - landing.premiumFrom
 *   - premium.planMonthlyPeriod
 *   - premium.planQuarterlyPeriod
 *   - premium.planYearlyPeriod
 *   - premium.teaserSubtitle
 *
 * Transformation: replace `/X` with `/ X` where X is the first
 * non-space, non-slash character after the slash. Idempotent: if
 * the slash is already followed by a space, nothing changes.
 *
 * Safety:
 *   - Explicit key allowlist (no blanket JSON walk). The regex IS
 *     naive about URLs: it would rewrite `https://foo.com/bar` to
 *     `https:// foo.com/ bar`. That's fine today because none of
 *     the 5 allowlisted keys contain a URL — if you ever add a key
 *     that does, tighten the regex (e.g. `(?<!:)\/([^\s/])`) first.
 *   - Preserves original JSON indentation (2 spaces) and trailing
 *     newline
 *   - Re-runnable: second run is a no-op
 */

const fs = require('fs')
const path = require('path')

const MESSAGES_DIR = path.join(__dirname, '..', 'messages')
const LOCALES = ['es', 'en', 'fr', 'pt', 'de', 'it', 'ru', 'tr', 'pl', 'ar', 'ko', 'ja', 'zh']

// Map of namespace → keys to touch within that namespace.
const TARGETS = {
  landing: ['premiumFrom'],
  premium: ['planMonthlyPeriod', 'planQuarterlyPeriod', 'planYearlyPeriod', 'teaserSubtitle'],
}

/** Insert a space after any slash followed by a non-space, non-slash char. */
function fixSlashSpacing(value) {
  if (typeof value !== 'string') return value
  return value.replace(/\/([^\s/])/g, '/ $1')
}

let totalChanged = 0
let totalUnchanged = 0
const missingFiles = []
const missingKeys = []

for (const locale of LOCALES) {
  const filePath = path.join(MESSAGES_DIR, `${locale}.json`)
  if (!fs.existsSync(filePath)) {
    missingFiles.push(locale)
    continue
  }

  const raw = fs.readFileSync(filePath, 'utf-8')
  const data = JSON.parse(raw)

  let localeChanged = 0
  let localeUnchanged = 0

  for (const [namespace, keys] of Object.entries(TARGETS)) {
    if (!data[namespace] || typeof data[namespace] !== 'object') {
      missingKeys.push(`${locale}.${namespace}`)
      continue
    }
    for (const key of keys) {
      if (!(key in data[namespace])) {
        // Not every locale has every key (e.g. some locales skip
        // planYearlyPeriod). Skip silently — only missing entire
        // namespaces are reported.
        continue
      }
      const before = data[namespace][key]
      const after = fixSlashSpacing(before)
      if (before === after) {
        localeUnchanged++
      } else {
        data[namespace][key] = after
        localeChanged++
        console.log(`[${locale}] ${namespace}.${key}:`)
        console.log(`    before: ${JSON.stringify(before)}`)
        console.log(`    after:  ${JSON.stringify(after)}`)
      }
    }
  }

  if (localeChanged > 0) {
    const trailingNewline = raw.endsWith('\n') ? '\n' : ''
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + trailingNewline, 'utf-8')
  }

  totalChanged += localeChanged
  totalUnchanged += localeUnchanged
}

console.log('\n' + '='.repeat(60))
console.log(`Summary:`)
console.log(`  Keys updated:   ${totalChanged}`)
console.log(`  Keys unchanged: ${totalUnchanged} (already spaced or no slash)`)
if (missingFiles.length) console.log(`  Missing locale files: ${missingFiles.join(', ')}`)
if (missingKeys.length) console.log(`  Missing namespaces:   ${missingKeys.join(', ')}`)
console.log('='.repeat(60))

if (missingFiles.length || missingKeys.length) {
  process.exitCode = 1
}
