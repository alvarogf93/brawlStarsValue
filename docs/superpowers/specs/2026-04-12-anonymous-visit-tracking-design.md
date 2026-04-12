# Anonymous Visit Tracking — Design Spec

**Date:** 2026-04-12
**Status:** Approved by user (v4, post fourth self-review), pending implementation plan
**Author:** Brainstormed with Claude (superpowers:brainstorming)

## Changelog

- **v1 (2026-04-12)** — initial draft, approved on main architecture.
- **v2 (2026-04-12)** — revised after first code-review found 4 blockers and 5 majors. Key corrections: real helper names, dual-client Supabase split, `after()` instead of `Promise.race`, reuse of existing tag helpers, sequential migration naming.
- **v3 (2026-04-12)** — revised after second deep review found 5 more issues that survived v2. Key corrections: auth check moved to route handler, tracker uses direct `@supabase/supabase-js` service-role client, removed `import 'server-only'`, locale whitelist, test mock mechanics, documented Guard 2 gap, `BEGIN/COMMIT` transaction, `proxy.ts` reference.
- **v4 (2026-04-12)** — revised after third in-depth self-review found 6 more issues that survived v3. Key corrections:
  1. **Locale whitelist is hardcoded inline** in `/api/calculate` instead of imported from `src/i18n/routing.ts`. The routing file also exports `createNavigation(routing)` which pulls in client-only `next/navigation` hooks — importing it from a server API route risks bundler crashes. The inline array is explicitly marked "keep in sync with routing.ts".
  2. **`vi.hoisted()` pattern** for the `after()` mock in §10.2. The v3 pattern of declaring `let capturedAfterCallback` outside `vi.mock` does not work because Vitest hoists `vi.mock` factories above any file-scope code.
  3. **Suspense fallback changed to `null`** in the profile layout wrapper. `<Suspense fallback={<Skeleton />}>` would compete with the page's own internal skeleton, causing a double-flicker.
  4. **`vi.resetModules()` in `beforeEach`** for the unit tests of `trackAnonymousVisit`, because the memoized `_admin` singleton is module-scoped and would leak state between tests.
  5. **`typeof body.locale === 'string'` type guard** added before `SUPPORTED_LOCALES.has(body.locale)` in the handler, to satisfy TS strict and prevent exotic value coercion.
  6. **Risk row added** for the "fail-closed on Supabase auth outage" behavior — if `auth.getUser()` throws, we log and do not track, trading one notification for safety.

## 1. Motivation

Today, the only signal we get for "new user" is the `POST /api/notify/signup` Telegram notification, which fires only when an authenticated user links a player tag to their `profiles` row. Anonymous visitors — people who type their `#tag` in the landing `InputForm` and enter the app without creating an account — are invisible to us: they leave no trace in Supabase, and no Telegram notification is sent.

We want visibility into this anonymous traffic as a lightweight "access log" with three goals:

1. Know how many distinct players discover the app via the landing.
2. Receive a Telegram notification the first time a new anonymous tag arrives, so we can observe organic growth in real time.
3. Feed a future Telegram conversational bot (separate brainstorming cycle) with basic queries like "how many new visitors today".

The table has **no business value beyond traffic observability**. It is not a funnel tool, not a CRM, not a retargeting list.

## 2. Scope

**In scope:**

- New table `public.anonymous_visits` storing `(tag, locale, first_visit_at, last_visit_at, visit_count)`.
- Tracking hook inside the existing `POST /api/calculate` route, piggybacking on the Supercell API call that already happens for every profile render. Zero additional Supercell calls.
- Telegram notification on the first visit of each new tag (not on re-entries).
- Automatic 90-day cleanup via `pg_cron`.
- Strict filter: only tracks visits that originate from the landing `InputForm` submission (detected via `?from=landing` query param). Shared-link visits do **not** populate the table.
- Whitelist validation of the incoming `locale` field against the 13 supported locales to prevent injection and garbage data.

**Out of scope (future brainstorming cycles):**

- Telegram conversational bot (incoming webhook, command parser, query handlers).
- Conversion analytics (anonymous → registered funnels).
- Geographic enrichment (country, region).
- Client-side fingerprinting or IP storage.
- Unifying the inconsistent `PLAYER_TAG_REGEX` values across `src/lib/constants.ts` (`{3,20}`) and `src/app/api/profile/route.ts` (`{3,12}`). The spec **reuses** existing helpers but does not fix inconsistencies elsewhere (Q-E decision).

## 3. Non-Goals

