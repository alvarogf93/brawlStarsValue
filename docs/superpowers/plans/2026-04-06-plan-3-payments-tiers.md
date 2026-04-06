# Plan 3: Lemon Squeezy Payments + Tier Management

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate Lemon Squeezy as Merchant of Record for premium subscriptions ($2.99/mo or $19.99/yr), with HMAC-verified webhooks, idempotent event processing, and tier management that updates user profiles in real-time.

**Architecture:** Checkout sessions are created server-side via Lemon Squeezy API. After payment, Lemon Squeezy sends webhooks to our `/api/webhooks/lemonsqueezy` endpoint. We verify HMAC-SHA256 signatures, check idempotency via `webhook_events` table, and update `profiles.tier` accordingly. A "Manage Subscription" button redirects to Lemon Squeezy's hosted Customer Portal.

**Tech Stack:** Lemon Squeezy API (REST), HMAC-SHA256 (Node crypto), Supabase PostgreSQL, Vitest, Next.js API routes

**Spec:** `docs/superpowers/specs/2026-04-06-premium-battle-analytics-design.md`

**Depends on:** Plan 1 (auth + profiles)

---

## File Map

| Action | Path | Responsibility |
|--------|------|---------------|
| Create | `src/lib/lemonsqueezy.ts` | LS API client + HMAC verification |
| Create | `src/app/api/checkout/route.ts` | Create checkout session |
| Create | `src/app/api/webhooks/lemonsqueezy/route.ts` | Webhook handler |
| Create | `src/__tests__/unit/lib/lemonsqueezy.test.ts` | HMAC + event parsing tests |
| Create | `src/__tests__/integration/api/checkout.test.ts` | Checkout route tests |
| Create | `src/__tests__/integration/api/webhook-ls.test.ts` | Webhook route tests |
| Create | `src/components/premium/UpgradeCard.tsx` | Upgrade CTA component |
| Create | `src/components/premium/ManageSubscription.tsx` | Manage sub button |
| Modify | `src/lib/supabase/types.ts` | Add webhook_events type |
| Modify | `src/components/layout/Header.tsx` | Wire upgrade button to checkout |
| Modify | `.env.example` | Add Lemon Squeezy env vars |

---

### Task 0: Create webhook_events Table + Environment

**Files:**
- Modify: `.env.example`

- [ ] **Step 1: Run SQL migration**

Supabase Dashboard → SQL Editor:

```sql
CREATE TABLE webhook_events (
  event_id     TEXT PRIMARY KEY,
  event_type   TEXT NOT NULL,
  processed_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;
-- No policies = no client access (service role bypasses RLS)
```

- [ ] **Step 2: Add Lemon Squeezy env vars**

Add to `.env.example`:

```
# Lemon Squeezy (server-only)
LEMONSQUEEZY_API_KEY=your-ls-api-key
LEMONSQUEEZY_STORE_ID=your-store-id
LEMONSQUEEZY_WEBHOOK_SECRET=your-webhook-signing-secret
LEMONSQUEEZY_VARIANT_MONTHLY=your-monthly-variant-id
LEMONSQUEEZY_VARIANT_YEARLY=your-yearly-variant-id
```

Add real values to `.env.local` from Lemon Squeezy Dashboard:
1. Settings → API Keys → Create key
2. Stores → Copy Store ID
3. Products → Create "BrawlVision Premium" with monthly ($2.99) and yearly ($19.99) variants
4. Settings → Webhooks → Create webhook pointing to `https://yourdomain.com/api/webhooks/lemonsqueezy`, copy signing secret
5. Select events: `subscription_created`, `subscription_updated`, `subscription_cancelled`, `subscription_expired`

- [ ] **Step 3: Extend database types**

Add to `src/lib/supabase/types.ts`:

```typescript
/** Row type for webhook_events (idempotency) */
export interface WebhookEvent {
  event_id: string
  event_type: string
  processed_at: string
}
```

Add to the `Database` interface's `Tables`:

```typescript
webhook_events: {
  Row: WebhookEvent
  Insert: { event_id: string; event_type: string }
  Update: never
}
```

- [ ] **Step 4: Commit**

```bash
git add .env.example src/lib/supabase/types.ts
git commit -m "feat: webhook_events table + Lemon Squeezy env vars"
```

