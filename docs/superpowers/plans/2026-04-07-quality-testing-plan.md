# Quality Testing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Achieve 90%+ test coverage on business logic, all API routes tested, all hooks tested, with shared fixtures and mocks.

**Architecture:** TDD with Vitest + Testing Library. Factory functions for test data, `vi.mock()` for external dependencies. Unit tests for pure logic, integration tests for API routes, renderHook for hooks.

**Tech Stack:** Vitest 4.1.2, @testing-library/react, @testing-library/jest-dom, jsdom

---

### Task 1: Shared Test Fixtures

**Files:**
- Create: `src/__tests__/fixtures/player.fixture.ts`
- Create: `src/__tests__/fixtures/battle.fixture.ts`
- Create: `src/__tests__/fixtures/profile.fixture.ts`

- [ ] **Step 1: Create player fixture factory**

```typescript
// src/__tests__/fixtures/player.fixture.ts
import type { PlayerTag } from '@/lib/types'

export function makePlayerData(overrides: Record<string, unknown> = {}) {
  return {
    tag: '#TEST123' as PlayerTag,
    name: 'TestPlayer',
    nameColor: '0xffFFFFFF',
    icon: { id: 28000000 },
    trophies: 25000,
    highestTrophies: 30000,
    expLevel: 200,
    totalPrestigeLevel: 5,
    soloVictories: 500,
    duoVictories: 300,
    '3vs3Victories': 2000,
    club: { tag: '#CLUB1', name: 'TestClub' },
    brawlers: [],
    ...overrides,
  }
}

export function makeBrawler(overrides: Record<string, unknown> = {}) {
  return {
    id: 16000000,
    name: 'SHELLY',
    power: 9,
    rank: 20,
    trophies: 500,
    highestTrophies: 750,
    gadgets: [{ id: 1, name: 'Clay Pigeons' }],
    starPowers: [{ id: 1, name: 'Shell Shock' }],
    hypercharges: [],
    gears: [{ id: 1, name: 'Damage' }],
    ...overrides,
  }
}

export function makeMaxBrawler(overrides: Record<string, unknown> = {}) {
  return makeBrawler({
    power: 11,
    gadgets: [{ id: 1, name: 'G1' }, { id: 2, name: 'G2' }],
    starPowers: [{ id: 1, name: 'SP1' }, { id: 2, name: 'SP2' }],
    hypercharges: [{ id: 1, name: 'HC1' }],
    gears: [{ id: 1, name: 'Gear1' }, { id: 2, name: 'Gear2' }],
    ...overrides,
  })
}
```

- [ ] **Step 2: Create battle fixture factory**

```typescript
// src/__tests__/fixtures/battle.fixture.ts
import type { Battle } from '@/lib/supabase/types'

export function makeBattle(overrides: Partial<Battle> = {}): Battle {
  return {
    id: 1,
    player_tag: '#TEST123',
    battle_time: '2026-04-05T17:00:00.000Z',
    event_id: 15000001,
    mode: 'brawlBall',
    map: 'Super Beach',
    result: 'victory',
    trophy_change: 8,
    duration: 120,
    is_star_player: false,
    my_brawler: {
      id: 16000000,
      name: 'SHELLY',
      power: 11,
      trophies: 750,
      gadgets: [{ id: 1, name: 'G1' }],
      starPowers: [{ id: 1, name: 'SP1' }],
      hypercharges: [],
    },
    teammates: [
      { tag: '#ALLY1', name: 'Ally1', brawler: { id: 16000001, name: 'COLT', power: 9, trophies: 600 } },
    ],
    opponents: [
      { tag: '#FOE1', name: 'Foe1', brawler: { id: 16000003, name: 'BROCK', power: 11, trophies: 700 } },
      { tag: '#FOE2', name: 'Foe2', brawler: { id: 16000004, name: 'RICO', power: 10, trophies: 650 } },
    ],
    created_at: '2026-04-05T17:00:00.000Z',
    ...overrides,
  } as Battle
}

export function makeVictory(overrides: Partial<Battle> = {}): Battle {
  return makeBattle({ result: 'victory', trophy_change: 8, ...overrides })
}

export function makeDefeat(overrides: Partial<Battle> = {}): Battle {
  return makeBattle({ result: 'defeat', trophy_change: -5, ...overrides })
}

export function makeDraw(overrides: Partial<Battle> = {}): Battle {
  return makeBattle({ result: 'draw', trophy_change: 0, ...overrides })
}

/** Generate N battles with incremental timestamps */
export function makeBattleSeries(count: number, base: Partial<Battle> = {}): Battle[] {
  return Array.from({ length: count }, (_, i) => {
    const time = new Date('2026-04-05T17:00:00.000Z')
    time.setMinutes(time.getMinutes() + i * 5)
    return makeBattle({
      id: i + 1,
      battle_time: time.toISOString(),
      result: i % 3 === 2 ? 'defeat' : 'victory',
      trophy_change: i % 3 === 2 ? -5 : 8,
      ...base,
    })
  })
}
```

