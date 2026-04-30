import '@testing-library/jest-dom/vitest'
import { afterEach, vi } from 'vitest'

// TEST-15 — Hardened global teardown. Without it, every test file had
// to remember to clear mocks, restore env, and clear localStorage on its
// own. Several integration tests stubbed `process.env.*` at top-level
// without restoration (TEST-10 in the audit), contaminating later
// suites. Doing it once here makes that class of bug unreachable.
afterEach(() => {
  vi.clearAllMocks()
  vi.unstubAllEnvs()
  if (typeof localStorage !== 'undefined') {
    localStorage.clear()
  }
})
