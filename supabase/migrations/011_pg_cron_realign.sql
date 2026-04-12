-- ═══════════════════════════════════════════════════════════════
-- Realign pg_cron state with the repo
-- ═══════════════════════════════════════════════════════════════
--
-- Issue: audit on 2026-04-12 found drift between the pg_cron state
-- in production and the code in this repo:
--
--   Job                       Repo (002_pg_cron_scheduler.sql)  Prod reality
--   ─────────────────────────────────────────────────────────────────────────
--   enqueue-premium-syncs     '* * * * *'  (every minute)       '*/15 * * * *'  (every 15 min)
--   process-sync-queue        commented out                     active '*/5 * * * *'
--   cleanup-anonymous-visits  (added in 009)                    matches repo ✓
--
-- This migration brings the repo back to being the source of truth
-- for `enqueue-premium-syncs`. It unschedules the existing job and
-- re-schedules it at the real production frequency (*/15) with the
-- SQL from the repo.
--
-- `process-sync-queue` is NOT included in this migration because
-- its current `command` in production is unknown to the repo — it
-- was configured manually in the Dashboard. Before including it here,
-- run the following query in the Dashboard SQL Editor and paste the
-- output to the next revision of this migration:
--
--     SELECT command FROM cron.job WHERE jobname = 'process-sync-queue';
--
-- Then replace the `-- TODO process-sync-queue` block at the end of
-- this file with a proper unschedule + schedule pair using the real
-- command. Until then, this migration only realigns the first job.

BEGIN;

-- ── 1. enqueue-premium-syncs: */15 * * * * ──────────────────────
-- Production has been running this at 15-min intervals since
-- someone adjusted it in the Dashboard. The SQL body is the same
-- as in 002_pg_cron_scheduler.sql, just the schedule differs.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'enqueue-premium-syncs') THEN
    PERFORM cron.unschedule('enqueue-premium-syncs');
  END IF;
END $$;

SELECT cron.schedule(
  'enqueue-premium-syncs',
  '*/15 * * * *',
  $$
    -- Reset stale jobs
    UPDATE sync_queue
    SET started_at = NULL, retry_count = retry_count + 1
    WHERE started_at < NOW() - INTERVAL '10 minutes'
      AND completed_at IS NULL
      AND retry_count < 3;

    -- Enqueue new syncs
    INSERT INTO sync_queue (player_tag)
    SELECT player_tag FROM profiles
    WHERE tier IN ('premium', 'pro')
      AND (last_sync IS NULL OR last_sync < NOW() - INTERVAL '1 hour')
      AND player_tag NOT IN (
        SELECT player_tag FROM sync_queue
        WHERE completed_at IS NULL
      )
    LIMIT 50;
  $$
);

-- ── 2. process-sync-queue: TODO ─────────────────────────────────
-- Do not touch this job from this migration until the real `command`
-- is copied out of the Dashboard. Leaving it alone means production
-- keeps working; touching it blindly could break the sync queue.

COMMIT;
