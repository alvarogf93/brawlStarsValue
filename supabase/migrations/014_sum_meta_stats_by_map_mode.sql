-- ═══════════════════════════════════════════════════════════════
-- sum_meta_stats_by_map_mode RPC (Sprint E, 2026-04-14)
-- ═══════════════════════════════════════════════════════════════
--
-- Used by the meta-poll cron (`src/app/api/cron/meta-poll/route.ts`)
-- at the start of every run to preload the cumulative 14-day battle
-- counts per (map, mode) pair. This turns the adaptive top-up
-- algorithm from a per-run delta balancer into a cumulative
-- balancer: the preloaded counts seed `battlesByMapMode` before
-- any player is processed, so the under-target filter reflects
-- actual on-disk imbalance instead of just this-run's delta.
--
-- Without this RPC the cron couldn't see that brawlBall had 7,000
-- cumulative battles while brawlHockey had 0 — each 30-min run
-- looked at its own fresh counts and tried to balance in isolation,
-- which propagated the cumulative imbalance indefinitely.
--
-- Contract:
--   Input:
--     p_since   DATE  — lower bound (inclusive) on meta_stats.date.
--                       Normally `NOW() - INTERVAL '14 days'`.
--     p_source  TEXT  — 'global' for the pro-poll, 'users' for the
--                       premium-user sync, etc.
--   Output:
--     TABLE(map TEXT, mode TEXT, total BIGINT) — one row per
--                       (map, mode) pair, with the SUM of the
--                       `total` column across all brawlers and
--                       all dates in range.
--
-- STABLE: the function is deterministic within a transaction and
-- performs no writes, so PostgREST can safely parallelize and cache.
-- SECURITY DEFINER is NOT used — the service-role client that calls
-- this RPC already has full read access via its JWT claim.

CREATE OR REPLACE FUNCTION sum_meta_stats_by_map_mode(
  p_since DATE,
  p_source TEXT
) RETURNS TABLE(map TEXT, mode TEXT, total BIGINT)
LANGUAGE sql
STABLE
AS $$
  SELECT
    map,
    mode,
    SUM(total)::BIGINT AS total
  FROM meta_stats
  WHERE date >= p_since
    AND source = p_source
  GROUP BY map, mode
$$;

-- Grant explicit execute to the service role (default for RPCs is
-- PUBLIC but we pin it for clarity).
GRANT EXECUTE ON FUNCTION sum_meta_stats_by_map_mode(DATE, TEXT) TO service_role;
