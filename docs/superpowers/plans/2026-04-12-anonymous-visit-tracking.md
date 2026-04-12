# Anonymous Visit Tracking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Track anonymous visitors who submit their player tag from the landing page, store them in a new `anonymous_visits` table, and send a Telegram notification on first occurrence of each tag.

**Architecture:** Piggyback on the existing `POST /api/calculate` route to reuse the Supercell API call it already makes. A `?from=landing` query param distinguishes landing submissions from shared-link visits. Auth check runs inline in the request handler (cookie context guaranteed), then `after()` schedules the tracker as a post-response background task. The tracker uses a stateless `@supabase/supabase-js` client with service role — no cookies, safe in any execution context.

**Tech Stack:** Next.js 16 App Router, TypeScript strict, Supabase (`@supabase/ssr` + `@supabase/supabase-js@^2.101.1`), Vitest, pg_cron.

**Design spec:** `docs/superpowers/specs/2026-04-12-anonymous-visit-tracking-design.md` (v4). This plan is a direct translation of that spec — if you find a contradiction, the spec wins and you should flag it.

---

## File Structure

**Create:**
- `supabase/migrations/009_anonymous_visits.sql` — table, RPC, cron job
- `src/lib/anonymous-visits.ts` — server tracker module (~100 lines)
- `src/__tests__/unit/lib/anonymous-visits.test.ts` — unit tests for the tracker

**Modify:**
- `src/app/api/calculate/route.ts` — locale whitelist, inline auth check, `after()` tracking
- `src/__tests__/integration/api/calculate.test.ts` — integration tests for the new branches
- `src/hooks/usePlayerData.ts` — accept `fromLanding`/`locale` opts, forward in body
- `src/app/[locale]/profile/[tag]/page.tsx` — read `useSearchParams`, pass to hook
- `src/app/[locale]/profile/[tag]/DashboardLayoutClient.tsx` — wrap `{children}` in `<Suspense fallback={null}>`
- `src/components/landing/InputForm.tsx` — append `?from=landing` to `router.push`

**Do not touch:**
- `src/lib/supabase/server.ts` — the tracker uses `@supabase/supabase-js` directly, bypassing this file
- `src/lib/telegram.ts` — `notify()` is called as-is, no changes
- `src/lib/utils.ts` — `isValidPlayerTag` / `normalizePlayerTag` are consumed, no changes
- `src/proxy.ts` — locale routing untouched
- `src/lib/constants.ts` / `src/app/api/profile/route.ts` — the regex inconsistency is explicitly out of scope (Q-E)

**Reference constants you will need:**
- `PLAYER_TAG_REGEX` lives in `src/lib/constants.ts` as `/^#[0-9A-Z]{3,20}$/i`.
- The 13 supported locales are `['es', 'en', 'fr', 'pt', 'de', 'it', 'ru', 'tr', 'pl', 'ar', 'ko', 'ja', 'zh']` (from `src/i18n/routing.ts`).
- `profiles.player_tag` is stored normalized with `#` prefix and uppercase (e.g. `#ABC123`).

---

## Task 1 — Database migration

**Files:**
- Create: `supabase/migrations/009_anonymous_visits.sql`

**Why first:** Nothing depends on code yet, but everything depends on the table existing once the code runs. Landing this first gives the subsequent tasks a real schema to test against.

- [ ] **Step 1.1 — Create the migration file**

Create `supabase/migrations/009_anonymous_visits.sql` with exactly this content:

```sql
BEGIN;

-- Ensure pg_cron is available. No-op in production Supabase (already installed).
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- ─────────────────────────────────────────────────────────────────
-- Table: public.anonymous_visits
-- Stores the tag as '#ABC123' (normalized via normalizePlayerTag).
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.anonymous_visits (
  tag            text PRIMARY KEY,
  locale         text NOT NULL CHECK (char_length(locale) BETWEEN 2 AND 10),
  first_visit_at timestamptz NOT NULL DEFAULT now(),
  last_visit_at  timestamptz NOT NULL DEFAULT now(),
  visit_count    integer NOT NULL DEFAULT 1 CHECK (visit_count >= 1)
);

CREATE INDEX IF NOT EXISTS idx_anonymous_visits_last_visit
  ON public.anonymous_visits(last_visit_at);

ALTER TABLE public.anonymous_visits ENABLE ROW LEVEL SECURITY;
-- No policies created. Only service-role server code can access this table.

-- ─────────────────────────────────────────────────────────────────
-- RPC: public.track_anonymous_visit(p_tag, p_locale) → boolean
-- Atomic upsert. Returns TRUE on INSERT (new tag), FALSE on UPDATE.
-- locale is intentionally not updated on re-entries (keep first-visit locale).
-- ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.track_anonymous_visit(
  p_tag    text,
  p_locale text
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  was_insert boolean;
BEGIN
  INSERT INTO public.anonymous_visits (tag, locale)
  VALUES (p_tag, p_locale)
  ON CONFLICT (tag) DO UPDATE
    SET last_visit_at = now(),
        visit_count   = public.anonymous_visits.visit_count + 1
  RETURNING (xmax = 0) INTO was_insert;
  RETURN was_insert;
END;
$$;

-- Lock down execute permissions — service role only.
REVOKE ALL     ON FUNCTION public.track_anonymous_visit(text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.track_anonymous_visit(text, text) FROM anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.track_anonymous_visit(text, text) TO service_role;

-- ─────────────────────────────────────────────────────────────────
-- Cron: daily cleanup of rows older than 90 days. Idempotent.
-- ─────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-anonymous-visits') THEN
    PERFORM cron.unschedule('cleanup-anonymous-visits');
  END IF;
END $$;

SELECT cron.schedule(
  'cleanup-anonymous-visits',
  '0 3 * * *',  -- 03:00 UTC daily
  $$DELETE FROM public.anonymous_visits
    WHERE last_visit_at < now() - interval '90 days'$$
);

COMMIT;
```