---

### Task 1: HMAC Verification + Lemon Squeezy Utilities

**Files:**
- Create: `src/lib/lemonsqueezy.ts`
- Test: `src/__tests__/unit/lib/lemonsqueezy.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// src/__tests__/unit/lib/lemonsqueezy.test.ts
import { describe, it, expect, vi } from 'vitest'
import { verifyWebhookSignature, parseWebhookEvent, createCheckoutUrl } from '@/lib/lemonsqueezy'
import crypto from 'crypto'

describe('verifyWebhookSignature', () => {
  const secret = 'test-webhook-secret'

  it('returns true for valid signature', () => {
    const body = '{"data":{"id":"1"}}'
    const hmac = crypto.createHmac('sha256', secret).update(body).digest('hex')
    expect(verifyWebhookSignature(body, hmac, secret)).toBe(true)
  })

  it('returns false for invalid signature', () => {
    expect(verifyWebhookSignature('{"data":{}}', 'bad-signature', secret)).toBe(false)
  })

  it('returns false for empty signature', () => {
    expect(verifyWebhookSignature('{"data":{}}', '', secret)).toBe(false)
  })

  it('returns false for tampered body', () => {
    const body = '{"data":{"id":"1"}}'
    const hmac = crypto.createHmac('sha256', secret).update(body).digest('hex')
    expect(verifyWebhookSignature('{"data":{"id":"2"}}', hmac, secret)).toBe(false)
  })
})

describe('parseWebhookEvent', () => {
  it('extracts subscription_created event data', () => {
    const payload = {
      meta: { event_name: 'subscription_created', custom_data: { profile_id: 'uid1' } },
      data: {
        id: 'sub_123',
        attributes: {
          customer_id: 456,
          status: 'active',
          variant_id: 789,
        },
      },
    }
    const result = parseWebhookEvent(payload)
    expect(result).toEqual({
      eventName: 'subscription_created',
      profileId: 'uid1',
      subscriptionId: 'sub_123',
      customerId: '456',
      status: 'active',
    })
  })

  it('extracts subscription_expired event data', () => {
    const payload = {
      meta: { event_name: 'subscription_expired', custom_data: { profile_id: 'uid1' } },
      data: {
        id: 'sub_123',
        attributes: { customer_id: 456, status: 'expired', variant_id: 789 },
      },
    }
    const result = parseWebhookEvent(payload)
    expect(result.eventName).toBe('subscription_expired')
    expect(result.status).toBe('expired')
  })

  it('returns null for missing profile_id', () => {
    const payload = {
      meta: { event_name: 'subscription_created', custom_data: {} },
      data: { id: 'sub_123', attributes: { customer_id: 456, status: 'active', variant_id: 789 } },
    }
    const result = parseWebhookEvent(payload)
    expect(result).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/unit/lib/lemonsqueezy.test.ts`

Expected: FAIL — module `@/lib/lemonsqueezy` not found.

- [ ] **Step 3: Implement Lemon Squeezy utilities**

```typescript
// src/lib/lemonsqueezy.ts
import crypto from 'crypto'

const LS_API_BASE = 'https://api.lemonsqueezy.com/v1'

// ── HMAC Verification ──────────────────────────────────────

export function verifyWebhookSignature(
  rawBody: string,
  signature: string,
  secret: string
): boolean {
  if (!signature || !rawBody) return false
  try {
    const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex')
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  } catch {
    return false
  }
}

// ── Webhook Event Parsing ──────────────────────────────────

export interface WebhookEventData {
  eventName: string
  profileId: string
  subscriptionId: string
  customerId: string
  status: string
}

export function parseWebhookEvent(payload: Record<string, unknown>): WebhookEventData | null {
  const meta = payload.meta as Record<string, unknown> | undefined
  const data = payload.data as Record<string, unknown> | undefined

  if (!meta || !data) return null

  const customData = meta.custom_data as Record<string, unknown> | undefined
  const profileId = customData?.profile_id as string | undefined

  if (!profileId) return null

  const attributes = data.attributes as Record<string, unknown>

  return {
    eventName: meta.event_name as string,
    profileId,
    subscriptionId: String(data.id),
    customerId: String(attributes.customer_id),
    status: String(attributes.status),
  }
}

// ── Checkout URL Creation ──────────────────────────────────

export async function createCheckoutUrl(params: {
  variantId: string
  profileId: string
  userEmail: string
  redirectUrl: string
}): Promise<string> {
  const apiKey = process.env.LEMONSQUEEZY_API_KEY!
  const storeId = process.env.LEMONSQUEEZY_STORE_ID!

  const res = await fetch(`${LS_API_BASE}/checkouts`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: 'application/vnd.api+json',
      'Content-Type': 'application/vnd.api+json',
    },
    body: JSON.stringify({
      data: {
        type: 'checkouts',
        attributes: {
          checkout_data: {
            email: params.userEmail,
            custom: { profile_id: params.profileId },
          },
          product_options: {
            redirect_url: params.redirectUrl,
          },
        },
        relationships: {
          store: { data: { type: 'stores', id: storeId } },
          variant: { data: { type: 'variants', id: params.variantId } },
        },
      },
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Lemon Squeezy checkout failed: ${res.status} ${err}`)
  }

  const json = await res.json()
  return json.data.attributes.url
}

