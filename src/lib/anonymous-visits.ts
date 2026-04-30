// Server-only module. Do not import from client components.
// (The `server-only` package is not used in this repo by convention.)
//
// IMPORTANT: this module must never call cookies() or any request-context API.
// It is designed to run inside after() callbacks where the request context
// may have expired. Uses @supabase/supabase-js directly with the service
// role key — stateless, cookie-free, safe in any execution context.

import { createClient as createSupabaseAdmin, type SupabaseClient } from '@supabase/supabase-js'
import { notify } from '@/lib/telegram/notify'
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
      const { count } = await admin
        .from('anonymous_visits')
        .select('*', { count: 'exact', head: true })

      const profileUrl = `https://brawlvision.com/${locale}/profile/${encodeURIComponent(normalizedTag)}`

      await notify(
        `👤 <b>Nuevo visitante anónimo</b>\n` +
        `Tag: <code>${normalizedTag}</code>\n` +
        `Idioma: ${locale}\n` +
        `Tags únicos en la tabla: ${count ?? '?'}\n` +
        `🔗 ${profileUrl}`
      )
    }
  } catch (err) {
    // Defensive catch — this function must never propagate to the after() caller.
    console.error('[anonymous-visits] unexpected failure', err)
  }
}