- [ ] **Step 1.2 — Commit the migration file**

```bash
git add supabase/migrations/009_anonymous_visits.sql
git commit -m "feat(db): add anonymous_visits table, RPC, and cleanup cron

Adds table, atomic upsert RPC with insert-vs-update detection,
and daily 03:00 UTC cron that deletes rows older than 90 days.
Fully idempotent — safe to re-apply."
```

> **Note on applying:** The migration is NOT applied to Supabase in this task. That happens in Task 8 after all code is in place, to avoid having a production table that no code writes to.

---

## Task 2 — Tracker module with unit tests (TDD)

**Files:**
- Create: `src/__tests__/unit/lib/anonymous-visits.test.ts`
- Create: `src/lib/anonymous-visits.ts`

**Why:** This is the core business logic. We write tests first so the 8 spec cases are pinned before any implementation, and we verify memoization + error paths. The module has zero dependencies on Next.js request context — it's a pure server-side function.

- [ ] **Step 2.1 — Read an existing test to match patterns**

Read `src/__tests__/integration/api/profile.test.ts` to see how this repo mocks Supabase clients. Copy the chainable-mock pattern — you'll build a similar `mockAdmin` object for `@supabase/supabase-js`.

- [ ] **Step 2.2 — Write the failing test file**

Create `src/__tests__/unit/lib/anonymous-visits.test.ts` with this content:

```ts
import { beforeEach, describe, expect, test, vi } from 'vitest'

// ───────────────── Mocks ─────────────────

const mockFrom = vi.fn()
const mockRpc = vi.fn()
const mockAdmin = {
  from: mockFrom,
  rpc: mockRpc,
}

// `createClient` from @supabase/supabase-js must return our mock admin
const createClientMock = vi.fn(() => mockAdmin)
vi.mock('@supabase/supabase-js', () => ({
  createClient: createClientMock,
}))

const notifyMock = vi.fn().mockResolvedValue(undefined)
vi.mock('@/lib/telegram', () => ({
  notify: notifyMock,
}))

// ───────────────── Setup / Teardown ─────────────────

beforeEach(() => {
  vi.resetModules()     // critical: resets the `_admin` singleton between tests
  vi.clearAllMocks()
  mockFrom.mockReset()
  mockRpc.mockReset()
  notifyMock.mockReset().mockResolvedValue(undefined)
  createClientMock.mockClear()

  // Required env vars for getAdminClient()
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key'
})

// Helper: build a chainable mock for .from('profiles').select(...).eq(...).maybeSingle()
function mockProfilesLookup(result: { data: { id: string } | null, error: null }) {
  const maybeSingle = vi.fn().mockResolvedValue(result)
  const eq = vi.fn().mockReturnValue({ maybeSingle })
  const select = vi.fn().mockReturnValue({ eq })
  mockFrom.mockImplementation((table: string) => {
    if (table === 'profiles') return { select }
    if (table === 'anonymous_visits') {
      // for the count-after-insert branch
      const countSelect = vi.fn().mockResolvedValue({ count: 5, data: null, error: null })
      return { select: countSelect }
    }
    throw new Error(`Unexpected table: ${table}`)
  })
}

// ───────────────── Tests ─────────────────

describe('trackAnonymousVisit', () => {
  test('1. new valid tag, not in profiles → insert + notify', async () => {
    mockProfilesLookup({ data: null, error: null })
    mockRpc.mockResolvedValue({ data: true, error: null })  // RPC returns is_new = true

    const { trackAnonymousVisit } = await import('@/lib/anonymous-visits')
    await trackAnonymousVisit({ tag: '#ABC123', locale: 'es' })

    expect(mockRpc).toHaveBeenCalledWith('track_anonymous_visit', {
      p_tag: '#ABC123',
      p_locale: 'es',
    })
    expect(notifyMock).toHaveBeenCalledTimes(1)
    expect(notifyMock.mock.calls[0][0]).toContain('#ABC123')
    expect(notifyMock.mock.calls[0][0]).toContain('Tags únicos en la tabla: 5')
  })

  test('2. existing tag (re-entry) → RPC called, notify NOT called', async () => {
    mockProfilesLookup({ data: null, error: null })
    mockRpc.mockResolvedValue({ data: false, error: null })  // is_new = false

    const { trackAnonymousVisit } = await import('@/lib/anonymous-visits')
    await trackAnonymousVisit({ tag: '#ABC123', locale: 'es' })

    expect(mockRpc).toHaveBeenCalledTimes(1)
    expect(notifyMock).not.toHaveBeenCalled()
  })

  test('3. tag already in profiles → RPC NOT called, notify NOT called', async () => {
    mockProfilesLookup({ data: { id: 'user-uuid' }, error: null })

    const { trackAnonymousVisit } = await import('@/lib/anonymous-visits')
    await trackAnonymousVisit({ tag: '#ABC123', locale: 'es' })

    expect(mockRpc).not.toHaveBeenCalled()
    expect(notifyMock).not.toHaveBeenCalled()
  })

  test('4. invalid tag format → no DB calls, no notify', async () => {
    const { trackAnonymousVisit } = await import('@/lib/anonymous-visits')
    await trackAnonymousVisit({ tag: '??INVALID??', locale: 'es' })

    expect(mockFrom).not.toHaveBeenCalled()
    expect(mockRpc).not.toHaveBeenCalled()
    expect(notifyMock).not.toHaveBeenCalled()
  })

  test('5. RPC returns error → logged, notify NOT called', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    mockProfilesLookup({ data: null, error: null })
    mockRpc.mockResolvedValue({ data: null, error: { message: 'boom' } })

    const { trackAnonymousVisit } = await import('@/lib/anonymous-visits')
    await trackAnonymousVisit({ tag: '#ABC123', locale: 'es' })

    expect(consoleError).toHaveBeenCalledWith(
      '[anonymous-visits] RPC failed',
      expect.objectContaining({ message: 'boom' }),
    )
    expect(notifyMock).not.toHaveBeenCalled()
    consoleError.mockRestore()
  })

  test('6. notify throws → caught, no propagation', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    mockProfilesLookup({ data: null, error: null })
    mockRpc.mockResolvedValue({ data: true, error: null })
    notifyMock.mockRejectedValueOnce(new Error('telegram down'))

    const { trackAnonymousVisit } = await import('@/lib/anonymous-visits')
    await expect(
      trackAnonymousVisit({ tag: '#ABC123', locale: 'es' })
    ).resolves.toBeUndefined()  // does NOT throw

    expect(consoleError).toHaveBeenCalledWith(
      '[anonymous-visits] unexpected failure',
      expect.any(Error),
    )
    consoleError.mockRestore()
  })

  test('7. admin client is memoized within a single module load', async () => {
    mockProfilesLookup({ data: null, error: null })
    mockRpc.mockResolvedValue({ data: false, error: null })

    const mod = await import('@/lib/anonymous-visits')
    await mod.trackAnonymousVisit({ tag: '#ABC123', locale: 'es' })
    await mod.trackAnonymousVisit({ tag: '#DEF456', locale: 'en' })

    // createClient() from @supabase/supabase-js must be called exactly once
    expect(createClientMock).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2.3 — Run the test file — expect failure (module not found)**

```bash
npx vitest run src/__tests__/unit/lib/anonymous-visits.test.ts
```

Expected: test runner fails to resolve `@/lib/anonymous-visits` (module does not exist yet).

- [ ] **Step 2.4 — Create the tracker module**

Create `src/lib/anonymous-visits.ts` with this content:

```ts
// Server-only module. Do not import from client components.
// (The `server-only` package is not used in this repo by convention.)
//
// IMPORTANT: this module must never call cookies() or any request-context API.
// It is designed to run inside after() callbacks where the request context
// may have expired. Uses @supabase/supabase-js directly with the service
// role key — stateless, cookie-free, safe in any execution context.

