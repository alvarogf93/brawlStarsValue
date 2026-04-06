# BrawlVision Premium — Battle Analytics Platform

## Vision

BrawlVision evolves from a "gem calculator" into a **combat analytics platform** for Brawl Stars. The gem value calculator remains the free hook. The paid product is an unlimited battle history with deep analytics: win rates by brawler/mode/map, best teammates, opponent data, and temporal evolution.

## Business Model

### Tiers

| | Free | Premium ($2.99/mo · $19.99/yr) | Pro (future) |
|---|---|---|---|
| Gem calculator | Yes | Yes | Yes |
| Last 25 battles (live API) | Yes | Yes | Yes |
| Ads (Google AdSense) | Yes | **No** | No |
| Unlimited battle history | No | **Yes** | Yes |
| Auto-sync (cron hourly) | No | **Yes** | Every 30min |
| Manual sync button | No | **Yes** (deduplicated) | Yes |
| Win rate by mode/map/brawler | Blurred teaser | **Yes** | Yes |
| Best teammates analysis | Blurred teaser | **Yes** | Yes |
| Opponent data | No | **Stored** (not visible) | **Yes + cross-analytics** |
| Meta predictions | No | No | **Yes** |

### Revenue Math

- Free: Google AdSense revenue (already integrated)
- Premium: $2.99/mo or $19.99/yr via Lemon Squeezy (Merchant of Record)
- Lemon Squeezy fee: 5% + $0.50 per transaction (handles VAT/taxes/invoicing)
- Supabase Pro breakeven: 9 monthly premium subscribers ($26.91 > $25/mo)
- No freelancer/company structure required (Lemon Squeezy is the legal seller)

## Architecture

### Tech Stack

| Component | Technology | Cost |
|---|---|---|
| Frontend | Next.js 16.2.2 (existing) | Free (Vercel Hobby) |
| Auth | Supabase Auth (Google login, Discord later) | Free (50K MAU) |
| Database | Supabase PostgreSQL + JSONB | Free (500MB) → Pro ($25/mo) |
| Queue/Cron | Supabase `pg_cron` + Edge Functions | Included with Supabase |
| Payments | Lemon Squeezy (Merchant of Record) | 5% + $0.50/tx |
| Rate limiting | Upstash Redis (existing) | Already paid |
| Deploy | Vercel (existing) | Already paid |
| i18n | next-intl, 13 locales (existing) | N/A |

### System Diagram

```
User (browser)
  │
  ├─ Free: GET /api/battlelog → Supercell API → 25 battles → render (no DB)
  │
  ├─ Premium (manual sync): POST /api/sync → fetch Supercell → INSERT battles ON CONFLICT DO NOTHING
  │
  └─ Premium (auto): pg_cron → sync_queue → Edge Function → Supercell API → INSERT battles

Lemon Squeezy
  └─ Webhook → POST /api/webhooks/lemonsqueezy → verify HMAC → UPDATE profiles.tier
```

## Data Model

### Table: `profiles`

```sql
CREATE TABLE profiles (
  id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  player_tag      TEXT NOT NULL,
  tier            TEXT NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'premium', 'pro')),
  ls_customer_id  TEXT,
  ls_subscription_id TEXT,
  ls_subscription_status TEXT CHECK (ls_subscription_status IN ('active', 'cancelled', 'expired', 'past_due', NULL)),
  last_sync       TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_profiles_tag ON profiles(player_tag);
CREATE INDEX idx_profiles_tier_sync ON profiles(tier, last_sync) WHERE tier != 'free';
```

### Table: `battles`

```sql
CREATE TABLE battles (
  id              BIGSERIAL PRIMARY KEY,
  player_tag      TEXT NOT NULL,
  battle_time     TIMESTAMPTZ NOT NULL,
  mode            TEXT NOT NULL,
  map             TEXT,
  result          TEXT NOT NULL CHECK (result IN ('victory', 'defeat', 'draw')),
  trophy_change   INT DEFAULT 0,
  duration        INT,
  is_star_player  BOOLEAN DEFAULT FALSE,
  my_brawler      JSONB NOT NULL,
  teammates       JSONB DEFAULT '[]'::jsonb,
  opponents       JSONB DEFAULT '[]'::jsonb,
  created_at      TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(player_tag, battle_time)
);

CREATE INDEX idx_battles_tag_time ON battles(player_tag, battle_time DESC);
CREATE INDEX idx_battles_mode ON battles(mode);
CREATE INDEX idx_battles_brawler ON battles USING GIN(my_brawler);
```

### Table: `sync_queue`

