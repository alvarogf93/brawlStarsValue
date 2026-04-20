-- ═══════════════════════════════════════════════════════════════
-- brawler_trends — pre-computed 7-day WR delta per brawler
-- ═══════════════════════════════════════════════════════════════
--
-- Problem: the `/api/meta/brawler-trends` endpoint ran a ~10k-row
-- scan on `meta_stats` on every ISR refresh. Working, but overkill
-- for data that changes on a days scale — and cumbersome once
-- meta_stats grows past 100k rows.
--
-- Solution: persist the computed trend in its own tiny table
-- (~100 rows, ~10 KB), refreshed every 6 hours by a pg_cron job.
-- The endpoint becomes a single `SELECT * FROM brawler_trends`
-- with a ~50ms response time.
--
-- The endpoint keeps a fallback path: if this table is empty or
-- missing, it falls back to the inline paginated computation so
-- that applying this migration and deploying the endpoint are
-- independently safe operations.
--
-- Fields mirror the semantics of `src/lib/brawler-detail/trend.ts`:
--   trend_7d      — WR delta in percentage points (7d vs prev 7d).
--                   NULL when either window has fewer than 3 battles.
--   recent_total  — number of battles in the last 7 days.
--   prev_total    — number of battles in days 8-14.
--   computed_at   — when this row was last refreshed.
-- ═══════════════════════════════════════════════════════════════

BEGIN;

CREATE EXTENSION IF NOT EXISTS pg_cron;

CREATE TABLE IF NOT EXISTS public.brawler_trends (
  brawler_id    INTEGER PRIMARY KEY,
  trend_7d      NUMERIC(5,1),
  recent_total  INTEGER NOT NULL DEFAULT 0,
  prev_total    INTEGER NOT NULL DEFAULT 0,
  computed_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.brawler_trends ENABLE ROW LEVEL SECURITY;

-- Public read (the /api endpoint uses the service role anyway, but
-- keeping this public simplifies any future admin dashboard).
DROP POLICY IF EXISTS "brawler_trends_select" ON public.brawler_trends;
CREATE POLICY "brawler_trends_select" ON public.brawler_trends
  FOR SELECT USING (true);

-- Service-role write only. Pattern copied from cron_heartbeats.
DROP POLICY IF EXISTS "brawler_trends_write" ON public.brawler_trends;
CREATE POLICY "brawler_trends_write" ON public.brawler_trends
  FOR ALL
  USING (
    (current_setting('request.jwt.claims', true)::jsonb ->> 'role') = 'service_role'
  )
  WITH CHECK (
    (current_setting('request.jwt.claims', true)::jsonb ->> 'role') = 'service_role'
  );

-- ─────────────────────────────────────────────────────────────────
-- Function: compute_brawler_trends()
-- Runs the aggregation in pure SQL — equivalent to the TypeScript
-- `compute7dTrend` in src/lib/brawler-detail/trend.ts. Keep the
-- 3-battle minimum in sync with MIN_BATTLES_PER_TREND_WINDOW.
-- ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.compute_brawler_trends()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rows_upserted INTEGER;
  cutoff_recent DATE := (CURRENT_DATE - INTERVAL '7 days')::DATE;
  cutoff_prev   DATE := (CURRENT_DATE - INTERVAL '14 days')::DATE;
BEGIN
  WITH agg AS (
    SELECT
      brawler_id,
      SUM(CASE WHEN date >= cutoff_recent THEN wins ELSE 0 END)::INTEGER  AS recent_wins,
      SUM(CASE WHEN date >= cutoff_recent THEN total ELSE 0 END)::INTEGER AS recent_total,
      SUM(CASE WHEN date >= cutoff_prev AND date < cutoff_recent THEN wins ELSE 0 END)::INTEGER  AS prev_wins,
      SUM(CASE WHEN date >= cutoff_prev AND date < cutoff_recent THEN total ELSE 0 END)::INTEGER AS prev_total
    FROM public.meta_stats
    WHERE date >= cutoff_prev
    GROUP BY brawler_id
  ),
  computed AS (
    SELECT
      brawler_id,
      recent_total,
      prev_total,
      CASE
        WHEN recent_total < 3 OR prev_total < 3 THEN NULL
        ELSE ROUND(
          ((recent_wins::NUMERIC / recent_total * 100)
           - (prev_wins::NUMERIC / prev_total * 100))::NUMERIC,
          1
        )
      END AS trend_7d
    FROM agg
  )
  INSERT INTO public.brawler_trends (brawler_id, trend_7d, recent_total, prev_total, computed_at)
  SELECT brawler_id, trend_7d, recent_total, prev_total, now()
  FROM computed
  ON CONFLICT (brawler_id) DO UPDATE
    SET trend_7d     = EXCLUDED.trend_7d,
        recent_total = EXCLUDED.recent_total,
        prev_total   = EXCLUDED.prev_total,
        computed_at  = EXCLUDED.computed_at;

  GET DIAGNOSTICS rows_upserted = ROW_COUNT;

  -- Reuse the existing cron_heartbeats table for observability.
  INSERT INTO public.cron_heartbeats (job_name, last_success_at, last_duration_ms, last_summary)
  VALUES (
    'compute-brawler-trends',
    now(),
    0,  -- single-statement job; per-call duration isn't meaningful
    jsonb_build_object(
      'computed_count', rows_upserted,
      'non_null_count', (SELECT COUNT(*) FROM public.brawler_trends WHERE trend_7d IS NOT NULL)
    )
  )
  ON CONFLICT (job_name) DO UPDATE
    SET last_success_at  = EXCLUDED.last_success_at,
        last_duration_ms = EXCLUDED.last_duration_ms,
        last_summary     = EXCLUDED.last_summary;

  RETURN rows_upserted;
END;
$$;

-- Lock down execute permissions — only service_role (via the
-- REST API) and pg_cron should ever invoke this.
REVOKE ALL      ON FUNCTION public.compute_brawler_trends() FROM PUBLIC;
REVOKE EXECUTE  ON FUNCTION public.compute_brawler_trends() FROM anon, authenticated;
GRANT  EXECUTE  ON FUNCTION public.compute_brawler_trends() TO service_role;

-- ─────────────────────────────────────────────────────────────────
-- Cron: refresh every 6 hours, offset to minute 17 so it doesn't
-- collide with sync (hourly) or meta-poll (every 30 min).
-- ─────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'compute-brawler-trends') THEN
    PERFORM cron.unschedule('compute-brawler-trends');
  END IF;
END $$;

SELECT cron.schedule(
  'compute-brawler-trends',
  '17 */6 * * *',  -- at minute 17, every 6 hours
  $$SELECT public.compute_brawler_trends();$$
);

-- Seed the table on migration apply so the endpoint's fast path is
-- usable immediately instead of waiting up to 6 hours for the first
-- cron tick.
SELECT public.compute_brawler_trends();

COMMIT;
