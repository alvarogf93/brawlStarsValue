import { test, expect } from '@playwright/test'

/**
 * Locale switching tests.
 * Pre-accepts cookies to prevent UI interference.
 * Waits for full hydration before clicking interactive elements.
 */

test.describe('Locale switching', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.removeItem('brawlvalue:user')
      localStorage.setItem('brawlvalue:cookie-consent', 'accepted')
    })
  })

  /** Wait for React hydration by checking that event handlers are attached */
  async function waitForHydration(page: import('@playwright/test').Page) {
    await page.waitForFunction(() => {
      // React hydration attaches __reactFiber on elements
      const input = document.querySelector('#player-tag-input')
      if (!input) return false
      return Object.keys(input).some(k => k.startsWith('__react'))
    }, { timeout: 30_000 })
  }

  test('landing page loads in Spanish', async ({ page }) => {
    await page.goto('/es', { waitUntil: 'domcontentloaded' })
    await expect(page.locator('html')).toHaveAttribute('lang', 'es')
    await expect(page.locator('#player-tag-input')).toBeVisible({ timeout: 30_000 })
  })

  test('locale switcher is visible', async ({ page }) => {
    await page.goto('/es', { waitUntil: 'domcontentloaded' })
    await waitForHydration(page)

    const switcher = page.locator('button[title="Change Language"]')
    await expect(switcher).toBeVisible()
    await expect(switcher).toContainText('ES')
  })

  test('switches from Spanish to English', async ({ page }) => {
    await page.goto('/es', { waitUntil: 'domcontentloaded' })
    await waitForHydration(page)

    // Click locale switcher
    await page.locator('button[title="Change Language"]').click()

    // Wait for the dropdown with locale options
    const englishBtn = page.locator('button', { hasText: 'English' })
    await expect(englishBtn).toBeVisible({ timeout: 5_000 })

    await englishBtn.click()

    await expect(page).toHaveURL(/\/en/, { timeout: 60_000 })
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  })

  test('switches from English to French', async ({ page }) => {
    await page.goto('/en', { waitUntil: 'domcontentloaded' })
    await waitForHydration(page)

    await page.locator('button[title="Change Language"]').click()

    const frenchBtn = page.locator('button', { hasText: 'Français' })
    await expect(frenchBtn).toBeVisible({ timeout: 5_000 })

    await frenchBtn.click()

    await expect(page).toHaveURL(/\/fr/, { timeout: 60_000 })
    await expect(page.locator('html')).toHaveAttribute('lang', 'fr')
  })

  test('preserves path when switching locale on profile page', async ({ page }) => {
    const tag = encodeURIComponent('#2P0Q8C2C0')
    await page.goto(`/es/profile/${tag}/brawlers`, { waitUntil: 'domcontentloaded' })
    await page.waitForSelector('header', { timeout: 30_000 })
    // Wait for hydration on profile page
    await page.waitForFunction(() => {
      const btn = document.querySelector('button[title="Change Language"]')
      return btn && Object.keys(btn).some(k => k.startsWith('__react'))
    }, { timeout: 30_000 })
    // Extra wait — profile page re-renders when player data loads/fails
    await page.waitForTimeout(2_000)

    // Click locale switcher — retry if dropdown doesn't open (re-render may close it)
    const englishBtn = page.locator('button', { hasText: 'English' })
    for (let attempt = 0; attempt < 3; attempt++) {
      await page.locator('button[title="Change Language"]').click()
      if (await englishBtn.isVisible({ timeout: 3_000 }).catch(() => false)) break
    }
    await expect(englishBtn).toBeVisible({ timeout: 5_000 })
    await englishBtn.click()

    await expect(page).toHaveURL(/\/en\/profile\/.*\/brawlers/, { timeout: 60_000 })
  })

  test('all 13 locales are available in the dropdown', async ({ page }) => {
    await page.goto('/es', { waitUntil: 'domcontentloaded' })
    await waitForHydration(page)

    await page.locator('button[title="Change Language"]').click()

    // Wait for any locale button to appear
    const firstLocaleBtn = page.locator('button', { hasText: 'English' })
    await expect(firstLocaleBtn).toBeVisible({ timeout: 5_000 })

    // Count all buttons in the locale dropdown container
    // The dropdown is the only element with these locale buttons
    const allLocaleButtons = page.locator('button', { hasText: /^(Español|English|Français|Português|Deutsch|Italiano|Русский|Türkçe|Polski|العربية|한국어|日本語|中文)/ })
    const count = await allLocaleButtons.count()
    expect(count).toBe(13)
  })
})