- **Not a funnel tool.** We do not correlate anonymous visits with later signups.
- **Not a CRM.** No personal data beyond the public Brawl Stars tag and the UI locale.
- **Not a rate-limiter test bed.** The endpoint this piggybacks on (`/api/calculate`) is already protected at the Supercell proxy layer.
- **Not a replacement for web analytics.** Vercel Analytics / GA4 stay the source of truth for generic pageviews.
- **Not an exact visit counter.** The client-side localStorage cache on `usePlayerData` (5 min TTL) means re-entries of the same tag within 5 minutes in the same browser session will not reach the server and therefore will not increment `visit_count`. This is a **deliberately accepted inaccuracy** (Q-A decision) — the "unique tags" metric remains exact; `visit_count` slightly undercounts for very active browsers but captures the long-tail of real re-visits across longer gaps.

## 4. Requirements

### 4.1 Functional

| ID | Requirement |
|----|-------------|
| FR-1 | When a visitor submits the landing `InputForm`, the app navigates to `/[locale]/profile/[tag]?from=landing`. |
| FR-2 | The profile page reads `from = searchParams.get('from')` and forwards `fromLanding = true` plus the active `locale` to `usePlayerData`, which sends both in the body of `POST /api/calculate`. |
| FR-3 | `/api/calculate` validates that `locale` is a `string` and belongs to a hardcoded `SUPPORTED_LOCALES` Set (13 locales, kept in sync manually with `src/i18n/routing.ts` — see §8.4 for rationale). If `fromLanding === true`, locale passes the guard, the handler then performs the auth check **inline** (using the cookie-aware Supabase client while the request context is valid), and only if the user is anonymous, schedules `trackAnonymousVisit({ tag, locale })` via `after()` from `next/server`. |
| FR-4 | `trackAnonymousVisit` must skip the insert if (a) the tag already exists in `public.profiles` (matched via `normalizePlayerTag(tag)`) or (b) the tag fails `isValidPlayerTag`. The auth-session guard is **not** repeated inside the tracker — it is handled upstream in the route handler where cookie context is guaranteed available. |
| FR-5 | On an insert (not an update), `trackAnonymousVisit` sends a Telegram notification via `notify()` with the tag, locale, current total unique anonymous tags in the table, and a direct link to the player profile. |
| FR-6 | On a re-entry of an existing tag, the row's `last_visit_at` is updated and `visit_count` is incremented — no Telegram notification. The stored `locale` is **not** updated (we keep the first-visit locale). |
| FR-7 | A daily `pg_cron` job deletes rows from `anonymous_visits` whose `last_visit_at` is older than 90 days. Runs at 03:00 UTC. |
| FR-8 | The cron job references `anonymous_visits` only — it is structurally impossible for it to delete `profiles` rows. |
| FR-9 | The migration file is idempotent: re-running it uses `CREATE TABLE IF NOT EXISTS`, `CREATE OR REPLACE FUNCTION`, and a `DO $$ ... cron.unschedule ... $$` guard for the cron job. |
| FR-10 | **Known limitation**: Guard 2 (`tag in profiles`) only covers tags with ≤12 characters **after** the `#` (13 total including the `#`) because `/api/profile/route.ts` uses a tighter regex (`/^#[0-9A-Z]{3,12}$/`) than `isValidPlayerTag` (`/^#[0-9A-Z]{3,20}$/i`). Tags in the 13-20 char post-`#` window would never reach `profiles` and therefore would not be filtered by Guard 2. In practice this window is empty because real Supercell tags are 8-10 characters, but the spec acknowledges the gap rather than pretending it doesn't exist. |

### 4.2 Non-Functional

| ID | Requirement |
|----|-------------|
| NFR-1 | `trackAnonymousVisit` must **never** block the response of `/api/calculate`. It runs inside `after()` which executes post-response on Vercel Fluid Compute. |
| NFR-2 | The Supabase RPC must be atomic: the "new vs re-entry" detection happens inside a single INSERT...ON CONFLICT statement, no race condition between two concurrent requests for the same tag. |
| NFR-3 | No additional public HTTP endpoints beyond the existing `/api/calculate`. No new public attack surface. |
| NFR-4 | No IP, user-agent, or browser fingerprint is stored. GDPR minimization principle. |
| NFR-5 | The tag validation and normalization **must** reuse the existing `isValidPlayerTag` and `normalizePlayerTag` helpers from `src/lib/utils.ts`. Do not invent new regexes. |
| NFR-6 | If `notify()` internally fails, it silently swallows the error (existing contract). The tracking flow must tolerate this and not propagate errors. |
| NFR-7 | The tracker module must not call `cookies()` or any request-context API inside the `after()` callback. Only request-context-free APIs (direct Supabase client with service role key) are allowed there. |
| NFR-8 | The locale field in the request body must be validated with `typeof === 'string'` AND membership in the `SUPPORTED_LOCALES` Set (hardcoded inline in `/api/calculate/route.ts`, mirror of `src/i18n/routing.ts`) **before** being interpolated into the Telegram HTML message. This closes XSS/phishing vectors via Telegram's HTML parse mode. |

