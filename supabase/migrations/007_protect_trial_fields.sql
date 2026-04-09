-- 007_protect_trial_fields.sql
-- Prevent client-side manipulation of trial/referral/payment fields.
-- Only service_role can modify these columns.
-- This ensures that even if RLS allows UPDATE, sensitive fields
-- cannot be changed by authenticated users directly.

CREATE OR REPLACE FUNCTION protect_trial_fields()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF current_setting('request.jwt.claims', true)::jsonb ->> 'role' != 'service_role' THEN
    NEW.trial_ends_at := OLD.trial_ends_at;
    NEW.referral_code := OLD.referral_code;
    NEW.referred_by := OLD.referred_by;
    NEW.referral_count := OLD.referral_count;
    NEW.tier := OLD.tier;
    NEW.ls_subscription_status := OLD.ls_subscription_status;
    NEW.ls_subscription_id := OLD.ls_subscription_id;
    NEW.ls_customer_id := OLD.ls_customer_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_protect_trial ON profiles;
CREATE TRIGGER tr_protect_trial
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION protect_trial_fields();
