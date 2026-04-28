/**
 * Resilience-hardened HTTP wrappers for external API calls.
 *
 * PERF-01 (Panóptico audit, 2026-04-28): every external fetch in the app used
 * to issue with no timeout. A single hung Supercell battlelog (8 s) repeated
 * 1000× in the meta-poll cron blew past Vercel's 300 s budget; PayPal sandbox
 * stalls cascaded into webhook re-delivery storms. The wrappers below give us:
 *
 *   1. Hard timeouts (default 8 s) via `AbortSignal.timeout`.
 *   2. Composable user-supplied AbortSignals (caller cancellation still works).
 *   3. Typed `HttpTimeoutError` so callers can distinguish timeout from 5xx.
 *   4. Idempotent retries with exponential backoff + full jitter.
 *   5. Per-domain `CircuitBreaker` to fail fast when an upstream is dying.
 *
 * Caveat on `CircuitBreaker`: state is in-memory and per process. Vercel
 * Functions span multiple instances, so tripping isn't global — it just bounds
 * the blast within a single instance. That's still useful for cron loops that
 * iterate hundreds of times in one invocation.
 */

const DEFAULT_TIMEOUT_MS = 8_000

// ─── Errors ────────────────────────────────────────────────────────────────

export class HttpTimeoutError extends Error {
  public readonly url: string
  public readonly timeoutMs: number

  constructor(url: string, timeoutMs: number) {
    super(`Request to ${url} timed out after ${timeoutMs}ms`)
    this.name = 'HttpTimeoutError'
    this.url = url
    this.timeoutMs = timeoutMs
    // Preserve prototype chain when targeting older lib (TS-friendly)
    Object.setPrototypeOf(this, HttpTimeoutError.prototype)
  }
}

export class CircuitOpenError extends Error {
  public readonly key: string
  constructor(key: string) {
    super(`Circuit breaker is open for "${key}"`)
    this.name = 'CircuitOpenError'
    this.key = key
    Object.setPrototypeOf(this, CircuitOpenError.prototype)
  }
}

// ─── fetchWithTimeout ──────────────────────────────────────────────────────

/**
 * fetch() with a hard timeout. Caller-supplied `init.signal` is composed with
 * the timeout signal via `AbortSignal.any` — whichever fires first wins.
 *
 * Throws:
 *   - `HttpTimeoutError` when the timeout fires.
 *   - A regular `AbortError` (DOMException with name 'AbortError') when the
 *     user-supplied signal aborts before the timeout.
 *   - Any underlying fetch network error (TypeError, etc.) untouched.
 *
 * Note: never logs request bodies, headers or URLs containing secrets — the
 * error message only contains the URL the caller already knew about.
 */
