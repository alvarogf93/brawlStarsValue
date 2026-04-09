-- ═══════════════════════════════════════════════════════════════
-- Meta Trios: Aggregated trio compositions from pro battlelogs
-- ═══════════════════════════════════════════════════════════════

-- Table: stores win/loss/total per trio (3 brawlers) per map/mode/date
-- Brawler IDs are canonically sorted: brawler1_id < brawler2_id < brawler3_id
CREATE TABLE IF NOT EXISTS meta_trios (
  brawler1_id INT NOT NULL,
  brawler2_id INT NOT NULL,
  brawler3_id INT NOT NULL,
  map TEXT NOT NULL,
  mode TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'global',
  date DATE NOT NULL,
  wins INT NOT NULL DEFAULT 0,
  losses INT NOT NULL DEFAULT 0,
  total INT NOT NULL DEFAULT 0,
  PRIMARY KEY (brawler1_id, brawler2_id, brawler3_id, map, mode, source, date)
);

-- Lookup index for API queries: filter by map + mode + source + date range
CREATE INDEX IF NOT EXISTS idx_meta_trios_lookup
  ON meta_trios(map, mode, source, date);

-- RLS: public read, service-role-only write
ALTER TABLE meta_trios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "meta_trios_select" ON meta_trios
  FOR SELECT USING (true);

CREATE POLICY "meta_trios_all_service" ON meta_trios
  FOR ALL USING (
    (current_setting('request.jwt.claims', true)::jsonb ->> 'role') = 'service_role'
  );

-- Bulk upsert RPC: atomically inserts or increments counters
CREATE OR REPLACE FUNCTION bulk_upsert_meta_trios(rows JSONB)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  r JSONB;
BEGIN
  FOR r IN SELECT * FROM jsonb_array_elements(rows)
  LOOP
    INSERT INTO meta_trios (brawler1_id, brawler2_id, brawler3_id, map, mode, source, date, wins, losses, total)
    VALUES (
      (r->>'brawler1_id')::int, (r->>'brawler2_id')::int, (r->>'brawler3_id')::int,
      r->>'map', r->>'mode', r->>'source', (r->>'date')::date,
      (r->>'wins')::int, (r->>'losses')::int, (r->>'total')::int
    )
    ON CONFLICT (brawler1_id, brawler2_id, brawler3_id, map, mode, source, date)
    DO UPDATE SET
      wins = meta_trios.wins + EXCLUDED.wins,
      losses = meta_trios.losses + EXCLUDED.losses,
      total = meta_trios.total + EXCLUDED.total;
  END LOOP;
END;
$$;