- [ ] **Step 3: Create profile fixture factory**

```typescript
// src/__tests__/fixtures/profile.fixture.ts
import type { Profile } from '@/lib/supabase/types'

export function makeProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    id: 'user-uuid-123',
    player_tag: '#TEST123',
    tier: 'free',
    ls_customer_id: '',
    ls_subscription_id: '',
    ls_subscription_status: null,
    last_sync: null,
    ...overrides,
  } as Profile
}

export function makePremiumProfile(overrides: Partial<Profile> = {}): Profile {
  return makeProfile({
    tier: 'premium',
    ls_subscription_status: 'active',
    last_sync: new Date().toISOString(),
    ...overrides,
  })
}

export function makeExpiredProfile(overrides: Partial<Profile> = {}): Profile {
  return makeProfile({
    tier: 'premium',
    ls_subscription_status: 'expired',
    ...overrides,
  })
}
```

- [ ] **Step 4: Commit fixtures**

```bash
git add src/__tests__/fixtures/
git commit -m "test: add shared test fixtures for player, battle, and profile"
```

---

### Task 2: Unit Tests — premium.ts

**Files:**
- Create: `src/__tests__/unit/lib/premium.test.ts`

- [ ] **Step 1: Write tests**

```typescript
// src/__tests__/unit/lib/premium.test.ts
import { describe, it, expect } from 'vitest'
import { isPremium } from '@/lib/premium'
import { makeProfile, makePremiumProfile, makeExpiredProfile } from '../../fixtures/profile.fixture'

describe('isPremium', () => {
  it('returns false for null profile', () => {
    expect(isPremium(null)).toBe(false)
  })

  it('returns false for free tier', () => {
    expect(isPremium(makeProfile({ tier: 'free' }))).toBe(false)
  })

  it('returns true for premium with active status', () => {
    expect(isPremium(makePremiumProfile())).toBe(true)
  })

  it('returns true for premium with cancelled status (grace period)', () => {
    expect(isPremium(makePremiumProfile({ ls_subscription_status: 'cancelled' }))).toBe(true)
  })

  it('returns false for premium with expired status', () => {
    expect(isPremium(makeExpiredProfile())).toBe(false)
  })

  it('returns false for premium with past_due status', () => {
    expect(isPremium(makeProfile({ tier: 'premium', ls_subscription_status: 'past_due' }))).toBe(false)
  })

  it('returns true for pro tier with active status', () => {
    expect(isPremium(makeProfile({ tier: 'pro', ls_subscription_status: 'active' }))).toBe(true)
  })

  it('returns false for premium with null subscription status', () => {
    expect(isPremium(makeProfile({ tier: 'premium', ls_subscription_status: null }))).toBe(false)
  })
})
```

- [ ] **Step 2: Run tests**

Run: `npx vitest run src/__tests__/unit/lib/premium.test.ts`
Expected: All 8 tests PASS

- [ ] **Step 3: Commit**

```bash
git add src/__tests__/unit/lib/premium.test.ts
git commit -m "test: add exhaustive premium.ts unit tests"
```

---

### Task 3: Unit Tests — constants.ts validation

**Files:**
- Create: `src/__tests__/unit/lib/constants.test.ts`

- [ ] **Step 1: Write tests**

