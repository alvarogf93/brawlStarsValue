import { test, expect } from '@playwright/test'

/**
 * Public brawler detail page.
 * These pages are SEO-critical and don't require auth.
 * Brawler ID 16000000 = Shelly (always exists in BrawlAPI)
 */

const BRAWLER_ID = 16000000
const BRAWLER_URL = `/es/brawler/${BRAWLER_ID}`

test.describe('Public brawler page', () => {
  test('renders brawler page and loads content', async ({ page }) => {
    await page.goto(BRAWLER_URL, { waitUntil: 'domcontentloaded' })

    // Wait for page to have meaningful content (cards with stats)
    await page.waitForSelector('[class*="brawl-card"]', { timeout: 30_000 })

    const pageText = await page.textContent('body')
    expect(pageText?.length).toBeGreaterThan(100)
  })

  test('shows brawler stats cards', async ({ page }) => {
    await page.goto(BRAWLER_URL, { waitUntil: 'domcontentloaded' })

    // Wait for stats to load — look for common stat labels
    await page.waitForFunction(
      () => {
        const text = document.body.textContent || ''
        return text.includes('Win Rate') || text.includes('Pick Rate') || text.includes('Batallas')
      },
      { timeout: 30_000 },
    )

    // At least one stat card should show a percentage
    const body = await page.textContent('body')
    expect(body).toMatch(/\d+\.?\d*%/)
  })

  test('has navigation back to index', async ({ page }) => {
    await page.goto(BRAWLER_URL, { waitUntil: 'domcontentloaded' })

    // "BrawlVision" back link should exist
    await expect(page.locator('a', { hasText: 'BrawlVision' })).toBeVisible({ timeout: 20_000 })
  })

  test('non-numeric brawler ID shows error', async ({ page }) => {
    await page.goto('/es/brawler/abc', { waitUntil: 'domcontentloaded' })

    // "Invalid brawler ID" message
    await expect(page.locator('text=/Invalid brawler ID/i')).toBeVisible({ timeout: 15_000 })
  })

  test('brawler index page lists brawlers', async ({ page }) => {
    await page.goto('/es/brawler', { waitUntil: 'domcontentloaded' })

    await page.waitForSelector('a[href*="/brawler/"]', { timeout: 30_000 })
    const brawlerLinks = page.locator('a[href*="/brawler/"]')
    const count = await brawlerLinks.count()
    expect(count).toBeGreaterThan(10)
  })

  test('SEO: page has meta description', async ({ page }) => {
    await page.goto(BRAWLER_URL, { waitUntil: 'domcontentloaded' })
    await page.waitForSelector('[class*="brawl-card"]', { timeout: 20_000 })

    const metaDesc = page.locator('meta[name="description"]')
    await expect(metaDesc).toHaveAttribute('content', /.+/)
  })
})
