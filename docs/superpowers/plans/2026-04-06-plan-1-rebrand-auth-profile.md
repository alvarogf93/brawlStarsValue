# Plan 1: Rebrand + Supabase Auth + Profile

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebrand BrawlValue → BrawlVision, set up Supabase Auth with Google login, and create user profiles linked to Brawl Stars player tags.

**Architecture:** Supabase Auth handles Google OAuth. Session cookies are refreshed in Next.js middleware (proxy.ts), combined with existing next-intl routing. A `profiles` table links Supabase user IDs to player tags and subscription tier. Client-side auth state is managed via a React context provider wrapping the app.

**Tech Stack:** Next.js 16.2.2, @supabase/supabase-js, @supabase/ssr, Supabase Auth (Google OAuth), PostgreSQL (Supabase), Vitest, next-intl

**Spec:** `docs/superpowers/specs/2026-04-06-premium-battle-analytics-design.md`

---

## File Map

| Action | Path | Responsibility |
|--------|------|---------------|
| Modify | `public/manifest.json` | Rebrand name |
| Modify | `src/app/[locale]/layout.tsx` | Rebrand metadata + add AuthProvider |
| Modify | `src/components/layout/Header.tsx` | Rebrand + auth buttons |
| Modify | `src/components/layout/Sidebar.tsx` | Rebrand footer + analytics nav |
| Modify | `package.json` | Add Supabase deps |
| Modify | `.env.example` | Add Supabase env vars |
| Modify | `src/proxy.ts` | Combine i18n + Supabase auth refresh |
| Create | `src/lib/supabase/types.ts` | Database type definitions |
| Create | `src/lib/supabase/client.ts` | Browser Supabase client |
| Create | `src/lib/supabase/server.ts` | Server Supabase client |
| Create | `src/lib/auth.ts` | Auth helper functions |
| Create | `src/hooks/useAuth.ts` | Client-side auth state hook |
| Create | `src/components/auth/AuthProvider.tsx` | Auth context provider |
| Create | `src/components/auth/AuthModal.tsx` | Google login modal |
| Create | `src/app/api/auth/callback/route.ts` | OAuth callback handler |
| Create | `src/app/api/profile/route.ts` | Profile CRUD (GET/POST/PATCH) |
| Create | `src/__tests__/unit/lib/auth.test.ts` | Auth utility tests |
| Create | `src/__tests__/unit/lib/supabase-types.test.ts` | Type guard tests |
| Create | `src/__tests__/integration/api/profile.test.ts` | Profile API tests |
| Create | `src/__tests__/integration/api/auth-callback.test.ts` | Callback route tests |

---

### Task 0: Rebrand BrawlValue → BrawlVision

**Files:**
- Modify: `public/manifest.json`
- Modify: `src/app/[locale]/layout.tsx:8-75`
- Modify: `src/components/layout/Header.tsx:52`
- Modify: `src/components/layout/Sidebar.tsx:100-106`

- [ ] **Step 1: Update manifest.json**

```json
{
  "name": "BrawlVision",
  "short_name": "BrawlVision",
  "description": "Brawl Stars combat analytics & gem calculator",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#121A2F",
  "theme_color": "#1C5CF1",
  "icons": [
    { "src": "/icon", "sizes": "48x48", "type": "image/png" }
  ]
}
```

- [ ] **Step 2: Update layout.tsx metadata**

Replace all `BrawlValue` references in the metadata object and JSON-LD:

```typescript
export const metadata: Metadata = {
  metadataBase: new URL('https://brawlvision.com'),
  title: {
    absolute: 'BrawlVision | Brawl Stars Combat Analytics & Gem Calculator',
    template: '%s | BrawlVision'
  },
  description: 'Brawl Stars combat analytics platform. Calculate gem value, analyze battles, track win rates, and compete on the Global Leaderboard.',
  keywords: ['Brawl Stars', 'BrawlVision', 'Battle Analytics', 'Gem Calculator', 'Brawl Stars Stats', 'Leaderboard', 'Supercell', 'Profile Tracker'],
  authors: [{ name: 'BrawlVision' }],
  openGraph: {
    type: 'website',
    url: 'https://brawlvision.com',
    title: 'BrawlVision - Brawl Stars Combat Analytics',
    description: 'Analyze your battles, track win rates, and calculate your gem value.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'BrawlVision | Combat Analytics & Gem Calculator',
    description: 'Analyze your battles, track win rates, and calculate your gem value.',
  },
  alternates: {
    languages: {
      es: 'https://brawlvision.com/es',
      en: 'https://brawlvision.com/en',
      fr: 'https://brawlvision.com/fr',
      pt: 'https://brawlvision.com/pt',
      de: 'https://brawlvision.com/de',
      it: 'https://brawlvision.com/it',
      ru: 'https://brawlvision.com/ru',
      tr: 'https://brawlvision.com/tr',
      pl: 'https://brawlvision.com/pl',
      ar: 'https://brawlvision.com/ar',
      ko: 'https://brawlvision.com/ko',
      ja: 'https://brawlvision.com/ja',
      zh: 'https://brawlvision.com/zh',
    },
  }
}
```

Update JSON-LD in the same file:

```typescript
{
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'BrawlVision',
  url: 'https://brawlvision.com',
  applicationCategory: 'GameApplication',
  operatingSystem: 'Web',
  description: 'Brawl Stars combat analytics platform. Calculate gem value, analyze battles, and track progression.',
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  author: { '@type': 'Organization', name: 'BrawlVision' },
  inLanguage: ['es', 'en', 'fr', 'pt', 'de', 'it', 'ru', 'tr', 'pl', 'ar', 'ko', 'ja', 'zh'],
}
```

- [ ] **Step 3: Update Header.tsx brand text**

In `src/components/layout/Header.tsx:52`, change the brand span:

