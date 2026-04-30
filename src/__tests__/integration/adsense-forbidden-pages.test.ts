import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, it, expect } from 'vitest'

/**
 * Reglas duras de AdSense Valuable Inventory: las pantallas de
 * calculadora / formulario y las pantallas de acción puntual (share,
 * download, login, thank-you) NO pueden servir ads. Esto es una
 * infracción de política, no una preferencia.
 *
 * Histórico (2026-04-30): Google sancionó la cuenta porque
 * `/profile/[tag]/cosmetics` (calculadora de gemas) y
 * `/profile/[tag]/share` (tarjeta viral) renderizaban un
 * <SafeAdSlot> a pesar de que la decisión-record de CLAUDE.md ya
 * decía que no debían tener ads. Este test es el guardrail que
 * impide reintroducir los slots por descuido.
 *
 * No basta con buscar el componente — el simple `import` ya es
 * señal de que alguien intentó volver a poner el slot.
 */

const FORBIDDEN_PAGES = [
  'src/app/[locale]/profile/[tag]/cosmetics/page.tsx',
  'src/app/[locale]/profile/[tag]/share/page.tsx',
] as const

const REPO_ROOT = resolve(__dirname, '..', '..', '..')

describe('AdSense forbidden pages — calculadoras y share-cards no llevan ads', () => {
  for (const relPath of FORBIDDEN_PAGES) {
    it(`${relPath} no importa SafeAdSlot ni AdPlaceholder`, () => {
      const source = readFileSync(resolve(REPO_ROOT, relPath), 'utf-8')
      expect(source).not.toMatch(/from\s+['"]@\/components\/ui\/SafeAdSlot['"]/)
      expect(source).not.toMatch(/from\s+['"]@\/components\/ui\/AdPlaceholder['"]/)
      expect(source).not.toMatch(/<SafeAdSlot[\s>]/)
      expect(source).not.toMatch(/<AdPlaceholder[\s>]/)
    })
  }
})

/**
 * Densidad de ads — la política AdSense limita ad density alta. La
 * página /profile/[tag]/stats tenía 3 slots (top, mid, footer) y ese
 * exceso fue uno de los detonantes de la sanción 2026-04-30. Reducida
 * a 1 slot mid-page; este test fija ese contrato.
 */
describe('AdSense ad density — stats page tiene exactamente 1 SafeAdSlot', () => {
  it('/profile/[tag]/stats no acumula más de 1 SafeAdSlot rendered', () => {
    const source = readFileSync(
      resolve(REPO_ROOT, 'src/app/[locale]/profile/[tag]/stats/page.tsx'),
      'utf-8',
    )
    const renderMatches = source.match(/<SafeAdSlot[\s>]/g) ?? []
    expect(renderMatches).toHaveLength(1)
  })
})
