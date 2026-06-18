-- ============================================================
-- Migration: 20260618000001_consent_datenschutz
-- Splits the combined AGB+Datenschutz consent column into two
-- separate GDPR audit-trail timestamps.
--
-- Before: consent_agb_at covered both AGB and Datenschutz.
-- After:  consent_agb_at = AGB agreement only.
--         consent_datenschutz_at = Datenschutz acknowledgment only.
-- ============================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS consent_datenschutz_at TIMESTAMPTZ;

-- Back-fill: existing rows that already have consent_agb_at
-- are assumed to have acknowledged both — copy the timestamp.
UPDATE public.profiles
  SET consent_datenschutz_at = consent_agb_at
  WHERE consent_agb_at IS NOT NULL
    AND consent_datenschutz_at IS NULL;