## 5. Architecture

### 5.1 Data flow

```
InputForm.tsx (client, landing)
        │
        │ router.push(`/${locale}/profile/${tag}?from=landing`)
        ▼
page.tsx (client, profile overview)
        │
        │ const from = useSearchParams().get('from')
        │ const fromLanding = from === 'landing'
        │ usePlayerData(tag, { fromLanding, locale })
        ▼
usePlayerData.ts (client hook)
        │
        │ if localStorage cache hit → return cached, NO fetch (accepted gap)
        │ else: fetch('/api/calculate', { body: { playerTag, fromLanding, locale } })
        ▼
/api/calculate/route.ts (server, existing)
        │
        │ 1. Validate tag (existing PLAYER_TAG_REGEX guard)
        │ 2. Fetch player + battlelog (existing)
        │ 3. Compute response payload (existing)
        │ 4. Anonymous-visit tracking (NEW, registered BEFORE return, executes AFTER response):
        │    if (
        │      body.fromLanding === true &&
        │      typeof body.locale === 'string' &&
        │      SUPPORTED_LOCALES.has(body.locale)
        │    ) {
        │      try {
        │        // Auth check runs inline in request context — cookie store still valid
        │        const supabaseAuth = await createClient()
        │        const { data: { user } } = await supabaseAuth.auth.getUser()
        │        if (!user) {
        │          const trackingLocale = body.locale
        │          after(async () => {
        │            try { await trackAnonymousVisit({ tag: playerTag, locale: trackingLocale }) }
        │            catch (err) { console.error('[calculate] tracking failed', err) }
        │          })
        │        }
        │      } catch (authErr) {
        │        console.error('[calculate] auth check for tracking failed', authErr)  // fail-closed
        │      }
        │    }
        │ 5. return NextResponse.json(result)   ← response delivered immediately
        ▼
src/lib/anonymous-visits.ts (server-only module, NEW)
        │   (executes post-response; caller already guaranteed user is anonymous)
        │
        │ 1. if (!isValidPlayerTag(rawTag)) return
        │ 2. const tag = normalizePlayerTag(rawTag)            // '#ABC123'
        │ 3. const admin = getAdminClient()                    // cached, no cookies
        │ 4. const { data } = await admin.from('profiles')
        │      .select('id').eq('player_tag', tag).maybeSingle()
        │    if (data) return                                   // already converted
        │ 5. const { data: isNew } = await admin.rpc(
        │      'track_anonymous_visit', { p_tag: tag, p_locale: locale })
        │ 6. if (isNew === true) {
        │      const { count } = await admin
        │        .from('anonymous_visits')
        │        .select('*', { count: 'exact', head: true })
        │      await notify(formatMessage(tag, locale, count))
        │    }
        ▼
Supabase: public.anonymous_visits (table, NEW)
        │
        │ pg_cron: daily DELETE WHERE last_visit_at < now() - 90 days
        ▼
(row eventually purged)
```

### 5.2 Why this shape

Three insights, each load-bearing:

1. **Piggyback on `/api/calculate`** — the handler already calls Supercell (`fetchPlayer`) for every profile render. By hooking tracking into that existing call, we get three benefits: no duplicate Supercell API consumption, no new public HTTP endpoint, and Supercell itself acts as the validity filter (if Supercell 404s, the existing handler early-returns before tracking can run).

2. **`?from=landing` as origin signal** — the flag distinguishes "user typed a tag in the landing" from "user navigated via shared link / bookmark / crawler". Without it we would conflate *tags viewed* with *tags entered*, distorting the metric.

3. **Auth check in the request handler, RPC in `after()`** — the Supabase cookie-aware client (`createClient()` from `src/lib/supabase/server.ts`) depends on the `cookies()` store from `next/headers`, which is only reliably available inside the request handler itself. Running the auth check inside an `after()` callback is brittle: the request context may expire, and `cookies()` might throw or return empty. The clean solution is to do the auth check inline in the handler (where context is guaranteed), and only schedule the expensive `after()` work if the user is confirmed anonymous. The tracker then uses a plain `@supabase/supabase-js` client with the service role key — a stateless client that never touches cookies and is safe in any execution context.

