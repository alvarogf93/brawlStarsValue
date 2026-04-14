-- ═══════════════════════════════════════════════════════════════
-- Schedule archive_meta_stats_weekly() via pg_cron (Sprint F+)
-- ═══════════════════════════════════════════════════════════════
--
-- Prerequisite:
--   - Migration 018 must be applied first (creates the table and
--     function).
--   - pg_cron extension must be enabled on the Supabase project
--     (already on by Sprint A — see 002_pg_cron_scheduler.sql).
--
-- Schedule:
--   Runs every Monday at 04:00 UTC. Rationale:
--     - Monday 04:00 UTC is a low-traffic window globally (Sunday
--       23:00 US Eastern, Monday 13:00 Japan, Monday 05:00 Europe).
--     - 4 AM avoids conflict with the */30 meta-poll cron (runs at
--       :00 and :30 of every hour) by a full 30-minute offset.
--     - 4 AM also avoids the 03:00 UTC cleanup-anonymous-visits
--       (from migration 009) by a full hour.
--     - Weekly cadence means the "hot tail" (rows aging out of the
--       90-day retention) builds up a maximum of 7 days between
--       runs — negligible for a table that grows ~500-1000 rows/day.
--
-- Safety:
--   - IMPORTANT: do NOT activate this schedule until the FIRST
--     BACKFILL has been completed manually. See
--     docs/crons/archive-runbook.md for the procedure. Activating
--     the cron on top of an un-backfilled hot table is not harmful
--     (the function is idempotent) but the first invocation will
--     process tens of thousands of rows in one go, which may take
--     several minutes. Doing it manually the first time gives
--     observability into the one-off large batch.
--
-- Idempotent application:
--   This migration wraps the schedule call in a
--   `DO ... unschedule if exists` block so re-running it replaces
--   any prior entry with the same name, matching the pattern used
--   by 009_anonymous_visits.sql and 011_pg_cron_realign.sql.

-- Unschedule any prior entry with this name. No-op if absent.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'archive-meta-stats') THEN
    PERFORM cron.unschedule('archive-meta-stats');
  END IF;
END $$;

-- Schedule: every Monday at 04:00 UTC.
SELECT cron.schedule(
  'archive-meta-stats',
  '0 4 * * 1',
  $$SELECT archive_meta_stats_weekly()$$
);

-- Quick sanity check — list the scheduled job so the SQL Editor
-- output confirms the entry exists with the expected shape.
SELECT
  jobid,
  jobname,
  schedule,
  active,
  command
FROM cron.job
WHERE jobname = 'archive-meta-stats';