import { createClient as createSupabaseAdmin, type SupabaseClient } from '@supabase/supabase-js'
import { notify } from '@/lib/telegram'
import { isValidPlayerTag, normalizePlayerTag } from '@/lib/utils'

interface TrackInput {
  /** Raw tag as received from the client — may include leading '#'. */
  tag: string
  /** UI locale. Must already be whitelisted by the caller. */
  locale: string
}

// Memoized per cold start. Stateless — no cookie handling, no session persistence.
let _admin: SupabaseClient | null = null

function getAdminClient(): SupabaseClient {
  if (_admin) return _admin
  _admin = createSupabaseAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
  return _admin
}

/**
 * Record an anonymous visit and notify Telegram on the first occurrence of a tag.
 *
 * Caller contract:
 *   - The user has already been verified as anonymous (no Supabase session).
 *   - The locale has already been validated against the supported whitelist.
 *   - This function must be invoked from `after()` so it never blocks a response.
 *
 * Never throws. All failure paths log and return.
 */
export async function trackAnonymousVisit({ tag, locale }: TrackInput): Promise<void> {
  // Defense in depth: re-validate the tag format using the canonical helper.
  if (!isValidPlayerTag(tag)) return
  const normalizedTag = normalizePlayerTag(tag)  // always '#UPPER'

  try {
    const admin = getAdminClient()

    // Guard: tags that already converted to a registered profile — skip.
    // The profiles table stores player_tag already normalized with '#'.
    // Note: this guard only fires for tags with ≤12 chars after '#' (FR-10).
    const { data: existingProfile } = await admin
      .from('profiles')
      .select('id')
      .eq('player_tag', normalizedTag)
      .maybeSingle()
    if (existingProfile) return

    // Atomic upsert via RPC; returns true on INSERT, false on UPDATE.
    const { data: isNew, error } = await admin.rpc('track_anonymous_visit', {
      p_tag: normalizedTag,
      p_locale: locale,
    })
    if (error) {
      console.error('[anonymous-visits] RPC failed', error)
      return
    }

    if (isNew === true) {
      const { count } = await admin
        .from('anonymous_visits')
        .select('*', { count: 'exact', head: true })

      const profileUrl = `https://brawlvision.com/${locale}/profile/${encodeURIComponent(normalizedTag)}`

      await notify(
        `👤 <b>Nuevo visitante anónimo</b>\n` +
        `Tag: <code>${normalizedTag}</code>\n` +
        `Idioma: ${locale}\n` +
        `Tags únicos en la tabla: ${count ?? '?'}\n` +
        `🔗 ${profileUrl}`
      )
    }
  } catch (err) {
    // Defensive catch — this function must never propagate to the after() caller.
    console.error('[anonymous-visits] unexpected failure', err)
  }
}
```

- [ ] **Step 2.5 — Run the tests — expect all 7 cases to pass**

```bash
npx vitest run src/__tests__/unit/lib/anonymous-visits.test.ts
```

Expected: 7 passed. If any fails, read the error message, fix either the test or the module (not both) until green.

> **Common pitfall**: test #7 (memoization) will fail if you use `import { trackAnonymousVisit } from '@/lib/anonymous-visits'` at the top of the test file instead of `await import()` inside each test. The `vi.resetModules()` call in `beforeEach` requires dynamic imports to take effect.

- [ ] **Step 2.6 — Run the full test suite to ensure no regressions**

```bash
npx vitest run
```

Expected: all existing tests still pass; the new 7 cases now appear in the summary.

- [ ] **Step 2.7 — Commit**

```bash
git add src/lib/anonymous-visits.ts src/__tests__/unit/lib/anonymous-visits.test.ts
git commit -m "feat(anonymous-visits): server tracker module with 7 unit tests

