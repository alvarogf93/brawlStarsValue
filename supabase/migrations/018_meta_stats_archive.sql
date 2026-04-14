-- ═══════════════════════════════════════════════════════════════
-- meta_stats_archive — long-term historical storage (Sprint F+)
-- ═══════════════════════════════════════════════════════════════
--
-- Purpose:
--   `meta_stats` is the hot table read by every UI query and by the
--   meta-poll cron's preload. Sprint F established the invariant
--   "never DELETE, never decrement". That kept our data honest but
--   means the table grows forever — today ~80k rows, projected
--   400k+ in a year.
--
--   `meta_stats_archive` is the long-term store. A weekly pg_cron
--   job moves rows older than HOT_RETENTION_DAYS out of the hot
--   table and into the archive, rolling up the per-day granularity
--   of `meta_stats` into per-week aggregates. The archive's schema
--   mirrors the hot table except that `date` is replaced by
--   `period_start` (DATE, first day of the ISO week), and PK is
--   updated accordingly.
--
-- Data-preservation invariants (must hold for any refactor):
--
--   1. INSERT to archive ALWAYS precedes DELETE from hot, in the
--      same transaction. A failed INSERT rolls back the DELETE —
--      impossible to lose rows.
--   2. The archive ON CONFLICT clause ADDS (SET wins = wins + EXCLUDED.wins)
--      rather than REPLACING — if the cron is re-run for a week
--      that's already been archived, the function is idempotent
--      and data is never double-counted nor lost.
--   3. Hot retention is HOT_RETENTION_DAYS days (currently 90).
--      This is strictly GREATER than META_POLL_PRELOAD_DAYS (28)
--      and strictly GREATER than META_ROLLING_DAYS (14), so every
--      read path in the app finds its data in the hot table and
--      never needs to touch the archive. The archive is lateral —
--      reserved for future cross-season analytics features.
--   4. The archive is append-or-merge only. No DELETE statement
--      anywhere in this file operates against meta_stats_archive.
--
-- Parameters:
--   Retention window and schedule are documented in the function
--   body. Changing retention requires updating the hardcoded
--   INTERVAL and re-running the backfill against the new cutoff.
--
-- Backfill on first application:
--   On the very first apply, `meta_stats` contains ~80k rows
--   accumulated over time. Most are already older than 90 days
--   and will be archived in a single invocation — potentially a
--   large (~50-80k row) batch. Run the backfill MANUALLY the first
--   time during a low-activity window; the weekly pg_cron schedule
--   (migration 019) is safe to activate only after the initial
--   backfill has completed. See docs/crons/archive-runbook.md.

-- ── Schema ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS meta_stats_archive (
  brawler_id   INTEGER NOT NULL,
  map          TEXT NOT NULL,
  mode         TEXT NOT NULL,
  source       TEXT NOT NULL,         -- 'global' (pro-poll) or 'users' (premium sync)
  period_start DATE NOT NULL,         -- first day of the ISO week (DATE_TRUNC('week', ...))
  wins         BIGINT NOT NULL DEFAULT 0,
  losses       BIGINT NOT NULL DEFAULT 0,
  total        BIGINT NOT NULL DEFAULT 0,
  archived_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (brawler_id, map, mode, source, period_start)
);

-- Query-pattern indexes. The PK already covers the common "lookup
-- for a specific brawler+map+mode+period" shape. These two extras
-- cover the two expected analytics use cases:
--   - "what happened in week X across all maps/brawlers?" (period_start)
--   - "what's the historical arc of map M in mode K?" (map + mode ordered by time)
CREATE INDEX IF NOT EXISTS meta_stats_archive_period_idx
  ON meta_stats_archive (period_start, source);

CREATE INDEX IF NOT EXISTS meta_stats_archive_map_mode_idx
  ON meta_stats_archive (map, mode, period_start);

COMMENT ON TABLE meta_stats_archive IS
  'Long-term historical store for meta_stats. Populated weekly by archive_meta_stats_weekly(). Rows are per-week aggregates (period_start = start of ISO week). Write-only and append-or-merge — see migration 018 header for invariants.';

-- ── Archival function ──────────────────────────────────────────

CREATE OR REPLACE FUNCTION archive_meta_stats_weekly()
RETURNS TABLE(
  rows_archived BIGINT,
  rows_deleted  BIGINT,
  cutoff_used   DATE
)
LANGUAGE plpgsql
AS $$
DECLARE
  -- Rows with `date` strictly less than cutoff move to the archive.
  -- 90 days leaves comfortable margin above META_POLL_PRELOAD_DAYS
  -- (28) and META_ROLLING_DAYS (14). Adjust ONLY with a follow-up
  -- migration + full backfill, never in place.
  v_cutoff DATE := CURRENT_DATE - INTERVAL '90 days';
  v_archived BIGINT;
  v_deleted  BIGINT;
BEGIN
  -- Single-transaction CTE: INSERT into archive first, DELETE from
  -- hot second. If the INSERT raises, the DELETE never runs. If the
  -- DELETE raises, the entire transaction rolls back. Atomicity
  -- guarantees zero data loss under any failure mode.
  WITH archived AS (
    INSERT INTO meta_stats_archive (
      brawler_id, map, mode, source, period_start,
      wins, losses, total, archived_at
    )
    SELECT
      brawler_id,
      map,
      mode,
      source,
      DATE_TRUNC('week', date)::DATE AS period_start,
      SUM(wins)::BIGINT,
      SUM(losses)::BIGINT,
      SUM(total)::BIGINT,
      NOW()
    FROM meta_stats
    WHERE date < v_cutoff
    GROUP BY brawler_id, map, mode, source, DATE_TRUNC('week', date)
    ON CONFLICT (brawler_id, map, mode, source, period_start)
    DO UPDATE SET
      wins        = meta_stats_archive.wins   + EXCLUDED.wins,
      losses      = meta_stats_archive.losses + EXCLUDED.losses,
      total       = meta_stats_archive.total  + EXCLUDED.total,
      archived_at = NOW()
    RETURNING 1
  ),
  deleted AS (
    DELETE FROM meta_stats
    WHERE date < v_cutoff
    RETURNING 1
  )
  SELECT
    (SELECT COUNT(*) FROM archived),
    (SELECT COUNT(*) FROM deleted)
  INTO v_archived, v_deleted;

  RETURN QUERY SELECT v_archived, v_deleted, v_cutoff;
END;
$$;

COMMENT ON FUNCTION archive_meta_stats_weekly() IS
  'Move meta_stats rows older than 90 days into meta_stats_archive as weekly aggregates. Atomic (CTE INSERT ... DELETE in one transaction). Idempotent (ON CONFLICT DO UPDATE sums rather than replaces). Called weekly by pg_cron — see migration 019.';

-- Grant explicit execute to the service role (default RPC grant is
-- PUBLIC but we pin it for clarity — the meta-poll route already
-- runs as service_role and will be the only caller beyond pg_cron).
GRANT EXECUTE ON FUNCTION archive_meta_stats_weekly() TO service_role;
