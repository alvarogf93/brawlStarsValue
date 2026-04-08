-- Bulk upsert for meta_stats (one call instead of hundreds)
CREATE OR REPLACE FUNCTION bulk_upsert_meta_stats(rows JSONB)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE r JSONB;
BEGIN
  FOR r IN SELECT * FROM jsonb_array_elements(rows)
  LOOP
    INSERT INTO meta_stats (brawler_id, map, mode, source, date, wins, losses, total)
    VALUES (
      (r->>'brawler_id')::int,
      r->>'map',
      r->>'mode',
      r->>'source',
      (r->>'date')::date,
      (r->>'wins')::int,
      (r->>'losses')::int,
      (r->>'total')::int
    )
    ON CONFLICT (brawler_id, map, mode, source, date)
    DO UPDATE SET
      wins = meta_stats.wins + EXCLUDED.wins,
      losses = meta_stats.losses + EXCLUDED.losses,
      total = meta_stats.total + EXCLUDED.total;
  END LOOP;
END;
$$;

-- Bulk upsert for meta_matchups (one call instead of thousands)
CREATE OR REPLACE FUNCTION bulk_upsert_meta_matchups(rows JSONB)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE r JSONB;
BEGIN
  FOR r IN SELECT * FROM jsonb_array_elements(rows)
  LOOP
    INSERT INTO meta_matchups (brawler_id, opponent_id, mode, source, date, wins, losses, total)
    VALUES (
      (r->>'brawler_id')::int,
      (r->>'opponent_id')::int,
      r->>'mode',
      r->>'source',
      (r->>'date')::date,
      (r->>'wins')::int,
      (r->>'losses')::int,
      (r->>'total')::int
    )
    ON CONFLICT (brawler_id, opponent_id, mode, source, date)
    DO UPDATE SET
      wins = meta_matchups.wins + EXCLUDED.wins,
      losses = meta_matchups.losses + EXCLUDED.losses,
      total = meta_matchups.total + EXCLUDED.total;
  END LOOP;
END;
$$;