```tsx
<span className="font-black text-2xl font-['Lilita_One'] tracking-wide text-[var(--color-brawl-gold)] text-stroke-brawl transform rotate-[-2deg]">BrawlVision</span>
```

- [ ] **Step 4: Update Sidebar.tsx brand footer**

In `src/components/layout/Sidebar.tsx:100-106`, change the branding block:

```tsx
<div className="p-4 shrink-0">
  <div className="w-full rounded-2xl border-4 border-[#0F172A] bg-gradient-to-r from-[#1C5CF1] to-[#121A2F] px-4 py-3 flex flex-col items-center justify-center overflow-hidden shadow-[0_3px_0_0_rgba(18,26,47,1)]">
    <span className="font-['Lilita_One'] text-lg text-[var(--color-brawl-gold)] text-stroke-brawl tracking-wide transform rotate-[-1deg]">BrawlVision</span>
    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">combat analytics</span>
  </div>
</div>
```

- [ ] **Step 5: Verify rebrand**

Run: `grep -r "BrawlValue" src/ public/ --include="*.tsx" --include="*.ts" --include="*.json" -l`

Expected: No files returned (all instances replaced). If any remain, fix them.

- [ ] **Step 6: Commit**

```bash
git add public/manifest.json src/app/[locale]/layout.tsx src/components/layout/Header.tsx src/components/layout/Sidebar.tsx
git commit -m "rebrand: BrawlValue → BrawlVision across all UI and metadata"
```

---

### Task 1: Install Supabase Dependencies + Environment

**Files:**
- Modify: `package.json`
- Modify: `.env.example`

- [ ] **Step 1: Install Supabase packages**

Run: `npm install @supabase/supabase-js @supabase/ssr`

Expected: Both packages added to `dependencies` in package.json.

- [ ] **Step 2: Update .env.example**

Add Supabase env vars:

```
# Supercell Brawl Stars API (server-only)
BRAWLSTARS_API_KEY=your_api_key_here

# Upstash Redis (server-only, rate limiting)
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...

# Google Analytics (public)
NEXT_PUBLIC_GA_ID=G-XXXXXXXXXX

# Supabase (public — safe to expose, RLS protects data)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Supabase (server-only — NEVER expose to client)
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

- [ ] **Step 3: Add real Supabase credentials to .env.local**

The user must:
1. Create a new Supabase project at https://supabase.com/dashboard
2. Go to Settings → API
3. Copy: Project URL → `NEXT_PUBLIC_SUPABASE_URL`, anon key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`, service_role key → `SUPABASE_SERVICE_ROLE_KEY`
4. Enable Google Auth: Authentication → Providers → Google → Enable, paste Google OAuth Client ID + Secret
5. Set redirect URL in Google Cloud Console: `https://<project>.supabase.co/auth/v1/callback`

Add to `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
```

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json .env.example
git commit -m "deps: add @supabase/supabase-js and @supabase/ssr"
```

---

### Task 2: Database Types + Supabase Clients

**Files:**
- Create: `src/lib/supabase/types.ts`
- Create: `src/lib/supabase/client.ts`
- Create: `src/lib/supabase/server.ts`
- Test: `src/__tests__/unit/lib/supabase-types.test.ts`

- [ ] **Step 1: Write type guard test**

```typescript
// src/__tests__/unit/lib/supabase-types.test.ts
import { describe, it, expect } from 'vitest'
import { isValidTier, isValidSubscriptionStatus, type Tier, type SubscriptionStatus } from '@/lib/supabase/types'

