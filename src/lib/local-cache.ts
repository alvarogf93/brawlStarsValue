/**
 * Versioned localStorage cache helper.
 *
 * LOG-13 — every hook that caches a server response in localStorage was
 * doing the same `JSON.parse + ttlCheck` dance, with no schema-version
 * field. When we changed a response shape (e.g. adding a new property to
 * BrawlerMastery), the OLD cached payload would still be returned until
 * its TTL expired, and any consumer destructuring the new property would
 * crash on `undefined`. Bumping a `schemaVersion` constant forces every
 * client to throw away the stale payload on the next read — equivalent to
 * a free-of-charge migration.
 *
 * Each caller picks its own `key` and `version`. Mixing two callers under
 * the same key is the bug the version field protects against — pick keys
 * that include a stable namespace (e.g. `bv:battlelog:#TAG`).
 *
 * `ttlMs` is per-call so each cache can pick its own freshness window.
 *
 * SSR-safe: `typeof window` guards every storage access, so importing this
 * helper in a server component is a no-op (always returns null on read,
 * silently drops on write).
 */

interface VersionedEntry<T> {
  v: number
  storedAt: number
  data: T
}

function getStorage(): Storage | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage
  } catch {
    // Some browsing modes (private mode, blocked storage) throw on
    // accessing localStorage. Treat as "no cache available".
    return null
  }
}

/**
 * Read a versioned cache entry. Returns `null` when:
 *   - localStorage isn't available (SSR / blocked).
 *   - The entry doesn't exist.
 *   - The stored version doesn't match the caller's `version`.
 *   - The entry is older than `ttlMs`.
 *   - The payload is unparseable JSON.
 */
export function readLocalCache<T>(
  key: string,
  version: number,
  ttlMs: number,
): T | null {
  const storage = getStorage()
  if (!storage) return null

  const raw = storage.getItem(key)
  if (!raw) return null

  let parsed: VersionedEntry<T>
  try {
    parsed = JSON.parse(raw) as VersionedEntry<T>
  } catch {
    storage.removeItem(key)
    return null
  }

  if (
    !parsed
    || typeof parsed !== 'object'
    || parsed.v !== version
    || typeof parsed.storedAt !== 'number'
  ) {
    storage.removeItem(key)
    return null
  }

  if (Date.now() - parsed.storedAt > ttlMs) {
    storage.removeItem(key)
    return null
  }

  return parsed.data
}

/**
 * Write a versioned cache entry. No-ops when localStorage isn't available
 * or when the storage quota is exceeded — the call site already has a
 * server response in hand, so a failed cache write is non-critical.
 */
export function writeLocalCache<T>(
  key: string,
  version: number,
  data: T,
): void {
  const storage = getStorage()
  if (!storage) return

  const entry: VersionedEntry<T> = {
    v: version,
    storedAt: Date.now(),
    data,
  }

  try {
    storage.setItem(key, JSON.stringify(entry))
  } catch {
    // Quota exceeded, JSON.stringify failure (cyclic refs), etc. The call
    // site already has the data — log nothing, fall through silently.
  }
}

/**
 * Delete a single cache entry. Used by hook `refresh()` paths.
 */
export function clearLocalCache(key: string): void {
  const storage = getStorage()
  if (!storage) return
  try {
    storage.removeItem(key)
  } catch {
    // ignore
  }
}