Stateless @supabase/supabase-js service-role client, memoized per
cold start. Guards: invalid tag, tag already in profiles, RPC error,
notify failure. Sends rich Telegram notification on first visit only."
```

---

## Task 3 — Extend `/api/calculate` with tracking (integration tests)

**Files:**
- Modify: `src/app/api/calculate/route.ts`
- Modify: `src/__tests__/integration/api/calculate.test.ts`

**Why:** This is where the tracker gets wired into the real request path. Auth check runs inline while cookies are valid, `after()` registers the tracker for post-response execution. Integration tests pin the three branches: fromLanding + anonymous, fromLanding + authenticated, no fromLanding.

- [ ] **Step 3.1 — Read the existing calculate route and its integration test**

Read both files end-to-end. Notice:
- The handler imports `fetchPlayer`, `fetchBattlelog`, `fetchClub`, `SuprecellApiError` from `@/lib/api`.
- Body parsing is `const body = await req.json()` with `const { playerTag } = body`.
- The final return is `return NextResponse.json({ ... result ... })` at ~line 44.
- The existing test file already mocks `@/lib/api` — you'll add mocks for `@/lib/supabase/server`, `@/lib/anonymous-visits`, and `next/server`.

- [ ] **Step 3.2 — Write the failing integration test cases**

Add the following to `src/__tests__/integration/api/calculate.test.ts`. Do NOT delete existing tests; append these. If the file already has a `describe(...)` block, add a new nested `describe('anonymous visit tracking', ...)` inside it. If it doesn't, add one at the top level.

```ts
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

// Hoisted helper for capturing the after() callback without invoking it.
const { getCaptured, resetCaptured, mockAfter } = vi.hoisted(() => {
  let captured: (() => Promise<void>) | null = null
  return {
    getCaptured: () => captured,
    resetCaptured: () => { captured = null },
    mockAfter: (cb: () => Promise<void>) => { captured = cb },
  }
})

vi.mock('next/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/server')>()
  return { ...actual, after: vi.fn(mockAfter) }
})

// Mock the tracker — we only verify it was called with the right args.
const trackAnonymousVisitMock = vi.fn().mockResolvedValue(undefined)
vi.mock('@/lib/anonymous-visits', () => ({
  trackAnonymousVisit: trackAnonymousVisitMock,
}))

// Mock createClient from @/lib/supabase/server to control auth.getUser() response.
const getUserMock = vi.fn()
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: getUserMock },
  }),
}))