describe('Supabase type guards', () => {
  it('validates tier values', () => {
    expect(isValidTier('free')).toBe(true)
    expect(isValidTier('premium')).toBe(true)
    expect(isValidTier('pro')).toBe(true)
    expect(isValidTier('ultra')).toBe(false)
    expect(isValidTier('')).toBe(false)
  })

  it('validates subscription status values', () => {
    expect(isValidSubscriptionStatus('active')).toBe(true)
    expect(isValidSubscriptionStatus('cancelled')).toBe(true)
    expect(isValidSubscriptionStatus('expired')).toBe(true)
    expect(isValidSubscriptionStatus('past_due')).toBe(true)
    expect(isValidSubscriptionStatus(null)).toBe(true)
    expect(isValidSubscriptionStatus('invalid')).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/unit/lib/supabase-types.test.ts`

Expected: FAIL — module `@/lib/supabase/types` not found.

- [ ] **Step 3: Create database types**

```typescript
// src/lib/supabase/types.ts

export type Tier = 'free' | 'premium' | 'pro'
export type SubscriptionStatus = 'active' | 'cancelled' | 'expired' | 'past_due'

export function isValidTier(value: string): value is Tier {
  return value === 'free' || value === 'premium' || value === 'pro'
}

export function isValidSubscriptionStatus(value: string | null): value is SubscriptionStatus | null {
  if (value === null) return true
  return value === 'active' || value === 'cancelled' || value === 'expired' || value === 'past_due'
}

/** Row type for the profiles table */
export interface Profile {
  id: string
  player_tag: string
  tier: Tier
  ls_customer_id: string | null
  ls_subscription_id: string | null
  ls_subscription_status: SubscriptionStatus | null
  last_sync: string | null
  created_at: string
  updated_at: string
}

/** What the client sends when creating a profile */
export interface ProfileInsert {
  id: string
  player_tag: string
  tier?: Tier
}

/** What the client sends when updating a profile */
export interface ProfileUpdate {
  player_tag?: string
  tier?: Tier
  ls_customer_id?: string | null
  ls_subscription_id?: string | null
  ls_subscription_status?: SubscriptionStatus | null
  last_sync?: string | null
}

/** Supabase Database type (used for typed client) */
export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile
        Insert: ProfileInsert
        Update: ProfileUpdate
      }
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/unit/lib/supabase-types.test.ts`

Expected: PASS — both tests green.

- [ ] **Step 5: Create browser client**

```typescript
// src/lib/supabase/client.ts
import { createBrowserClient } from '@supabase/ssr'
import type { Database } from './types'

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

- [ ] **Step 6: Create server client**

```typescript
// src/lib/supabase/server.ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from './types'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          } catch {
            // setAll is called from Server Component — ignore.
            // Middleware will refresh the session on next request.
          }
        },
      },
    }
  )
}

/** Server client with service role (bypasses RLS). Only use in API routes. */
export async function createServiceClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          } catch {
            // Ignored in Server Components
          }
        },
      },
    }
  )
}
```

- [ ] **Step 7: Commit**

```bash
git add src/lib/supabase/ src/__tests__/unit/lib/supabase-types.test.ts
git commit -m "feat: Supabase client setup + database types with type guards"
```

---

### Task 3: Create Profiles Table in Supabase

**Files:**
- None (SQL executed in Supabase Dashboard)

- [ ] **Step 1: Run SQL migration**

Open Supabase Dashboard → SQL Editor → New Query. Paste and run:

```sql
-- Profiles table: links Supabase auth user to Brawl Stars player tag
CREATE TABLE profiles (
  id                     UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  player_tag             TEXT NOT NULL,
  tier                   TEXT NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'premium', 'pro')),
  ls_customer_id         TEXT,
  ls_subscription_id     TEXT,
  ls_subscription_status TEXT CHECK (ls_subscription_status IN ('active', 'cancelled', 'expired', 'past_due')),
  last_sync              TIMESTAMPTZ,
  created_at             TIMESTAMPTZ DEFAULT NOW(),
  updated_at             TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_profiles_tag ON profiles(player_tag);
CREATE INDEX idx_profiles_tier_sync ON profiles(tier, last_sync) WHERE tier != 'free';

-- Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Users can only read/update their own profile
CREATE POLICY profiles_select ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY profiles_insert ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY profiles_update ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY profiles_delete ON profiles FOR DELETE USING (auth.uid() = id);
```

- [ ] **Step 2: Verify in Supabase Dashboard**

Go to Table Editor → `profiles` should be visible with all columns. Check RLS is enabled (shield icon).

- [ ] **Step 3: Enable Google Auth in Supabase**

Go to Authentication → Providers → Google:
1. Toggle ON
2. Enter Google OAuth Client ID and Client Secret (from Google Cloud Console)
3. Copy the Supabase callback URL: `https://<project>.supabase.co/auth/v1/callback`
4. Add it as authorized redirect URI in Google Cloud Console → Credentials → your OAuth client

---

### Task 4: Auth Middleware (proxy.ts)

**Files:**
- Modify: `src/proxy.ts`

- [ ] **Step 1: Update proxy.ts to combine i18n + Supabase auth refresh**

```typescript
// src/proxy.ts
import { type NextRequest } from 'next/server'
import createIntlMiddleware from 'next-intl/middleware'
import { createServerClient } from '@supabase/ssr'
import { routing } from './i18n/routing'

const handleI18n = createIntlMiddleware(routing)

export default async function proxy(request: NextRequest) {
  // 1. Run i18n middleware (locale detection + rewriting)
  const response = handleI18n(request)

  // 2. Refresh Supabase auth session (reads/writes cookies on request + response)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (supabaseUrl && supabaseAnonKey) {
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value)
          })
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options)
          })
        },
      },
    })

    // This refreshes the session if expired — the cookie changes
    // are written to the response via setAll above
    await supabase.auth.getUser()
  }

  return response
}

export const config = {
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
}
```

- [ ] **Step 2: Verify dev server starts without errors**

Run: `npm run dev`

Expected: Server starts, no errors about Supabase. If `NEXT_PUBLIC_SUPABASE_URL` is not set yet, the `if` guard skips Supabase (graceful degradation).

- [ ] **Step 3: Commit**

```bash
git add src/proxy.ts
git commit -m "feat: add Supabase auth session refresh to middleware"
```

---

### Task 5: OAuth Callback Route

**Files:**
- Create: `src/app/api/auth/callback/route.ts`
- Test: `src/__tests__/integration/api/auth-callback.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/__tests__/integration/api/auth-callback.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET } from '@/app/api/auth/callback/route'

// Mock @supabase/ssr
vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(() => ({
    auth: {
      exchangeCodeForSession: vi.fn().mockResolvedValue({ error: null }),
    },
  })),
}))

// Mock next/headers
vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({
    getAll: () => [],
    set: vi.fn(),
  }),
}))

function makeRequest(url: string) {
  return new Request(url)
}

describe('GET /api/auth/callback', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('redirects to next param after successful code exchange', async () => {
    const res = await GET(makeRequest('http://localhost:3000/api/auth/callback?code=abc123&next=/es/profile/%23TAG'))
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toBe('http://localhost:3000/es/profile/%23TAG')
  })

  it('redirects to / when no next param', async () => {
    const res = await GET(makeRequest('http://localhost:3000/api/auth/callback?code=abc123'))
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toBe('http://localhost:3000/')
  })

  it('redirects to error page when no code', async () => {
    const res = await GET(makeRequest('http://localhost:3000/api/auth/callback'))
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('/auth-error')
  })

  it('redirects to error page on exchange failure', async () => {
    const { createServerClient } = await import('@supabase/ssr')
    vi.mocked(createServerClient).mockReturnValue({
      auth: {
        exchangeCodeForSession: vi.fn().mockResolvedValue({ error: new Error('bad code') }),
      },
    } as never)

    const res = await GET(makeRequest('http://localhost:3000/api/auth/callback?code=badcode'))
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('/auth-error')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/integration/api/auth-callback.test.ts`

Expected: FAIL — module `@/app/api/auth/callback/route` not found.

- [ ] **Step 3: Create callback route**

```typescript
// src/app/api/auth/callback/route.ts
import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  if (!code) {
    return NextResponse.redirect(`${origin}/auth-error`)
  }

  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          } catch {
            // Ignored
          }
        },
      },
    }
  )

  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    return NextResponse.redirect(`${origin}/auth-error`)
  }

  return NextResponse.redirect(`${origin}${next}`)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/integration/api/auth-callback.test.ts`

Expected: PASS — all 4 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/auth/callback/route.ts src/__tests__/integration/api/auth-callback.test.ts
git commit -m "feat: OAuth callback route for Google login"
```

---

### Task 6: Auth Utilities

**Files:**
- Create: `src/lib/auth.ts`
- Test: `src/__tests__/unit/lib/auth.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/__tests__/unit/lib/auth.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getProfile, createProfile, isPremium } from '@/lib/auth'
import type { Profile } from '@/lib/supabase/types'

// Mock supabase server client
const mockFrom = vi.fn()
const mockSupabase = {
  auth: { getUser: vi.fn() },
  from: mockFrom,
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue(mockSupabase),
}))