// ── Tier Mapping ───────────────────────────────────────────

/** Map Lemon Squeezy subscription status to our tier */
export function statusToTier(eventName: string, status: string): { tier: string; subscriptionStatus: string } {
  switch (eventName) {
    case 'subscription_created':
      return { tier: 'premium', subscriptionStatus: 'active' }
    case 'subscription_updated':
      return { tier: status === 'active' ? 'premium' : 'premium', subscriptionStatus: status }
    case 'subscription_cancelled':
      return { tier: 'premium', subscriptionStatus: 'cancelled' } // keep tier until period ends
    case 'subscription_expired':
      return { tier: 'free', subscriptionStatus: 'expired' }
    default:
      return { tier: 'premium', subscriptionStatus: status }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/unit/lib/lemonsqueezy.test.ts`

Expected: PASS — all 7 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/lemonsqueezy.ts src/__tests__/unit/lib/lemonsqueezy.test.ts
git commit -m "feat: Lemon Squeezy utilities — HMAC, event parsing, checkout, tier mapping"
```

---

### Task 2: Checkout API Route

**Files:**
- Create: `src/app/api/checkout/route.ts`
- Test: `src/__tests__/integration/api/checkout.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// src/__tests__/integration/api/checkout.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from '@/app/api/checkout/route'

const mockGetUser = vi.fn()
const mockFrom = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: (...args: unknown[]) => mockGetUser(...args) },
    from: (...args: unknown[]) => mockFrom(...args),
  }),
}))

vi.mock('@/lib/lemonsqueezy', () => ({
  createCheckoutUrl: vi.fn().mockResolvedValue('https://checkout.lemonsqueezy.com/test'),
}))

function makeRequest(body: unknown) {
  return new Request('http://localhost:3000/api/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/checkout', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    const res = await POST(makeRequest({ interval: 'monthly' }))
    expect(res.status).toBe(401)
  })

  it('returns 400 for invalid interval', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'uid1', email: 'a@b.com' } }, error: null })
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { id: 'uid1', player_tag: '#TAG', tier: 'free' }, error: null }),
        }),
      }),
    })
    const res = await POST(makeRequest({ interval: 'weekly' }))
    expect(res.status).toBe(400)
  })

  it('returns checkout URL for valid request', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'uid1', email: 'a@b.com' } }, error: null })
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { id: 'uid1', player_tag: '#TAG', tier: 'free' }, error: null }),
        }),
      }),
    })

    const res = await POST(makeRequest({ interval: 'monthly' }))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.url).toBe('https://checkout.lemonsqueezy.com/test')
  })

  it('returns 409 when user is already premium', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'uid1', email: 'a@b.com' } }, error: null })
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { id: 'uid1', player_tag: '#TAG', tier: 'premium', ls_subscription_status: 'active' }, error: null }),
        }),
      }),
    })

    const res = await POST(makeRequest({ interval: 'monthly' }))
    expect(res.status).toBe(409)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/integration/api/checkout.test.ts`

Expected: FAIL — module not found.

- [ ] **Step 3: Implement checkout route**

```typescript
// src/app/api/checkout/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createCheckoutUrl } from '@/lib/lemonsqueezy'
import { isPremium } from '@/lib/auth'
import type { Profile } from '@/lib/supabase/types'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const body = await request.json()
  const interval = body.interval as string

  if (interval !== 'monthly' && interval !== 'yearly') {
    return NextResponse.json({ error: 'interval must be "monthly" or "yearly"' }, { status: 400 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  if (isPremium(profile as Profile)) {
    return NextResponse.json({ error: 'Already premium' }, { status: 409 })
  }

  const variantId = interval === 'monthly'
    ? process.env.LEMONSQUEEZY_VARIANT_MONTHLY!
    : process.env.LEMONSQUEEZY_VARIANT_YEARLY!

  const { origin } = new URL(request.url)
  const redirectUrl = `${origin}/profile/${encodeURIComponent(profile.player_tag)}?upgraded=true`

  const url = await createCheckoutUrl({
    variantId,
    profileId: user.id,
    userEmail: user.email ?? '',
    redirectUrl,
  })

  return NextResponse.json({ url })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/integration/api/checkout.test.ts`

Expected: PASS — all 4 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/checkout/route.ts src/__tests__/integration/api/checkout.test.ts
git commit -m "feat: checkout API route — creates Lemon Squeezy session"
```

---

### Task 3: Webhook Handler

**Files:**
- Create: `src/app/api/webhooks/lemonsqueezy/route.ts`
- Test: `src/__tests__/integration/api/webhook-ls.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// src/__tests__/integration/api/webhook-ls.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from '@/app/api/webhooks/lemonsqueezy/route'
import crypto from 'crypto'

const WEBHOOK_SECRET = 'test-secret'

const mockFrom = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: vi.fn().mockResolvedValue({
    from: (...args: unknown[]) => mockFrom(...args),
  }),
}))