```typescript
// src/__tests__/unit/lib/constants.test.ts
import { describe, it, expect } from 'vitest'
import {
  PLAYER_TAG_REGEX,
  POWER_LEVEL_GEM_COST,
  GEM_COSTS,
  BRAWLER_RARITY_MAP,
  SKIN_TIER_PRICES,
  PIN_TIER_PRICES,
} from '@/lib/constants'

describe('PLAYER_TAG_REGEX', () => {
  it('accepts valid tags', () => {
    expect(PLAYER_TAG_REGEX.test('#YJU282PV')).toBe(true)
    expect(PLAYER_TAG_REGEX.test('#ABC')).toBe(true)
    expect(PLAYER_TAG_REGEX.test('#abc')).toBe(true) // case insensitive
    expect(PLAYER_TAG_REGEX.test('#12345678901234567890')).toBe(true) // 20 chars
  })

  it('rejects invalid tags', () => {
    expect(PLAYER_TAG_REGEX.test('')).toBe(false)
    expect(PLAYER_TAG_REGEX.test('YJU282PV')).toBe(false) // missing #
    expect(PLAYER_TAG_REGEX.test('#AB')).toBe(false) // too short
    expect(PLAYER_TAG_REGEX.test('#AB!')).toBe(false) // special chars
    expect(PLAYER_TAG_REGEX.test('# SPACE')).toBe(false) // spaces
    expect(PLAYER_TAG_REGEX.test('#123456789012345678901')).toBe(false) // 21 chars
  })
})

describe('POWER_LEVEL_GEM_COST', () => {
  it('has entries for levels 0 through 11', () => {
    for (let i = 0; i <= 11; i++) {
      expect(POWER_LEVEL_GEM_COST[i]).toBeDefined()
      expect(typeof POWER_LEVEL_GEM_COST[i]).toBe('number')
    }
  })

  it('costs are monotonically increasing', () => {
    for (let i = 1; i <= 11; i++) {
      expect(POWER_LEVEL_GEM_COST[i]).toBeGreaterThanOrEqual(POWER_LEVEL_GEM_COST[i - 1])
    }
  })

  it('level 0 costs 0 gems', () => {
    expect(POWER_LEVEL_GEM_COST[0]).toBe(0)
  })
})

describe('GEM_COSTS', () => {
  it('all costs are positive numbers', () => {
    for (const [key, value] of Object.entries(GEM_COSTS)) {
      expect(value, `GEM_COSTS.${key}`).toBeGreaterThan(0)
    }
  })

  it('has required upgrade types', () => {
    expect(GEM_COSTS.gadget).toBeDefined()
    expect(GEM_COSTS.starPower).toBeDefined()
    expect(GEM_COSTS.hypercharge).toBeDefined()
    expect(GEM_COSTS.gear).toBeDefined()
  })
})

describe('BRAWLER_RARITY_MAP', () => {
  it('has at least 50 brawlers', () => {
    expect(Object.keys(BRAWLER_RARITY_MAP).length).toBeGreaterThanOrEqual(50)
  })

  it('all rarities are valid strings', () => {
    const validRarities = ['Trophy Road', 'Rare', 'Super Rare', 'Epic', 'Mythic', 'Legendary', 'Chromatic', 'Ultra Legendary']
    for (const [id, rarity] of Object.entries(BRAWLER_RARITY_MAP)) {
      expect(validRarities, `Brawler ${id}`).toContain(rarity)
    }
  })
})

describe('SKIN_TIER_PRICES', () => {
  it('all prices are positive', () => {
    for (const [tier, price] of Object.entries(SKIN_TIER_PRICES)) {
      expect(price, `Skin tier ${tier}`).toBeGreaterThan(0)
    }
  })
})

describe('PIN_TIER_PRICES', () => {
  it('all prices are positive', () => {
    for (const [tier, price] of Object.entries(PIN_TIER_PRICES)) {
      expect(price, `Pin tier ${tier}`).toBeGreaterThan(0)
    }
  })
})
```

- [ ] **Step 2: Run tests**

Run: `npx vitest run src/__tests__/unit/lib/constants.test.ts`
Expected: All tests PASS

- [ ] **Step 3: Commit**

```bash
git add src/__tests__/unit/lib/constants.test.ts
git commit -m "test: add constants.ts validation tests"
```

---

### Task 4: Unit Tests — api.ts (mocked fetch)

**Files:**
- Create: `src/__tests__/unit/lib/api.test.ts`

- [ ] **Step 1: Write tests**