```sql
CREATE TABLE sync_queue (
  id            BIGSERIAL PRIMARY KEY,
  player_tag    TEXT NOT NULL,
  scheduled_at  TIMESTAMPTZ DEFAULT NOW(),
  started_at    TIMESTAMPTZ,
  completed_at  TIMESTAMPTZ,
  error         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sync_queue_pending ON sync_queue(scheduled_at) WHERE completed_at IS NULL AND started_at IS NULL;
```

### Row Level Security

```sql
-- profiles: users can only read/update their own profile
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY profiles_own ON profiles FOR ALL USING (auth.uid() = id);

-- battles: users can only read battles for their own player_tag
ALTER TABLE battles ENABLE ROW LEVEL SECURITY;
CREATE POLICY battles_own ON battles FOR SELECT USING (
  player_tag IN (SELECT player_tag FROM profiles WHERE id = auth.uid())
);
-- INSERT/UPDATE/DELETE only via service role (server-side)

-- sync_queue: no client access, service role only
ALTER TABLE sync_queue ENABLE ROW LEVEL SECURITY;
-- No policies = no client access (service role bypasses RLS)
```

### JSONB Structure

**my_brawler**:
```json
{
  "id": 16000000,
  "name": "Shelly",
  "power": 11,
  "trophies": 750,
  "gadgets": [{"id": 23000255, "name": "Clay Pigeons"}],
  "starPowers": [{"id": 23000076, "name": "Shell Shock"}],
  "hypercharges": []
}
```

**teammates** / **opponents**:
```json
[
  {
    "tag": "#ABC123",
    "name": "PlayerX",
    "brawler": {
      "id": 16000001,
      "name": "Colt",
      "power": 9,
      "trophies": 600
    }
  }
]
```

## Queue System (pg_cron)

### Scheduler (runs every minute)

```sql
SELECT cron.schedule(
  'enqueue-premium-syncs',
  '* * * * *',  -- every minute
  $$
    INSERT INTO sync_queue (player_tag)
    SELECT player_tag FROM profiles
    WHERE tier IN ('premium', 'pro')
      AND (last_sync IS NULL OR last_sync < NOW() - INTERVAL '1 hour')
      AND player_tag NOT IN (
        SELECT player_tag FROM sync_queue
        WHERE completed_at IS NULL
      )
  $$
);
```

### Worker (Supabase Edge Function)

Triggered by database webhook on `sync_queue` INSERT:

1. SELECT oldest unprocessed row from `sync_queue`, mark `started_at = NOW()`
2. Fetch battlelog from Supercell API for that `player_tag`
3. For each battle: extract my_brawler, teammates, opponents
4. `INSERT INTO battles ... ON CONFLICT(player_tag, battle_time) DO NOTHING`
5. `UPDATE profiles SET last_sync = NOW()`
6. Mark `sync_queue` row as `completed_at = NOW()`
7. On error: set `sync_queue.error`, leave `completed_at` NULL for retry

Rate limit safety: Edge Function processes 1 tag at a time with 200ms delay between API calls.

## Deduplication Strategy

- Unique constraint: `UNIQUE(player_tag, battle_time)`
- Insert strategy: `INSERT ... ON CONFLICT DO NOTHING`
- The Supercell API `battleTime` field (e.g., `"20260405T171604.000Z"`) is unique per battle for a given player
- If a user syncs manually and the cron also syncs, both attempt the same INSERT — the second silently skips duplicates
- Zero race condition risk due to PostgreSQL's atomic conflict handling

## Payment Flow (Lemon Squeezy)

### Checkout

