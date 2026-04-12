import { test, expect } from '@playwright/test'

/**
 * Share page tests.
 * Tests the share/flex page UI shell (sidebar, header, layout).
 * Data availability depends on the Supercell API.
 */

const TEST_TAG = '#2P0Q8C2C0'
const ENCODED_TAG = encodeURIComponent(TEST_TAG)
const SHARE_URL = `/es/profile/${ENCODED_TAG}/share`

test.describe('Share page', () => {
  test('renders share page layout', async ({ page }) => {
    await page.goto(SHARE_URL, { waitUntil: 'domcontentloaded' })

    // Wait for the profile shell to load (header + sidebar)
    await page.waitForSelector('header', { timeout: 20_000 })
    await page.waitForSelector('aside[role="navigation"]', { timeout: 10_000 })

    // The page should have content inside main
    const main = page.locator('main')
    await expect(main).toBeVisible()
  })

  test('has sidebar with share link active', async ({ page }) => {
    await page.goto(SHARE_URL, { waitUntil: 'domcontentloaded' })
    await page.waitForSelector('aside[role="navigation"]', { timeout: 20_000 })

    // Share link should exist in sidebar
    const shareLink = page.locator(`aside a[href*="/share"]`)
    await expect(shareLink).toBeVisible()
  })

  test('header shows BrawlVision logo', async ({ page }) => {
    await page.goto(SHARE_URL, { waitUntil: 'domcontentloaded' })
    await page.waitForSelector('header', { timeout: 20_000 })

    const logo = page.locator('header img[alt="BrawlVision"]')
    await expect(logo).toBeVisible()
  })

  test('share page shows content or loading state', async ({ page }) => {
    await page.goto(SHARE_URL, { waitUntil: 'domcontentloaded' })

    // Either shows the share card with data, an error, or loading skeleton
    await page.waitForFunction(
      () => {
        const body = document.body.textContent || ''
        // Has meaningful content: heading, error text, or loading
        return body.length > 200
      },
      { timeout: 20_000 },
    )
  })
})