## 6. Schema

### 6.1 Table

```sql
-- Stored as '#ABC123' (normalized via normalizePlayerTag).
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
-- No policies created intentionally. Only service-role server code can access.
```

### 6.2 RPC (atomic insert-or-update with is-new detection)

```sql
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
    -- Note: locale intentionally NOT updated — keep first-visit locale
  RETURNING (xmax = 0) INTO was_insert;
  RETURN was_insert;
END;
$$;

-- Lock it down to service role only.
REVOKE ALL       ON FUNCTION public.track_anonymous_visit(text, text) FROM PUBLIC;
REVOKE EXECUTE   ON FUNCTION public.track_anonymous_visit(text, text) FROM anon, authenticated;
GRANT  EXECUTE   ON FUNCTION public.track_anonymous_visit(text, text) TO service_role;
```

The expression `(xmax = 0)` evaluates to `true` on INSERT and `false` on UPDATE — standard PostgreSQL idiom. Atomic in a single round-trip, safe against concurrent inserts of the same tag.

### 6.3 Cron (idempotent registration)

```sql
-- pg_cron must be enabled once at the database level.
-- This is a no-op if already installed (production Supabase has it).
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Drop any previous incarnation of the job before re-creating it.
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
```

This cron body references `anonymous_visits` only. Premium users in `profiles` are structurally untouchable by this job.

## 7. Server module: `src/lib/anonymous-visits.ts` (NEW)

```ts
// Server-only module. Do not import from client components.
// (The `server-only` package is not used in this repo by convention.)
//
// IMPORTANT: this module must never call cookies() or any request-context API.
// It is designed to run inside after() callbacks where the request context
// may have expired. Use the direct @supabase/supabase-js client with the
// service role key — stateless, cookie-free, safe in any execution context.

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
      // count: 'exact' performs a real COUNT(*) — acceptable at our scale
      // (worst case ~tens of thousands of rows bounded by 90-day cleanup).
      const { count } = await admin
        .from('anonymous_visits')
        .select('*', { count: 'exact', head: true })

      // normalizedTag is '#ABC123' — encodeURIComponent escapes '#' to %23
      // which the profile page correctly decodes via decodeURIComponent(params.tag).
      const profileUrl = `https://brawlvision.com/${locale}/profile/${encodeURIComponent(normalizedTag)}`

      // Safe interpolation: normalizedTag matches /^#[0-9A-Z]+$/, no HTML-meaningful
      // chars. locale was whitelisted upstream. No escaping needed.
      await notify(
        `👤 <b>Nuevo visitante anónimo</b>\n` +
        `Tag: <code>${normalizedTag}</code>\n` +
        `Idioma: ${locale}\n` +
        `Tags únicos en la tabla: ${count ?? '?'}\n` +
        `🔗 ${profileUrl}`
      )
    }
  } catch (err) {
    // Defensive catch — this function must never propagate an error
    // to the after() caller. Any crash here is a bug; log and move on.
    console.error('[anonymous-visits] unexpected failure', err)
  }
}
```

**Key contracts and rationale:**

- **No `cookies()` calls anywhere.** `getAdminClient()` uses `@supabase/supabase-js` directly (not the SSR wrapper in `src/lib/supabase/server.ts`), so it never reaches into `next/headers`. This makes it safe inside `after()`.
- **Memoization** (`let _admin`) ensures we only instantiate the client once per cold start. Supabase recommends this pattern for serverless environments.
- **No `persistSession` / no `autoRefreshToken`** because there is no user session — we're using the service role key directly.
- **Auth check is the caller's responsibility.** The spec guarantees by construction that `trackAnonymousVisit` is only invoked when the user is anonymous. This simplifies the tracker and eliminates the `cookies()`-in-`after()` failure mode.
- **The `try/catch` is defensive**, not load-bearing. All normal failure modes are handled inline (guards, RPC error, notify silent-fail).

## 8. Changes to existing files

### 8.1 `src/components/landing/InputForm.tsx` (~ line 54)

Append `?from=landing` to the destination URL:

```diff
- router.push(`/${locale}/profile/${encodeURIComponent(cleanTag)}`)
+ router.push(`/${locale}/profile/${encodeURIComponent(cleanTag)}?from=landing`)
```

### 8.2 `src/app/[locale]/profile/[tag]/page.tsx`

- Import `useSearchParams` from `next/navigation` (already a client component).
- Read `const from = useSearchParams().get('from')`, compute `const fromLanding = from === 'landing'`.
- Pass to the hook: `usePlayerData(tag, { fromLanding, locale })`. `locale` already available via `useParams`.
- **Next.js 16 Suspense requirement**: `useSearchParams` forces CSR bailout in a client component and must be wrapped in a `<Suspense>` boundary upstream. Since `src/app/[locale]/profile/[tag]/layout.tsx` currently renders `{children}` directly, wrap `{children}` in `<Suspense fallback={null}>` — **not** a Skeleton. The profile page already renders its own internal skeleton when `isLoading === true` (see `page.tsx` lines 34-49), so any Suspense-level fallback would cause a double-render flicker. `fallback={null}` lets Next.js swallow the brief bailout moment silently.
- Note: `src/proxy.ts` (not `middleware.ts` — Next.js 16 rename, already applied in this repo) handles locale routing and is untouched by this spec.

### 8.3 `src/hooks/usePlayerData.ts`

- Change signature to `usePlayerData(tag: string, opts?: { fromLanding?: boolean; locale?: string })`.
- Forward `opts?.fromLanding` and `opts?.locale` inside the fetch body to `/api/calculate`.
- Do **not** include either field in the localStorage cache key — the cache must hit regardless of origin or locale.
- Do **not** bypass the cache when `fromLanding === true`. This is the Q-A decision: accept that re-entries within 5 minutes in the same browser are not counted. First visits are always accurate because they are cache misses.

### 8.4 `src/app/api/calculate/route.ts`

Add imports at the top:

```ts
import { after } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { trackAnonymousVisit } from '@/lib/anonymous-visits'

