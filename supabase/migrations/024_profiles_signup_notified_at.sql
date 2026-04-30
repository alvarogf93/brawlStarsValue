-- ═══════════════════════════════════════════════════════════════
-- SEG-09 — profiles.signup_notified_at: idempotency flag for the
--          /api/notify/signup Telegram side-effect.
-- ═══════════════════════════════════════════════════════════════
--
-- The /api/notify/signup route fires a Telegram message every time it's
-- called by an authenticated user with a profile. Without an idempotency
-- flag, refreshing the signup page or replaying the request triggers a
-- new Telegram notification each time — admin chat fills with duplicates,
-- and the user's email is logged in Telegram every replay (a GDPR
-- retention concern: that data is now in a third party we can't
-- comprehensively delete from).
--
-- This column records the timestamp of the FIRST successful notify. The
-- route checks it before sending and skips if non-NULL.
--
-- Idempotent migration — uses IF NOT EXISTS. Safe to re-run.
-- ═══════════════════════════════════════════════════════════════

BEGIN;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS signup_notified_at TIMESTAMPTZ;

COMMENT ON COLUMN public.profiles.signup_notified_at IS
  'When the admin Telegram signup notification was successfully sent. '
  'NULL means it has not fired yet — the /api/notify/signup route uses '
  'this for idempotency so refreshing the signup page does not double-notify.';

COMMIT;
