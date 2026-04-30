-- ═══════════════════════════════════════════════════════════════
-- MIX-03 — sum_meta_stats_total: scalar aggregate to bypass
--          PostgREST 1000-row cap on /api/meta/brawler-detail
-- ═══════════════════════════════════════════════════════════════
--
-- The brawler-detail endpoint computed pickRate as
-- `brawlerGames / sum(meta_stats.total over rolling window) * 100`.
-- The denominator was fetched with `.from('meta_stats').select('total')
-- .gte('date', cutoff)` — unpaginated. PostgREST silently caps
-- unpaginated SELECTs at 1000 rows, so a 14-day window with ~10k
-- rows returned an arbitrary slice and `pickRate` was matched
-- against a truncated, non-deterministic denominator.
--
-- This RPC returns the real scalar aggregate. Same pattern as
-- migrations 014/017 (`sum_meta_stats_by_map_mode`).
--
-- p_source is OPTIONAL:
--   - NULL  → sum all sources (current brawler-detail semantics:
--             "all sources global+users", documented at route.ts:35).
--   - 'global' or 'users' → restrict to that source.
--
-- The COALESCE guards against an empty window returning NULL,
-- keeping the function's return type honest as BIGINT.
--
-- Idempotent — only CREATE OR REPLACEs the function.
-- ═══════════════════════════════════════════════════════════════

BEGIN;

CREATE OR REPLACE FUNCTION public.sum_meta_stats_total(
  p_since DATE,
  p_source TEXT DEFAULT NULL
) RETURNS BIGINT
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(SUM(total), 0)::BIGINT
  FROM public.meta_stats
  WHERE date >= p_since
    AND (p_source IS NULL OR source = p_source);
$$;

-- Hardening: explicit GRANTs for the three application roles.
-- The current caller (`createServiceClient()` in /api/meta/brawler-detail)
-- only needs `service_role`, but routes that use `createClient()` (cookie-
-- auth, rol `authenticated`) or anon SSR (rol `anon`) would silently fail
-- with `permission denied for function` if they ever invoked this RPC.
-- Granting all three is consistent with how migrations 014/017 expose
-- sibling helpers (`sum_meta_stats_by_map_mode`).
GRANT EXECUTE ON FUNCTION public.sum_meta_stats_total(DATE, TEXT)
  TO authenticated, anon, service_role;

COMMIT;