// Locale whitelist for anonymous-visit tracking.
// ⚠️ MUST stay in sync with `src/i18n/routing.ts` (`routing.locales`).
// Intentionally hardcoded rather than imported because routing.ts also
// exports `createNavigation(routing)` which pulls in client-only
// next-intl navigation hooks that crash server bundles when imported
// from API routes. Keep this array and routing.ts in lockstep.
const SUPPORTED_LOCALES = new Set<string>([
  'es', 'en', 'fr', 'pt', 'de', 'it', 'ru', 'tr', 'pl', 'ar', 'ko', 'ja', 'zh',
])
```

Destructure `fromLanding` and `locale` alongside `playerTag` from the body. The existing tag validation (`PLAYER_TAG_REGEX.test(playerTag)`) stays untouched.

Just before the final `return NextResponse.json(result)` at line ~44 of the current handler, add:

```ts
// Anonymous visit tracking — fire-and-forget via after().
// Runs only when the request originated from the landing InputForm
// AND the locale is in the whitelist AND the user is not authenticated.
if (
  body.fromLanding === true &&
  typeof body.locale === 'string' &&
  SUPPORTED_LOCALES.has(body.locale)
) {
  try {
    // Auth check inline while request context (cookies) is guaranteed valid.
    // Fail-closed: if this throws, we skip tracking entirely (see risks §13).
    const supabaseAuth = await createClient()
    const { data: { user } } = await supabaseAuth.auth.getUser()

    if (!user) {
      const trackingLocale = body.locale  // narrowed to string by the typeof guard above
      after(async () => {
        try {
          await trackAnonymousVisit({ tag: playerTag, locale: trackingLocale })
        } catch (err) {
          console.error('[calculate] tracking failed', err)
        }
      })
    }
  } catch (authErr) {
    // Auth check failing must never affect the response.
    console.error('[calculate] auth check for tracking failed', authErr)
  }
}
```

**Why `after()` and not `Promise.race` or `waitUntil`:**

- `after()` is the Next.js 15+ idiomatic API for work that must run *after* the response is delivered but still within the function's execution window.
- On Vercel Fluid Compute (default in this project), `after()` integrates with the platform's background-task lifecycle — the function instance stays warm until the `after()` body resolves. No truncation mid-flight.
- `Promise.race(timeout)` would resolve the main handler but leave the underlying Telegram fetch orphaned; Vercel would then kill the serverless instance mid-request, risking dropped notifications.
- `waitUntil()` from `@vercel/functions` is semantically equivalent but `after()` comes from `next/server` and matches the rest of the codebase's Next.js-native patterns.

## 9. Migration file: `supabase/migrations/009_anonymous_visits.sql` (NEW)

**Naming**: follows the repo's existing sequential convention (`001_*.sql` through `008_*.sql`). Do **not** use date-prefixed naming.

**Transaction wrapping**: follows the pattern of `005_bulk_meta_rpc.sql` through `008_meta_trios.sql` — wrap the whole file in `BEGIN; ... COMMIT;` so a partial failure rolls back cleanly.

Contents, in order:

```sql
BEGIN;

