-- Feedback pass item 3 — configurable default document-rule office.
-- Founder decision: collect documents from everyone immediately; a case whose
-- resolved office has zero document rules uses the DEFAULT office's rules.
-- Default = Sozialamt Berlin-Pankow until Roman's Essen rule seed lands
-- (then: one UPDATE on this row flips the default).

BEGIN;

CREATE TABLE IF NOT EXISTS public.app_config (
  key        TEXT        PRIMARY KEY,
  value      JSONB       NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE public.app_config IS
  'Single-row app configuration entries, changed by migration only.';

ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "app_config: authenticated read" ON public.app_config;
CREATE POLICY "app_config: authenticated read"
  ON public.app_config FOR SELECT TO authenticated USING (true);

INSERT INTO public.app_config (key, value) VALUES
  ('default_document_office_id', '"11000000-0000-0000-0000-000000000001"'::jsonb)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();

COMMIT;