describe('POST /api/calculate — anonymous visit tracking', () => {
  beforeEach(() => {
    resetCaptured()
    vi.clearAllMocks()
    // Default: anonymous user
    getUserMock.mockResolvedValue({ data: { user: null }, error: null })
  })

  // Helper to build a valid request
  function makeRequest(overrides: Record<string, unknown> = {}) {
    return new Request('http://localhost/api/calculate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        playerTag: '#ABC123',
        fromLanding: true,
        locale: 'es',
        ...overrides,
      }),
    })
  }

  test('fromLanding=true + anonymous user → registers after() callback, tracker NOT yet invoked', async () => {
    const { POST } = await import('@/app/api/calculate/route')
    const res = await POST(makeRequest())

    expect(res.status).toBe(200)

    // Response went out BEFORE any tracking happened
    expect(trackAnonymousVisitMock).not.toHaveBeenCalled()

    // But the after() callback was registered
    const captured = getCaptured()
    expect(captured).not.toBeNull()

    // Now drain the callback — tracker runs
    await captured!()
    expect(trackAnonymousVisitMock).toHaveBeenCalledTimes(1)
    expect(trackAnonymousVisitMock).toHaveBeenCalledWith({
      tag: '#ABC123',
      locale: 'es',
    })
  })

  test('fromLanding=false → no after() callback, tracker never called', async () => {
    const { POST } = await import('@/app/api/calculate/route')
    await POST(makeRequest({ fromLanding: false }))

    expect(getCaptured()).toBeNull()
    expect(trackAnonymousVisitMock).not.toHaveBeenCalled()
  })

  test('fromLanding=true + locale not in whitelist → no after()', async () => {
    const { POST } = await import('@/app/api/calculate/route')
    await POST(makeRequest({ locale: 'xx' }))

    expect(getCaptured()).toBeNull()
    expect(trackAnonymousVisitMock).not.toHaveBeenCalled()
  })

  test('fromLanding=true + HTML-injection locale → no after()', async () => {
    const { POST } = await import('@/app/api/calculate/route')
    await POST(makeRequest({ locale: '<b>evil</b>' }))

    expect(getCaptured()).toBeNull()
    expect(trackAnonymousVisitMock).not.toHaveBeenCalled()
  })

  test('fromLanding=true + authenticated user → no after()', async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: 'user-uuid', email: 'a@b.c' } },
      error: null,
    })
    const { POST } = await import('@/app/api/calculate/route')
    await POST(makeRequest())

    expect(getCaptured()).toBeNull()
    expect(trackAnonymousVisitMock).not.toHaveBeenCalled()
  })

  test('fromLanding=true + locale is a number → no after() (type guard)', async () => {
    const { POST } = await import('@/app/api/calculate/route')
    await POST(makeRequest({ locale: 12345 }))

    expect(getCaptured()).toBeNull()
    expect(trackAnonymousVisitMock).not.toHaveBeenCalled()
  })

  test('auth.getUser() throws → fail-closed, no after(), no throw', async () => {
    getUserMock.mockRejectedValue(new Error('supabase auth down'))
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    const { POST } = await import('@/app/api/calculate/route')
    const res = await POST(makeRequest())

    expect(res.status).toBe(200)  // response still succeeds
    expect(getCaptured()).toBeNull()
    expect(trackAnonymousVisitMock).not.toHaveBeenCalled()
    expect(consoleError).toHaveBeenCalledWith(
      '[calculate] auth check for tracking failed',
      expect.any(Error),
    )
    consoleError.mockRestore()
  })
})
```

**Important**: the existing test file may already mock `@/lib/api` (`fetchPlayer`, `fetchBattlelog`, `fetchClub`). Those mocks must return valid data for the `POST` handler to reach the tracking branch. If the existing test file does not already provide a default valid mock for these, extend the `beforeEach` above to do so:

```ts
// Inside beforeEach, after resetCaptured():
vi.mocked(fetchPlayer).mockResolvedValue({
  tag: '#ABC123', name: 'Test', trophies: 10000, /* ... minimal valid PlayerData ... */
} as any)
vi.mocked(fetchBattlelog).mockResolvedValue({ items: [], paging: { cursors: {} } })
vi.mocked(fetchClub).mockResolvedValue({ badgeId: 1 } as any)
```

You'll need to confirm the exact shape by reading the types in `src/lib/types.ts` and `src/lib/api.ts`. The existing `calculate.test.ts` should already show the canonical mock — copy that.

- [ ] **Step 3.3 — Run the new tests — expect failures**

```bash
npx vitest run src/__tests__/integration/api/calculate.test.ts
```

Expected: the 7 new `anonymous visit tracking` tests fail (the handler doesn't call `createClient`, `after`, or `trackAnonymousVisit` yet).

- [ ] **Step 3.4 — Modify `/api/calculate/route.ts` to add the tracking branch**

Open `src/app/api/calculate/route.ts`. At the top, **add** these imports (keep existing imports):

```ts
import { after } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { trackAnonymousVisit } from '@/lib/anonymous-visits'
```

Then, below all imports but above `export async function POST(...)`, add this module-scope constant:

```ts
// Locale whitelist for anonymous-visit tracking.
// ⚠️ MUST stay in sync with `src/i18n/routing.ts` (`routing.locales`).
// Intentionally hardcoded rather than imported because routing.ts also
// exports `createNavigation(routing)` which pulls in client-only
// next-intl navigation hooks that crash server bundles from API routes.
const SUPPORTED_LOCALES = new Set<string>([
  'es', 'en', 'fr', 'pt', 'de', 'it', 'ru', 'tr', 'pl', 'ar', 'ko', 'ja', 'zh',
])
```

Inside the `POST` handler, locate the final `return NextResponse.json({ ... })` (currently at roughly line 44 — the line that returns the computed gem score). **Just before that return statement**, insert this block:

```ts
// ─── Anonymous visit tracking (fire-and-forget via after()) ───
// Runs only when the request originated from the landing InputForm
// AND the locale is in the whitelist AND the user is not authenticated.
if (
  body.fromLanding === true &&
  typeof body.locale === 'string' &&
  SUPPORTED_LOCALES.has(body.locale)
) {
  try {
    // Auth check inline while request context (cookies) is guaranteed valid.
    // Fail-closed: if this throws, we skip tracking entirely.
    const supabaseAuth = await createClient()
    const { data: { user } } = await supabaseAuth.auth.getUser()

    if (!user) {
      const trackingLocale = body.locale  // narrowed to string by the typeof guard
      after(async () => {
        try {
          await trackAnonymousVisit({ tag: playerTag, locale: trackingLocale })
        } catch (err) {
          console.error('[calculate] tracking failed', err)
        }
      })
    }
  } catch (authErr) {
    console.error('[calculate] auth check for tracking failed', authErr)
  }
}
```

Do not modify any existing logic. The new block sits between the `result` computation and the `return NextResponse.json(...)`.

- [ ] **Step 3.5 — Run the integration tests — expect all new cases to pass**

```bash
npx vitest run src/__tests__/integration/api/calculate.test.ts
```

Expected: all 7 new tracking cases pass, plus all pre-existing tests still pass.

- [ ] **Step 3.6 — Run the full test suite**

```bash
npx vitest run
```

Expected: all tests pass (no regressions).

- [ ] **Step 3.7 — Type-check the project**

```bash
npx tsc --noEmit
```

Expected: no errors. If there are errors in `route.ts`, most likely `body.locale` is `unknown` — confirm the `typeof body.locale === 'string'` guard is in place so TS narrows it correctly.

- [ ] **Step 3.8 — Commit**

```bash
git add src/app/api/calculate/route.ts src/__tests__/integration/api/calculate.test.ts
git commit -m "feat(api/calculate): wire anonymous visit tracking via after()

