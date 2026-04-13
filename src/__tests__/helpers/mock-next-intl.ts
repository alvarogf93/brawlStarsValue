/**
 * Strict `next-intl` mock for component tests.
 *
 * Production `next-intl` throws `IntlError FORMATTING_ERROR` at runtime when
 * a translation key references a `{param}` interpolation that the caller did
 * not supply (e.g. `t('teammatesSeeMore')` when the key is `"Ver más ({count})"`).
 * The inline mocks we previously used silently returned `?` as a fallback,
 * hiding this class of bug in tests. It was exactly how the PlayNow
 * `teammatesSeeMore` aria-label bug shipped to production.
 *
 * This helper replicates the strict behaviour:
 *  - If a string contains `{foo}` and `params.foo` is missing → THROW the
 *    same class of error the runtime would throw, so tests fail loudly.
 *  - If the key is not in the dictionary → returns the key verbatim so
 *    components referencing keys not yet in the locale file still render
 *    (preserves the ergonomic property of the old mock).
 *
 * Usage:
 *
 *   import { vi } from 'vitest'
 *   import { mockNextIntl } from '@/__tests__/helpers/mock-next-intl'
 *
 *   vi.mock('next-intl', () => mockNextIntl({
 *     teammatesLabel: 'TEAMMATES',
 *     teammatesSeeMore: 'See more ({count})',
 *   }))
 */

type TranslationDict = Record<string, string>

export class MockIntlFormattingError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'MockIntlFormattingError'
  }
}

/**
 * Build the object to pass to `vi.mock('next-intl', () => ...)`.
 * Accepts a flat dictionary of keys → templates (with `{param}` markers).
 */
export function mockNextIntl(dict: TranslationDict) {
  function format(
    template: string,
    params: Record<string, string | number> | undefined,
    key: string,
  ): string {
    // Match every `{name}` token in the template. For each one, require
    // that params has a value for that name. Throw if not — mirrors
    // production behaviour where the user sees a hard error.
    return template.replace(/\{(\w+)\}/g, (_match, name: string) => {
      if (!params || !(name in params) || params[name] === undefined) {
        throw new MockIntlFormattingError(
          `FORMATTING_ERROR: The intl string context variable "${name}" was not provided ` +
          `to the string "${template}" (key: "${key}")`,
        )
      }
      return String(params[name])
    })
  }

  return {
    useTranslations: () =>
      (key: string, params?: Record<string, string | number>): string => {
        const template = dict[key]
        // Unknown key → return verbatim (component hasn't been translated yet).
        if (template === undefined) return key
        return format(template, params, key)
      },
  }
}
