#!/usr/bin/env node
/**
 * Hunts orphan exports: symbols exported from src/ that have ZERO
 * external references anywhere in the repo (src/ + tests + scripts).
 *
 * Skips:
 *   - Files that match a Next.js framework convention (page/layout/route/
 *     opengraph-image/icon/sitemap/robots/manifest/proxy/middleware/etc.)
 *     since those are wired by file path, not by import.
 *   - Identifiers in FRAMEWORK_NAMES (default, GET, POST, generateMetadata,
 *     etc.) for the same reason.
 *
 * Run: node scripts/find-orphan-exports.js
 *
 * Treat output as CANDIDATES, not a delete list — verify each because
 * dynamic imports, JSX-only refs in MDX, or cross-package imports may
 * be missed by a static text scan.
 */

const fs = require('fs')
const path = require('path')

const FRAMEWORK_NAMES = new Set([
  'default', 'GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD',
  'generateMetadata', 'generateImageMetadata', 'metadata', 'sitemap', 'robots',
  'generateStaticParams', 'loading', 'error', 'not-found', 'page', 'layout',
  'template', 'head', 'opengraph-image', 'apple-icon', 'icon', 'manifest',
  'middleware', 'proxy', 'config', 'runtime', 'dynamic', 'revalidate',
  'fetchCache', 'preferredRegion', 'maxDuration', 'contentType', 'size', 'alt',
  'generateViewport', 'viewport',
])

const FRAMEWORK_FILES = /\/(page|layout|loading|error|template|not-found|head|route|opengraph-image|twitter-image|apple-icon|icon|sitemap|robots|manifest|proxy|middleware)\.(tsx?|ts)$/

function walk(dir, files = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.') || e.name === 'node_modules') continue
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p, files)
    else if (/\.(tsx?|js|jsx)$/.test(e.name)) files.push(p)
  }
  return files
}

const root = path.join(__dirname, '..')
const allFiles = [
  ...walk(path.join(root, 'src')),
  ...walk(path.join(root, 'scripts')),
]

// Exports come from src/ only (we never want to "export" from scripts).
// Skip files whose name matches a framework convention.
const exportEntries = []
for (const f of allFiles) {
  if (!f.includes(path.sep + 'src' + path.sep)) continue
  if (FRAMEWORK_FILES.test(f.replace(/\\/g, '/'))) continue
  if (f.includes(path.sep + '__tests__' + path.sep)) continue

  const txt = fs.readFileSync(f, 'utf-8')
  for (const m of txt.matchAll(/^export\s+(?:default\s+)?(?:async\s+)?(?:function|class|const|let|var|interface|type|enum)\s+(\w+)/gm)) {
    exportEntries.push({ name: m[1], file: f })
  }
  for (const m of txt.matchAll(/^export\s*\{([^}]+)\}/gm)) {
    for (const part of m[1].split(',').map(s => s.trim())) {
      const out = part.split(/\s+as\s+/).pop().trim()
      if (out) exportEntries.push({ name: out, file: f })
    }
  }
}

// Usage scan over EVERYTHING (including tests + scripts) so that helpers
// used only by their test file are NOT reported as orphans.
const fileText = new Map()
for (const f of allFiles) fileText.set(f, fs.readFileSync(f, 'utf-8'))

const orphans = []
for (const { name, file } of exportEntries) {
  if (FRAMEWORK_NAMES.has(name)) continue
  const re = new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g')
  let externalRefs = 0
  for (const [f, txt] of fileText) {
    if (f === file) continue
    const matches = txt.match(re)
    if (matches) externalRefs += matches.length
  }
  if (externalRefs === 0) orphans.push({ name, file })
}

orphans.sort((a, b) => a.file.localeCompare(b.file) || a.name.localeCompare(b.name))

console.log(`Total exports scanned (production src/): ${exportEntries.length}`)
console.log(`Orphan candidates (zero external references in src/+tests+scripts): ${orphans.length}`)
console.log('')
for (const o of orphans) {
  const rel = o.file.replace(root + path.sep, '').replace(/\\/g, '/')
  console.log(`  ${o.name.padEnd(40)}  ${rel}`)
}