Adds SUPPORTED_LOCALES whitelist + inline auth check + after()
registration for the tracker. 7 new integration tests cover: anonymous
happy path, fromLanding=false, locale not whitelisted, HTML injection
attempt, authenticated user, type-guard, fail-closed auth outage."
```

---

## Task 4 — Update `usePlayerData` hook signature

**Files:**
- Modify: `src/hooks/usePlayerData.ts`

**Why:** The hook must forward `fromLanding` and `locale` from the page to `/api/calculate`. No tests exist for this hook today; the spec does not mandate adding one here (it would require a React Testing Library setup that isn't in the repo for this module). Manual verification covers it.

- [ ] **Step 4.1 — Read the current hook**

Read `src/hooks/usePlayerData.ts` end-to-end. You already have it in context from earlier reads, but re-read to be sure. Key points:
- Current signature: `usePlayerData(tag: string)`
- Line 66 builds the fetch body: `body: JSON.stringify({ playerTag: tag })`
- Lines 17-38 handle the localStorage cache.

- [ ] **Step 4.2 — Modify the hook signature and body**

Change line 41 from:

```ts
export function usePlayerData(tag: string) {
```

to:

```ts
export function usePlayerData(
  tag: string,
  opts?: { fromLanding?: boolean; locale?: string },
) {
```

Change line 66 from:

```ts
      body: JSON.stringify({ playerTag: tag }),
```

to:

```ts
      body: JSON.stringify({
        playerTag: tag,
        ...(opts?.fromLanding ? { fromLanding: true } : {}),
        ...(opts?.locale ? { locale: opts.locale } : {}),
      }),
```

Also update the `useEffect` dependency array on line 89 from:

```ts
  }, [tag])
```

to:

```ts
  }, [tag, opts?.fromLanding, opts?.locale])
```

**Do not** modify the localStorage cache logic. The cache key must remain `brawlvalue:player:${tag.toUpperCase()}` (unchanged), per the Q-A decision — the cache hits regardless of origin.

- [ ] **Step 4.3 — Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4.4 — Run the full test suite**

```bash
npx vitest run
```

Expected: no regressions. Any existing test that imports `usePlayerData` directly will still work because the new `opts` parameter is optional.

- [ ] **Step 4.5 — Commit**

```bash
git add src/hooks/usePlayerData.ts
git commit -m "feat(hooks): usePlayerData accepts fromLanding/locale options

New optional opts parameter forwards both fields in the /api/calculate
POST body when present. Cache key is unchanged (cache hits regardless
of origin, per spec Q-A decision)."
```

---

## Task 5 — Update profile page to pass `fromLanding` to the hook

**Files:**
- Modify: `src/app/[locale]/profile/[tag]/page.tsx`

**Why:** The page is where the `?from=landing` query param is read. It reads `useSearchParams`, computes `fromLanding`, and forwards it to the hook.

- [ ] **Step 5.1 — Read the current page**

Read `src/app/[locale]/profile/[tag]/page.tsx`. You've already seen it. Key facts:
- It's `'use client'`.
- It uses `useParams` at line 17.
- It calls `usePlayerData(tag)` at line 21.
- It imports from `next/navigation` at line 3.

- [ ] **Step 5.2 — Add `useSearchParams` import and usage**

Modify line 3 from:

```ts
import { useParams } from 'next/navigation'
```

to:

```ts
import { useParams, useSearchParams } from 'next/navigation'
```

Below `const locale = params.locale || 'es'` (currently line 20), add:

```ts
  const searchParams = useSearchParams()
  const fromLanding = searchParams.get('from') === 'landing'
```

Change the `usePlayerData(tag)` call on line 21 to:

```ts
  const { data, isLoading, error } = usePlayerData(tag, { fromLanding, locale })
```

That's all — three line changes total.

- [ ] **Step 5.3 — Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5.4 — Run the full test suite**

```bash
npx vitest run
```

Expected: all tests pass.

- [ ] **Step 5.5 — Commit**

```bash
git add src/app/[locale]/profile/[tag]/page.tsx
git commit -m "feat(profile): read ?from=landing and forward to usePlayerData

