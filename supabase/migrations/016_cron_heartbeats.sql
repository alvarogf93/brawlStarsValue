-- ═══════════════════════════════════════════════════════════════
-- cron_heartbeats — observability for the VPS-hosted cron jobs
-- ═══════════════════════════════════════════════════════════════
--
-- Problem: `/api/cron/meta-poll` and `/api/cron/sync` are invoked
-- from a VPS crontab (see `docs/crons/README.md` Tier 3). If the
-- VPS goes down, the cron fails silently — there is no central
-- observability. The 2026-04-12 audit found 7/14 days with zero
-- meta_stats growth, which means at least one full week of silent
-- outage nobody noticed. This table is the first half of a self-
-- hosted healthcheck (the second half — the pg_cron alert trigger
-- — is a v2 follow-up once we decide on the notification transport).
--
-- What this v1 gives us:
--   - One row per cron job, updated on every successful run.
--   - `last_success_at` tells you when the job last finished end-
--     to-end. A stale value (> 2× expected interval) means
--     something is wrong: the VPS died, the endpoint is returning
--     errors, the secret rotated, etc.
--   - `last_duration_ms` lets you track performance drift without
--     SSH'ing to the VPS for `/tmp/meta-poll.log`.
--   - `last_summary` is the route-specific JSON payload (e.g. for
--     meta-poll: battlesProcessed, poolSize, stragglersMerged
--     count; for sync: processed, reason). Read-only from the UI
--     side — it's a snapshot of the last run's diagnostics.
--
-- Policy: the `job_name` is the primary key, so only one row per
-- job. Each successful run UPSERTs the row. Failures do NOT touch
-- the row — that's the whole point: the row goes stale when runs
-- stop succeeding, and a v2 cron job checks for staleness and
-- alerts via Telegram.
--
-- This table is public-readable (nothing sensitive — just "when
-- did cron X last succeed?") and service-role-write. Letting the
-- public read it means the Telegram bot's `/cron` command can
-- query it without needing elevated DB access.

CREATE TABLE IF NOT EXISTS cron_heartbeats (
  job_name TEXT PRIMARY KEY,
  last_success_at TIMESTAMPTZ NOT NULL,
  last_duration_ms INT NOT NULL,
  last_summary JSONB
);

-- Common query: "is any job stale?" — indexed for the v2 alert cron.
CREATE INDEX IF NOT EXISTS idx_cron_heartbeats_success_at
  ON cron_heartbeats(last_success_at);

ALTER TABLE cron_heartbeats ENABLE ROW LEVEL SECURITY;

-- Public read (bot `/cron` command, admin dashboards, diagnose scripts)
CREATE POLICY "cron_heartbeats_select" ON cron_heartbeats
  FOR SELECT USING (true);

-- Service-role write only. `USING` gates existing-row visibility for
-- UPDATE/DELETE, `WITH CHECK` gates the row being inserted or updated.
-- A `FOR ALL` policy without `WITH CHECK` silently allows writes from
-- roles that pass the existing-row check but shouldn't be allowed to
-- create new rows. In practice the Supabase service role bypasses RLS
-- entirely so this is a latent concern — but if anyone ever grants
-- INSERT to another role without reviewing the policy, the tighter
-- definition below catches the mistake.
CREATE POLICY "cron_heartbeats_write" ON cron_heartbeats
  FOR ALL
  USING (
    (current_setting('request.jwt.claims', true)::jsonb ->> 'role') = 'service_role'
  )
  WITH CHECK (
    (current_setting('request.jwt.claims', true)::jsonb ->> 'role') = 'service_role'
  );