1. Authenticated user clicks "Upgrade to Premium"
2. Frontend calls `POST /api/checkout` with `{ tier: 'premium', interval: 'monthly' | 'yearly' }`
3. API route creates Lemon Squeezy checkout session (server-side, with user's `profile.id` as custom data)
4. Returns checkout URL → redirect user
5. User completes payment on Lemon Squeezy hosted page
6. Lemon Squeezy redirects back to `/profile/{tag}?upgraded=true`

### Webhook Processing

```
POST /api/webhooks/lemonsqueezy
  1. Verify HMAC-SHA256 signature (reject if invalid)
  2. Parse event type:
     - subscription_created → UPDATE profiles SET tier='premium', ls_subscription_status='active'
     - subscription_updated → UPDATE status accordingly
     - subscription_cancelled → SET ls_subscription_status='cancelled' (keep tier until period ends)
     - subscription_expired → SET tier='free', ls_subscription_status='expired'
  3. Return 200 OK
```

### Subscription Management

- "Manage Subscription" button in profile → redirects to Lemon Squeezy Customer Portal
- User can upgrade, downgrade, cancel, update payment method — all on Lemon Squeezy's hosted page
- Every change triggers a webhook that updates `profiles`

## Security

| Threat | Mitigation |
|---|---|
| User reads another user's battles | RLS: `player_tag IN (SELECT player_tag FROM profiles WHERE id = auth.uid())` |
| Fake webhook from attacker | HMAC-SHA256 signature verification on every webhook |
| Service key exposure | Only in API routes and Edge Functions, never in client bundle |
| Sync button spam | Upstash Redis rate limiting (existing) + deduplication |
| XSS in JSONB data | React auto-escapes. JSONB stored server-side only. |
| Unauthorized tier upgrade | Tier only changes via verified webhook, never from client |
| SQL injection | Supabase SDK uses parameterized queries exclusively |
| CSRF on checkout | Checkout URL generated server-side with user session validation |

## UI / UX

### Existing flow (unchanged)

Enter tag → see profile → gem score, brawlers, battles, stats, club, compare, share. No login required. Ads shown.

### New elements

1. **Header**: "Upgrade ⭐" button (visible to logged-in free users only)
2. **Sidebar**: New sub-item under "Stats": "Analytics 🔬" (premium badge if locked)
3. **Battles page**: Below the 25 free battles, a blurred teaser section:
   - Blurred preview of historical battles
   - Lock icon + CTA: "Unlock full battle history + analytics. From $2.99/mo"
4. **Analytics page** (`/profile/{tag}/stats/analytics`):
   - Win rate by mode (horizontal bars)
   - Win rate by brawler (sortable grid)
   - Win rate by map (sortable list)
   - Best teammates (frequent + win rate)
   - Battle history timeline (infinite scroll)
   - All data from stored `battles` table
5. **Auth modals**: Login with Google (clean modal, not full redirect)
6. **Sync indicator**: In header for premium users — "Last sync: 12 min ago" + manual "Sync now" button

### i18n

All premium copy (teaser, upgrade CTA, analytics labels, checkout redirect messages, error states) translated to all 13 locales from day one: es, en, fr, pt, de, it, ru, tr, pl, ar, ko, ja, zh.

## Testing Strategy

### Environment Isolation

- **Supabase**: Separate project for development/testing (different URL + keys). Production data never touched by tests.
- **Lemon Squeezy**: Test mode with sandbox API keys. No real charges during development.
- **Supercell API**: Real API with test tag `#YJU282PV` for integration tests. Rate-limited calls with delays.

### Test Layers

1. **Unit tests** (Vitest):
   - Deduplication logic (given existing battles, which new ones get inserted?)
   - JSONB extraction (parse battle data into my_brawler/teammates/opponents)
   - Tier checking logic (is user premium? is subscription active?)
   - Webhook signature verification (valid/invalid/tampered)
   - Analytics aggregation (win rate calculations, grouping, sorting)

2. **Integration tests** (Vitest + Supabase test project):
   - Full sync flow: fetch from Supercell API → insert into test DB → verify deduplication
   - Auth flow: sign in → create profile → link tag → verify RLS
   - Webhook flow: send mock webhook → verify profile tier updates
   - Queue flow: insert into sync_queue → verify Edge Function processes it

3. **E2E tests** (Playwright, optional later):
   - Free user flow: enter tag → see battles → see blurred teaser
   - Premium user flow: login → upgrade → see analytics → manual sync

### Test Data

- Test player tag: `#YJU282PV` (real Supercell data)
- Test Supabase project: separate from production (different env vars)
- Test Lemon Squeezy: sandbox mode (test API keys, no real charges)
- CI: Tests run against test Supabase project, never production

## Storage Estimation

| Scenario | Battles/day | 6-month raw | Annual cost |
|---|---|---|---|
| 100 premium users | ~2,500 | 450K rows ≈ 450MB | Free tier |
| 1,000 premium users | ~25,000 | 4.5M rows ≈ 4.5GB | Supabase Pro ($25/mo) |
| 10,000 premium users | ~250,000 | 45M rows ≈ 45GB | Supabase Pro + addon ($75/mo) |

Revenue at 1,000 users: $2,990/mo. Infrastructure cost: $25/mo. **Margin: 99.2%**.

## Implementation Order

1. Supabase project setup (new project, tables, RLS, indexes)
2. Auth integration (Google login, profile creation, tag linking)
3. Battle sync engine (fetch → parse → deduplicate → insert)
4. pg_cron queue system (scheduler + Edge Function worker)
5. Lemon Squeezy integration (checkout, webhooks, tier management)
6. Analytics page (premium-only, dashboards)
7. Free teaser UI (blurred sections, upgrade CTAs)
8. Ad removal for premium users
9. i18n for all new copy (13 locales)
10. Testing (unit + integration against test Supabase project)