```typescript
// src/__tests__/unit/lib/api.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock global fetch
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

import { fetchPlayer, fetchBattlelog, fetchClub, SuprecellApiError } from '@/lib/api'

beforeEach(() => {
  vi.clearAllMocks()
})

function mockJsonResponse(data: unknown, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: () => Promise.resolve(data) }
}

describe('fetchPlayer', () => {
  it('returns player data for valid tag', async () => {
    const playerData = { tag: '#TEST', name: 'Player', trophies: 25000, brawlers: [] }
    mockFetch.mockResolvedValueOnce(mockJsonResponse(playerData))

    const result = await fetchPlayer('#TEST')
    expect(result).toEqual(playerData)
    expect(mockFetch).toHaveBeenCalledOnce()
  })

  it('throws SuprecellApiError on 404', async () => {
    mockFetch.mockResolvedValueOnce(mockJsonResponse({ reason: 'notFound' }, 404))

    await expect(fetchPlayer('#NONEXISTENT')).rejects.toThrow(SuprecellApiError)
    await expect(fetchPlayer('#NONEXISTENT')).rejects.toThrow()
  })

  it('throws SuprecellApiError on 403', async () => {
    mockFetch.mockResolvedValueOnce(mockJsonResponse({ reason: 'accessDenied' }, 403))

    await expect(fetchPlayer('#TEST')).rejects.toThrow(SuprecellApiError)
  })

  it('throws SuprecellApiError on 429 rate limit', async () => {
    mockFetch.mockResolvedValueOnce(mockJsonResponse({}, 429))

    await expect(fetchPlayer('#TEST')).rejects.toThrow(SuprecellApiError)
  })

  it('throws SuprecellApiError on 503 maintenance', async () => {
    mockFetch.mockResolvedValueOnce(mockJsonResponse({}, 503))

    await expect(fetchPlayer('#TEST')).rejects.toThrow(SuprecellApiError)
  })
})

describe('fetchBattlelog', () => {
  it('returns battlelog with items', async () => {
    const battlelog = { items: [{ battleTime: '20260405T170000.000Z' }] }
    mockFetch.mockResolvedValueOnce(mockJsonResponse(battlelog))

    const result = await fetchBattlelog('#TEST')
    expect(result.items).toHaveLength(1)
  })

  it('throws on 404', async () => {
    mockFetch.mockResolvedValueOnce(mockJsonResponse({}, 404))

    await expect(fetchBattlelog('#NONEXISTENT')).rejects.toThrow(SuprecellApiError)
  })
})

describe('fetchClub', () => {
  it('returns club data', async () => {
    const club = { tag: '#CLUB1', name: 'TestClub', members: [] }
    mockFetch.mockResolvedValueOnce(mockJsonResponse(club))

    const result = await fetchClub('#CLUB1')
    expect(result.name).toBe('TestClub')
  })

  it('throws on 404', async () => {
    mockFetch.mockResolvedValueOnce(mockJsonResponse({}, 404))

    await expect(fetchClub('#NONEXISTENT')).rejects.toThrow(SuprecellApiError)
  })
})

describe('SuprecellApiError', () => {
  it('captures status code', () => {
    const err = new SuprecellApiError(404, 'Not found')
    expect(err.status).toBe(404)
    expect(err.message).toBe('Not found')
    expect(err).toBeInstanceOf(Error)
  })
})
```

- [ ] **Step 2: Run tests**

Run: `npx vitest run src/__tests__/unit/lib/api.test.ts`
Expected: All tests PASS

- [ ] **Step 3: Commit**

```bash
git add src/__tests__/unit/lib/api.test.ts
git commit -m "test: add api.ts unit tests with mocked fetch"
```

---

### Task 5: Unit Tests — recommendations.ts

**Files:**
- Create: `src/__tests__/unit/lib/analytics-recommendations.test.ts`

- [ ] **Step 1: Write tests**

