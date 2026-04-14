import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'

// ── next-intl strict mock (inlined to avoid vi.mock hoisting error) ──
// vi.mock is hoisted to the top of the file before any top-level
// `const` assignment runs, so we can't reference an external helper
// here. We replicate the subset of `mock-next-intl.ts` behavior we
// need: a `useTranslations` that returns literal keys if unknown.
vi.mock('next-intl', () => {
  const dict: Record<string, string> = {
    placeholder: 'Introduce tu player tag',
    cta: 'Calcular',
    calculating: 'Calculando…',
    invalidTag: 'Tag inválido',
  }
  return {
    useTranslations: () => (key: string) => dict[key] ?? key,
    useLocale: () => 'es',
  }
})

// ── next/navigation router mock ─────────────────────────────────
const routerReplace = vi.fn()
const routerPush = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: routerReplace, push: routerPush }),
}))

// ── useAuth mock (dynamic state set per-test) ───────────────────
interface MockAuthState {
  profile: { player_tag: string } | null
  loading: boolean
}
let currentAuth: MockAuthState = { profile: null, loading: false }
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => currentAuth,
}))

// ── localStorage scratchpad ─────────────────────────────────────
const storageBacking = new Map<string, string>()
const mockStorage = {
  getItem: vi.fn((k: string) => storageBacking.get(k) ?? null),
  setItem: vi.fn((k: string, v: string) => { storageBacking.set(k, v) }),
  removeItem: vi.fn((k: string) => { storageBacking.delete(k) }),
  clear: vi.fn(() => storageBacking.clear()),
  get length() { return storageBacking.size },
  key: (i: number) => Array.from(storageBacking.keys())[i] ?? null,
}
Object.defineProperty(window, 'localStorage', { value: mockStorage, writable: true })

import { InputForm } from '@/components/landing/InputForm'

beforeEach(() => {
  routerReplace.mockClear()
  routerPush.mockClear()
  storageBacking.clear()
  currentAuth = { profile: null, loading: false }
})

afterEach(() => {
  cleanup()
})

describe('InputForm — post-OAuth redirect behaviour', () => {
  it('redirects to the profile when AuthProvider resolves a profile with a player_tag', () => {
    // Simulates: user just logged in, AuthProvider has finished fetching
    // the profile, no localStorage entry yet (fresh browser / post-canonical-flip).
    // Expected: one router.replace call to the user's profile page.
    currentAuth = { profile: { player_tag: '#ABC123' }, loading: false }
    render(<InputForm />)
    expect(routerReplace).toHaveBeenCalledTimes(1)
    expect(routerReplace).toHaveBeenCalledWith('/es/profile/%23ABC123')
  })

  it('does NOT redirect while AuthProvider is still loading (avoids premature push)', () => {
    currentAuth = { profile: null, loading: true }
    storageBacking.set('brawlvalue:user', '#STALE99')
    render(<InputForm />)
    // Even though localStorage has a value, we must wait for auth to
    // resolve before deciding — the cookies might contradict a stale
    // localStorage entry from a previous account on the same machine.
    expect(routerReplace).not.toHaveBeenCalled()
  })

  it('falls back to localStorage when there is no profile (anonymous returning user)', () => {
    // Unauthenticated user who previously searched for a tag via the
    // landing form (localStorage populated by `handleSubmit`).
    currentAuth = { profile: null, loading: false }
    storageBacking.set('brawlvalue:user', '#REMEMBERED')
    render(<InputForm />)
    expect(routerReplace).toHaveBeenCalledTimes(1)
    expect(routerReplace).toHaveBeenCalledWith('/es/profile/%23REMEMBERED')
  })

  it('prefers profile.player_tag over localStorage when both are present', () => {
    // localStorage could be stale (older account on the same machine).
    // The authenticated profile is the source of truth.
    currentAuth = { profile: { player_tag: '#AUTH_USER' }, loading: false }
    storageBacking.set('brawlvalue:user', '#LOCAL_USER')
    render(<InputForm />)
    expect(routerReplace).toHaveBeenCalledTimes(1)
    expect(routerReplace).toHaveBeenCalledWith('/es/profile/%23AUTH_USER')
    expect(routerReplace).not.toHaveBeenCalledWith('/es/profile/%23LOCAL_USER')
  })

  it('does nothing when there is no profile AND no localStorage (fresh anonymous user)', () => {
    currentAuth = { profile: null, loading: false }
    render(<InputForm />)
    expect(routerReplace).not.toHaveBeenCalled()
  })

  it('re-evaluates the redirect when the profile becomes available after initial render', () => {
    // This is the critical regression case. The post-OAuth flow is:
    //
    //   1. User logs in → callback sets cookies → redirects to /es
    //   2. Landing renders, AuthProvider starts resolving session
    //   3. InputForm mounts. authLoading=true, profile=null → no redirect (good)
    //   4. AuthProvider resolves → profile becomes the linked user → re-render
    //   5. InputForm effect re-runs with the new profile → redirects
    //
    // Before the fix, step 5 didn't happen because the effect only
    // depended on `[locale, router]`, not on the auth state.
    currentAuth = { profile: null, loading: true }
    const { rerender } = render(<InputForm />)
    expect(routerReplace).not.toHaveBeenCalled()

    // Simulate the async resolution of the profile
    currentAuth = { profile: { player_tag: '#LATE_RESOLVE' }, loading: false }
    rerender(<InputForm />)
    expect(routerReplace).toHaveBeenCalledTimes(1)
    expect(routerReplace).toHaveBeenCalledWith('/es/profile/%23LATE_RESOLVE')
  })
})
