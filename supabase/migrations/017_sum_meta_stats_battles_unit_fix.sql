-- ═══════════════════════════════════════════════════════════════
-- sum_meta_stats_by_map_mode — units fix (2026-04-14)
-- ═══════════════════════════════════════════════════════════════
--
-- Context:
--   Migration 014 introduced `sum_meta_stats_by_map_mode` returning
--   `SUM(total)::BIGINT`. That sum is in **brawler-rows**, not real
--   battles: every 3v3 draft battle produces 6 rows in `meta_stats`
--   (one per brawler × 2 teams × 3 players), each with `total = 1`.
--
--   The meta-poll cron used this RPC to seed `battlesByMapMode`
--   in-memory, then during the player loop incremented that map
--   with `+1 per real battle`. Result: two different units in the
--   same container. The preload dominated because it carried 14
--   days of accumulated rows, so the in-loop `+1` per battle was
--   effectively noise — the algorithm could never make meaningful
--   progress within a single run, and the target calculation
--   compared brawler-rows (from preload) against a ratio of
--   brawler-rows (max × 0.6), producing targets like 5203 that
--   were unreachable in practice.
--
--   The UI's `/api/meta/pro-analysis` already divides by 6
--   (`route.ts:280`: `const totalUniqueBattles = Math.round(totalProBattles / 6)`),
--   so the UI has always shown real battles. Only the cron preload
--   was out of sync.
--
-- Fix:
--   Divide by 6 inside the RPC so the preload returns real battle
--   counts that match the in-loop increment. All downstream math
--   (target, acceptance rate, diagnostics) now speaks one unit.
--
--   The divisor is a hard 6 because every mode in DRAFT_MODES is
--   exactly 3v3 (6 brawlers per battle). Showdown / boss / duels
--   are filtered out upstream at battle normalization, so they
--   never reach `meta_stats` and never affect this sum.
--
--   INTEGER division would round 11 brawler-rows down to 1, which
--   is wrong — we want 2 battles (11/6 ≈ 1.83 → 2). Use float
--   division + round:
--       ROUND(SUM(total)::NUMERIC / 6)::BIGINT
--
-- Safety:
--   - This migration ONLY replaces the RPC body. It does not touch
--     `meta_stats`, `meta_matchups`, or any other table. Zero data
--     loss. Zero migrations to roll back.
--   - The change is forward-compatible with the old meta-poll code
--     even before the accompanying route refactor: smaller preload
--     numbers → lower targets → the old broken algorithm becomes
--     less broken (targets become reachable again), not more.
--   - Re-runnable (`CREATE OR REPLACE`).
--
-- Downstream consumers to verify before merge:
--   - src/app/api/cron/meta-poll/route.ts → preloadCumulativeCounts
--     (the only caller; its in-memory counts are now in real
--     battles, matching the `+1 per battle` increment).
--
-- Related:
--   - docs/crons/README.md (will be updated to document this unit
--     invariant as part of the meta-poll Sprint F notes).

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
    ROUND(SUM(total)::NUMERIC / 6)::BIGINT AS total
  FROM meta_stats
  WHERE date >= p_since
    AND source = p_source
  GROUP BY map, mode
$$;

GRANT EXECUTE ON FUNCTION sum_meta_stats_by_map_mode(DATE, TEXT) TO service_role;