const MOCK_PROFILE: Profile = {
  id: 'user-uuid-1',
  player_tag: '#YJU282PV',
  tier: 'free',
  ls_customer_id: null,
  ls_subscription_id: null,
  ls_subscription_status: null,
  last_sync: null,
  created_at: '2026-04-06T00:00:00Z',
  updated_at: '2026-04-06T00:00:00Z',
}

describe('auth utilities', () => {
  beforeEach(() => { vi.clearAllMocks() })

  describe('isPremium', () => {
    it('returns true for premium tier with active status', () => {
      expect(isPremium({ ...MOCK_PROFILE, tier: 'premium', ls_subscription_status: 'active' })).toBe(true)
    })

    it('returns true for pro tier', () => {
      expect(isPremium({ ...MOCK_PROFILE, tier: 'pro', ls_subscription_status: 'active' })).toBe(true)
    })

    it('returns true for cancelled subscription (still in paid period)', () => {
      // Spec: "subscription_cancelled → keep tier until period ends"
      // User paid — access continues until subscription_expired fires
      expect(isPremium({ ...MOCK_PROFILE, tier: 'premium', ls_subscription_status: 'cancelled' })).toBe(true)
    })

    it('returns false for free tier', () => {
      expect(isPremium(MOCK_PROFILE)).toBe(false)
    })

    it('returns false for expired subscription', () => {
      expect(isPremium({ ...MOCK_PROFILE, tier: 'free', ls_subscription_status: 'expired' })).toBe(false)
    })

    it('returns false for past_due subscription', () => {
      expect(isPremium({ ...MOCK_PROFILE, tier: 'premium', ls_subscription_status: 'past_due' })).toBe(false)
    })

    it('returns false for null profile', () => {
      expect(isPremium(null)).toBe(false)
    })
  })

  describe('getProfile', () => {
    it('returns profile when user is authenticated', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'user-uuid-1' } }, error: null })
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: MOCK_PROFILE, error: null }),
          }),
        }),
      })

      const result = await getProfile()
      expect(result).toEqual({ user: { id: 'user-uuid-1' }, profile: MOCK_PROFILE })
    })

    it('returns null user and profile when not authenticated', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null }, error: null })

      const result = await getProfile()
      expect(result).toEqual({ user: null, profile: null })
    })
  })

  describe('createProfile', () => {
    it('inserts profile with given user id and tag', async () => {
      const mockInsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: MOCK_PROFILE, error: null }),
        }),
      })
      mockFrom.mockReturnValue({ insert: mockInsert })

      const result = await createProfile('user-uuid-1', '#YJU282PV')
      expect(result).toEqual(MOCK_PROFILE)
      expect(mockInsert).toHaveBeenCalledWith({ id: 'user-uuid-1', player_tag: '#YJU282PV' })
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/unit/lib/auth.test.ts`

Expected: FAIL — module `@/lib/auth` not found.

- [ ] **Step 3: Create auth utilities**

```typescript
// src/lib/auth.ts
import { createClient } from '@/lib/supabase/server'
import type { Profile } from '@/lib/supabase/types'

/** Check if a profile has active premium access.
 *  Cancelled subscriptions KEEP access until period ends (subscription_expired).
 *  Only 'expired' and 'past_due' revoke access. */
export function isPremium(profile: Profile | null): boolean {
  if (!profile) return false
  if (profile.tier === 'free') return false
  return profile.ls_subscription_status === 'active'
      || profile.ls_subscription_status === 'cancelled'
}

/** Get current authenticated user + their profile (if exists) */
export async function getProfile(): Promise<{
  user: { id: string } | null
  profile: Profile | null
}> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { user: null, profile: null }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  return { user: { id: user.id }, profile: profile ?? null }
}

