import { test, expect } from '@playwright/test'

/**
 * AdSense compliance — every public page that serves ads must
 * have at least 500 words of editorial content rendered before
 * the first <ins class="adsbygoogle"> slot.
 *
 * The threshold is 500 (not 600 / 800) because that's the minimum
 * the industry consensus and AdSense reviewer feedback convergence
 * on for thin-content avoidance, even though some of our pages
 * (`/brawler`, `/battle-history`) carry significantly more.
 *
 * The crawl tests `/es` only — copy length is roughly comparable
 * across the 13 locales because the i18n batches translate the
 * source paragraphs faithfully. If a single locale ever ships
 * with truncated keys, the unit test for translation parity will
 * catch it before this E2E does.
 */

const PUBLIC_AD_PAGES = [
  '/es/brawler',
  '/es/picks',
  '/es/battle-history',
  '/es/leaderboard',
] as const

const MIN_WORDS_BEFORE_FIRST_AD = 500

test.describe('AdSense ad-content ratio', () => {
  for (const url of PUBLIC_AD_PAGES) {
    test(`${url}: ≥${MIN_WORDS_BEFORE_FIRST_AD} words before first ad slot`, async ({ page }) => {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 })
      // Wait for main to populate beyond skeleton state.
      await page.waitForSelector('main h1, main h2', { timeout: 30_000 })

      const wordsBefore = await page.evaluate(() => {
        const main = document.querySelector('main')
        if (!main) return -1

        // First AdSense slot, regardless of how it was injected. The
        // <ins class="adsbygoogle"> element comes from AdPlaceholder.
        const firstAd = main.querySelector('ins.adsbygoogle, .adsbygoogle')
        if (!firstAd) {
          // No ad slot was rendered (gate passed false, or premium user,
          // or page genuinely has no slot). Total content suffices.
          return (main.textContent ?? '').trim().split(/\s+/).filter(Boolean).length
        }

        // Walk text nodes inside `main`, sum word counts until we hit
        // a node that is NOT preceding the first ad in DOM order.
        const walker = document.createTreeWalker(
          main,
          NodeFilter.SHOW_TEXT,
        )
        let count = 0
        let node: Node | null = walker.nextNode()
        while (node) {
          const text = (node.textContent ?? '').trim()
          if (text) {
            const pos = firstAd.compareDocumentPosition(node)
            if (pos & Node.DOCUMENT_POSITION_PRECEDING) {
              count += text.split(/\s+/).filter(Boolean).length
            } else if (firstAd.contains(node)) {
              // Inside the ad — ignore
            } else {
              // Following or contains the ad — we're past it
              break
            }
          }
          node = walker.nextNode()
        }
        return count
      })

      expect(wordsBefore).toBeGreaterThanOrEqual(MIN_WORDS_BEFORE_FIRST_AD)
    })
  }
})
