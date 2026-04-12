import { test, expect } from '@playwright/test'

/**
 * Sidebar navigation between profile sections.
 * Dev server compiles pages on-demand so nav tests
 * use generous timeouts.
 */

const TEST_TAG = '#2P0Q8C2C0'
const ENCODED_TAG = encodeURIComponent(TEST_TAG)
const BASE_PATH = `/es/profile/${ENCODED_TAG}`

test.describe('Profile sidebar navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_PATH, { waitUntil: 'domcontentloaded' })
    await page.waitForSelector('aside[role="navigation"]', { timeout: 45_000 })
  })

  test('sidebar is visible on desktop with all nav items', async ({ page }) => {
    const sidebar = page.locator('aside[role="navigation"]')
    await expect(sidebar).toBeVisible()

    const links = sidebar.locator('a')
    const count = await links.count()
    expect(count).toBeGreaterThanOrEqual(7)
  })

  test('clicking brawlers link updates URL', async ({ page }) => {
    const link = page.locator(`aside a[href="${BASE_PATH}/brawlers"]`)
    await link.click()
    await expect(page).toHaveURL(/\/brawlers/, { timeout: 60_000 })
  })

  test('clicking stats link updates URL', async ({ page }) => {
    const link = page.locator(`aside a[href="${BASE_PATH}/stats"]`)
    await link.click()
    await expect(page).toHaveURL(/\/stats/, { timeout: 60_000 })
  })

  test('clicking club link updates URL', async ({ page }) => {
    const link = page.locator(`aside a[href="${BASE_PATH}/club"]`)
    await link.click()
    await expect(page).toHaveURL(/\/club/, { timeout: 60_000 })
  })

  test('clicking share link updates URL', async ({ page }) => {
    const link = page.locator(`aside a[href="${BASE_PATH}/share"]`)
    await link.click()
    await expect(page).toHaveURL(/\/share/, { timeout: 60_000 })
  })

  test('header shows BrawlVision logo', async ({ page }) => {
    const logo = page.locator('header img[alt="BrawlVision"]')
    await expect(logo).toBeVisible()
  })

  test('leaderboard link is present in header', async ({ page }) => {
    const leaderboardLink = page.locator('header a[href*="/leaderboard"]')
    await expect(leaderboardLink).toBeVisible()
  })
})

test.describe('Mobile sidebar', () => {
  test.use({ viewport: { width: 375, height: 812 } })

  test('sidebar is hidden by default on mobile', async ({ page }) => {
    await page.goto(BASE_PATH, { waitUntil: 'domcontentloaded' })
    await page.waitForSelector('header', { timeout: 45_000 })

    const sidebar = page.locator('aside[role="navigation"]')
    const firstLink = sidebar.locator('a').first()
    await expect(firstLink).not.toBeInViewport()
  })

  test('hamburger menu opens sidebar on mobile', async ({ page }) => {
    await page.goto(BASE_PATH, { waitUntil: 'domcontentloaded' })
    await page.waitForSelector('header', { timeout: 45_000 })

    const menuButton = page.locator('button[aria-label="Toggle menu"]')
    await expect(menuButton).toBeVisible()
    await menuButton.click()

    const sidebar = page.locator('aside[role="navigation"]')
    const firstLink = sidebar.locator('a').first()
    await expect(firstLink).toBeVisible()
  })
})
