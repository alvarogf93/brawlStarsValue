import { test, expect } from '@playwright/test'

/**
 * Compare page smoke test with POSITIVE assertion for the trophy chart.
 *
 * This is the regression lock for the Sprint D "Cambio de Trofeos
 * desaparecido" bug. The chart was invisible in localhost because
 * BRAWLSTARS_API_URL wasn't set — src/lib/api.ts fell back to a VPS IP
 * unreachable from dev machines, and the component was gated on
 * `p1Battles?.battles && p2Battles?.battles` so it silently didn't
 * render with zero console errors.
 *
 * Zero-console-error smoke tests do NOT catch this class of bug —
 * silent component absence is not an error. We need a positive
 * assertion: "this specific element MUST be visible after load".
 *
 * This test uses two real Brawl Stars player tags and an opponent
 * tag passed via query string.
 */

const TEST_TAG = '#2P0Q8C2C0'
const OPPONENT_TAG = '#YJU282PV'
const ENCODED_TAG = encodeURIComponent(TEST_TAG)
const ENCODED_OPPONENT = encodeURIComponent(OPPONENT_TAG)

test.describe('Compare page — trophy chart regression lock', () => {
  test('renders the comparison page shell without console errors', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', err => errors.push(err.message))
    page.on('console', msg => {
      if (msg.type() === 'error' && !/brawlify|cdn-brawlstars|ResizeObserver|manifest/i.test(msg.text())) {
        errors.push(msg.text())
      }
    })

    await page.goto(`/es/profile/${ENCODED_TAG}/compare`, { waitUntil: 'domcontentloaded' })

    // Shell should appear — at minimum the page scaffold / layout nav
    await page.waitForSelector('aside[role="navigation"], [class*="brawl-card"]', {
      timeout: 60_000,
    })

    expect(errors, `Console errors:\n${errors.join('\n')}`).toHaveLength(0)
  })

  test('renders the CompareTrophyChart when both player battlelogs load successfully', async ({ page }) => {
    // Navigate with opponent query param so the compare logic runs
    await page.goto(
      `/es/profile/${ENCODED_TAG}/compare?opponent=${ENCODED_OPPONENT}`,
      { waitUntil: 'domcontentloaded' },
    )

    // Wait for the comparison shell
    await page.waitForSelector('aside[role="navigation"], [class*="brawl-card"]', {
      timeout: 60_000,
    })

    // POSITIVE assertion: the CompareTrophyChart must eventually render.
    // The component's i18n title comes from the `battles` namespace
    // `trophyChange` key — "Cambio de Trofeos (reciente)" in Spanish.
    //
    // If BRAWLSTARS_API_URL is missing OR the Supercell API is unreachable,
    // `useBattlelog` sets `data` to null, the gate `p1Battles?.battles &&
    // p2Battles?.battles` evaluates to false, the chart never renders, and
    // this test FAILS — which is exactly the regression we want to catch.
    //
    // 45s timeout: useBattlelog has a 2min cache TTL + the dev server
    // compiles compare/page.tsx on first visit, so we need generous budget.
    const trophyChartLocator = page.getByText(/Cambio de Trofeos|Trophy Change/i).first()

    try {
      await expect(trophyChartLocator).toBeVisible({ timeout: 45_000 })
    } catch (err) {
      // Give an actionable error message if the chart is missing
      const bodyText = (await page.textContent('body')) ?? ''
      const hasLoadingState = /cargando|loading/i.test(bodyText)
      const hasErrorState = /error|no se pud/i.test(bodyText)
      throw new Error(
        `CompareTrophyChart did not render within 45s.\n` +
        `Page has loading state: ${hasLoadingState}\n` +
        `Page has error state: ${hasErrorState}\n` +
        `Likely cause: BRAWLSTARS_API_URL missing or Supercell API unreachable.\n` +
        `Original error: ${(err as Error).message}`,
      )
    }
  })
})