```typescript
// src/__tests__/unit/lib/analytics-recommendations.test.ts
import { describe, it, expect } from 'vitest'
import { computeCounterPick, findUnderusedBrawlers, computePlayNowRecommendations } from '@/lib/analytics/recommendations'
import { makeBattle, makeVictory, makeDefeat } from '../../fixtures/battle.fixture'

describe('computeCounterPick', () => {
  it('returns empty array with no battles', () => {
    const result = computeCounterPick([], ['SHELLY'])
    expect(result).toEqual([])
  })

  it('returns empty array when no battles match opponent', () => {
    const battles = [makeVictory()]
    const result = computeCounterPick(battles, ['NONEXISTENT'])
    expect(result).toEqual([])
  })

  it('finds counter-picks against specified opponent', () => {
    const battles = [
      makeVictory({
        my_brawler: { id: 16000000, name: 'SHELLY', power: 11, trophies: 750, gadgets: [], starPowers: [], hypercharges: [] },
        opponents: [{ tag: '#F1', name: 'Foe', brawler: { id: 16000003, name: 'BROCK', power: 10, trophies: 600 } }],
      }),
      makeDefeat({
        my_brawler: { id: 16000001, name: 'COLT', power: 9, trophies: 500, gadgets: [], starPowers: [], hypercharges: [] },
        opponents: [{ tag: '#F2', name: 'Foe2', brawler: { id: 16000003, name: 'BROCK', power: 11, trophies: 700 } }],
      }),
    ]
    const result = computeCounterPick(battles, ['BROCK'])
    expect(result.length).toBeGreaterThanOrEqual(1)
    // SHELLY won vs BROCK, COLT lost — SHELLY should rank higher
    const shellyIdx = result.findIndex(r => r.brawlerName === 'SHELLY')
    const coltIdx = result.findIndex(r => r.brawlerName === 'COLT')
    if (shellyIdx >= 0 && coltIdx >= 0) {
      expect(shellyIdx).toBeLessThan(coltIdx)
    }
  })

  it('is case-insensitive for opponent names', () => {
    const battles = [
      makeVictory({
        opponents: [{ tag: '#F1', name: 'Foe', brawler: { id: 16000003, name: 'BROCK', power: 10, trophies: 600 } }],
      }),
    ]
    const result = computeCounterPick(battles, ['brock'])
    expect(result.length).toBeGreaterThanOrEqual(1)
  })

  it('filters by map when mapFilter provided', () => {
    const battles = [
      makeVictory({
        map: 'Super Beach',
        opponents: [{ tag: '#F1', name: 'Foe', brawler: { id: 16000003, name: 'BROCK', power: 10, trophies: 600 } }],
      }),
      makeVictory({
        map: 'Backyard Bowl',
        opponents: [{ tag: '#F2', name: 'Foe2', brawler: { id: 16000003, name: 'BROCK', power: 11, trophies: 700 } }],
      }),
    ]
    const result = computeCounterPick(battles, ['BROCK'], 'Super Beach')
    // Should only include battles from Super Beach
    expect(result.length).toBeGreaterThanOrEqual(1)
    expect(result[0].gamesPlayed).toBe(1)
  })
})

describe('findUnderusedBrawlers', () => {
  it('returns empty for player with no high-power brawlers', () => {
    const brawlers = [{ id: 16000000, name: 'SHELLY', power: 5, trophies: 200 }]
    const battleCounts = new Map<number, number>()
    const result = findUnderusedBrawlers(brawlers as any, battleCounts)
    expect(result).toEqual([])
  })

  it('identifies high-power brawler with 0 battles', () => {
    const brawlers = [{ id: 16000000, name: 'SHELLY', power: 11, trophies: 750 }]
    const battleCounts = new Map<number, number>()
    const result = findUnderusedBrawlers(brawlers as any, battleCounts)
    expect(result).toHaveLength(1)
    expect(result[0].brawlerId).toBe(16000000)
  })

  it('excludes brawlers with many battles', () => {
    const brawlers = [{ id: 16000000, name: 'SHELLY', power: 11, trophies: 750 }]
    const battleCounts = new Map<number, number>([[16000000, 50]])
    const result = findUnderusedBrawlers(brawlers as any, battleCounts)
    expect(result).toEqual([])
  })

  it('sorts by power level descending', () => {
    const brawlers = [
      { id: 16000000, name: 'SHELLY', power: 9, trophies: 500 },
      { id: 16000001, name: 'COLT', power: 11, trophies: 750 },
    ]
    const battleCounts = new Map<number, number>()
    const result = findUnderusedBrawlers(brawlers as any, battleCounts)
    expect(result[0].brawlerName).toBe('COLT')
  })
})

describe('computePlayNowRecommendations', () => {
  it('returns empty array with no events', () => {
    const result = computePlayNowRecommendations([], [], [])
    expect(result).toEqual([])
  })

  it('returns empty array with no brawler data', () => {
    const events = [{ startTime: '2026-04-05T10:00:00Z', endTime: '2026-04-06T10:00:00Z', event: { id: 1, mode: 'brawlBall', map: 'Super Beach' } }]
    const result = computePlayNowRecommendations([], [], events as any)
    expect(result).toEqual([])
  })
})
```

