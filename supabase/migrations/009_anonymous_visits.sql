BEGIN;

-- Ensure pg_cron is available. No-op in production Supabase (already installed).
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- ─────────────────────────────────────────────────────────────────
-- Table: public.anonymous_visits
-- Stores the tag as '#ABC123' (normalized via normalizePlayerTag).
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.anonymous_visits (
  tag            text PRIMARY KEY,
  locale         text NOT NULL CHECK (char_length(locale) BETWEEN 2 AND 10),
  first_visit_at timestamptz NOT NULL DEFAULT now(),
  last_visit_at  timestamptz NOT NULL DEFAULT now(),
  visit_count    integer NOT NULL DEFAULT 1 CHECK (visit_count >= 1)
);

CREATE INDEX IF NOT EXISTS idx_anonymous_visits_last_visit
  ON public.anonymous_visits(last_visit_at);

ALTER TABLE public.anonymous_visits ENABLE ROW LEVEL SECURITY;
-- No policies created. Only service-role server code can access this table.

-- ─────────────────────────────────────────────────────────────────
-- RPC: public.track_anonymous_visit(p_tag, p_locale) → boolean
-- Atomic upsert. Returns TRUE on INSERT (new tag), FALSE on UPDATE.
-- locale is intentionally not updated on re-entries (keep first-visit locale).
-- ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.track_anonymous_visit(
  p_tag    text,
  p_locale text
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  was_insert boolean;
BEGIN
  INSERT INTO public.anonymous_visits (tag, locale)
  VALUES (p_tag, p_locale)
  ON CONFLICT (tag) DO UPDATE
    SET last_visit_at = now(),
        visit_count   = public.anonymous_visits.visit_count + 1
  RETURNING (xmax = 0) INTO was_insert;
  RETURN was_insert;
END;
$$;

-- Lock down execute permissions — service role only.
REVOKE ALL     ON FUNCTION public.track_anonymous_visit(text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.track_anonymous_visit(text, text) FROM anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.track_anonymous_visit(text, text) TO service_role;

-- ─────────────────────────────────────────────────────────────────
-- Cron: daily cleanup of rows older than 90 days. Idempotent.
-- ─────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-anonymous-visits') THEN
    PERFORM cron.unschedule('cleanup-anonymous-visits');
  END IF;
END $$;

SELECT cron.schedule(
  'cleanup-anonymous-visits',
  '0 3 * * *',  -- 03:00 UTC daily
  $$DELETE FROM public.anonymous_visits
    WHERE last_visit_at < now() - interval '90 days'$$
);

COMMIT;