Uses useSearchParams to detect landing-origin requests. The locale
is already available from useParams and is passed alongside."
```

---

## Task 6 — Add Suspense boundary in the profile layout client

**Files:**
- Modify: `src/app/[locale]/profile/[tag]/DashboardLayoutClient.tsx` (see step 6.1 to confirm exact file)

**Why:** `useSearchParams` in Next.js 16 triggers a CSR bailout inside the client component that uses it, which requires a `<Suspense>` boundary somewhere upstream. The `fallback={null}` choice avoids a double-skeleton flicker (the page already renders its own `Skeleton` when `isLoading`).

- [ ] **Step 6.1 — Confirm where `{children}` is rendered**

Read `src/app/[locale]/profile/[tag]/layout.tsx`. You already saw it — at line 63 it renders `<DashboardLayoutClient>{children}</DashboardLayoutClient>`. Now read `src/app/[locale]/profile/[tag]/DashboardLayoutClient.tsx` and find the JSX location where `{children}` is rendered. Most likely this is inside a `<main>` or similar layout wrapper.

- [ ] **Step 6.2 — Wrap `{children}` in a Suspense boundary**

In `DashboardLayoutClient.tsx`:

1. Add the import at the top:

```ts
import { Suspense } from 'react'
```

2. Locate the spot where `{children}` is rendered. Replace it with:

```tsx
<Suspense fallback={null}>{children}</Suspense>
```

Do not use a `Skeleton` fallback — the profile page already renders one via `isLoading`, and a layout-level skeleton would cause a flicker.

- [ ] **Step 6.3 — Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6.4 — Run the full test suite**

```bash
npx vitest run
```

Expected: all tests pass.

- [ ] **Step 6.5 — Manual smoke check on dev server**

```bash
npm run dev
```

Then navigate to `http://localhost:3000/es/profile/%23ABC123` (use a real test tag or any syntactically valid one). Confirm:
- Page loads without Next.js dev overlay warnings about `useSearchParams` needing a Suspense boundary.
- No visible flicker between a layout-level skeleton and the page's own skeleton.

Kill the dev server with Ctrl+C before continuing.

- [ ] **Step 6.6 — Commit**

```bash
git add src/app/[locale]/profile/[tag]/DashboardLayoutClient.tsx
git commit -m "feat(profile): add Suspense boundary around dashboard children

Required by Next.js 16 because page.tsx now uses useSearchParams,
which triggers a CSR bailout. fallback={null} to avoid double-skeleton
flicker with the page's own loading state."
```

---

## Task 7 — Update `InputForm` to append `?from=landing`

**Files:**
- Modify: `src/components/landing/InputForm.tsx`

**Why:** This is the only place in the app where the "user typed a tag and pressed submit" action happens. The flag distinguishes it from auto-redirects (saved-tag restoration) and shared links.

- [ ] **Step 7.1 — Read the current file**

Read `src/components/landing/InputForm.tsx`. Relevant lines:
- Line 28-35: auto-redirect if a tag was previously saved in localStorage (`router.replace`).
- Line 54: `router.push` after a successful form submission.

**Do NOT** add `?from=landing` to line 32 (`router.replace`). That path is session restoration, not an active landing submission — it would inflate the metric with users who already visited before.

**Only modify line 54**, which is the "user actively submitted a tag" path.

- [ ] **Step 7.2 — Modify line 54**

Change line 54 from:

```ts
    router.push(`/${locale}/profile/${encodeURIComponent(formattedTag)}`)
```

to:

```ts
    router.push(`/${locale}/profile/${encodeURIComponent(formattedTag)}?from=landing`)
```

One-line change. Nothing else in the file changes.

- [ ] **Step 7.3 — Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 7.4 — Run the full test suite**

```bash
npx vitest run
```

Expected: all tests pass.

- [ ] **Step 7.5 — Commit**

```bash
git add src/components/landing/InputForm.tsx
git commit -m "feat(landing): append ?from=landing on active tag submission

Only applies to the submit-button path (router.push). The
localStorage auto-redirect path (router.replace) is intentionally
unchanged — session restoration is not a 'new visit'."
```

---

## Task 8 — Apply migration and end-to-end smoke test

**Files:** none modified. This task is pure verification.

**Why:** Final check that the whole pipeline works end-to-end against a real Supabase instance and sends a real Telegram message.

- [ ] **Step 8.1 — Apply the migration to Supabase**

Option A (preferred) — Supabase CLI:

```bash
supabase db push
```

Option B — Dashboard SQL Editor:

1. Open the Supabase project → SQL Editor.
2. Paste the full contents of `supabase/migrations/009_anonymous_visits.sql`.
3. Click **Run**.

Expected: `Success. No rows returned.` The transaction commits cleanly.

- [ ] **Step 8.2 — Verify the table, RPC, and cron exist**

In the Supabase SQL Editor, run each of these and inspect the output:

```sql
-- Table exists with the right columns
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'anonymous_visits';
```

Expected 5 rows: `tag/text/NO`, `locale/text/NO`, `first_visit_at/timestamptz/NO`, `last_visit_at/timestamptz/NO`, `visit_count/integer/NO`.

```sql
-- RPC exists and is SECURITY DEFINER
SELECT proname, prosecdef
FROM pg_proc
WHERE proname = 'track_anonymous_visit';
```

Expected: 1 row, `prosecdef = true`.

```sql
-- Cron job is registered exactly once
SELECT jobname, schedule, active
FROM cron.job
WHERE jobname = 'cleanup-anonymous-visits';
```

Expected: 1 row, `schedule = '0 3 * * *'`, `active = true`.

- [ ] **Step 8.3 — Dry-run the RPC manually**

```sql
SELECT public.track_anonymous_visit('#TESTTAG1', 'es');
```

Expected: `true` (new insert).

```sql
SELECT public.track_anonymous_visit('#TESTTAG1', 'es');
```

Expected: `false` (update).