// Set env
vi.stubEnv('LEMONSQUEEZY_WEBHOOK_SECRET', WEBHOOK_SECRET)

function makeSignedRequest(body: Record<string, unknown>) {
  const raw = JSON.stringify(body)
  const sig = crypto.createHmac('sha256', WEBHOOK_SECRET).update(raw).digest('hex')
  return new Request('http://localhost:3000/api/webhooks/lemonsqueezy', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Signature': sig,
      'X-Event-Id': 'evt_' + Date.now(),
    },
    body: raw,
  })
}

function makeUnsignedRequest(body: Record<string, unknown>) {
  return new Request('http://localhost:3000/api/webhooks/lemonsqueezy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Signature': 'invalid', 'X-Event-Id': 'evt_1' },
    body: JSON.stringify(body),
  })
}

const VALID_PAYLOAD = {
  meta: { event_name: 'subscription_created', custom_data: { profile_id: 'uid1' } },
  data: { id: 'sub_123', attributes: { customer_id: 456, status: 'active', variant_id: 789 } },
}

describe('POST /api/webhooks/lemonsqueezy', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Mock webhook_events: no duplicate
    mockFrom.mockImplementation((table: string) => {
      if (table === 'webhook_events') {
        return {
          insert: vi.fn().mockResolvedValue({ error: null }),
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }),
            }),
          }),
        }
      }
      if (table === 'profiles') {
        return {
          update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
        }
      }
      return {}
    })
  })

  it('rejects invalid HMAC signature', async () => {
    const res = await POST(makeUnsignedRequest(VALID_PAYLOAD))
    expect(res.status).toBe(401)
  })

  it('processes subscription_created and updates tier', async () => {
    const res = await POST(makeSignedRequest(VALID_PAYLOAD))
    expect(res.status).toBe(200)
  })

  it('returns 200 for duplicate event_id (idempotent)', async () => {
    // Simulate existing event_id
    mockFrom.mockImplementation((table: string) => {
      if (table === 'webhook_events') {
        return {
          insert: vi.fn().mockResolvedValue({ error: { code: '23505' } }), // unique violation
        }
      }
      return {}
    })

    const res = await POST(makeSignedRequest(VALID_PAYLOAD))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.skipped).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/integration/api/webhook-ls.test.ts`

Expected: FAIL — module not found.

- [ ] **Step 3: Implement webhook handler**

```typescript
// src/app/api/webhooks/lemonsqueezy/route.ts
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { verifyWebhookSignature, parseWebhookEvent, statusToTier } from '@/lib/lemonsqueezy'

export async function POST(request: Request) {
  const rawBody = await request.text()
  const signature = request.headers.get('X-Signature') ?? ''
  const eventId = request.headers.get('X-Event-Id') ?? ''
  const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET!

  // 1. Verify HMAC signature
  if (!verifyWebhookSignature(rawBody, signature, secret)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const supabase = await createServiceClient()

  // 2. Idempotency check: try to insert event_id
  if (eventId) {
    const { error: insertErr } = await supabase
      .from('webhook_events')
      .insert({ event_id: eventId, event_type: 'lemonsqueezy' })

    if (insertErr?.code === '23505') {
      // Duplicate — already processed
      return NextResponse.json({ ok: true, skipped: true })
    }
  }

  // 3. Parse event
  const payload = JSON.parse(rawBody)
  const event = parseWebhookEvent(payload)

  if (!event) {
    return NextResponse.json({ error: 'Could not parse event' }, { status: 400 })
  }

  // 4. Update profile tier
  const { tier, subscriptionStatus } = statusToTier(event.eventName, event.status)

  await supabase
    .from('profiles')
    .update({
      tier,
      ls_customer_id: event.customerId,
      ls_subscription_id: event.subscriptionId,
      ls_subscription_status: subscriptionStatus,
      updated_at: new Date().toISOString(),
    })
    .eq('id', event.profileId)

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/integration/api/webhook-ls.test.ts`

Expected: PASS — all 3 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/webhooks/lemonsqueezy/route.ts src/__tests__/integration/api/webhook-ls.test.ts
git commit -m "feat: Lemon Squeezy webhook handler — HMAC + idempotency + tier update"
```

---

### Task 4: Upgrade Card Component

**Files:**
- Create: `src/components/premium/UpgradeCard.tsx`

- [ ] **Step 1: Create the upgrade CTA component**

```typescript
// src/components/premium/UpgradeCard.tsx
'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useAuth } from '@/hooks/useAuth'
import { AuthModal } from '@/components/auth/AuthModal'
import { Crown, Zap, BarChart3, Users } from 'lucide-react'

interface UpgradeCardProps {
  redirectTo?: string
}

export function UpgradeCard({ redirectTo }: UpgradeCardProps) {
  const { user, profile } = useAuth()
  const t = useTranslations('premium')
  const [loading, setLoading] = useState(false)
  const [authModalOpen, setAuthModalOpen] = useState(false)

  const handleUpgrade = async (interval: 'monthly' | 'yearly') => {
    if (!user) {
      setAuthModalOpen(true)
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interval }),
      })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      }
    } catch {
      setLoading(false)
    }
  }

  return (
    <>
      <div className="brawl-card-dark p-6 md:p-8 border-[#FFC91B]/20 bg-gradient-to-br from-[#FFC91B]/5 to-transparent">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-xl bg-[#FFC91B]/20 border-2 border-[#FFC91B]/30 flex items-center justify-center">
            <Crown className="w-6 h-6 text-[#FFC91B]" />
          </div>
          <div>
            <h3 className="font-['Lilita_One'] text-xl text-white">{t('title')}</h3>
            <p className="text-xs text-slate-400">{t('subtitle')}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
          <div className="flex items-center gap-2 text-sm text-slate-300">
            <Zap className="w-4 h-4 text-[#FFC91B]" />
            <span>{t('featureHistory')}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-300">
            <BarChart3 className="w-4 h-4 text-[#FFC91B]" />
            <span>{t('featureAnalytics')}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-300">
            <Users className="w-4 h-4 text-[#FFC91B]" />
            <span>{t('featureTeammates')}</span>
          </div>
        </div>

        <p className="text-[10px] text-slate-500 mb-4">{t('ageNotice')}</p>

        <div className="flex gap-3">
          <button
            onClick={() => handleUpgrade('monthly')}
            disabled={loading}
            className="flex-1 brawl-button py-3 text-center disabled:opacity-50"
          >
            {t('monthly')}
          </button>
          <button
            onClick={() => handleUpgrade('yearly')}
            disabled={loading}
            className="flex-1 py-3 text-center font-['Lilita_One'] text-sm bg-[#FFC91B] text-[var(--color-brawl-dark)] rounded-xl border-4 border-[var(--color-brawl-dark)] shadow-[0_3px_0_0_rgba(18,26,47,1)] hover:translate-y-[1px] hover:shadow-[0_2px_0_0_rgba(18,26,47,1)] transition-all disabled:opacity-50"
          >
            {t('yearly')}
          </button>
        </div>
      </div>

      <AuthModal open={authModalOpen} onClose={() => setAuthModalOpen(false)} redirectTo={redirectTo} />
    </>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/premium/UpgradeCard.tsx
git commit -m "feat: UpgradeCard component with monthly/yearly checkout"
```

---

### Task 5: Manage Subscription Component

**Files:**
- Create: `src/components/premium/ManageSubscription.tsx`

- [ ] **Step 1: Create manage subscription button**

```typescript
// src/components/premium/ManageSubscription.tsx
'use client'

import { useTranslations } from 'next-intl'
import { useAuth } from '@/hooks/useAuth'
import { Settings } from 'lucide-react'

export function ManageSubscription() {
  const { profile } = useAuth()
  const t = useTranslations('premium')

  if (!profile || profile.tier === 'free') return null

  // Lemon Squeezy Customer Portal URL
  const portalUrl = `https://app.lemonsqueezy.com/my-orders`

  return (
    <div className="brawl-card-dark p-4 border-[#090E17] flex items-center justify-between">
      <div>
        <p className="font-['Lilita_One'] text-sm text-[#FFC91B] flex items-center gap-2">
          <span>⭐</span> {t('activePlan')}
        </p>
        <p className="text-[10px] text-slate-500">
          {profile.ls_subscription_status === 'cancelled' ? t('cancelledNotice') : t('activeNotice')}
        </p>
      </div>
      <a
        href={portalUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
      >
        <Settings className="w-4 h-4" />
        {t('manage')}
      </a>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/premium/ManageSubscription.tsx
git commit -m "feat: ManageSubscription component for premium users"
```

---

### Task 6: Wire Upgrade Button in Header

**Files:**
- Modify: `src/components/layout/Header.tsx`

- [ ] **Step 1: Update the upgrade button to redirect to checkout**

In `Header.tsx`, replace the placeholder upgrade button:

```tsx
{!loading && user && profile?.tier === 'free' && (
  <button
    onClick={() => {/* Plan 3: checkout redirect */}}
    ...
```

With:

```tsx
{!loading && user && profile?.tier === 'free' && (
  <button
    onClick={async () => {
      try {
        const res = await fetch('/api/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ interval: 'monthly' }),
        })
        const data = await res.json()
        if (data.url) window.location.href = data.url
      } catch { /* ignore */ }
    }}
    className="flex items-center gap-1.5 px-3 py-2 text-sm font-['Lilita_One'] text-[#FFC91B] bg-[#FFC91B]/10 hover:bg-[#FFC91B]/20 rounded-xl transition-colors border border-[#FFC91B]/30"
  >
    <Crown className="w-4 h-4" />
    <span className="hidden sm:inline">{t('upgrade')}</span>
  </button>
)}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/layout/Header.tsx
git commit -m "feat: wire upgrade button to checkout API"
```

---

### Task 7: i18n for Premium Strings

**Files:**
- Modify: all 13 files in `messages/*.json`

- [ ] **Step 1: Add premium namespace to all locales**

```bash
node -e "
const fs = require('fs');
const path = require('path');

const PREMIUM = {
  es: { title: 'BrawlVision Premium', subtitle: 'Analítica de combate ilimitada', featureHistory: 'Historial ilimitado', featureAnalytics: 'Win rate detallado', featureTeammates: 'Análisis de compañeros', monthly: '\$2.99/mes', yearly: '\$19.99/año (ahorra 44%)', ageNotice: 'Debes tener 18+ o consentimiento parental para comprar.', activePlan: 'Plan Premium activo', activeNotice: 'Tu suscripción se renueva automáticamente.', cancelledNotice: 'Tu suscripción está cancelada pero activa hasta fin del período.', manage: 'Gestionar' },
  en: { title: 'BrawlVision Premium', subtitle: 'Unlimited combat analytics', featureHistory: 'Unlimited history', featureAnalytics: 'Detailed win rates', featureTeammates: 'Teammate analysis', monthly: '\$2.99/mo', yearly: '\$19.99/yr (save 44%)', ageNotice: 'You must be 18+ or have parental consent to purchase.', activePlan: 'Premium plan active', activeNotice: 'Your subscription renews automatically.', cancelledNotice: 'Your subscription is cancelled but active until end of period.', manage: 'Manage' },
  fr: { title: 'BrawlVision Premium', subtitle: 'Analyses de combat illimitées', featureHistory: 'Historique illimité', featureAnalytics: 'Taux de victoire détaillés', featureTeammates: 'Analyse des coéquipiers', monthly: '2,99\$/mois', yearly: '19,99\$/an (économisez 44%)', ageNotice: 'Vous devez avoir 18 ans ou le consentement parental pour acheter.', activePlan: 'Plan Premium actif', activeNotice: 'Votre abonnement se renouvelle automatiquement.', cancelledNotice: 'Votre abonnement est annulé mais actif jusqu\\'au fin de la période.', manage: 'Gérer' },
  pt: { title: 'BrawlVision Premium', subtitle: 'Análise de combate ilimitada', featureHistory: 'Histórico ilimitado', featureAnalytics: 'Taxa de vitória detalhada', featureTeammates: 'Análise de companheiros', monthly: '\$2,99/mês', yearly: '\$19,99/ano (economize 44%)', ageNotice: 'Você deve ter 18+ ou consentimento dos pais para comprar.', activePlan: 'Plano Premium ativo', activeNotice: 'Sua assinatura renova automaticamente.', cancelledNotice: 'Sua assinatura está cancelada mas ativa até o fim do período.', manage: 'Gerenciar' },
  de: { title: 'BrawlVision Premium', subtitle: 'Unbegrenzte Kampfanalysen', featureHistory: 'Unbegrenzter Verlauf', featureAnalytics: 'Detaillierte Siegesraten', featureTeammates: 'Teamkameraden-Analyse', monthly: '2,99\$/Monat', yearly: '19,99\$/Jahr (44% sparen)', ageNotice: 'Sie müssen 18+ sein oder elterliche Zustimmung haben.', activePlan: 'Premium-Plan aktiv', activeNotice: 'Ihr Abo verlängert sich automatisch.', cancelledNotice: 'Ihr Abo ist gekündigt aber bis Periodenende aktiv.', manage: 'Verwalten' },
  it: { title: 'BrawlVision Premium', subtitle: 'Analisi di combattimento illimitata', featureHistory: 'Storico illimitato', featureAnalytics: 'Percentuali vittoria dettagliate', featureTeammates: 'Analisi compagni', monthly: '2,99\$/mese', yearly: '19,99\$/anno (risparmia 44%)', ageNotice: 'Devi avere 18+ o il consenso dei genitori per acquistare.', activePlan: 'Piano Premium attivo', activeNotice: 'Il tuo abbonamento si rinnova automaticamente.', cancelledNotice: 'Il tuo abbonamento è cancellato ma attivo fino alla fine del periodo.', manage: 'Gestisci' },
  ru: { title: 'BrawlVision Премиум', subtitle: 'Безлимитная боевая аналитика', featureHistory: 'Безлимитная история', featureAnalytics: 'Детальный винрейт', featureTeammates: 'Анализ тиммейтов', monthly: '\$2.99/мес', yearly: '\$19.99/год (скидка 44%)', ageNotice: 'Для покупки необходимо быть старше 18 лет или иметь согласие родителей.', activePlan: 'Премиум-план активен', activeNotice: 'Ваша подписка продлевается автоматически.', cancelledNotice: 'Ваша подписка отменена, но активна до конца периода.', manage: 'Управление' },
  tr: { title: 'BrawlVision Premium', subtitle: 'Sınırsız savaş analitiği', featureHistory: 'Sınırsız geçmiş', featureAnalytics: 'Detaylı kazanma oranları', featureTeammates: 'Takım arkadaşı analizi', monthly: '\$2.99/ay', yearly: '\$19.99/yıl (%44 tasarruf)', ageNotice: 'Satın almak için 18 yaşında olmanız veya ebeveyn onayı almanız gerekir.', activePlan: 'Premium plan aktif', activeNotice: 'Aboneliğiniz otomatik yenilenir.', cancelledNotice: 'Aboneliğiniz iptal edildi ama dönem sonuna kadar aktif.', manage: 'Yönet' },
  pl: { title: 'BrawlVision Premium', subtitle: 'Nielimitowane analizy bitew', featureHistory: 'Nielimitowana historia', featureAnalytics: 'Szczegółowe win rate', featureTeammates: 'Analiza współgraczy', monthly: '\$2.99/mies.', yearly: '\$19.99/rok (oszczędź 44%)', ageNotice: 'Musisz mieć 18+ lat lub zgodę rodzica na zakup.', activePlan: 'Plan Premium aktywny', activeNotice: 'Twoja subskrypcja odnawia się automatycznie.', cancelledNotice: 'Twoja subskrypcja jest anulowana ale aktywna do końca okresu.', manage: 'Zarządzaj' },
  ar: { title: 'BrawlVision بريميوم', subtitle: 'تحليلات قتال غير محدودة', featureHistory: 'سجل غير محدود', featureAnalytics: 'معدل فوز مفصل', featureTeammates: 'تحليل زملاء الفريق', monthly: '\$2.99/شهر', yearly: '\$19.99/سنة (وفر 44%)', ageNotice: 'يجب أن تكون 18+ أو لديك موافقة الوالدين للشراء.', activePlan: 'خطة بريميوم نشطة', activeNotice: 'يتم تجديد اشتراكك تلقائياً.', cancelledNotice: 'تم إلغاء اشتراكك لكنه نشط حتى نهاية الفترة.', manage: 'إدارة' },
  ko: { title: 'BrawlVision 프리미엄', subtitle: '무제한 전투 분석', featureHistory: '무제한 기록', featureAnalytics: '상세 승률', featureTeammates: '팀원 분석', monthly: '\$2.99/월', yearly: '\$19.99/년 (44% 절약)', ageNotice: '구매하려면 18세 이상이거나 부모 동의가 필요합니다.', activePlan: '프리미엄 플랜 활성', activeNotice: '구독이 자동 갱신됩니다.', cancelledNotice: '구독이 취소되었지만 기간 종료까지 활성입니다.', manage: '관리' },
  ja: { title: 'BrawlVision プレミアム', subtitle: '無制限バトル分析', featureHistory: '無制限履歴', featureAnalytics: '詳細勝率', featureTeammates: 'チームメイト分析', monthly: '\$2.99/月', yearly: '\$19.99/年 (44%お得)', ageNotice: '購入には18歳以上または保護者の同意が必要です。', activePlan: 'プレミアムプラン有効', activeNotice: 'サブスクリプションは自動更新されます。', cancelledNotice: 'サブスクリプションはキャンセルされましたが期間終了まで有効です。', manage: '管理' },
  zh: { title: 'BrawlVision 高级版', subtitle: '无限战斗分析', featureHistory: '无限历史', featureAnalytics: '详细胜率', featureTeammates: '队友分析', monthly: '\$2.99/月', yearly: '\$19.99/年 (节省44%)', ageNotice: '购买需年满18岁或获得家长同意。', activePlan: '高级计划已激活', activeNotice: '您的订阅将自动续订。', cancelledNotice: '您的订阅已取消，但在期限结束前仍有效。', manage: '管理' },
};

const dir = path.join(__dirname, 'messages');
for (const [locale, strings] of Object.entries(PREMIUM)) {
  const filePath = path.join(dir, locale + '.json');
  const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  content.premium = strings;
  fs.writeFileSync(filePath, JSON.stringify(content, null, 2) + '\\n');
}
console.log('Done: premium namespace added to all 13 locales');
"
```

- [ ] **Step 2: Commit**

```bash
git add messages/
git commit -m "i18n: add premium namespace to all 13 locales"
```

---

### Task 8: Full Verification

- [ ] **Step 1: Run all tests**

Run: `npx vitest run`

Expected: All tests pass including:
- `unit/lib/lemonsqueezy.test.ts` (7 tests)
- `integration/api/checkout.test.ts` (4 tests)
- `integration/api/webhook-ls.test.ts` (3 tests)

- [ ] **Step 2: Type check**

Run: `npx tsc --noEmit`

- [ ] **Step 3: Build**

Run: `npm run build`

- [ ] **Step 4: Final commit if fixes needed**

```bash
git add -A
git commit -m "chore: fix lint/type/build issues from Plan 3"
```
