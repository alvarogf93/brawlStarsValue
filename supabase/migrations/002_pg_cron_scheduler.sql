-- pg_cron scheduler — run in Supabase Dashboard → SQL Editor
-- Prerequisites: enable pg_cron and pg_net extensions first

-- 1. Enqueue premium users who need syncing (every minute, LIMIT 50)
SELECT cron.schedule(
  'enqueue-premium-syncs',
  '* * * * *',
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

-- 2. Trigger the Edge Function to process queue (every minute)
-- Replace <project-ref> and <service_role_key> with actual values
-- SELECT cron.schedule(
--   'process-sync-queue',
--   '* * * * *',
--   $$
--     SELECT net.http_post(
--       url := 'https://<project-ref>.supabase.co/functions/v1/sync-worker',
--       body := '{}'::jsonb,
--       headers := '{"Authorization": "Bearer <service_role_key>", "Content-Type": "application/json"}'::jsonb
--     );
--   $$
-- );