/** Create a new profile (called after first login) */
export async function createProfile(userId: string, playerTag: string): Promise<Profile | null> {
  const supabase = await createClient()

  const { data } = await supabase
    .from('profiles')
    .insert({ id: userId, player_tag: playerTag })
    .select()
    .single()

  return data ?? null
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/unit/lib/auth.test.ts`

Expected: PASS — all 7 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth.ts src/__tests__/unit/lib/auth.test.ts
git commit -m "feat: auth utilities — getProfile, createProfile, isPremium"
```

---

### Task 7: useAuth Hook + AuthProvider

**Files:**
- Create: `src/hooks/useAuth.ts`
- Create: `src/components/auth/AuthProvider.tsx`
- Modify: `src/app/[locale]/layout.tsx`

- [ ] **Step 1: Create useAuth hook**

```typescript
// src/hooks/useAuth.ts
'use client'

import { createContext, useContext } from 'react'
import type { User } from '@supabase/supabase-js'
import type { Profile } from '@/lib/supabase/types'

export interface AuthState {
  user: User | null
  profile: Profile | null
  loading: boolean
  signIn: (redirectTo?: string) => Promise<void>
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthState>({
  user: null,
  profile: null,
  loading: true,
  signIn: async () => {},
  signOut: async () => {},
})

export function useAuth(): AuthState {
  return useContext(AuthContext)
}
```

- [ ] **Step 2: Create AuthProvider**

```typescript
// src/components/auth/AuthProvider.tsx
'use client'

import { useState, useEffect, useCallback, type ReactNode } from 'react'
import { AuthContext, type AuthState } from '@/hooks/useAuth'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'
import type { Profile } from '@/lib/supabase/types'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  const supabase = createClient()

  // Fetch profile for a given user ID
  const fetchProfile = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    setProfile(data ?? null)
  }, [supabase])

  useEffect(() => {
    // Get initial session
    supabase.auth.getUser().then(({ data: { user: u } }) => {
      setUser(u)
      if (u) fetchProfile(u.id)
      setLoading(false)
    })

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        const u = session?.user ?? null
        setUser(u)
        if (u) {
          await fetchProfile(u.id)
        } else {
          setProfile(null)
        }
        setLoading(false)
      }
    )

    return () => subscription.unsubscribe()
  }, [supabase, fetchProfile])

  const signIn = useCallback(async (redirectTo?: string) => {
    const redirectPath = redirectTo ?? window.location.pathname
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/api/auth/callback?next=${encodeURIComponent(redirectPath)}`,
      },
    })
  }, [supabase])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
  }, [supabase])

  const value: AuthState = { user, profile, loading, signIn, signOut }

  return (
    <AuthContext value={value}>
      {children}
    </AuthContext>
  )
}
```

- [ ] **Step 3: Add AuthProvider to layout.tsx**

In `src/app/[locale]/layout.tsx`, add the import and wrap children:

Add import at top:
```typescript
import { AuthProvider } from '@/components/auth/AuthProvider'
```

Wrap `{children}` inside the body:
```tsx
<body className="min-h-screen">
  <Script
    src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-6838192381842255"
    crossOrigin="anonymous"
    strategy="afterInteractive"
  />
  <NextIntlClientProvider messages={messages}>
    <AuthProvider>
      {children}
      <CookieConsent />
    </AuthProvider>
  </NextIntlClientProvider>
</body>
```

- [ ] **Step 4: Verify dev server loads without errors**

Run: `npm run dev`

Visit `http://localhost:3000`. The page should render normally. No auth errors (user will be null since Supabase credentials may not be set yet).

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useAuth.ts src/components/auth/AuthProvider.tsx src/app/[locale]/layout.tsx
git commit -m "feat: AuthProvider context + useAuth hook"
```

---

### Task 8: AuthModal Component

**Files:**
- Create: `src/components/auth/AuthModal.tsx`

- [ ] **Step 1: Create AuthModal**

```typescript
// src/components/auth/AuthModal.tsx
'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useTranslations } from 'next-intl'

interface AuthModalProps {
  open: boolean
  onClose: () => void
  redirectTo?: string
}