- [ ] **Step 2: Run tests**

Run: `npx vitest run src/__tests__/unit/lib/analytics-recommendations.test.ts`
Expected: All tests PASS

- [ ] **Step 3: Commit**

```bash
git add src/__tests__/unit/lib/analytics-recommendations.test.ts
git commit -m "test: add recommendations.ts unit tests"
```

---

### Task 6: Integration Tests — /api/battlelog

**Files:**
- Create: `src/__tests__/integration/api/battlelog.test.ts`

- [ ] **Step 1: Write tests**

```typescript
// src/__tests__/integration/api/battlelog.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/api', () => ({
  fetchBattlelog: vi.fn(),
  SuprecellApiError: class extends Error {
    status: number
    constructor(status: number, message: string) {
      super(message)
      this.status = status
    }
  },
}))

import { fetchBattlelog, SuprecellApiError } from '@/lib/api'
import { POST } from '@/app/api/battlelog/route'

const mockFetchBattlelog = vi.mocked(fetchBattlelog)

beforeEach(() => {
  vi.clearAllMocks()
})

function makeRequest(body: unknown) {
  return new Request('http://localhost:3000/api/battlelog', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/battlelog', () => {
  it('returns battlelog for valid tag', async () => {
    mockFetchBattlelog.mockResolvedValueOnce({ items: [{ battleTime: '20260405T170000.000Z' }] } as any)

    const res = await POST(makeRequest({ playerTag: '#YJU282PV' }))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.items).toHaveLength(1)
  })

  it('returns 400 for invalid tag', async () => {
    const res = await POST(makeRequest({ playerTag: 'invalid' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for missing body', async () => {
    const res = await POST(makeRequest({}))
    expect(res.status).toBe(400)
  })

  it('returns 404 when player not found', async () => {
    mockFetchBattlelog.mockRejectedValueOnce(new SuprecellApiError(404, 'Player not found'))

    const res = await POST(makeRequest({ playerTag: '#NONEXIST' }))
    expect(res.status).toBe(404)
  })
})
```

- [ ] **Step 2: Run tests and adjust if route structure differs**

Run: `npx vitest run src/__tests__/integration/api/battlelog.test.ts`
If imports fail, check the actual exports from the route file and adjust.

- [ ] **Step 3: Commit**

```bash
git add src/__tests__/integration/api/battlelog.test.ts
git commit -m "test: add battlelog API integration tests"
```

---

### Task 7: Integration Tests — /api/club

**Files:**
- Create: `src/__tests__/integration/api/club.test.ts`

- [ ] **Step 1: Write tests**

```typescript
// src/__tests__/integration/api/club.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/api', () => ({
  fetchClub: vi.fn(),
  SuprecellApiError: class extends Error {
    status: number
    constructor(status: number, message: string) {
      super(message)
      this.status = status
    }
  },
}))

import { fetchClub, SuprecellApiError } from '@/lib/api'
import { POST } from '@/app/api/club/route'

const mockFetchClub = vi.mocked(fetchClub)

beforeEach(() => {
  vi.clearAllMocks()
})

function makeRequest(body: unknown) {
  return new Request('http://localhost:3000/api/club', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/club', () => {
  it('returns club data for valid tag', async () => {
    mockFetchClub.mockResolvedValueOnce({ tag: '#CLUB1', name: 'TestClub', members: [] } as any)

    const res = await POST(makeRequest({ clubTag: '#CLUB1' }))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.name).toBe('TestClub')
  })

  it('returns 404 for non-existent club', async () => {
    mockFetchClub.mockRejectedValueOnce(new SuprecellApiError(404, 'Club not found'))

    const res = await POST(makeRequest({ clubTag: '#NOCLUB' }))
    expect(res.status).toBe(404)
  })

  it('returns 400 for missing clubTag', async () => {
    const res = await POST(makeRequest({}))
    expect(res.status).toBe(400)
  })
})
```

- [ ] **Step 2: Run tests**

Run: `npx vitest run src/__tests__/integration/api/club.test.ts`

- [ ] **Step 3: Commit**

```bash
git add src/__tests__/integration/api/club.test.ts
git commit -m "test: add club API integration tests"
```

---

### Task 8: Integration Tests — /api/rankings

