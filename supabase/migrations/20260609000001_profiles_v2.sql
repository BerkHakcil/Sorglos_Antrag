-- ============================================================
-- Migration: 20260609000001_profiles_v2
-- Hilfe-zur-Pflege — profiles schema update, Milestone 1 follow-up
--
-- Changes:
--   1. Replace full_name with first_name + last_name + phone.
--   2. Replace boolean consent columns with GDPR audit-trail timestamps
--      (consent_agb_at, consent_data_processing_at, consent_authority_to_act_at)
--      plus a terms_version tag.
--   3. Re-create handle_new_user() to read first_name + last_name from metadata.
-- ============================================================

-- ─── 1. Column changes on profiles ────────────────────────

ALTER TABLE public.profiles
  DROP COLUMN IF EXISTS full_name,
  ADD COLUMN  first_name TEXT NOT NULL DEFAULT '',
  ADD COLUMN  last_name  TEXT NOT NULL DEFAULT '',
  ADD COLUMN  phone      TEXT;

ALTER TABLE public.profiles
  DROP COLUMN IF EXISTS consent_privacy,
  DROP COLUMN IF EXISTS consent_privacy_at,
  DROP COLUMN IF EXISTS consent_data_processing,
  DROP COLUMN IF EXISTS consent_data_processing_at,
  ADD COLUMN  consent_agb_at              TIMESTAMPTZ,
  ADD COLUMN  consent_data_processing_at  TIMESTAMPTZ,
  ADD COLUMN  consent_authority_to_act_at TIMESTAMPTZ,
  ADD COLUMN  terms_version               TEXT NOT NULL DEFAULT 'v0-draft';

-- ─── 2. Update handle_new_user() ──────────────────────────
--
-- Reads first_name + last_name instead of full_name from the metadata
-- that signupAction passes to supabase.auth.signUp({ options: { data: … } }).

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, first_name, last_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name',  '')
  );

  INSERT INTO public.cases (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;