export function AuthModal({ open, onClose, redirectTo }: AuthModalProps) {
  const { signIn } = useAuth()
  const t = useTranslations('auth')
  const [loading, setLoading] = useState(false)

  if (!open) return null

  const handleGoogleLogin = async () => {
    setLoading(true)
    await signIn(redirectTo)
    // Redirect happens externally — no need to setLoading(false)
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative brawl-card p-8 max-w-sm w-full mx-4 animate-fade-in">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 text-slate-400 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center mb-6">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[var(--color-brawl-sky)] border-4 border-[var(--color-brawl-dark)] flex items-center justify-center shadow-[0_4px_0_rgba(18,26,47,1)]">
            <span className="text-3xl">🔓</span>
          </div>
          <h2 className="font-['Lilita_One'] text-2xl text-white text-stroke-brawl">
            {t('title')}
          </h2>
          <p className="text-sm text-slate-400 mt-2">
            {t('subtitle')}
          </p>
        </div>

        <button
          onClick={handleGoogleLogin}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 px-6 py-3 bg-white text-gray-800 font-semibold rounded-xl hover:bg-gray-100 transition-colors disabled:opacity-50 border-4 border-[var(--color-brawl-dark)] shadow-[0_3px_0_0_rgba(18,26,47,1)]"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          {loading ? t('loading') : t('googleButton')}
        </button>

        <p className="text-[10px] text-slate-600 text-center mt-4">
          {t('disclaimer')}
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify component renders**

Run dev server, temporarily import and render `<AuthModal open={true} onClose={() => {}} />` in any page to verify the modal looks correct. Remove after verification.

- [ ] **Step 3: Commit**

```bash
git add src/components/auth/AuthModal.tsx
git commit -m "feat: AuthModal component with Google login"
```

---

### Task 9: Header + Sidebar Auth Integration

**Files:**
- Modify: `src/components/layout/Header.tsx`
- Modify: `src/components/layout/Sidebar.tsx`

- [ ] **Step 1: Update Header.tsx with auth buttons**

Replace the full Header component:

```typescript
// src/components/layout/Header.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { LocaleSwitcher } from '@/components/common/LocaleSwitcher'
import { AuthModal } from '@/components/auth/AuthModal'
import { useAuth } from '@/hooks/useAuth'
import { Menu, LogOut, RefreshCw, User, Crown } from 'lucide-react'
import Link from 'next/link'

interface HeaderProps {
  playerTag?: string
  onMenuToggle?: () => void
}

export function Header({ playerTag, onMenuToggle }: HeaderProps) {
  const router = useRouter()
  const locale = useLocale()
  const t = useTranslations('nav')
  const { user, profile, loading, signOut } = useAuth()

  const [syncing, setSyncing] = useState(false)
  const [authModalOpen, setAuthModalOpen] = useState(false)

  const handleSync = () => {
    setSyncing(true)
    try {
      const keysToKeep = ['brawlvalue:user']
      const keysToKeepPrefixes = ['brawlvalue:skins:']
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i)
        if (key?.startsWith('brawlvalue:') && !keysToKeep.includes(key) && !keysToKeepPrefixes.some(p => key.startsWith(p))) {
          localStorage.removeItem(key)
        }
      }
    } catch { /* ignore */ }
    window.location.reload()
  }

  const handleLogout = async () => {
    if (user) {
      await signOut()
    }
    try { localStorage.removeItem('brawlvalue:user') } catch { /* ignore */ }
    router.replace(`/${locale}`)
  }

  return (
    <>
      <header className="h-[var(--header-height)] shrink-0 bg-[#0F172A] border-b-4 border-[#030712] flex items-center justify-between px-6 md:px-8 z-50 shadow-[0_4px_15px_rgba(0,0,0,0.5)]">
        <div className="flex items-center gap-4">
          {onMenuToggle && (
            <button onClick={onMenuToggle} className="md:hidden p-2 text-[var(--color-brawl-dark)] hover:bg-[var(--color-brawl-light)] transition-colors rounded-xl border-2 border-transparent hover:border-[var(--color-brawl-dark)]">
              <Menu className="w-6 h-6 stroke-[3px]" />
            </button>
          )}
          <span className="font-black text-2xl font-['Lilita_One'] tracking-wide text-[var(--color-brawl-gold)] text-stroke-brawl transform rotate-[-2deg]">BrawlVision</span>
          {playerTag && (
            <span className="text-sm font-['Lilita_One'] px-3 py-1 rounded-full bg-[var(--color-brawl-sky)] border-2 border-[var(--color-brawl-dark)] text-white hidden sm:inline-block ml-2 drop-shadow-[0_2px_0_rgba(18,26,47,1)]">
              {playerTag}
            </span>
          )}
        </div>
        <div className="flex gap-2 items-center">
          {/* Auth: Login or Premium Upgrade */}
          {!loading && !user && (
            <button
              onClick={() => setAuthModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-['Lilita_One'] text-white bg-white/10 hover:bg-white/20 rounded-xl transition-colors"
            >
              <User className="w-4 h-4" />
              <span className="hidden sm:inline">{t('login')}</span>
            </button>
          )}
          {!loading && user && profile?.tier === 'free' && (
            <button
              onClick={() => {/* Plan 3: checkout redirect */}}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-['Lilita_One'] text-[#FFC91B] bg-[#FFC91B]/10 hover:bg-[#FFC91B]/20 rounded-xl transition-colors border border-[#FFC91B]/30"
            >
              <Crown className="w-4 h-4" />
              <span className="hidden sm:inline">{t('upgrade')}</span>
            </button>
          )}

          {playerTag && (
            <button
              onClick={handleSync}
              disabled={syncing}
              className="p-2 text-slate-400 hover:text-[#4EC0FA] transition-colors rounded-xl hover:bg-white/5 disabled:opacity-50"
              title={t('sync')}
            >
              <RefreshCw className={`w-5 h-5 ${syncing ? 'animate-spin' : ''}`} />
            </button>
          )}
          <Link href={`/${locale}/leaderboard`} className="brawl-button px-3 py-2 flex items-center gap-2 text-sm">
            🏆 <span className="hidden sm:inline-block">{t('leaderboard')}</span>
          </Link>
          <LocaleSwitcher />
          {playerTag && (
            <button onClick={handleLogout} className="p-2 text-slate-400 hover:text-red-400 transition-colors rounded-xl hover:bg-white/5" title={t('logout')}>
              <LogOut className="w-5 h-5" />
            </button>
          )}
        </div>
      </header>

      <AuthModal open={authModalOpen} onClose={() => setAuthModalOpen(false)} />
    </>
  )
}
```

- [ ] **Step 2: Add analytics sub-item to Sidebar**

In `src/components/layout/Sidebar.tsx`, add an analytics sub-item under "stats":

Change the stats entry in NAV_ITEMS from:
```typescript
{ key: 'stats', path: '/stats', icon: <BarChart3 className="w-5 h-5" /> },
```
to:
```typescript
{ key: 'stats', path: '/stats', icon: <BarChart3 className="w-5 h-5" />, sub: [
  { key: 'analytics', path: '/analytics', icon: <FlaskConical className="w-4 h-4" /> },
] },
```

Add `FlaskConical` to the lucide-react import:
```typescript
import { LayoutDashboard, Users, Swords, BarChart3, Shield, GitCompareArrows, Palette, Share2, FlaskConical } from 'lucide-react'
```

Add `analytics` key rendering with premium badge. After the sub-item `<Link>`, add a premium indicator if the user is free tier. Modify the sub-item rendering to show a lock for non-premium:

In the sub-items `.map()` block (the existing one that renders cosmetics, and now analytics), after `<span>{t(sub.key)}</span>`, add:
```tsx
{sub.key === 'analytics' && (
  <span className="ml-auto text-[9px] px-1.5 py-0.5 rounded bg-[#FFC91B]/20 text-[#FFC91B] font-bold uppercase">PRO</span>
)}
```

- [ ] **Step 3: Verify header renders login/upgrade buttons**

Run dev server, navigate to any profile page. You should see:
- If no user: "Login" button in header
- If logged in free: "Upgrade" button with crown icon

- [ ] **Step 4: Commit**

```bash
git add src/components/layout/Header.tsx src/components/layout/Sidebar.tsx
git commit -m "feat: auth buttons in Header + analytics nav item in Sidebar"
```

---

### Task 10: Profile API Route

**Files:**
- Create: `src/app/api/profile/route.ts`
- Test: `src/__tests__/integration/api/profile.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/__tests__/integration/api/profile.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET, POST } from '@/app/api/profile/route'

const mockGetUser = vi.fn()
const mockFrom = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: (...args: unknown[]) => mockGetUser(...args) },
    from: (...args: unknown[]) => mockFrom(...args),
  }),
}))

function makeRequest(method: string, body?: unknown) {
  return new Request('http://localhost:3000/api/profile', {
    method,
    headers: { 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
}

describe('Profile API', () => {
  beforeEach(() => { vi.clearAllMocks() })

  describe('GET /api/profile', () => {
    it('returns 401 when not authenticated', async () => {
      mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
      const res = await GET(makeRequest('GET'))
      expect(res.status).toBe(401)
    })

    it('returns profile when authenticated', async () => {
      mockGetUser.mockResolvedValue({ data: { user: { id: 'uid1' } }, error: null })
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: 'uid1', player_tag: '#TAG', tier: 'free' },
              error: null,
            }),
          }),
        }),
      })

      const res = await GET(makeRequest('GET'))
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.player_tag).toBe('#TAG')
    })

    it('returns 404 when profile does not exist', async () => {
      mockGetUser.mockResolvedValue({ data: { user: { id: 'uid1' } }, error: null })
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }),
          }),
        }),
      })

      const res = await GET(makeRequest('GET'))
      expect(res.status).toBe(404)
    })
  })

  describe('POST /api/profile', () => {
    it('returns 401 when not authenticated', async () => {
      mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
      const res = await POST(makeRequest('POST', { player_tag: '#TAG' }))
      expect(res.status).toBe(401)
    })

    it('creates profile with valid tag', async () => {
      mockGetUser.mockResolvedValue({ data: { user: { id: 'uid1' } }, error: null })
      mockFrom.mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: 'uid1', player_tag: '#TAG', tier: 'free' },
              error: null,
            }),
          }),
        }),
      })

      const res = await POST(makeRequest('POST', { player_tag: '#TAG' }))
      expect(res.status).toBe(201)
      const data = await res.json()
      expect(data.player_tag).toBe('#TAG')
    })

    it('returns 400 for invalid tag format', async () => {
      mockGetUser.mockResolvedValue({ data: { user: { id: 'uid1' } }, error: null })
      const res = await POST(makeRequest('POST', { player_tag: 'invalid' }))
      expect(res.status).toBe(400)
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/integration/api/profile.test.ts`

Expected: FAIL — module `@/app/api/profile/route` not found.

- [ ] **Step 3: Create profile API route**

```typescript
// src/app/api/profile/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const TAG_REGEX = /^#[0-9A-Z]{3,12}$/

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (error || !profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  return NextResponse.json(profile)
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const body = await request.json()
  const playerTag = (body.player_tag ?? '').toUpperCase().trim()

  if (!TAG_REGEX.test(playerTag)) {
    return NextResponse.json({ error: 'Invalid player tag format' }, { status: 400 })
  }

  const { data: profile, error } = await supabase
    .from('profiles')
    .insert({ id: user.id, player_tag: playerTag })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 409 })
  }

  return NextResponse.json(profile, { status: 201 })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/integration/api/profile.test.ts`

Expected: PASS — all 6 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/profile/route.ts src/__tests__/integration/api/profile.test.ts
git commit -m "feat: profile API route — GET (read) + POST (create with tag)"
```

---

### Task 11: Post-Login Profile Linking

**Files:**
- Modify: `src/components/auth/AuthProvider.tsx`

- [ ] **Step 1: Add automatic profile creation after first login**

The AuthProvider needs to detect first-time login (user exists but no profile) and create a profile using the player tag from the current URL or localStorage.

Update `AuthProvider.tsx` — replace the `fetchProfile` function and add `ensureProfile`:

```typescript
// In AuthProvider.tsx, update the fetchProfile callback:

const fetchProfile = useCallback(async (userId: string) => {
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()

  if (data) {
    setProfile(data)
    return
  }

  // First login — create profile with current player tag
  const currentTag = extractPlayerTag()
  if (!currentTag) {
    setProfile(null)
    return
  }

  const { data: newProfile } = await supabase
    .from('profiles')
    .insert({ id: userId, player_tag: currentTag })
    .select()
    .single()

  setProfile(newProfile ?? null)
}, [supabase])
```

Add the helper function at the top of the component (inside `AuthProvider`, before the hooks):

```typescript
/** Extract the player tag from URL path or localStorage */
function extractPlayerTag(): string | null {
  // Try URL: /es/profile/%23YJU282PV/battles → #YJU282PV
  const match = window.location.pathname.match(/\/profile\/([^/]+)/)
  if (match) {
    try {
      return decodeURIComponent(match[1])
    } catch { /* ignore */ }
  }

  // Fallback: localStorage
  try {
    return localStorage.getItem('brawlvalue:user')
  } catch { /* ignore */ }

  return null
}
```

- [ ] **Step 2: Verify the flow end-to-end**

1. Start dev server
2. Navigate to `/es/profile/%23YJU282PV`
3. Click "Login" → Google login
4. After redirect back, check Supabase Dashboard → `profiles` table
5. A new row should appear with `player_tag = '#YJU282PV'` and `tier = 'free'`

- [ ] **Step 3: Commit**

```bash
git add src/components/auth/AuthProvider.tsx
git commit -m "feat: automatic profile creation with tag linking on first login"
```

---

### Task 12: i18n for Auth Strings

**Files:**
- Modify: all 13 files in `messages/*.json`

- [ ] **Step 1: Add auth namespace to all locale files**

Run this Node script to add the `auth` namespace to every locale file:

```bash
node -e "
const fs = require('fs');
const path = require('path');

const AUTH_STRINGS = {
  es: { title: 'Crear cuenta gratis', subtitle: 'Accede a analytics y sincroniza tus batallas', googleButton: 'Continuar con Google', loading: 'Conectando...', disclaimer: 'Al registrarte, aceptas nuestra Política de Privacidad.', login: 'Login', upgrade: 'Premium' },
  en: { title: 'Create free account', subtitle: 'Access analytics and sync your battles', googleButton: 'Continue with Google', loading: 'Connecting...', disclaimer: 'By signing up, you agree to our Privacy Policy.', login: 'Login', upgrade: 'Premium' },
  fr: { title: 'Créer un compte gratuit', subtitle: 'Accédez aux analyses et synchronisez vos combats', googleButton: 'Continuer avec Google', loading: 'Connexion...', disclaimer: 'En vous inscrivant, vous acceptez notre Politique de Confidentialité.', login: 'Connexion', upgrade: 'Premium' },
  pt: { title: 'Criar conta grátis', subtitle: 'Acesse análises e sincronize suas batalhas', googleButton: 'Continuar com Google', loading: 'Conectando...', disclaimer: 'Ao se registrar, você concorda com nossa Política de Privacidade.', login: 'Entrar', upgrade: 'Premium' },
  de: { title: 'Kostenloses Konto erstellen', subtitle: 'Zugriff auf Analysen und Kämpfe synchronisieren', googleButton: 'Weiter mit Google', loading: 'Verbinde...', disclaimer: 'Mit der Registrierung akzeptierst du unsere Datenschutzrichtlinie.', login: 'Anmelden', upgrade: 'Premium' },
  it: { title: 'Crea account gratuito', subtitle: 'Accedi alle analisi e sincronizza le tue battaglie', googleButton: 'Continua con Google', loading: 'Connessione...', disclaimer: 'Registrandoti, accetti la nostra Informativa sulla Privacy.', login: 'Accedi', upgrade: 'Premium' },
  ru: { title: 'Создать бесплатный аккаунт', subtitle: 'Доступ к аналитике и синхронизации боёв', googleButton: 'Продолжить с Google', loading: 'Подключение...', disclaimer: 'Регистрируясь, вы соглашаетесь с нашей Политикой конфиденциальности.', login: 'Войти', upgrade: 'Премиум' },
  tr: { title: 'Ücretsiz hesap oluştur', subtitle: 'Analizlere erişin ve savaşlarınızı senkronize edin', googleButton: 'Google ile devam et', loading: 'Bağlanıyor...', disclaimer: 'Kaydolarak Gizlilik Politikamızı kabul edersiniz.', login: 'Giriş', upgrade: 'Premium' },
  pl: { title: 'Utwórz darmowe konto', subtitle: 'Uzyskaj dostęp do analiz i synchronizuj bitwy', googleButton: 'Kontynuuj z Google', loading: 'Łączenie...', disclaimer: 'Rejestrując się, akceptujesz naszą Politykę Prywatności.', login: 'Zaloguj', upgrade: 'Premium' },
  ar: { title: 'إنشاء حساب مجاني', subtitle: 'الوصول إلى التحليلات ومزامنة معاركك', googleButton: 'المتابعة مع Google', loading: 'جارِ الاتصال...', disclaimer: 'بالتسجيل، توافق على سياسة الخصوصية الخاصة بنا.', login: 'تسجيل الدخول', upgrade: 'بريميوم' },
  ko: { title: '무료 계정 만들기', subtitle: '분석에 접근하고 전투를 동기화하세요', googleButton: 'Google로 계속하기', loading: '연결 중...', disclaimer: '가입하면 개인정보 보호정책에 동의하게 됩니다.', login: '로그인', upgrade: '프리미엄' },
  ja: { title: '無料アカウント作成', subtitle: '分析にアクセスしてバトルを同期', googleButton: 'Googleで続ける', loading: '接続中...', disclaimer: '登録することで、プライバシーポリシーに同意します。', login: 'ログイン', upgrade: 'プレミアム' },
  zh: { title: '创建免费账户', subtitle: '访问分析和同步战斗', googleButton: '使用Google继续', loading: '连接中...', disclaimer: '注册即表示您同意我们的隐私政策。', login: '登录', upgrade: '高级版' },
};

const dir = path.join(__dirname, 'messages');
for (const [locale, strings] of Object.entries(AUTH_STRINGS)) {
  const filePath = path.join(dir, locale + '.json');
  const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  content.auth = strings;
  // Also add login/upgrade to nav if not present
  if (!content.nav.login) content.nav.login = strings.login;
  if (!content.nav.upgrade) content.nav.upgrade = strings.upgrade;
  fs.writeFileSync(filePath, JSON.stringify(content, null, 2) + '\\n');
}
console.log('Done: auth namespace added to all 13 locales');
"
```

- [ ] **Step 2: Verify translations load**

Run dev server, switch to English locale, open AuthModal → text should be in English. Switch to Japanese → text in Japanese.

- [ ] **Step 3: Run all tests to verify nothing broke**

Run: `npx vitest run`

Expected: All existing tests pass + new tests pass.

- [ ] **Step 4: Commit**

```bash
git add messages/
git commit -m "i18n: add auth namespace to all 13 locales"
```

---

### Task 13: Run Full Test Suite + Type Check

**Files:** None (verification only)

- [ ] **Step 1: Run type check**

Run: `npx tsc --noEmit`

Expected: No TypeScript errors. If there are errors, fix them.

- [ ] **Step 2: Run all tests**

Run: `npx vitest run`

Expected: All tests pass:
- `unit/lib/calculate.test.ts` — existing tests
- `unit/lib/utils.test.ts` — existing tests
- `unit/lib/supabase-types.test.ts` — new (Task 2)
- `unit/lib/auth.test.ts` — new (Task 6)
- `integration/api/calculate.test.ts` — existing tests
- `integration/api/auth-callback.test.ts` — new (Task 5)
- `integration/api/profile.test.ts` — new (Task 10)

- [ ] **Step 3: Run linter**

Run: `npx next lint`

Expected: No lint errors.

- [ ] **Step 4: Verify build**

Run: `npm run build`

Expected: Build succeeds. If it fails due to missing env vars, set dummy values in `.env.local` for build.

- [ ] **Step 5: Final commit (if any fixes were needed)**

```bash
git add -A
git commit -m "chore: fix lint/type/build issues from Plan 1"
```