-- Ensure pg_cron is available (no-op in production Supabase).
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Table with data-integrity checks.
CREATE TABLE IF NOT EXISTS public.anonymous_visits ( ... );

CREATE INDEX IF NOT EXISTS idx_anonymous_visits_last_visit
  ON public.anonymous_visits(last_visit_at);

ALTER TABLE public.anonymous_visits ENABLE ROW LEVEL SECURITY;

-- RPC (CREATE OR REPLACE makes re-runs safe).
CREATE OR REPLACE FUNCTION public.track_anonymous_visit ( ... ) ...;

REVOKE ALL     ON FUNCTION public.track_anonymous_visit(text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.track_anonymous_visit(text, text) FROM anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.track_anonymous_visit(text, text) TO service_role;

-- Idempotent cron registration.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-anonymous-visits') THEN
    PERFORM cron.unschedule('cleanup-anonymous-visits');
  END IF;
END $$;

SELECT cron.schedule(
  'cleanup-anonymous-visits',
  '0 3 * * *',
  $$DELETE FROM public.anonymous_visits
    WHERE last_visit_at < now() - interval '90 days'$$
);

COMMIT;
```

The entire file is idempotent: re-running it on an existing database makes no destructive changes to data, and the cron guard prevents duplicate jobs. A partial failure (e.g., `pg_cron` not installed) rolls back the entire migration thanks to the explicit transaction.

## 10. Testing

### 10.1 Unit tests — `src/__tests__/unit/lib/anonymous-visits.test.ts` (NEW)

Follow the patterns in `src/__tests__/integration/api/profile.test.ts` (which already mocks `@/lib/supabase/server`). Mock `@supabase/supabase-js` (not the SSR wrapper), `@/lib/telegram`, and rely on the real `@/lib/utils` helpers.

```ts
// Setup pattern:
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockAdmin),
}))
vi.mock('@/lib/telegram', () => ({
  notify: vi.fn().mockResolvedValue(undefined),
}))

// CRITICAL: reset module state between tests so the `_admin` singleton
// in anonymous-visits.ts does not leak between test cases.
beforeEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
})
```

Assertions for each case:

| # | Case | Setup | Expected |
|---|------|-------|----------|
| 1 | New valid tag, not in profiles | profiles query returns `null`, RPC returns `true`, count = 5 | RPC called once, `notify` called once with message containing "Tags únicos en la tabla: 5" |
| 2 | Existing tag (re-entry) | RPC returns `false` | RPC called once, `notify` **not** called |
| 3 | Tag already in profiles | profiles query returns `{ id: 'x' }` | RPC **not** called, `notify` **not** called |
| 4 | Invalid tag format | tag = `"??INVALID??"` | no DB calls, no `notify` |
| 5 | RPC returns error | `{ error: { message: 'boom' } }` | `console.error` called, `notify` **not** called |
| 6 | `notify` throws (should not in practice) | mock rejects | caught by outer `try/catch`, no propagation |
| 7 | Memoization | call the function twice in the same test | `createSupabaseAdmin` invoked exactly once (memoized client) |

### 10.2 Integration test — `src/__tests__/integration/api/calculate.test.ts`

Extend the existing file. Add a `vi.mock('next/server')` that **captures** the `after()` callback without invoking it. Critically, the capture state must live inside `vi.hoisted()` because Vitest hoists `vi.mock` factories above all file-scope code — a plain `let capturedAfterCallback = null` outside the mock would be undefined at factory execution time.

```ts
// All four accessors come from a single vi.hoisted() block so they're
// guaranteed to exist when the vi.mock factory runs.
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

beforeEach(() => { resetCaptured() })