```sql
SELECT tag, locale, visit_count FROM public.anonymous_visits WHERE tag = '#TESTTAG1';
```

Expected: `#TESTTAG1 | es | 2`.

- [ ] **Step 8.4 — Clean up the test row**

```sql
DELETE FROM public.anonymous_visits WHERE tag = '#TESTTAG1';
```

- [ ] **Step 8.5 — Deploy code to a preview URL**

Push the branch to a remote, open a PR, let Vercel create a preview deployment. Wait for the deploy to finish and note the preview URL.

- [ ] **Step 8.6 — Smoke test the happy path on preview**

1. Open the preview URL in an **incognito window** (no Supabase session).
2. On the landing, type a test tag that you are **100% sure** does not exist in `profiles` yet (e.g. a throwaway real Brawl Stars tag you control).
3. Click the submit button.
4. Within ~5 seconds, check your Telegram admin chat — a message should arrive:
   ```
   👤 Nuevo visitante anónimo
   Tag: #YOURTAG
   Idioma: es
   Tags únicos en la tabla: 1
   🔗 https://brawlvision.com/es/profile/%23YOURTAG
   ```

- [ ] **Step 8.7 — Smoke test the "no double notification" path**

1. In the same incognito session, click the browser back button and resubmit the same tag.
2. Confirm: **no second Telegram message**. (Either the localStorage cache short-circuits the fetch, or the RPC returns `is_new = false`.)

- [ ] **Step 8.8 — Smoke test the "authenticated user" path**

1. Log into an account that has a linked profile in `profiles`.
2. Go to the landing and submit the tag that is already linked to that profile.
3. Confirm: **no Telegram message**. The inline auth check in the handler filtered it out.

- [ ] **Step 8.9 — Smoke test the "shared link" path**

1. In a fresh incognito window, navigate directly to `https://<preview-url>/es/profile/%23ANYTAG` (no `?from=landing`).
2. Confirm: **no Telegram message**. The page did not pass `fromLanding=true`.

- [ ] **Step 8.10 — Smoke test the injection rejection path**

From your terminal:

```bash
curl -X POST https://<preview-url>/api/calculate \
  -H "Content-Type: application/json" \
  -d '{"playerTag":"#ABC123","fromLanding":true,"locale":"<b>evil</b>"}'
```

Confirm:
- The response is 200 (the gem calculation still works).
- **No Telegram message arrives** — the whitelist rejected `<b>evil</b>`.

- [ ] **Step 8.11 — Clean up preview test rows**

In the Supabase SQL editor, remove any tags you inserted during smoke testing:

```sql
DELETE FROM public.anonymous_visits WHERE tag IN ('#YOURTAG', '#ANYTAG', '#ABC123');
```

Adjust the list to match whatever you actually submitted.

- [ ] **Step 8.12 — Promote to production**

Merge the PR to `main`. Vercel will deploy to production. Observe the Telegram chat for the next 24 hours and note the signal-to-noise ratio. If you see abuse (random notifications from unknown tags at odd hours), revisit the rate limit decision from spec Q-C.

---

## Verification Checklist

Before declaring the feature complete:

- [ ] All 7 unit tests for `trackAnonymousVisit` pass (`npx vitest run src/__tests__/unit/lib/anonymous-visits.test.ts`).
- [ ] All 7 new integration tests for `/api/calculate` pass (`npx vitest run src/__tests__/integration/api/calculate.test.ts`).
- [ ] Full test suite is green (`npx vitest run`).
- [ ] `npx tsc --noEmit` produces no errors.
- [ ] Migration applied to production Supabase and the cron job is visible in `cron.job`.
- [ ] Preview deploy sent exactly one Telegram message per unique never-seen tag.
- [ ] Preview deploy sent zero Telegram messages for: repeat visits, authenticated users, shared links, HTML-injection locales.
- [ ] No test row left behind in production `anonymous_visits` after the smoke test.

---

## Rollback plan

If something goes wrong in production:

1. **Disable notifications without redeploy**: Unset `TELEGRAM_BOT_TOKEN` in Vercel env vars → redeploy. `notify()` no-ops silently. DB rows still written.
2. **Hard kill the tracker**: In Supabase SQL editor:
   ```sql
   REVOKE EXECUTE ON FUNCTION public.track_anonymous_visit(text, text) FROM service_role;
   ```
   The RPC will fail, the error will be logged, and no row will be written. Re-grant when ready:
   ```sql
   GRANT EXECUTE ON FUNCTION public.track_anonymous_visit(text, text) TO service_role;
   ```
3. **Fully revert**: `git revert` the commits from this plan. The migration is idempotent but does not have an explicit down-migration. To drop the table:
   ```sql
   SELECT cron.unschedule('cleanup-anonymous-visits');
   DROP FUNCTION public.track_anonymous_visit(text, text);
   DROP TABLE public.anonymous_visits;
   ```

---

## Out of scope reminders

Do NOT, during this implementation:

- Touch `src/lib/constants.ts` or `src/app/api/profile/route.ts` to "fix" the `PLAYER_TAG_REGEX` inconsistency (Q-E decision).
- Add a rate limiter (Q-C decision — observe first, act later).
- Add an HTML-escape helper to `notify()` (nice-to-have, listed in spec §14 Future work).
- Add IP, user-agent, or country enrichment to the schema.
- Build the Telegram conversational bot — that is a separate brainstorming cycle and spec.