**Files:**
- Create: `src/__tests__/integration/api/rankings.test.ts`

- [ ] **Step 1: Write tests**

```typescript
// src/__tests__/integration/api/rankings.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/api', () => ({
  fetchPlayerRankings: vi.fn(),
  SuprecellApiError: class extends Error {
    status: number
    constructor(status: number, message: string) {
      super(message)
      this.status = status
    }
  },
}))

import { fetchPlayerRankings, SuprecellApiError } from '@/lib/api'
import { GET } from '@/app/api/rankings/route'

const mockFetchRankings = vi.mocked(fetchPlayerRankings)

beforeEach(() => {
  vi.clearAllMocks()
})

function makeRequest(params: Record<string, string> = {}) {
  const url = new URL('http://localhost:3000/api/rankings')
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  return new Request(url.toString())
}

describe('GET /api/rankings', () => {
  it('returns global rankings by default', async () => {
    mockFetchRankings.mockResolvedValueOnce({ items: [{ tag: '#P1', name: 'Player1', trophies: 50000 }] } as any)

    const res = await GET(makeRequest())
    expect(res.status).toBe(200)
  })

  it('returns filtered rankings by country', async () => {
    mockFetchRankings.mockResolvedValueOnce({ items: [{ tag: '#P1', name: 'SpainPlayer', trophies: 40000 }] } as any)

    const res = await GET(makeRequest({ country: 'ES' }))
    expect(res.status).toBe(200)
    expect(mockFetchRankings).toHaveBeenCalledWith(expect.anything(), expect.anything())
  })

  it('handles API error', async () => {
    mockFetchRankings.mockRejectedValueOnce(new SuprecellApiError(503, 'Maintenance'))

    const res = await GET(makeRequest())
    expect(res.status).toBe(503)
  })
})
```

- [ ] **Step 2: Run tests**

Run: `npx vitest run src/__tests__/integration/api/rankings.test.ts`

- [ ] **Step 3: Commit**

```bash
git add src/__tests__/integration/api/rankings.test.ts
git commit -m "test: add rankings API integration tests"
```

---

### Task 9: Integration Tests — /api/events

**Files:**
- Create: `src/__tests__/integration/api/events.test.ts`

- [ ] **Step 1: Write tests**

```typescript
// src/__tests__/integration/api/events.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/api', () => ({
  fetchEventRotation: vi.fn(),
  SuprecellApiError: class extends Error {
    status: number
    constructor(status: number, message: string) {
      super(message)
      this.status = status
    }
  },
}))

import { fetchEventRotation, SuprecellApiError } from '@/lib/api'
import { GET } from '@/app/api/events/route'

const mockFetchEvents = vi.mocked(fetchEventRotation)

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/events', () => {
  it('returns event rotation', async () => {
    mockFetchEvents.mockResolvedValueOnce([
      { startTime: '20260405T100000.000Z', endTime: '20260406T100000.000Z', event: { id: 1, mode: 'brawlBall', map: 'Super Beach' } },
    ] as any)

    const res = await GET()
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(Array.isArray(data)).toBe(true)
  })

  it('handles API error gracefully', async () => {
    mockFetchEvents.mockRejectedValueOnce(new SuprecellApiError(503, 'Maintenance'))

    const res = await GET()
    expect(res.status).toBe(503)
  })
})
```

- [ ] **Step 2: Run and commit**

```bash
npx vitest run src/__tests__/integration/api/events.test.ts
git add src/__tests__/integration/api/events.test.ts
git commit -m "test: add events API integration tests"
```

---

### Task 10: Integration Tests — /api/cron/sync

**Files:**
- Create: `src/__tests__/integration/api/cron-sync.test.ts`

- [ ] **Step 1: Write tests**

