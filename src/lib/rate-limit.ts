import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

/**
 * Rate-limit helper backed by Upstash Redis (sliding-window algorithm).
 *
 * Used by public, unauthenticated POST endpoints that proxy to Supercell's
 * Brawl Stars API (battlelog, club, calculate) to defend against abuse that
 * would burn the Cloudflare Worker proxy's quota → IP-ban → site offline.
 *
 * Three credential states:
 *   - BOTH set         → real Redis-backed limiter is created (singleton).
 *   - NEITHER set      → fall open (returns ok=true) and warn ONCE per process.
 *                        Lets local dev work without Upstash credentials.
 *   - EXACTLY ONE set  → throws — that's a misconfiguration (typo, partial
 *                        env-var paste, etc.). Surfacing it loudly is safer
 *                        than silently disabling rate-limiting in production.
 *
 * The helper extracts the client IP from `x-forwarded-for` (taking the first
 * hop, which is the real client; subsequent hops are intermediate proxies),
 * falling back to `x-real-ip`, then to the literal string "anonymous".
 *
 * We intentionally never log the values of UPSTASH_* env vars, only their
 * presence/absence — leaking the token would defeat the purpose.
 */

export type RateLimitWindow =
  | `${number} ms`
  | `${number} s`
  | `${number} m`
  | `${number} h`
  | `${number} d`

export interface RateLimitOptions {
  /** Maximum number of requests allowed per `window`. */
  limit: number
  /** Sliding window duration, e.g. `'60 s'`, `'1 m'`. */
  window: RateLimitWindow
}

export interface RateLimitResult {
  ok: boolean
  /** Requests remaining in the current window (only meaningful when ok=true). */
  remaining?: number
  /**
   * Seconds until the window resets, suitable for a `Retry-After` header.
   * Always a non-negative integer; `0` means "retry now".
   */
  reset?: number
}

// ---------------------------------------------------------------------------
// Module-level singletons. We build the Ratelimit instance once per process so
// the underlying connection-pool is reused across requests.

let cachedLimiter: Ratelimit | null = null
let warnedAboutMissingCreds = false

function getLimiter(): Ratelimit | null {
  // Read fresh every call — tests reset env vars between cases, and prod env
  // is stable so this is essentially free.
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN

  const hasUrl = typeof url === 'string' && url.length > 0
  const hasToken = typeof token === 'string' && token.length > 0

  // Both missing → fall open, warn ONCE.
  if (!hasUrl && !hasToken) {
    if (!warnedAboutMissingCreds) {
      console.warn(
        '[rate-limit] Upstash credentials not configured; rate-limiting is DISABLED. ' +
          'Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN in your environment ' +
          'to enable. Falling open is intended for local dev only.',
      )
      warnedAboutMissingCreds = true
    }
    return null
  }

  // Exactly one missing → loud failure. Never silently degrade in production.
  if (!hasUrl || !hasToken) {
    throw new Error(
      '[rate-limit] Upstash misconfigured: exactly one of UPSTASH_REDIS_REST_URL / ' +
        'UPSTASH_REDIS_REST_TOKEN is set. Both are required.',
    )
  }

  if (!cachedLimiter) {
    const redis = new Redis({ url, token })
    cachedLimiter = new Ratelimit({
      redis,
      // Algorithm is created lazily per `limit` call below — but the constructor
      // requires a default. Use a no-op-friendly default; per-route limits are
      // applied via `Ratelimit.slidingWindow(limit, window)` passed at construction.
      limiter: Ratelimit.slidingWindow(1, '1 s'),
      analytics: false,
      prefix: 'bv:ratelimit',
    })
  }

  return cachedLimiter
}

// ---------------------------------------------------------------------------
// Per-route limiter cache. We build one Ratelimit instance per (limit, window)
// pair so each route gets its own sliding window without rebuilding on every
// call. Key: "limit:window".

const perRouteLimiters = new Map<string, Ratelimit>()

function getPerRouteLimiter(opts: RateLimitOptions): Ratelimit | null {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN

  const hasUrl = typeof url === 'string' && url.length > 0
  const hasToken = typeof token === 'string' && token.length > 0

  if (!hasUrl && !hasToken) {
    // Trigger the once-per-process warning side-effect.
    getLimiter()
    return null
  }
  if (!hasUrl || !hasToken) {
    // Re-throw via the canonical path so the error message stays in one place.
    getLimiter()
    return null // unreachable — getLimiter throws — but satisfies TS.
  }

  const key = `${opts.limit}:${opts.window}`
  const existing = perRouteLimiters.get(key)
  if (existing) return existing

  const redis = new Redis({ url, token })
  const limiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(opts.limit, opts.window),
    analytics: false,
    prefix: `bv:rl:${opts.limit}:${opts.window.replace(/\s+/g, '')}`,
  })
  perRouteLimiters.set(key, limiter)
  return limiter
}

// ---------------------------------------------------------------------------

function extractIdentifier(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for')
  if (fwd) {
    const first = fwd.split(',')[0]?.trim()
    if (first) return first
  }
  const real = req.headers.get('x-real-ip')
  if (real && real.trim().length > 0) return real.trim()
  return 'anonymous'
}

/**
 * Enforce a per-IP sliding-window rate limit.
 *
 * Returns:
 *   - `{ ok: true, remaining, reset }` when the request is allowed.
 *   - `{ ok: false, remaining: 0, reset }` when the limit has been hit.
 *     `reset` is the number of seconds until the window resets (use as the
 *     `Retry-After` header value).
 *
 * In the "no credentials" mode (local dev), always returns `{ ok: true }`.
 *
 * Throws on partial credentials — that's a configuration bug.
 */
export async function enforceRateLimit(
  req: Request,
  opts: RateLimitOptions,
): Promise<RateLimitResult> {
  const limiter = getPerRouteLimiter(opts)

  if (!limiter) {
    // Fall-open path (dev with no Upstash creds).
    return { ok: true }
  }

  const identifier = extractIdentifier(req)
  const result = await limiter.limit(identifier)

  // `result.reset` is a Unix epoch in milliseconds. Convert to a non-negative
  // number of seconds for the Retry-After header.
  const nowMs = Date.now()
  const resetSec = Math.max(0, Math.ceil((result.reset - nowMs) / 1000))

  return {
    ok: result.success,
    remaining: result.remaining,
    reset: resetSec,
  }
}

/**
 * Test-only: reset the module-level state. Not exported in production paths.
 * Vitest already isolates via `vi.resetModules()` inside tests, so this
 * helper isn't actually called from tests — kept for emergency manual reset.
 */
export function __resetRateLimitForTests(): void {
  cachedLimiter = null
  warnedAboutMissingCreds = false
  perRouteLimiters.clear()
}
