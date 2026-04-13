import { test, expect } from '@playwright/test'

/**
 * Public /picks page (anonymous user) smoke test.
 *
 * Acceptance criterion: the page renders without a single console.error
 * during the full navigation flow. This is our regression net for any
 * runtime error that ships past unit tests — FORMATTING_ERROR from
 * next-intl, React throws, undefined property access, etc.
 *
 * If the assertion fails, read the `consoleErrors` array in the failure
 * to see exactly which error surfaced.
 */

/** Errors we expect and want to ignore (flaky third-party CDN, 404 images on fresh test data). */
const IGNORED_ERROR_PATTERNS: RegExp[] = [
  /Failed to load resource.*brawlify\.com/i,      // CDN occasionally 404s on specific portraits
  /Failed to load resource.*cdn-brawlstars/i,     // same
  /Hydration.*text content.*mismatch/i,           // Locale-dependent date formatting, covered elsewhere
  /ResizeObserver loop/i,                          // benign Chrome warning
  /manifest\.json.*Syntax error/i,                // manifest fetching; not our code
]

function collectConsoleErrors(page: import('@playwright/test').Page): string[] {
  const errors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return
    const text = msg.text()
    if (IGNORED_ERROR_PATTERNS.some(re => re.test(text))) return
    errors.push(text)
  })
  page.on('pageerror', (err) => {
    const text = err.message
    if (IGNORED_ERROR_PATTERNS.some(re => re.test(text))) return
    errors.push(`pageerror: ${text}`)
  })
  return errors
}

test.describe('/picks smoke — anonymous public flow', () => {
  test('renders the picks page without any console errors', async ({ page }) => {
    const errors = collectConsoleErrors(page)

    // Clear any saved session to ensure we test the anonymous flow
    await page.addInitScript(() => {
      try { localStorage.clear() } catch { /* ignore */ }
    })

    await page.goto('/es/picks', { waitUntil: 'domcontentloaded' })

    // Wait until the page has rendered meaningful content (not just the skeleton).
    // `.brawl-card` is used by every map card on this page.
    await page.waitForSelector('[class*="brawl-card"]', { timeout: 45_000 })

    // Give React 1s more to mount any post-hydration work (hooks that fetch
    // from /api/meta, client-side map image loading, etc.).
    await page.waitForTimeout(1000)

    // Assert zero console errors across the whole render flow
    expect(errors, `Console errors during /picks render:\n${errors.join('\n')}`).toHaveLength(0)
  })

  test('map cards contain readable text content', async ({ page }) => {
    await page.goto('/es/picks', { waitUntil: 'domcontentloaded' })
    await page.waitForSelector('[class*="brawl-card"]', { timeout: 45_000 })

    const bodyText = await page.textContent('body')
    expect(bodyText).toBeTruthy()
    // Either we have cards with "batallas" (sample-size label) OR we have
    // the empty-rotation state. Both are valid non-error states.
    const hasBattleCount = /batallas/i.test(bodyText ?? '')
    const hasEmptyState = /no hay|rotación/i.test(bodyText ?? '')
    expect(hasBattleCount || hasEmptyState).toBeTruthy()
  })
})
