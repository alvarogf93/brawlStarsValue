-- Add event_id column to battles table for map image lookups
-- Run in Supabase Dashboard → SQL Editor

ALTER TABLE battles ADD COLUMN IF NOT EXISTS event_id BIGINT;
