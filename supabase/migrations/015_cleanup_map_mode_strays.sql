-- ═══════════════════════════════════════════════════════════════
-- cleanup_map_mode_strays RPC (Sprint E follow-up, 2026-04-14)
-- ═══════════════════════════════════════════════════════════════
--
-- Self-healing cleanup for the Supercell API quirk where hockey maps
-- are shipped with `mode: "brawlBall"` + `modeId: 45`. The code fix
-- in `normalizeSupercellMode` (commit 3db3bcc) stops NEW mis-
-- classifications, but every time a new hockey map rotates in, some
-- rows land in `meta_stats` / `meta_trios` / `battles` under the wrong
-- mode during the window between the map rotating in and the deploy
-- catching up. This RPC is called at the start of every `meta-poll`
-- run to merge those stragglers atomically.
--
-- Called with a single (map, wrong_mode, canonical_mode) triple. The
-- caller (`src/app/api/cron/meta-poll/route.ts`) determines which
-- triples to pass by comparing the preloaded (map, mode) counts
-- against the live rotation (see `findMapModeStragglers`). Running
-- this with "no strays" is a no-op (the INSERT...SELECT finds 0 rows,
-- the DELETE affects 0 rows).
--
-- Safety:
--   - Only touches the (map, mode) tuples explicitly passed in.
--   - Uses `ON CONFLICT ... DO UPDATE SET col = col + EXCLUDED.col`
--     so merging is incremental (sums wins/losses/total), never
--     overwriting.
--   - Runs as a single transaction per RPC call — partial failures
--     roll back cleanly.
--
-- Returns the number of meta_stats rows that were merged (useful for
-- the cron response diagnostics).

CREATE OR REPLACE FUNCTION cleanup_map_mode_strays(
  p_map TEXT,
  p_wrong_mode TEXT,
  p_canonical_mode TEXT,
  p_source TEXT DEFAULT 'global'
) RETURNS INT
LANGUAGE plpgsql
AS $$
DECLARE
  stats_merged INT := 0;
BEGIN
  -- ── 1. meta_stats: merge wrong-mode rows into canonical-mode rows ──
  --
  -- Uses the DELETE ... RETURNING → INSERT ... ON CONFLICT pattern.
  -- DELETE runs first and atomically captures the set of wrong-mode
  -- rows; the CTE then feeds them into the INSERT with the canonical
  -- mode, merging via ON CONFLICT DO UPDATE. Any concurrent writer
  -- that tries to insert new wrong-mode rows between the DELETE's
  -- snapshot and the INSERT's commit is either serialized (they land
  -- AFTER this statement and survive to the next cron run) or caught
  -- inside the same transaction and rolled back on conflict. This is
  -- meaningfully safer than the INSERT-then-DELETE pattern, which had
  -- a window where a concurrently-inserted row could be deleted
  -- without being merged.
  WITH deleted_strays AS (
    DELETE FROM meta_stats
    WHERE map = p_map
      AND mode = p_wrong_mode
      AND source = p_source
    RETURNING brawler_id, source, date, wins, losses, total
  )
  INSERT INTO meta_stats (brawler_id, map, mode, source, date, wins, losses, total)
  SELECT brawler_id, p_map, p_canonical_mode, source, date, wins, losses, total
  FROM deleted_strays
  ON CONFLICT (brawler_id, map, mode, source, date)
  DO UPDATE SET
    wins = meta_stats.wins + EXCLUDED.wins,
    losses = meta_stats.losses + EXCLUDED.losses,
    total = meta_stats.total + EXCLUDED.total;

  GET DIAGNOSTICS stats_merged = ROW_COUNT;

  -- ── 2. meta_trios: same DELETE-RETURNING-INSERT pattern ──
  WITH deleted_trio_strays AS (
    DELETE FROM meta_trios
    WHERE map = p_map
      AND mode = p_wrong_mode
      AND source = p_source
    RETURNING brawler1_id, brawler2_id, brawler3_id, source, date, wins, losses, total
  )
  INSERT INTO meta_trios (
    brawler1_id, brawler2_id, brawler3_id,
    map, mode, source, date, wins, losses, total
  )
  SELECT brawler1_id, brawler2_id, brawler3_id,
         p_map, p_canonical_mode, source, date, wins, losses, total
  FROM deleted_trio_strays
  ON CONFLICT (brawler1_id, brawler2_id, brawler3_id, map, mode, source, date)
  DO UPDATE SET
    wins = meta_trios.wins + EXCLUDED.wins,
    losses = meta_trios.losses + EXCLUDED.losses,
    total = meta_trios.total + EXCLUDED.total;

  -- ── 3. battles: simple UPDATE (no PK conflict — battles PK is on id) ──
  -- The `source` filter does not apply here because battles is the raw
  -- premium-user sync table and doesn't split by source.
  UPDATE battles
  SET mode = p_canonical_mode
  WHERE map = p_map
    AND mode = p_wrong_mode;

  RETURN stats_merged;
END;
$$;

GRANT EXECUTE ON FUNCTION cleanup_map_mode_strays(TEXT, TEXT, TEXT, TEXT) TO service_role;