test('fromLanding=true with anonymous user schedules tracking after response', async () => {
  const res = await POST(makeRequest({ playerTag: '#ABC123', fromLanding: true, locale: 'es' }))
  expect(res.status).toBe(200)

  // Tracking must NOT have run yet — it is only registered in after()
  expect(trackAnonymousVisitMock).not.toHaveBeenCalled()
  expect(getCaptured()).not.toBeNull()

  // Now drain the after() callback and assert tracking ran
  await getCaptured()!()
  expect(trackAnonymousVisitMock).toHaveBeenCalledWith({ tag: '#ABC123', locale: 'es' })
})
```

Cases (all use `getCaptured()` from the hoisted helper above):

1. **`fromLanding: true`, locale `'es'`, mocked anonymous user**:
   - POST the request, await the response.
   - Assert the response is 200 and contains the expected gem score payload.
   - Assert `getCaptured()` returns a non-null function (callback registered).
   - Assert `trackAnonymousVisit` **has not been called yet** (only registered, not invoked).
   - Manually invoke the captured callback: `await getCaptured()!()`.
   - Assert `trackAnonymousVisit` was called exactly once with `{ tag: '#ABC123', locale: 'es' }`.
   - This proves non-blocking ordering: the response went out before the tracking ran.
2. **`fromLanding: false`**: `getCaptured()` remains `null`, `trackAnonymousVisit` never called.
3. **`locale: 'xx'` (not in whitelist)**: `getCaptured()` remains `null`.
4. **`locale: '<b>evil</b>'` (HTML injection attempt)**: `getCaptured()` remains `null` — whitelist rejects.
5. **Authenticated user (mock `createClient` / `auth.getUser()` to return a user)**: `getCaptured()` remains `null` even with `fromLanding: true`.
6. **`typeof body.locale !== 'string'`** (e.g. `locale: 123`): `getCaptured()` remains `null`.

### 10.3 Manual SQL verification

After applying the migration locally (`supabase db reset` or equivalent):

- Run `SELECT track_anonymous_visit('#ABC123', 'es');` twice → first returns `true`, second returns `false`, `visit_count = 2`.
- `INSERT INTO anonymous_visits (tag, locale, last_visit_at) VALUES ('#OLD1', 'en', now() - interval '100 days');` then manually execute the cron body → row is deleted.
- Re-apply the migration → no errors, cron job still exists with the same name.

## 11. Observability

- Every failure path in `trackAnonymousVisit` logs to `console.error` with prefix `[anonymous-visits]`. Surface via Vercel Runtime Logs (Dashboard → Deployments → Functions tab).
- `[calculate] tracking failed` and `[calculate] auth check for tracking failed` logged from the route handler catch blocks.
- **Kill switch**: to disable tracking without redeploying, unset `TELEGRAM_BOT_TOKEN` in Vercel env vars and redeploy — `notify()` already no-ops when env vars are missing. For a harder kill, `REVOKE EXECUTE ON FUNCTION public.track_anonymous_visit FROM service_role;` via Supabase SQL editor — the RPC will fail, the error will be logged, and no row will be written.

## 12. Rollout plan

1. Apply migration `009_anonymous_visits.sql` to Supabase.
2. Verify: `SELECT * FROM cron.job WHERE jobname = 'cleanup-anonymous-visits';` returns one row.
3. Deploy code changes to a preview URL.
4. End-to-end smoke test on preview:
   - Incognito → landing → submit a never-seen test tag → Telegram message arrives within seconds.
   - Reload the same profile → no second Telegram message.
   - Log into an account with a profile → submit its tag from landing → no Telegram message (auth check filters it out in the handler).
   - Navigate to a player profile via direct URL (no `?from=landing`) → no Telegram message, no DB row.
   - POST manually to `/api/calculate` with `{ playerTag, fromLanding: true, locale: '<b>x</b>' }` → no Telegram message (whitelist blocks it).
5. Promote to production.
6. Observe Telegram for 24 hours. If signal-to-noise is acceptable, close the feature.
7. Revisit in 7 days to decide if a rate limit on notifications is needed (Q-C was "observe first").

## 13. Risks and mitigations

| Risk | Severity | Mitigation |
|------|----------|------------|
| A legitimate landing visitor types a tag that happens to already exist in `profiles` (someone else registered it). | Low | Intended behavior — skip. We count "new to system" not "new to this visitor". Acceptable false negative. |
| Telegram API outage. | Low | `notify()` already silent-fails. `after()` isolates it from the response path. User never sees a slowdown. |
| `pg_cron` job fails silently. | Medium | Weekly manual check: `SELECT * FROM cron.job_run_details WHERE jobname = 'cleanup-anonymous-visits' ORDER BY start_time DESC LIMIT 10;`. |
| Table grows unbounded if cron stops. | Low | 90-day window + PK on tag bounds worst case to ~tens of thousands of rows. |
| An attacker forges `fromLanding=true` via direct POST to `/api/calculate` with valid tags from public leaderboards, spamming Telegram. | Medium | Accepted for v1 (Q-C). Mitigations ready if abuse appears: (a) `Origin` header check against `brawlvision.com`, (b) max notifications per hour via Upstash Redis, (c) `REVOKE EXECUTE` as hard kill. |
| localStorage cache suppresses re-entries within 5 minutes. | Low | Documented as accepted (Q-A). `visit_count` slightly under-counts; unique tags remain exact. |
| Guard 2 gap for tags with 13-20 chars. | Low | Real Supercell tags are 8-10 chars, so the window is empty in practice. If a long tag ever appears, it lands in `anonymous_visits` and eventually is cleaned by cron. Documented in FR-10. |
| A future refactor moves the auth check back inside `trackAnonymousVisit` and breaks cookies-in-after. | Medium | Integration test #5 (authenticated user → skip) catches this. Inline comment in `src/lib/anonymous-visits.ts` explains why the auth check lives in the handler. |
| HTML injection in Telegram message via `locale`. | Mitigated | Whitelist in `/api/calculate` rejects anything not in `SUPPORTED_LOCALES`. Defense in depth: the BD CHECK constraint bounds length. |
| `createSupabaseAdmin` instantiation crashing on cold start if env vars missing. | Low | Env vars are required for other features already (e.g., `supabase.auth.getUser()`). If they're missing, many other things also break. Fast-fail is acceptable. |
| Supabase Auth outage during the inline `auth.getUser()` call in `/api/calculate`. | Low | **Fail-closed**: the outer `try/catch` in the handler logs the error and skips scheduling `after()`. Result: we miss some notifications during the outage window, but we never mistakenly log an authenticated user as anonymous. Trading one-off missed notifications for correctness is the right call. |
| Locale whitelist (`SUPPORTED_LOCALES` in `/api/calculate`) drifts out of sync with `src/i18n/routing.ts`. | Medium | Inline comment explicitly warns about this. When adding a 14th locale, both files must be updated. Consider a follow-up refactor to extract locales to a pure `src/i18n/locales.ts` module that both files import. |

## 14. Future work (not part of this spec)

- **Telegram conversational bot**: incoming webhook at `/api/telegram/webhook`, command parser (`/nuevos`, `/stats`, `/premium`, `/batallas`), queries over `profiles` + `battles` + `anonymous_visits`. Will require its own brainstorming cycle and spec. This is explicitly what unlocks value from this spec.
- **Daily digest push**: instead of real-time notifications, a daily Telegram summary at a fixed hour.
- **Country enrichment**: if geographic breakdown becomes interesting, add a `country` column populated from Vercel's `x-vercel-ip-country` header. Deferred due to GDPR considerations.
- **Rate limit on notifications**: if Q-C observation reveals abuse, add Upstash Redis sliding-window counter keyed by hour.
- **Unify `PLAYER_TAG_REGEX` definitions** across `src/lib/constants.ts` (`{3,20}`) and `src/app/api/profile/route.ts` (`{3,12}`). Out of scope here per Q-E, but a dedicated cleanup pass would close FR-10's known gap.
- **Generic HTML escape helper for `notify()`**: currently only `locale` is whitelisted; other existing callers (e.g., `/api/notify/signup` which interpolates `user.email`) also use `parse_mode: 'HTML'` without escaping. Worth a dedicated pass.

## 15. Approval

This spec (v4, post fourth self-review) reflects all user decisions:

- **Q1**: Per-tag row with `visit_count` and `last_visit_at` (option b).
- **Q2**: "Freeze on registration" conversion policy — guard by `profiles` lookup (option c).
- **Q3**: Rich Telegram notification format (option c).
- **Q4**: Piggyback on `/api/calculate` with `?from=landing` flag.
- **Q5**: `pg_cron` daily 03:00 UTC cleanup (option a).
- **Q6**: Reuse existing Supercell call for implicit validation (smart option c).
- **Q-A**: Accept localStorage cache gap for re-entries within 5 minutes (option 1).
- **Q-B**: Use `after()` from `next/server` for post-response Telegram delivery.
- **Q-C**: No rate limit on notifications for v1; observe and react (option 1).
- **Q-D**: Reuse `isValidPlayerTag` / `normalizePlayerTag` from `src/lib/utils.ts` (yes).
- **Q-E**: Do not unify the inconsistent regex across other files (out of scope).

Pending: final user review of v4 before committing and invoking `superpowers:writing-plans`.
