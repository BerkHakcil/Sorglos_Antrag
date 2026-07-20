-- M5 Round 2 (part 1) — Pankow office + routing, document tables, legacy drop,
-- static_content keys. (The storage bucket + policies are a separate migration
-- so a storage-schema failure surfaces alone, per the agreed stop rule.)

BEGIN;

-- ── Sozialamt Berlin-Pankow + higher-priority PLZ rules (D5, option B) ────────
-- PLZ list drafted from official Bezirk-Pankow data — PENDING ROMAN CONFIRMATION
-- (milestone log). Priority 20 outranks the city-wide Berlin rules (priority 10
-- and below); all other Berlin PLZs keep the city-wide office. The new office
-- id 11000000-… namespace: the nationwide seed already occupies 10000000-…-0001..0376
-- (a collision with Sozialamt Koblenz was caught in replay checks).
-- has no questionnaire, so resolvePlzAction's default hands these users the
-- Berlin questionnaire (CP3/D12) with status 'resolved'.
INSERT INTO public.social_office (id, name) VALUES
  ('11000000-0000-0000-0000-000000000001', 'Sozialamt Berlin-Pankow')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.postal_code_rule (id, social_office_id, plz_from, plz_to, priority)
SELECT ('b0000000-0000-0000-0000-' || lpad(row_number() OVER (ORDER BY plz)::text, 12, '0'))::uuid,
       '11000000-0000-0000-0000-000000000001', plz, plz, 20
FROM (VALUES
  ('10119'),('10405'),('10407'),('10409'),('10435'),('10437'),('10439'),
  ('13086'),('13088'),('13089'),
  ('13125'),('13127'),('13129'),
  ('13156'),('13158'),('13159'),('13187'),('13189')
) AS p(plz)
ON CONFLICT (id) DO NOTHING;

-- ── Legacy M1 placeholders: superseded, zero code references, zero rows ───────
-- Dropped BEFORE the new tables: the M1 schema already had a document_upload
-- (old shape, FK to case_document_requirement) whose name the new table reuses.
DROP TABLE IF EXISTS public.document_upload;
DROP TABLE IF EXISTS public.case_document_requirement;
DROP TABLE IF EXISTS public.document_rule;
DROP TABLE IF EXISTS public.document_type;

-- ── Document tables (Roman's model: global catalog + office-scoped rules) ─────
CREATE TABLE IF NOT EXISTS public.document_catalog (
  id             TEXT        PRIMARY KEY,          -- Roman's DOC-####
  technical_key  TEXT        NOT NULL UNIQUE,
  name_de        TEXT        NOT NULL,
  category       TEXT        NOT NULL,
  instance_basis TEXT        NOT NULL,
  active         BOOLEAN     NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.document_catalog ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "document_catalog: authenticated read" ON public.document_catalog;
CREATE POLICY "document_catalog: authenticated read"
  ON public.document_catalog FOR SELECT TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS public.office_document_rule (
  id               TEXT        PRIMARY KEY,        -- Roman's PAN-###
  social_office_id UUID        NOT NULL REFERENCES public.social_office(id) ON DELETE CASCADE,
  document_id      TEXT        NOT NULL REFERENCES public.document_catalog(id) ON DELETE CASCADE,
  requirement_type TEXT        NOT NULL CHECK (requirement_type IN ('mandatory','conditional')),
  subject          TEXT        NOT NULL CHECK (subject IN ('person_1','person_2','previous_home')),
  instance_note    TEXT,
  period_months    INTEGER,
  condition        JSONB       NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.office_document_rule ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "office_document_rule: authenticated read" ON public.office_document_rule;
CREATE POLICY "office_document_rule: authenticated read"
  ON public.office_document_rule FOR SELECT TO authenticated USING (true);

-- Upload metadata. Multiple rows per slot = multiple files per document type.
CREATE TABLE IF NOT EXISTS public.document_upload (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id           UUID        NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  rule_id           TEXT        NOT NULL REFERENCES public.office_document_rule(id),
  document_id       TEXT        NOT NULL REFERENCES public.document_catalog(id),
  subject           TEXT        NOT NULL,
  instance_key      TEXT        NOT NULL DEFAULT 'default',
  storage_path      TEXT        NOT NULL UNIQUE,
  original_filename TEXT        NOT NULL,
  mime_type         TEXT        NOT NULL,
  size_bytes        BIGINT      NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS document_upload_case_idx ON public.document_upload (case_id);
ALTER TABLE public.document_upload ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "document_upload: own case select" ON public.document_upload;
CREATE POLICY "document_upload: own case select" ON public.document_upload FOR SELECT TO authenticated
  USING (case_id IN (SELECT id FROM public.cases WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS "document_upload: own case insert" ON public.document_upload;
CREATE POLICY "document_upload: own case insert" ON public.document_upload FOR INSERT TO authenticated
  WITH CHECK (case_id IN (SELECT id FROM public.cases WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS "document_upload: own case delete" ON public.document_upload;
CREATE POLICY "document_upload: own case delete" ON public.document_upload FOR DELETE TO authenticated
  USING (case_id IN (SELECT id FROM public.cases WHERE user_id = auth.uid()));

-- ── Document-area copy (constructed German — ALL pending Roman review) ────────
INSERT INTO public.static_content (key, value_de) VALUES
  ('docs.area_title',      'Ihre Dokumente'),
  ('docs.area_intro',      'Bitte laden Sie die folgenden Unterlagen hoch. Erlaubt sind PDF, JPG, PNG und HEIC bis 15 MB pro Datei.'),
  ('docs.status_missing',  'Fehlt'),
  ('docs.status_uploaded', '{n} Datei(en) hochgeladen'),
  ('docs.upload_button',   'Datei hochladen'),
  ('docs.delete_button',   'Entfernen'),
  ('docs.error_type',      'Dieses Dateiformat wird nicht unterstützt (erlaubt: PDF, JPG, PNG, HEIC).'),
  ('docs.error_size',      'Die Datei ist größer als 15 MB.'),
  ('docs.error_generic',   'Der Upload ist fehlgeschlagen. Bitte versuchen Sie es erneut.'),
  ('docs.heading_person_1','Ihre Unterlagen'),
  ('docs.heading_person_2','Unterlagen Ihres Partners'),
  ('docs.heading_previous_home','Letzte Wohnung')
ON CONFLICT (key) DO UPDATE SET value_de = EXCLUDED.value_de, updated_at = NOW();

COMMIT;
