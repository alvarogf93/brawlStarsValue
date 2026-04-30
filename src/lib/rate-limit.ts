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
  /** Configured maximum requests per window (always present). */
  limit: number
  /** Requests remaining in the current window. */
  remaining: number
  /**
   * Seconds until the window resets, suitable for a `Retry-After` header.
   * Always a non-negative integer; `0` means "retry now".
   */
  reset: number
}

// ---------------------------------------------------------------------------
// Credential state.

type CredState =
  | { kind: 'configured'; url: string; token: string }
  | { kind: 'fall-open' }

let warnedAboutMissingCreds = false

/**
 * Read Upstash credentials from env vars and classify the state. Throws on
 * partial configuration (loud failure path). Reads fresh every call — tests
 * stub env between cases, prod is stable so this is essentially free.
 */
function checkCredentials(): CredState {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN

  const hasUrl = typeof url === 'string' && url.length > 0
  const hasToken = typeof token === 'string' && token.length > 0

  if (hasUrl && hasToken) {
    return { kind: 'configured', url, token }
  }

  if (!hasUrl && !hasToken) {
    if (!warnedAboutMissingCreds) {
      console.warn(
        '[rate-limit] Upstash credentials not configured; rate-limiting is DISABLED. ' +
          'Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN in your environment ' +
          'to enable. Falling open is intended for local dev only.',
      )
      warnedAboutMissingCreds = true
    }
    return { kind: 'fall-open' }
  }

  // Exactly one missing → never silently degrade in production.
  throw new Error(
    '[rate-limit] Upstash misconfigured: exactly one of UPSTASH_REDIS_REST_URL / ' +
      'UPSTASH_REDIS_REST_TOKEN is set. Both are required.',
  )
}

// ---------------------------------------------------------------------------
// Per-route limiter cache. We build one Ratelimit instance per (limit, window)
// pair so each route gets its own sliding window without rebuilding on every
// call. Key: "limit:window".

const perRouteLimiters = new Map<string, Ratelimit>()

function getPerRouteLimiter(opts: RateLimitOptions): Ratelimit | null {
  const creds = checkCredentials()
  if (creds.kind === 'fall-open') return null

  const key = `${opts.limit}:${opts.window}`
  const existing = perRouteLimiters.get(key)
  if (existing) return existing

  const redis = new Redis({ url: creds.url, token: creds.token })
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
// Identifier extraction.

/**
 * Extract the client IP from forwarding headers, with safe fallbacks.
 *
 * Vercel sets `x-forwarded-for` with the chain `<client>, <proxy1>, ...`. The
 * leftmost entry is the originating client; subsequent entries are
 * intermediate proxies. We trust the leftmost because Vercel terminates the
 * external connection at its edge.
 */
export function extractClientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for')
  if (fwd) {
    const first = fwd.split(',')[0]?.trim()
    if (first) return first
  }
  const real = req.headers.get('x-real-ip')
  if (real && real.trim().length > 0) return real.trim()
  return 'anonymous'
}

// ---------------------------------------------------------------------------
// Public API.

/**
 * Enforce a sliding-window rate limit keyed by client IP (default).
 *
 * Returns:
 *   - `{ ok: true, limit, remaining, reset }` when the request is allowed.
 *   - `{ ok: false, limit, remaining: 0, reset }` when the limit has been hit.
 *
 * In "no credentials" mode (local dev) always returns ok=true with `limit=∞`
 * sentinel values (`limit: opts.limit, remaining: opts.limit, reset: 0`).
 *
 * Throws on partial credentials.
 */
export async function enforceRateLimit(
  req: Request,
  opts: RateLimitOptions,
  identifierOverride?: string,
): Promise<RateLimitResult> {
  const limiter = getPerRouteLimiter(opts)

  if (!limiter) {
    // Fall-open path (dev with no Upstash creds). Return values clients can
    // still attach to response headers without leaking that we're disabled.
    return { ok: true, limit: opts.limit, remaining: opts.limit, reset: 0 }
  }

  const identifier = identifierOverride ?? extractClientIp(req)
  const result = await limiter.limit(identifier)

  const nowMs = Date.now()
  const resetSec = Math.max(0, Math.ceil((result.reset - nowMs) / 1000))

  return {
    ok: result.success,
    limit: opts.limit,
    remaining: result.remaining,
    reset: resetSec,
  }
}

/**
 * Build the standard rate-limit response headers from a `RateLimitResult`.
 *
 * Uses the IETF draft-ietf-httpapi-ratelimit-headers naming (`RateLimit-*`,
 * no `X-` prefix) plus the legacy `X-RateLimit-*` aliases for clients that
 * still depend on them. `Retry-After` (RFC 9110 §10.2.3) is set on 429.
 *
 * Pass the result of `enforceRateLimit` plus a flag for whether this is a
 * 429 (rejected) response — only the rejected path emits `Retry-After`.
 *
 * Refs:
 *   https://datatracker.ietf.org/doc/draft-ietf-httpapi-ratelimit-headers/
 *   https://www.rfc-editor.org/rfc/rfc9110#section-10.2.3
 */
export function rateLimitHeaders(rl: RateLimitResult, rejected: boolean): Record<string, string> {
  const headers: Record<string, string> = {
    'RateLimit-Limit': String(rl.limit),
    'RateLimit-Remaining': String(rl.remaining),
    'RateLimit-Reset': String(rl.reset),
    'X-RateLimit-Limit': String(rl.limit),
    'X-RateLimit-Remaining': String(rl.remaining),
    'X-RateLimit-Reset': String(rl.reset),
  }
  if (rejected) {
    headers['Retry-After'] = String(rl.reset)
  }
  return headers
}

/**
 * Test-only: reset the module-level state. Not exported in production paths.
 * Vitest already isolates via `vi.resetModules()` inside tests, so this
 * helper isn't actually called from tests — kept for emergency manual reset.
 */
export function __resetRateLimitForTests(): void {
  warnedAboutMissingCreds = false
  perRouteLimiters.clear()
}
