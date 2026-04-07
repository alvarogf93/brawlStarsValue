# BrawlVision — Quality & Testing Spec

**Date:** 2026-04-07  
**Scope:** Exhaustive test coverage + quality hardening for all app layers  
**Goal:** 100% confidence in correctness, robustness, and edge-case handling

---

## 1. Current State

### Existing Tests
- **9 unit tests** (`src/__tests__/unit/lib/`): calculate, battle-parser, battle-sync, analytics-compute, analytics-stats, auth, lemonsqueezy, supabase-types, utils
- **7 integration tests** (`src/__tests__/integration/api/`): auth-callback, battles, calculate, checkout, profile, sync, webhook-ls
- **Framework**: Vitest 4.1.2 + Testing Library + jsdom
- **Coverage tool**: @vitest/coverage-v8 (configured, not enforced)

### Gaps Identified
| Category | Files Covered | Files Missing | Priority |
|----------|--------------|---------------|----------|
| Lib/Utils (unit) | 9/16 | api.ts, premium.ts, constants validation, analytics/recommendations.ts, analytics/types validation | High |
| API Routes (integration) | 7/14 | battlelog, club, rankings, events, analytics, analytics/counter-pick, cron/sync | High |
| Hooks | 0/8 | All hooks untested | High |
| Components | 0/40+ | All components untested | Medium |
| Pages (E2E) | 0/12 | All pages untested | Medium |
| Error Boundaries | 0 | No error boundaries exist | High |

---

## 2. Testing Strategy

### 2.1 Unit Tests — Business Logic (Priority: Critical)

**Target files and what to test:**

#### `src/lib/calculate.ts`
- Existing tests: YES — expand with:
  - Player with 0 brawlers → returns 0 gems
  - Player with max-level brawler (power 11, all gadgets/SPs/HC) → correct gem sum
  - Win rate edge cases: 0%, 100%, undefined (defaults to 50%)
  - Rarity map override vs default
  - Negative trophy values handling
  - Missing fields in playerData (partial data)

#### `src/lib/battle-parser.ts`
- Existing tests: YES — expand with:
  - Malformed battleTime strings (missing chars, different format)
  - Battle with no teams (solo showdown format)
  - Player not found in battle → returns null
  - Battle with null/missing fields (duration, trophyChange, map)
  - Star player detection edge cases (no starPlayer field)
  - Empty opponents array
  - Duplicate teammate tags

#### `src/lib/analytics/compute.ts`
- Existing tests: YES — expand with:
  - Empty battles array → all metrics return safe defaults
  - Single battle → all metrics computed without division-by-zero
  - All draws → streak detection handles correctly
  - Session gap exactly 30 min (boundary)
  - Tilt with exactly 3 losses then win → correct episode count
  - Timezone conversion edge cases (DST transitions)
  - 5000+ battles → performance doesn't degrade (time limit test)
  - Battles out of chronological order

#### `src/lib/analytics/stats.ts`
- Existing tests: YES — expand with:
  - Wilson score with 0 total → returns 0, not NaN
  - Wilson score with very large numbers (100K battles)
  - winRate with 0 total → returns 0
  - compositeKey with empty strings
  - compositeKey with strings containing `|||` separator

#### `src/lib/analytics/recommendations.ts`
- **NEW** — needs full test suite:
  - `computeCounterPick`: 0 matching battles, case-insensitive names, map filter
  - `computePlayNowRecommendations`: no events, no map data (mode fallback), empty brawler data
  - `findUnderusedBrawlers`: all brawlers above threshold, all below, mixed

#### `src/lib/premium.ts`
- **NEW** — needs full test suite:
  - Each tier + status combination: free/active, premium/active, premium/cancelled, premium/expired, premium/past_due, pro/active
  - Null profile → false
  - Missing `ls_subscription_status` field

#### `src/lib/api.ts`
- **NEW** — needs test suite (mock fetch):
  - fetchPlayer: valid tag, 404, 403, 429, 503, network error
  - fetchBattlelog: valid response, empty items, API down
  - fetchClub: valid, not found
  - fetchRankings: with/without country filter
  - fetchEvents: valid rotation, empty
  - SuprecellApiError: correct status codes and messages
  - Cache headers sent correctly (Cache-Control)