export async function fetchWithTimeout(
  url: string,
  init?: RequestInit,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<Response> {
  const timeoutSignal = AbortSignal.timeout(timeoutMs)
  const userSignal = init?.signal ?? null

  const signal: AbortSignal = userSignal
    ? AbortSignal.any([userSignal, timeoutSignal])
    : timeoutSignal

  try {
    return await fetch(url, { ...init, signal })
  } catch (err) {
    // Distinguish "we timed out" from "user cancelled" from "network died".
    if (isAbortError(err)) {
      // Timeout signal aborted? Surface our typed error.
      if (timeoutSignal.aborted) {
        throw new HttpTimeoutError(url, timeoutMs)
      }
      // Otherwise the user cancelled — propagate the original AbortError.
      throw err
    }
    throw err
  }
}

function isAbortError(err: unknown): boolean {
  return (
    err instanceof Error &&
    (err.name === 'AbortError' || err.name === 'TimeoutError')
  )
}

// ─── fetchWithRetry ────────────────────────────────────────────────────────

export interface FetchRetryOptions {
  /**
   * How many *additional* attempts after the first.
   * Default: 2 (so up to 3 total calls) for GETs.
   *
   * IMPORTANT: POST callers must pass this explicitly to opt in. The default
   * for any non-GET method is 0 because POST is generally not idempotent.
   * Callers who know their POST is idempotent (PayPal verify-webhook,
   * client_credentials grant, Telegram sendMessage) can pass `retries: N`.
   * createSubscription is NOT safe and must NEVER be retried.
   */
  retries?: number
  /** Initial backoff in ms. Default 200. */
  baseMs?: number
  /** Cap on backoff in ms. Default 4000. */
  maxMs?: number
  /** Per-attempt timeout in ms. Default 8000. */
  timeoutMs?: number
  /**
   * Override which errors / responses trigger a retry. Defaults to:
   *   - HttpTimeoutError
   *   - HTTP 408, 429, 500, 502, 503, 504
   * 4xx (other than 408/429) are NOT retried.
   */
  isRetriable?: (err: unknown, res: Response | null) => boolean
}

const RETRIABLE_STATUS = new Set([408, 429, 500, 502, 503, 504])

export function defaultIsRetriable(err: unknown, res: Response | null): boolean {
  if (err) {
    if (err instanceof HttpTimeoutError) return true
    return false
  }
  if (res) return RETRIABLE_STATUS.has(res.status)
  return false
}

/**
 * Wraps `fetchWithTimeout` with idempotent retries (exponential backoff +
 * full jitter). Use for GETs and known-idempotent POSTs.
 *
 * IMPORTANT: This function is silent on POSTs by default. If `init.method` is
 * anything other than GET / HEAD and the caller did not explicitly set
 * `opts.retries`, retries default to 0. This guards against accidental
 * double-charges (PayPal createSubscription, etc.).
 */
export async function fetchWithRetry(
  url: string,
  init?: RequestInit,
  opts: FetchRetryOptions = {},
): Promise<Response> {
  const {
    baseMs = 200,
    maxMs = 4_000,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    isRetriable = defaultIsRetriable,
  } = opts

  // POST opt-in guard: if no retries supplied AND method is mutating, force 0.
  const method = (init?.method ?? 'GET').toUpperCase()
  const isReadOnly = method === 'GET' || method === 'HEAD'
  const retries =
    opts.retries !== undefined
      ? opts.retries
      : isReadOnly
        ? 2
        : 0

  let attempt = 0
  // We always make at least one call; `retries` is *additional* attempts.
  // Loop bound: retries + 1 total attempts.

  // We accumulate the last error/response to surface if retries exhaust.
  let lastErr: unknown = null
  let lastRes: Response | null = null

  while (attempt <= retries) {
    lastErr = null
    lastRes = null
    try {
      const res = await fetchWithTimeout(url, init, timeoutMs)
      if (res.ok) return res
      // Got a response but it's not OK: retry only if retriable.
      lastRes = res
      if (attempt === retries || !isRetriable(null, res)) {
        return res
      }
    } catch (err) {
      lastErr = err
      // User-cancellation is never retriable.
      if (err instanceof Error && err.name === 'AbortError' && !(err instanceof HttpTimeoutError)) {
        throw err
      }
      if (attempt === retries || !isRetriable(err, null)) {
        throw err
      }
    }

    // Backoff with full jitter, capped at maxMs.
    const exp = Math.min(maxMs, baseMs * 2 ** attempt)
    const delay = Math.floor(Math.random() * exp)
    await sleep(delay)
    attempt += 1
  }

  // Defensive — loop should always return or throw. Surface the last signal.
  if (lastErr) throw lastErr
  if (lastRes) return lastRes
  throw new Error('fetchWithRetry: exhausted retries with no result')
}

function sleep(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve()
  return new Promise(resolve => setTimeout(resolve, ms))
}

// ─── CircuitBreaker ────────────────────────────────────────────────────────

export interface CircuitBreakerOptions {
  /** Failures within `failureWindowMs` to trip. Default 5. */
  failureThreshold?: number
  /** Rolling window for failure counting. Default 30 s. */
  failureWindowMs?: number
  /** How long to stay open before half-opening. Default 60 s. */
  openDurationMs?: number
  /** Optional clock injection for tests. */
  now?: () => number
}

type State = 'closed' | 'open' | 'half-open'

/**
 * Half-open style circuit breaker keyed by an arbitrary string (typically a
 * domain like 'supercell', 'paypal', 'brawlapi').
 *
 * State machine:
 *   - `closed`: requests pass through. Failures within the rolling window are
 *     counted; reaching `failureThreshold` trips to `open`.
 *   - `open`: requests fail fast with `CircuitOpenError` until
 *     `openDurationMs` has elapsed, then state moves to `half-open`.
 *   - `half-open`: a single probe request is allowed. Success → `closed`.
 *     Failure → `open` again.
 *
 * In-memory and per-process. Vercel Functions run multiple instances, so
 * tripping does not propagate globally — but it still bounds the blast within
 * a single instance, which is the dominant cost for our cron loops that issue
 * hundreds of calls per invocation.
 */
export class CircuitBreaker {
  private readonly threshold: number
  private readonly windowMs: number
  private readonly openMs: number
  private readonly clock: () => number
  private failures: number[] = []
  private state: State = 'closed'
  private openedAt = 0
  private halfOpenInFlight = false

  constructor(
    public readonly key: string,
    opts: CircuitBreakerOptions = {},
  ) {
    this.threshold = opts.failureThreshold ?? 5
    this.windowMs = opts.failureWindowMs ?? 30_000
    this.openMs = opts.openDurationMs ?? 60_000
    this.clock = opts.now ?? Date.now
  }

  /** Inspect the current state (after applying any time-based transitions). */
  getState(): State {
    this.tick()
    return this.state
  }

  /**
   * Run `op` through the breaker. Throws `CircuitOpenError` immediately when
   * open. When half-open, only one probe is allowed; concurrent probes are
   * rejected with `CircuitOpenError` until the probe resolves.
   */
  async execute<T>(op: () => Promise<T>): Promise<T> {
    this.tick()

    if (this.state === 'open') {
      throw new CircuitOpenError(this.key)
    }
    if (this.state === 'half-open') {
      if (this.halfOpenInFlight) {
        throw new CircuitOpenError(this.key)
      }
      this.halfOpenInFlight = true
      try {
        const out = await op()
        this.recordSuccess()
        return out
      } catch (err) {
        this.recordFailure()
        throw err
      } finally {
        this.halfOpenInFlight = false
      }
    }

    // closed
    try {
      const out = await op()
      this.recordSuccess()
      return out
    } catch (err) {
      this.recordFailure()
      throw err
    }
  }

  /** Test helper: reset the breaker to closed and clear counters. */
  reset(): void {
    this.failures = []
    this.state = 'closed'
    this.openedAt = 0
    this.halfOpenInFlight = false
  }

  private tick(): void {
    const now = this.clock()
    if (this.state === 'open' && now - this.openedAt >= this.openMs) {
      this.state = 'half-open'
      this.halfOpenInFlight = false
    }
  }

  private recordSuccess(): void {
    if (this.state === 'half-open') {
      this.state = 'closed'
    }
    this.failures = []
  }

  private recordFailure(): void {
    const now = this.clock()
    if (this.state === 'half-open') {
      this.state = 'open'
      this.openedAt = now
      this.failures = []
      return
    }
    // closed: prune expired failures, append, evaluate threshold.
    const cutoff = now - this.windowMs
    this.failures = this.failures.filter(t => t >= cutoff)
    this.failures.push(now)
    if (this.failures.length >= this.threshold) {
      this.state = 'open'
      this.openedAt = now
      this.failures = []
    }
  }
}

// ─── Shared per-domain breakers ─────────────────────────────────────────────

/**
 * Lazily-instantiated breakers shared across the codebase. A `globalThis`
 * cache keeps the same instance across Hot Module Replacement reloads in dev
 * (where re-importing the module would otherwise create fresh breakers and
 * silently reset state).
 */
type BreakerRegistry = Map<string, CircuitBreaker>

const REGISTRY_KEY = '__bv_circuit_breakers__'

function registry(): BreakerRegistry {
  const g = globalThis as unknown as Record<string, BreakerRegistry | undefined>
  if (!g[REGISTRY_KEY]) g[REGISTRY_KEY] = new Map()
  return g[REGISTRY_KEY] as BreakerRegistry
}

export function getCircuitBreaker(
  key: string,
  opts?: CircuitBreakerOptions,
): CircuitBreaker {
  const reg = registry()
  let cb = reg.get(key)
  if (!cb) {
    cb = new CircuitBreaker(key, opts)
    reg.set(key, cb)
  }
  return cb
}

/**
 * Test helper: reset every registered circuit breaker to its closed/empty
 * state. Call this from `beforeEach` so a previous test's induced failures
 * don't leak into the next test (especially important when tests force 5xx
 * responses, which would otherwise trip the breaker for the rest of the file).
 */
export function resetAllCircuitBreakers(): void {
  for (const cb of registry().values()) cb.reset()
}
