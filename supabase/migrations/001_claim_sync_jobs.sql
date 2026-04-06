-- RPC function for the sync-worker Edge Function to claim jobs atomically
-- Run this in Supabase Dashboard → SQL Editor

CREATE OR REPLACE FUNCTION claim_sync_jobs(batch_size INT DEFAULT 5)
RETURNS SETOF sync_queue
LANGUAGE sql
AS $$
  UPDATE sync_queue
  SET started_at = NOW()
  WHERE id IN (
    SELECT id FROM sync_queue
    WHERE started_at IS NULL
      AND completed_at IS NULL
      AND retry_count < 3
    ORDER BY scheduled_at
    LIMIT batch_size
    FOR UPDATE SKIP LOCKED
  )
  RETURNING *;
$$;