#### `src/lib/lemonsqueezy.ts`
- Existing tests: YES — expand with:
  - Webhook signature with tampered body → rejects
  - All event types: subscription_created, updated, cancelled
  - statusToTier edge cases: unknown event name
  - Missing custom_data.profile_id → handled gracefully
  - Duplicate webhook (idempotency)

#### `src/lib/utils.ts`
- Existing tests: YES — verify:
  - Tag normalization: lowercase → uppercase, missing #, extra spaces
  - formatGems: 0, negative, very large numbers, decimals
  - formatPlaytime: 0 hours, fractional, very large

#### `src/lib/constants.ts`
- **NEW** — validation tests:
  - PLAYER_TAG_REGEX: valid tags, invalid tags, edge cases (min/max length)
  - GEM_COSTS: all values are positive integers
  - POWER_LEVEL_GEM_COST: has entries 0-11, values are monotonically increasing
  - RARITY_MAP: all Brawl Stars rarities present

### 2.2 Integration Tests — API Routes (Priority: Critical)

**Target routes and scenarios:**

#### `/api/calculate` (expand existing)
- Valid tag → 200 with GemScore
- Invalid tag format → 400
- Non-existent player → 404
- Missing body → 400
- Rate-limited Supercell API → 429

#### `/api/battlelog` — **NEW**
- Valid tag → 200 with items array
- Invalid tag → 400
- Player not found → 404

#### `/api/club` — **NEW**
- Valid club tag → 200 with members
- Invalid tag → 400
- Club not found → 404

#### `/api/rankings` — **NEW**
- Global rankings → 200 with player list
- Country filter (ES) → 200 filtered
- Invalid country → handled gracefully

#### `/api/events` — **NEW**
- Returns current event rotation
- Handles API unavailability

#### `/api/analytics` — **NEW**
- Authenticated premium user → 200 with analytics
- Unauthenticated → 401
- Free user → 403
- No battles in DB → 200 with empty analytics

#### `/api/analytics/counter-pick` — **NEW**
- Valid opponent list → 200 with recommendations
- Empty opponents → 400
- No matching battles → 200 with empty results

#### `/api/cron/sync` — **NEW**
- Valid CRON_SECRET → processes users
- Invalid secret → 401
- No users to sync → 200 with processed:0
- API failure during sync → partial results

#### `/api/sync` (expand existing)
- Rate limit: call twice within 2 min → 429 on second
- Non-premium user → 403

#### `/api/profile` (expand existing)
- GET: authenticated → returns profile
- GET: unauthenticated → 401
- POST: create with valid tag → 201
- POST: create with invalid tag → 400

#### `/api/checkout` (expand existing)
- Authenticated user → returns checkout URL
- Unauthenticated → 401
- Invalid interval → 400

#### `/api/webhooks/lemonsqueezy` (expand existing)
- Valid signature + new subscription → updates profile
- Invalid signature → 401
- Duplicate event (idempotency) → ignored
- Missing profile_id in custom_data → handled

### 2.3 Hook Tests (Priority: High)

**All hooks need tests with React Testing Library's `renderHook`:**

#### `usePlayerData`
- Fetches and returns data for valid tag
- Returns cached data (localStorage) within TTL
- Refetches after TTL expires
- Handles API error gracefully
- Empty tag → doesn't fetch

#### `useAuth`
- Returns initial loading state
- After login → user + profile populated
- signOut → clears user, profile, localStorage
- First login + valid tag → creates profile
- First login + invalid tag → doesn't create profile (NEW behavior)

#### `useBattlelog`
- Fetches and analyzes battles
- Extracts mode stats, teammates, win rates correctly
- Handles empty battle list
- Handles API error

#### `useClub`
- Fetches and caches club data
- Returns cached within 10min TTL
- Handles missing club gracefully

#### `useClubEnriched`
- Enriches members in batches
- Caches enriched data (15min TTL)
- Handles partial API failures (some members fail)

#### `useAdvancedAnalytics`
- Fetches analytics for authenticated premium user
- Handles unauthenticated state
- Handles empty analytics response

#### `useSkinClassifications`
- Reads/writes localStorage correctly
- Handles corrupted localStorage data
- Returns defaults on first use

#### `useClubTrophyChanges`
- Calculates per-member trophy changes
- Handles members with no battle data

### 2.4 Component Tests (Priority: Medium)

**Focus on components with logic, not purely visual ones:**

#### Auth Components
- `AuthProvider`: renders children, provides context
- `AuthModal`: opens/closes, calls signIn, loading state
- `TagThenLogin`: validates tag, shows error, calls signIn only if tag valid (NEW behavior)