```typescript
// src/__tests__/integration/api/cron-sync.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFrom = vi.fn()

vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(() => ({
    from: (...args: unknown[]) => mockFrom(...args),
  })),
}))

vi.mock('@/lib/api', () => ({
  fetchBattlelog: vi.fn().mockResolvedValue({ items: [] }),
}))

vi.mock('@/lib/battle-parser', () => ({
  parseBattlelog: vi.fn().mockReturnValue([]),
}))

import { GET } from '@/app/api/cron/sync/route'

beforeEach(() => {
  vi.clearAllMocks()
  process.env.CRON_SECRET = 'test-secret'
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key'
})

function makeRequest(secret?: string) {
  return new Request('http://localhost:3000/api/cron/sync', {
    headers: secret ? { authorization: `Bearer ${secret}` } : {},
  })
}

describe('GET /api/cron/sync', () => {
  it('returns 401 without valid secret', async () => {
    const res = await GET(makeRequest('wrong-secret'))
    expect(res.status).toBe(401)
  })

  it('returns 401 without auth header', async () => {
    const res = await GET(makeRequest())
    expect(res.status).toBe(401)
  })

  it('returns processed:0 when no users need sync', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        in: vi.fn().mockReturnValue({
          or: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
      }),
    })

    const res = await GET(makeRequest('test-secret'))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.processed).toBe(0)
  })
})
```

- [ ] **Step 2: Run and commit**

```bash
npx vitest run src/__tests__/integration/api/cron-sync.test.ts
git add src/__tests__/integration/api/cron-sync.test.ts
git commit -m "test: add cron sync API integration tests"
```

---

### Task 11: Expand existing unit tests — edge cases

**Files:**
- Modify: `src/__tests__/unit/lib/calculate.test.ts`
- Modify: `src/__tests__/unit/lib/analytics-compute.test.ts`
- Modify: `src/__tests__/unit/lib/analytics-stats.test.ts`

- [ ] **Step 1: Add edge case tests to calculate.test.ts**

Add these tests to the existing file:

```typescript
it('handles 0% win rate without division by zero', () => {
  const player = makePlayer({ soloVictories: 0, duoVictories: 0, '3vs3Victories': 0 })
  const result = calculateValue(player, { winRate: 0, rarityMap: MOCK_RARITY })
  expect(result.estimatedTotalMatches).toBe(0)
  expect(result.estimatedHoursPlayed).toBe(0)
})

it('handles 100% win rate', () => {
  const player = makePlayer({ soloVictories: 100, duoVictories: 0, '3vs3Victories': 0 })
  const result = calculateValue(player, { winRate: 1, rarityMap: MOCK_RARITY })
  expect(result.estimatedTotalMatches).toBe(100)
})

it('calculates correctly with max-level brawler', () => {
  const player = makePlayer({
    brawlers: [makeMaxBrawler()],
  })
  const result = calculateValue(player, { rarityMap: MOCK_RARITY })
  expect(result.totalGems).toBeGreaterThan(0)
  expect(result.breakdown).toBeDefined()
})
```

- [ ] **Step 2: Add edge cases to analytics-stats.test.ts**

```typescript
it('wilsonLowerBound returns 0 for 0 total', () => {
  expect(wilsonLowerBound(0, 0)).toBe(0)
})

it('wilsonLowerBound handles very large numbers', () => {
  const result = wilsonLowerBound(50000, 100000)
  expect(result).toBeGreaterThan(0.49)
  expect(result).toBeLessThan(0.51)
})

it('winRate returns 0 for 0 total', () => {
  expect(winRate(0, 0)).toBe(0)
})
```

- [ ] **Step 3: Add edge cases to analytics-compute.test.ts**

```typescript
it('handles empty battles array', () => {
  const result = computeAdvancedAnalytics([])
  expect(result.overview.totalBattles).toBe(0)
  expect(result.overview.overallWinRate).toBe(0)
  expect(result.byBrawler).toEqual([])
})

it('handles all-draw battles', () => {
  const battles = [makeDraw(), makeDraw(), makeDraw()]
  const result = computeAdvancedAnalytics(battles)
  expect(result.overview.overallWinRate).toBe(0)
  expect(result.overview.streaks.currentWin).toBe(0)
  expect(result.overview.streaks.currentLoss).toBe(0)
})

it('handles single battle', () => {
  const battles = [makeVictory()]
  const result = computeAdvancedAnalytics(battles)
  expect(result.overview.totalBattles).toBe(1)
  expect(result.overview.totalWins).toBe(1)
})
```

- [ ] **Step 4: Run all tests**

Run: `npx vitest run`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/__tests__/unit/lib/
git commit -m "test: expand unit tests with edge cases for calculate, stats, and compute"
```

---

### Task 12: Run full test suite and generate coverage

- [ ] **Step 1: Run all tests**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 2: Generate coverage report**

Run: `npx vitest run --coverage`
Review: Check coverage for `src/lib/` and `src/app/api/`

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "test: complete Phase 1 testing — all business logic and API routes covered"
```
