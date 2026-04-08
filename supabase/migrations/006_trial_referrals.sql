-- ═══════════════════════════════════════════════════════════════
-- Trial & Referral System
-- ═══════════════════════════════════════════════════════════════

-- Add trial and referral fields to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS referred_by TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS referral_count INT NOT NULL DEFAULT 0;

-- ═══════════════════════════════════════════════════════════════
-- Trigger: auto-set trial + referral code on new profile
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION set_trial_on_insert()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- Auto-set 3-day trial if not already set
  IF NEW.trial_ends_at IS NULL THEN
    NEW.trial_ends_at := NOW() + INTERVAL '3 days';
  END IF;
  -- Auto-generate referral code if not set
  IF NEW.referral_code IS NULL THEN
    NEW.referral_code := 'BV-' || upper(substr(md5(random()::text), 1, 5));
  END IF;
  RETURN NEW;
END;
$$;

-- Drop if exists to allow re-run
DROP TRIGGER IF EXISTS tr_profile_trial ON profiles;
CREATE TRIGGER tr_profile_trial
  BEFORE INSERT ON profiles
  FOR EACH ROW EXECUTE FUNCTION set_trial_on_insert();

-- ═══════════════════════════════════════════════════════════════
-- RPC: Apply referral code (atomic — updates both profiles)
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION apply_referral(
  p_new_user_id UUID,
  p_referral_code TEXT
) RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE
  v_referrer_id UUID;
  v_referrer_count INT;
BEGIN
  -- Find referrer by code
  SELECT id, referral_count INTO v_referrer_id, v_referrer_count
  FROM profiles WHERE referral_code = p_referral_code;

  IF v_referrer_id IS NULL THEN
    RETURN '{"ok": false, "error": "invalid_code"}'::jsonb;
  END IF;

  -- Prevent self-referral
  IF v_referrer_id = p_new_user_id THEN
    RETURN '{"ok": false, "error": "self_referral"}'::jsonb;
  END IF;

  -- Update new user: set referred_by, extend trial by 3 days
  UPDATE profiles
  SET referred_by = p_referral_code,
      trial_ends_at = COALESCE(trial_ends_at, NOW()) + INTERVAL '3 days'
  WHERE id = p_new_user_id AND referred_by IS NULL;

  -- Update referrer: extend trial + increment count (only if < 5)
  IF v_referrer_count < 5 THEN
    UPDATE profiles
    SET trial_ends_at = GREATEST(COALESCE(trial_ends_at, NOW()), NOW()) + INTERVAL '3 days',
        referral_count = referral_count + 1
    WHERE id = v_referrer_id;
  END IF;

  RETURN '{"ok": true}'::jsonb;
END;
$$;