#### Profile Components
- `BreakdownGrid`: renders correct gem counts per category
- `AnimatedCounter`: animates from 0 to target value

#### Landing Components
- `InputForm`: validates tag, navigates on submit, shows error for invalid
- `TagThenLogin`: validates tag exists via API before OAuth (NEW behavior)

#### Layout Components
- `Header`: shows login/upgrade/sync buttons based on auth state
- `Sidebar`: active link highlighting, responsive behavior
- `DashboardLayoutClient`: redirects on invalid tag for logged-in users (NEW behavior)

#### Analytics Components
- `TiltDetector`: renders correct tilt episode count and recommendations
- `CounterPickAdvisor`: submits opponents, displays results
- `MatchupMatrix`: renders heatmap with correct colors

### 2.5 Error Boundary & Edge Case Tests (Priority: High)

**Missing entirely — needs implementation + tests:**

- Global error boundary catches render failures
- API timeout handling (10s timeout → user-friendly message)
- Network offline detection
- Malformed API responses (unexpected JSON structure)
- localStorage full/disabled → graceful degradation
- Auth token expired mid-session → re-auth prompt
- Concurrent fetches to same endpoint → deduplication

### 2.6 Performance & Regression Tests (Priority: Low)

- `computeAdvancedAnalytics` with 5000 battles completes < 2s
- `calculateValue` with 80 brawlers completes < 100ms
- Large localStorage (1000 cached entries) doesn't slow page load

---

## 3. Test Infrastructure Improvements

### 3.1 Shared Fixtures
Create `src/__tests__/fixtures/`:
- `player.fixture.ts` — realistic PlayerData objects (1 brawler, 80 brawlers, max level)
- `battle.fixture.ts` — realistic Battle objects (victory, defeat, draw, showdown, team modes)
- `profile.fixture.ts` — Profile objects (free, premium, expired, no subscription)
- `analytics.fixture.ts` — Pre-computed analytics output for snapshot testing

### 3.2 Mock Utilities
Create `src/__tests__/mocks/`:
- `supabase.mock.ts` — mock Supabase client (auth + DB operations)
- `fetch.mock.ts` — mock fetch for API calls with preset responses
- `localStorage.mock.ts` — in-memory localStorage implementation
- `next-navigation.mock.ts` — mock useRouter, useParams, usePathname

### 3.3 Coverage Enforcement
- Add `vitest.config.ts` coverage thresholds:
  - `src/lib/`: 90% lines, 85% branches
  - `src/hooks/`: 80% lines
  - `src/components/`: 70% lines
  - `src/app/api/`: 85% lines

### 3.4 CI Integration
- Run tests on every push (already has npm test script)
- Fail build if coverage drops below thresholds
- Generate coverage report artifact

---

## 4. Implementation Order

### Phase 1: Critical Business Logic (Days 1-2)
1. Fix/expand unit tests for calculate, battle-parser, analytics
2. Add new unit tests for recommendations, premium, api, constants
3. Create shared fixtures and mocks

### Phase 2: API Routes (Days 3-4)
4. Add integration tests for all 7 missing API routes
5. Expand existing 7 API tests with edge cases
6. Test rate limiting, auth gating, error responses

### Phase 3: Hooks & Auth Flow (Days 5-6)
7. Test all 8 hooks with renderHook
8. Test new validation flows (tag validation before login, redirect on invalid tag)
9. Test auth state transitions

### Phase 4: Components & Error Handling (Days 7-8)
10. Add error boundaries (implementation + tests)
11. Test critical components (auth, layout, landing)
12. Add performance regression tests

### Phase 5: Coverage & CI (Day 9)
13. Enforce coverage thresholds
14. Verify all tests pass in clean environment
15. Document test conventions

---

## 5. Success Criteria

- [ ] 90%+ line coverage on `src/lib/`
- [ ] 85%+ line coverage on `src/app/api/`
- [ ] 80%+ line coverage on `src/hooks/`
- [ ] All 14 API routes have integration tests
- [ ] All 8 hooks have unit tests
- [ ] Error boundaries implemented and tested
- [ ] All new auth validation flows tested (tag validation, redirect)
- [ ] No test depends on external APIs (all mocked)
- [ ] Tests complete in < 30 seconds
- [ ] Coverage thresholds enforced in CI
