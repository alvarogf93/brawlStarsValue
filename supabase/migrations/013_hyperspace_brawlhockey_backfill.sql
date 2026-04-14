-- ═══════════════════════════════════════════════════════════════
-- Hyperspace → brawlHockey backfill (Sprint E, 2026-04-14)
-- ═══════════════════════════════════════════════════════════════
--
-- Context: Hyperspace is a Brawl Hockey map (modeId 45) but the
-- Supercell battlelog API ships every Hyperspace battle with
-- `mode: "brawlBall"`. The original implementation of
-- `normalizeSupercellMode` short-circuited on any valid draft-mode
-- string, so it never consulted `modeId` when the string was
-- already "brawlBall". Result: every Hyperspace battle landed in
-- `meta_stats` and `meta_trios` under `mode = 'brawlBall'` and the
-- `brawlHockey` mode had zero rows in the entire history of the
-- table.
--
-- The code fix (2026-04-14) flips the priority so modeId wins over
-- the mode string when it maps to a known draft mode. From now on,
-- new Hyperspace battles are correctly classified as `brawlHockey`.
-- This migration backfills the existing mis-classified rows so the
-- 14-day rolling window reflects the correct mode immediately, not
-- 14 days from now when the old rows naturally expire.
--
-- Safety:
--   - brawlHockey has zero rows in both tables before this runs,
--     so no primary-key conflicts during the UPDATE.
--   - Scoped strictly to `map = 'Hyperspace'` — no other map is
--     affected. Older legitimate brawlBall data is untouched.
--   - Wrapped in a transaction so both tables flip atomically.
--
-- Tables with a (map, mode) pair:
--   - meta_stats (brawler_id, map, mode, source, date)
--   - meta_trios (brawler1_id, brawler2_id, brawler3_id, map, mode, source, date)
--
-- NOT affected:
--   - meta_matchups has no `map` column. Mode-level matchups from
--     Hyperspace-origin battles were counted as brawlBall, and we
--     cannot surgically distinguish them from legitimate brawlBall
--     matchups. They will self-correct over the 14-day rolling
--     window as old mis-classified rows age out and new correctly-
--     classified rows come in.
--   - `battles` table stores user-synced data with a `mode` column.
--     Premium users who played Hyperspace have their battles stored
--     as brawlBall. Backfilled here too for consistency.

BEGIN;

-- 1. meta_stats
UPDATE meta_stats
SET mode = 'brawlHockey'
WHERE map = 'Hyperspace' AND mode = 'brawlBall';

-- 2. meta_trios
UPDATE meta_trios
SET mode = 'brawlHockey'
WHERE map = 'Hyperspace' AND mode = 'brawlBall';

-- 3. battles (user sync data)
UPDATE battles
SET mode = 'brawlHockey'
WHERE map = 'Hyperspace' AND mode = 'brawlBall';

COMMIT;
