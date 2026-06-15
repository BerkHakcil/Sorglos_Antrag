-- ============================================================
-- supabase/setup.sql
-- ONE-SHOT SETUP for the Hilfe-zur-Pflege Supabase project.
--
-- Paste the entire contents of this file into:
--   Supabase Dashboard → SQL Editor → New query → Run (Ctrl+Enter)
--
-- This is migration 1 + migration 2 + migration 3 (profiles_v2) + seed combined.
-- Safe to run on a fresh project only. If you need to start over,
-- use the Supabase Dashboard → Project Settings → "Reset database"
-- (Danger Zone) and then run this file again.
-- ============================================================


-- ════════════════════════════════════════════════════════════
-- PART 1 — SCHEMA  (migration 20260607000001_initial_schema)
-- ════════════════════════════════════════════════════════════

-- ─── Extensions ───────────────────────────────────────────
-- gen_random_uuid() is built into Postgres 13+; no extension needed.

-- ─── Enums ────────────────────────────────────────────────

CREATE TYPE public.user_role AS ENUM ('user', 'admin');

CREATE TYPE public.answer_type AS ENUM (
  'short_text',
  'long_text',
  'number',
  'amount',
  'date',
  'yes_no',
  'single_select',
  'multi_select',
  'address',
  'person',
  'bank_account',
  'document_upload'
);

CREATE TYPE public.plz_resolution_status AS ENUM (
  'resolved',
  'unclear',
  'unsupported'
);

CREATE TYPE public.case_status AS ENUM (
  'in_progress',
  'under_review'
);

CREATE TYPE public.document_requirement_status AS ENUM (
  'please_upload',
  'in_review',
  'checked',
  'resubmit'
);

-- ─── Shared trigger: set updated_at on any UPDATE ─────────

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- ─── Config tables ────────────────────────────────────────

CREATE TABLE public.care_home (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT        NOT NULL,
  address    TEXT,
  is_active  BOOLEAN     NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.social_office (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT        NOT NULL,
  address       TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  is_active     BOOLEAN     NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.postal_code_rule (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  social_office_id UUID        NOT NULL REFERENCES public.social_office(id),
  plz_from         TEXT        NOT NULL CHECK (plz_from ~ '^\d{5}$'),
  plz_to           TEXT        NOT NULL CHECK (plz_to   ~ '^\d{5}$'),
  priority         INTEGER     NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT plz_range_valid CHECK (plz_from <= plz_to)
);

CREATE TABLE public.questionnaire (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  social_office_id UUID        REFERENCES public.social_office(id),
  name             TEXT        NOT NULL,
  version          INTEGER     NOT NULL DEFAULT 1,
  is_active        BOOLEAN     NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.category (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  questionnaire_id UUID        NOT NULL REFERENCES public.questionnaire(id) ON DELETE CASCADE,
  key              TEXT        NOT NULL,
  sort_order       INTEGER     NOT NULL DEFAULT 0,
  label_de         TEXT        NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (questionnaire_id, key)
);

CREATE TABLE public.question_group (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id   UUID        NOT NULL REFERENCES public.category(id) ON DELETE CASCADE,
  key           TEXT        NOT NULL,
  sort_order    INTEGER     NOT NULL DEFAULT 0,
  label_de      TEXT        NOT NULL,
  is_repeatable BOOLEAN     NOT NULL DEFAULT false,
  min_count     INTEGER     NOT NULL DEFAULT 0,
  max_count     INTEGER,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.question (
  id              UUID               PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id     UUID               NOT NULL REFERENCES public.category(id) ON DELETE CASCADE,
  group_id        UUID               REFERENCES public.question_group(id) ON DELETE SET NULL,
  key             TEXT               NOT NULL,
  sort_order      INTEGER            NOT NULL DEFAULT 0,
  answer_type     public.answer_type NOT NULL,
  is_required     BOOLEAN            NOT NULL DEFAULT true,
  prompt_de       TEXT               NOT NULL,
  help_de         TEXT,
  validation      JSONB,
  visibility_rule JSONB,
  created_at      TIMESTAMPTZ        NOT NULL DEFAULT NOW()
);

CREATE TABLE public.question_option (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID        NOT NULL REFERENCES public.question(id) ON DELETE CASCADE,
  key         TEXT        NOT NULL,
  sort_order  INTEGER     NOT NULL DEFAULT 0,
  label_de    TEXT        NOT NULL,
  value       TEXT        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (question_id, key)
);

CREATE TABLE public.document_type (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  key            TEXT        NOT NULL UNIQUE,
  label_de       TEXT        NOT NULL,
  description_de TEXT,
  is_base        BOOLEAN     NOT NULL DEFAULT false,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.document_rule (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  questionnaire_id     UUID        REFERENCES public.questionnaire(id),
  document_type_id     UUID        NOT NULL REFERENCES public.document_type(id),
  condition            JSONB,
  repeat_per_group_key TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Runtime tables ───────────────────────────────────────

CREATE TABLE public.profiles (
  id                         UUID               PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name                  TEXT               NOT NULL DEFAULT '',
  consent_privacy            BOOLEAN            NOT NULL DEFAULT false,
  consent_privacy_at         TIMESTAMPTZ,
  consent_data_processing    BOOLEAN            NOT NULL DEFAULT false,
  consent_data_processing_at TIMESTAMPTZ,
  role                       public.user_role   NOT NULL DEFAULT 'user',
  created_at                 TIMESTAMPTZ        NOT NULL DEFAULT NOW(),
  updated_at                 TIMESTAMPTZ        NOT NULL DEFAULT NOW()
);

CREATE TRIGGER profiles_set_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.cases (
  id                    UUID                         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID                         NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  care_home_id          UUID                         REFERENCES public.care_home(id),
  social_office_id      UUID                         REFERENCES public.social_office(id),
  questionnaire_id      UUID                         REFERENCES public.questionnaire(id),
  plz_before_move       TEXT,
  plz_resolution_status public.plz_resolution_status NOT NULL DEFAULT 'unclear',
  status                public.case_status           NOT NULL DEFAULT 'in_progress',
  created_at            TIMESTAMPTZ                  NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ                  NOT NULL DEFAULT NOW()
);

CREATE TRIGGER cases_set_updated_at
  BEFORE UPDATE ON public.cases
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.answer (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id        UUID        NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  question_id    UUID        NOT NULL REFERENCES public.question(id) ON DELETE CASCADE,
  group_instance TEXT        NOT NULL DEFAULT 'default',
  value          JSONB,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (case_id, question_id, group_instance)
);

CREATE TRIGGER answer_set_updated_at
  BEFORE UPDATE ON public.answer
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.case_document_requirement (
  id               UUID                               PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id          UUID                               NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  document_type_id UUID                               NOT NULL REFERENCES public.document_type(id),
  source_rule_id   UUID                               REFERENCES public.document_rule(id),
  repeat_ref       TEXT,
  label_de         TEXT                               NOT NULL,
  status           public.document_requirement_status NOT NULL DEFAULT 'please_upload',
  is_active        BOOLEAN                            NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ                        NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ                        NOT NULL DEFAULT NOW()
);

CREATE TRIGGER case_document_requirement_set_updated_at
  BEFORE UPDATE ON public.case_document_requirement
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.document_upload (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  requirement_id    UUID        NOT NULL REFERENCES public.case_document_requirement(id) ON DELETE CASCADE,
  storage_path      TEXT        NOT NULL,
  original_filename TEXT        NOT NULL,
  content_type      TEXT        NOT NULL CHECK (content_type IN ('application/pdf','image/jpeg','image/png','image/heic','image/heif')),
  size_bytes        BIGINT      NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 15728640),
  uploaded_by       UUID        NOT NULL REFERENCES auth.users(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.status_event (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id    UUID        NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  event_type TEXT        NOT NULL,
  payload    JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── New-user trigger ─────────────────────────────────────

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );

  INSERT INTO public.cases (user_id)
  VALUES (NEW.id);

  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ─── Indexes ──────────────────────────────────────────────

CREATE INDEX idx_cases_user_id          ON public.cases (user_id);
CREATE INDEX idx_answer_case_id         ON public.answer (case_id);
CREATE INDEX idx_answer_question_instance ON public.answer (case_id, question_id, group_instance);
CREATE INDEX idx_postal_code_rule_plz   ON public.postal_code_rule (plz_from, plz_to, priority DESC);
CREATE INDEX idx_category_questionnaire_id ON public.category (questionnaire_id, sort_order);
CREATE INDEX idx_question_group_category_id ON public.question_group (category_id, sort_order);
CREATE INDEX idx_question_category_id   ON public.question (category_id, sort_order);
CREATE INDEX idx_case_doc_req_case_id   ON public.case_document_requirement (case_id);
CREATE INDEX idx_status_event_case_created ON public.status_event (case_id, created_at);


-- ════════════════════════════════════════════════════════════
-- PART 2 — RLS POLICIES  (migration 20260607000002_rls_policies)
-- ════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
$$;

ALTER TABLE public.care_home                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_office             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.postal_code_rule          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questionnaire             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.category                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_group            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_option           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_type             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_rule             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cases                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.answer                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_document_requirement ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_upload           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.status_event              ENABLE ROW LEVEL SECURITY;

CREATE POLICY "care_home: authenticated read active"         ON public.care_home         FOR SELECT TO authenticated USING (is_active = true);
CREATE POLICY "social_office: authenticated read active"     ON public.social_office      FOR SELECT TO authenticated USING (is_active = true);
CREATE POLICY "postal_code_rule: authenticated read"         ON public.postal_code_rule   FOR SELECT TO authenticated USING (true);
CREATE POLICY "questionnaire: authenticated read active"     ON public.questionnaire      FOR SELECT TO authenticated USING (is_active = true);
CREATE POLICY "category: authenticated read"                 ON public.category           FOR SELECT TO authenticated USING (true);
CREATE POLICY "question_group: authenticated read"           ON public.question_group     FOR SELECT TO authenticated USING (true);
CREATE POLICY "question: authenticated read"                 ON public.question           FOR SELECT TO authenticated USING (true);
CREATE POLICY "question_option: authenticated read"          ON public.question_option    FOR SELECT TO authenticated USING (true);
CREATE POLICY "document_type: authenticated read"            ON public.document_type      FOR SELECT TO authenticated USING (true);
CREATE POLICY "document_rule: authenticated read"            ON public.document_rule      FOR SELECT TO authenticated USING (true);

CREATE POLICY "profiles: user reads own"   ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles: admin reads all"  ON public.profiles FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "profiles: user updates own" ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id AND role = (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid()));

CREATE POLICY "cases: user reads own"  ON public.cases FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "cases: admin reads all" ON public.cases FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "cases: user updates own" ON public.cases FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "answer: user reads own"   ON public.answer FOR SELECT TO authenticated USING (case_id = (SELECT id FROM public.cases WHERE user_id = auth.uid()));
CREATE POLICY "answer: admin reads all"  ON public.answer FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "answer: user inserts own" ON public.answer FOR INSERT TO authenticated WITH CHECK (case_id = (SELECT id FROM public.cases WHERE user_id = auth.uid()));
CREATE POLICY "answer: user updates own" ON public.answer FOR UPDATE TO authenticated
  USING  (case_id = (SELECT id FROM public.cases WHERE user_id = auth.uid()))
  WITH CHECK (case_id = (SELECT id FROM public.cases WHERE user_id = auth.uid()));
CREATE POLICY "answer: user deletes own" ON public.answer FOR DELETE TO authenticated USING (case_id = (SELECT id FROM public.cases WHERE user_id = auth.uid()));

CREATE POLICY "case_document_requirement: user reads own"  ON public.case_document_requirement FOR SELECT TO authenticated USING (case_id = (SELECT id FROM public.cases WHERE user_id = auth.uid()));
CREATE POLICY "case_document_requirement: admin reads all" ON public.case_document_requirement FOR SELECT TO authenticated USING (public.is_admin());

CREATE POLICY "document_upload: user reads own" ON public.document_upload FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.case_document_requirement cdr JOIN public.cases c ON c.id = cdr.case_id WHERE cdr.id = document_upload.requirement_id AND c.user_id = auth.uid()));
CREATE POLICY "document_upload: admin reads all" ON public.document_upload FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "document_upload: user inserts own" ON public.document_upload FOR INSERT TO authenticated
  WITH CHECK (uploaded_by = auth.uid() AND EXISTS (SELECT 1 FROM public.case_document_requirement cdr JOIN public.cases c ON c.id = cdr.case_id WHERE cdr.id = requirement_id AND c.user_id = auth.uid()));

CREATE POLICY "status_event: user reads own"  ON public.status_event FOR SELECT TO authenticated USING (case_id = (SELECT id FROM public.cases WHERE user_id = auth.uid()));
CREATE POLICY "status_event: admin reads all" ON public.status_event FOR SELECT TO authenticated USING (public.is_admin());


-- ════════════════════════════════════════════════════════════
-- PART 3 — SEED DATA  (supabase/seed.sql)
-- ════════════════════════════════════════════════════════════

INSERT INTO public.social_office (id, name, address, contact_email, contact_phone) VALUES
  ('10000000-0000-0000-0000-000000000001', 'Sozialamt Frankfurt am Main',            'Kurt-Schumacher-Straße 10, 60311 Frankfurt am Main', 'sozialamt@frankfurt.de',    '069 212-0'),
  ('10000000-0000-0000-0000-000000000002', 'Sozialamt der Landeshauptstadt München', 'Prielmayerstraße 8, 80335 München',                  'sozialreferat@muenchen.de', '089 233-0')
ON CONFLICT DO NOTHING;

INSERT INTO public.care_home (id, name, address) VALUES
  ('20000000-0000-0000-0000-000000000001', 'Seniorenheim St. Josef',      'Bergstraße 12, 60318 Frankfurt am Main'),
  ('20000000-0000-0000-0000-000000000002', 'AWO Pflegeheim Sonnenschein', 'Hansaallee 150, 60320 Frankfurt am Main'),
  ('20000000-0000-0000-0000-000000000003', 'Altenheim am Stadtpark',      'Liebigstraße 45, 60323 Frankfurt am Main'),
  ('20000000-0000-0000-0000-000000000004', 'Residenz Westend',            'Beethovenstraße 66, 60325 Frankfurt am Main'),
  ('20000000-0000-0000-0000-000000000005', 'Pflegezentrum Bornheim',      'Berger Straße 231, 60385 Frankfurt am Main'),
  ('20000000-0000-0000-0000-000000000006', 'Haus Sachsenhausen',          'Schweizer Straße 20, 60594 Frankfurt am Main'),
  ('20000000-0000-0000-0000-000000000007', 'Seniorenzentrum Nordend',     'Adalbertstraße 3, 60486 Frankfurt am Main')
ON CONFLICT DO NOTHING;

INSERT INTO public.postal_code_rule (id, social_office_id, plz_from, plz_to, priority) VALUES
  ('a0000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '60001', '60699', 10),
  ('a0000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', '80001', '81999', 10)
ON CONFLICT DO NOTHING;

INSERT INTO public.questionnaire (id, social_office_id, name, version) VALUES
  ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Fragebogen – Sozialamt Frankfurt am Main', 1),
  ('30000000-0000-0000-0000-000000000002', NULL,                                   'Allgemeiner Fragebogen (Fallback)',          1)
ON CONFLICT DO NOTHING;

INSERT INTO public.category (id, questionnaire_id, key, sort_order, label_de) VALUES
  ('40000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'antragsteller', 0, 'Angaben zur pflegebedürftigen Person'),
  ('40000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000001', 'einkommen',     1, 'Einnahmen und Rente'),
  ('40000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000001', 'dokumente',     2, 'Erforderliche Dokumente')
ON CONFLICT DO NOTHING;

INSERT INTO public.question (id, category_id, group_id, key, sort_order, answer_type, is_required, prompt_de, help_de, validation, visibility_rule) VALUES
  ('60000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', NULL, 'name_pflegebedueftiger',  0, 'short_text',     true, 'Vollständiger Name der pflegebedürftigen Person',    'Bitte geben Sie Vor- und Nachname an.', NULL, NULL),
  ('60000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000001', NULL, 'geburtsdatum',           1, 'date',           true, 'Geburtsdatum der pflegebedürftigen Person',          NULL, NULL, NULL),
  ('60000000-0000-0000-0000-000000000003', '40000000-0000-0000-0000-000000000002', NULL, 'familienstand',          0, 'single_select',  true, 'Familienstand der pflegebedürftigen Person',         NULL, NULL, NULL),
  ('60000000-0000-0000-0000-000000000004', '40000000-0000-0000-0000-000000000002', NULL, 'hat_rente',              1, 'yes_no',         true, 'Erhält die pflegebedürftige Person Rente?',         NULL, NULL, NULL),
  ('60000000-0000-0000-0000-000000000005', '40000000-0000-0000-0000-000000000002', NULL, 'rentenbetrag',           2, 'amount',         true, 'Monatlicher Rentenbetrag (€)',                       'Bitte geben Sie den Bruttobetrag aus dem aktuellen Rentenbescheid an.', '{"min": 0, "max": 99999}'::jsonb, '{"question_key": "hat_rente", "value": true}'::jsonb),
  ('60000000-0000-0000-0000-000000000006', '40000000-0000-0000-0000-000000000003', NULL, 'personalausweis_upload', 0, 'document_upload',true, 'Personalausweis oder Reisepass',                    'Bitte laden Sie ein gültiges Ausweisdokument hoch (PDF, JPG oder PNG, max. 15 MB).', NULL, NULL)
ON CONFLICT DO NOTHING;

INSERT INTO public.question_option (id, question_id, key, sort_order, label_de, value) VALUES
  ('70000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000003', 'ledig',       0, 'Ledig',       'ledig'),
  ('70000000-0000-0000-0000-000000000002', '60000000-0000-0000-0000-000000000003', 'verheiratet', 1, 'Verheiratet', 'verheiratet'),
  ('70000000-0000-0000-0000-000000000003', '60000000-0000-0000-0000-000000000003', 'verwitwet',   2, 'Verwitwet',   'verwitwet'),
  ('70000000-0000-0000-0000-000000000004', '60000000-0000-0000-0000-000000000003', 'geschieden',  3, 'Geschieden',  'geschieden')
ON CONFLICT DO NOTHING;

INSERT INTO public.document_type (id, key, label_de, description_de, is_base) VALUES
  ('80000000-0000-0000-0000-000000000001', 'personalausweis', 'Personalausweis oder Reisepass', 'Gültiges Ausweisdokument der pflegebedürftigen Person.', true),
  ('80000000-0000-0000-0000-000000000002', 'rentenbescheid',  'Rentenbescheid',                 'Aktueller Rentenbescheid (nicht älter als 12 Monate).',  false)
ON CONFLICT DO NOTHING;

INSERT INTO public.document_rule (id, questionnaire_id, document_type_id, condition, repeat_per_group_key) VALUES
  ('90000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000001', NULL, NULL),
  ('90000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000002', '{"question_key": "hat_rente", "value": true}'::jsonb, NULL)
ON CONFLICT DO NOTHING;


-- ════════════════════════════════════════════════════════════
-- PART 4 — MIGRATION 3: profiles_v2
--           (supabase/migrations/20260609000001_profiles_v2.sql)
-- ════════════════════════════════════════════════════════════

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


-- ════════════════════════════════════════════════════════════

-- ════════════════════════════════════════════════════════════
-- PART 5 — SEED DATA  (supabase/seed.sql, Milestone 2)
-- Real Berlin questionnaire + 7 care homes + 190 Berlin PLZ rules.
-- Generated from Excel source files via scripts/generate_berlin_seed.py
-- ════════════════════════════════════════════════════════════

-- ============================================================
-- supabase/seed.sql
-- Hilfe-zur-Pflege — reproducible config seed, Milestone 2
--
-- Source files:
--   seed-care homes.xlsx  (7 partner care homes)
--   Question Master_Berlin.xlsx → Berlin_HzP sheet
--   plz_de.xlsx → deutschland_plz_sozialamt_named sheet (Berlin only)
--
-- Run automatically by:  supabase db reset  /  supabase start
-- ============================================================

-- ─── Clear old seed data (safe order: children first) ──────
DELETE FROM public.document_rule;
DELETE FROM public.document_type;
DELETE FROM public.question_option;
DELETE FROM public.question;
DELETE FROM public.question_group;
DELETE FROM public.category;
DELETE FROM public.questionnaire;
DELETE FROM public.postal_code_rule;
DELETE FROM public.care_home;
DELETE FROM public.social_office;

-- ─── Social office ──────────────────────────────────────────
-- One canonical entry for Berlin; PLZ routing resolves to this office.
-- Per-borough detail (Bezirksamt) can be added when per-borough forms are ready.
INSERT INTO public.social_office (id, name, address, contact_email, contact_phone) VALUES
  ('10000000-0000-0000-0000-000000000001', 'Sozialamt Berlin',
   'Bezirksämter Berlin – Amt für Soziales',
   'buergerbuero@sozialamt.berlin.de', '030 115')
ON CONFLICT DO NOTHING;

-- ─── Care homes (7 partner homes) ──────────────────────────
INSERT INTO public.care_home (id, name, address) VALUES
  ('20000000-0000-0000-0000-000000000001', 'Seniorenresidenz Haus Pankow', 'Schulzestraße 10, 13187 Berlin'),
  ('20000000-0000-0000-0000-000000000002', 'Seniorenzentrum Altenessen', 'Altenessenerstraße 170, 45326 Essen'),
  ('20000000-0000-0000-0000-000000000003', 'Seniorenzentrum Brauck', 'Brauckstraße 52, 45968 Gladbeck'),
  ('20000000-0000-0000-0000-000000000004', 'Seniorenzentrum Brauck 2', 'Brauckstraße 54, 45968 Gladbeck'),
  ('20000000-0000-0000-0000-000000000005', 'Seniorenzentrum Homberg', 'Zechenstraße 50, 47198 Duisburg'),
  ('20000000-0000-0000-0000-000000000006', 'Seniorenzentrum Feldstraße', 'Feldstraße 17, 47198 Duisburg'),
  ('20000000-0000-0000-0000-000000000007', 'K&S Seniorenresidenz Stade', 'Am Hinterdeich 4, 21680 Stade')
ON CONFLICT DO NOTHING;

-- ─── Questionnaires ─────────────────────────────────────────
INSERT INTO public.questionnaire (id, social_office_id, name, version) VALUES
  ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Fragebogen – Sozialamt Berlin', 1),
  ('30000000-0000-0000-0000-000000000002', NULL,         'Allgemeiner Fragebogen (Fallback)', 1)
ON CONFLICT DO NOTHING;

-- ─── Categories ─────────────────────────────────────────────
INSERT INTO public.category (id, questionnaire_id, key, sort_order, label_de) VALUES
  ('40000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'personal', 0, 'Persönliche Angaben'),
  ('40000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000001', 'home', 1, 'Wohnverhältnisse'),
  ('40000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000001', 'children', 2, 'Kinder'),
  ('40000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000001', 'income', 3, 'Einkünfte'),
  ('40000000-0000-0000-0000-000000000005', '30000000-0000-0000-0000-000000000001', 'expenditure', 4, 'Ausgaben'),
  ('40000000-0000-0000-0000-000000000006', '30000000-0000-0000-0000-000000000001', 'wealth', 5, 'Vermögen'),
  ('40000000-0000-0000-0000-000000000007', '30000000-0000-0000-0000-000000000001', 'additional', 6, 'Weitere Angaben'),
  ('40000000-0000-0000-0000-000000000008', '30000000-0000-0000-0000-000000000001', 'spouse', 7, 'Ehepartner / Lebenspartner')
ON CONFLICT DO NOTHING;

-- ─── Question groups (repeatable) ──────────────────────────
INSERT INTO public.question_group
  (id, category_id, key, sort_order, label_de, is_repeatable, min_count, max_count)
VALUES
  ('50000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000003', 'children', 0, 'Kinder', true, 0, NULL),
  ('50000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000004', 'pension', 0, 'Rente / Pension', true, 0, NULL),
  ('50000000-0000-0000-0000-000000000003', '40000000-0000-0000-0000-000000000004', 'other_income', 1, 'Sonstige Einkünfte', true, 0, NULL),
  ('50000000-0000-0000-0000-000000000004', '40000000-0000-0000-0000-000000000006', 'bank_additional', 0, 'Weitere Bankkonten', true, 0, NULL),
  ('50000000-0000-0000-0000-000000000005', '40000000-0000-0000-0000-000000000008', 'spouse_pension', 0, 'Rente / Pension des Ehepartners', true, 0, NULL),
  ('50000000-0000-0000-0000-000000000006', '40000000-0000-0000-0000-000000000008', 'spouse_other_income', 1, 'Sonstige Einkünfte des Ehepartners', true, 0, NULL)
ON CONFLICT DO NOTHING;

-- ─── Questions ──────────────────────────────────────────────
-- Prompts are all about the PATIENT (care-home resident), not the caregiver.
-- No question IDs or per-office logic appear in UI components.
INSERT INTO public.question
  (id, category_id, group_id, key, sort_order, answer_type,
   is_required, prompt_de, help_de, validation, visibility_rule)
VALUES
  ('60000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000001', NULL,
   'last_name', 0, 'short_text', true,
   'Wie lautet Ihr Nachname?', NULL, NULL, NULL),
  ('60000000-0000-0000-0000-000000000003', '40000000-0000-0000-0000-000000000001', NULL,
   'birth_name', 1, 'short_text', true,
   'Wie lautet Ihr Geburtsname?', NULL, NULL, NULL),
  ('60000000-0000-0000-0000-000000000004', '40000000-0000-0000-0000-000000000001', NULL,
   'first_name', 2, 'short_text', true,
   'Wie lautet Ihr Vorname?', NULL, NULL, NULL),
  ('60000000-0000-0000-0000-000000000005', '40000000-0000-0000-0000-000000000001', NULL,
   'birthdate', 3, 'date', true,
   'Wann wurden Sie geboren?', NULL, NULL, NULL),
  ('60000000-0000-0000-0000-000000000006', '40000000-0000-0000-0000-000000000001', NULL,
   'city_of_birth', 4, 'short_text', true,
   'In welcher Stadt wurden Sie geboren?', NULL, NULL, NULL),
  ('60000000-0000-0000-0000-000000000007', '40000000-0000-0000-0000-000000000001', NULL,
   'district_of_birth', 5, 'short_text', true,
   'In welchem Kreis/Bezirk wurden Sie geboren?', NULL, NULL, NULL),
  ('60000000-0000-0000-0000-000000000008', '40000000-0000-0000-0000-000000000001', NULL,
   'country_of_birth', 6, 'short_text', true,
   'In welchem Land wurden Sie geboren?', NULL, NULL, NULL),
  ('60000000-0000-0000-0000-000000000009', '40000000-0000-0000-0000-000000000001', NULL,
   'gender', 7, 'single_select', true,
   'Was ist Ihr Geschlecht?', NULL, NULL, NULL),
  ('60000000-0000-0000-0000-00000000000a', '40000000-0000-0000-0000-000000000001', NULL,
   'marital_status', 8, 'single_select', true,
   'Was ist Ihr Familienstand?', NULL, NULL, NULL),
  ('60000000-0000-0000-0000-00000000000b', '40000000-0000-0000-0000-000000000001', NULL,
   'marital_status_since', 9, 'date', true,
   'Seit wann ist dies Ihr Familienstand?', NULL, NULL, NULL),
  ('60000000-0000-0000-0000-00000000000c', '40000000-0000-0000-0000-000000000001', NULL,
   'citizenship', 10, 'short_text', true,
   'Was ist Ihre Staatsangehörigkeit?', NULL, NULL, NULL),
  ('60000000-0000-0000-0000-00000000000d', '40000000-0000-0000-0000-000000000001', NULL,
   'issuer_of_id', 11, 'short_text', true,
   'Welche Behörde hat Ihr Personaldokument ausgestellt?', NULL, NULL, NULL),
  ('60000000-0000-0000-0000-00000000000e', '40000000-0000-0000-0000-000000000001', NULL,
   'id_expiry_date', 12, 'date', true,
   'Bis wann ist Ihr Personaldokument gültig?', NULL, NULL, NULL),
  ('60000000-0000-0000-0000-00000000000f', '40000000-0000-0000-0000-000000000001', NULL,
   'prior_social_aid', 13, 'single_select', true,
   'Haben Sie bereits Hilfe zur Pflege Leistungen erhalten?', NULL, NULL, NULL),
  ('60000000-0000-0000-0000-000000000010', '40000000-0000-0000-0000-000000000001', NULL,
   'prior_social_aid_until', 14, 'date', true,
   'Bis wann haben Sie Hilfe zur Pflege erhalten?', NULL, NULL, '{"question_key": "prior_social_aid", "value": "Ja"}'::jsonb),
  ('60000000-0000-0000-0000-000000000011', '40000000-0000-0000-0000-000000000001', NULL,
   'prior_social_aid_issuer', 15, 'short_text', true,
   'Welche Behörde hat die Hilfe zur Pflege genehmigt?', NULL, NULL, '{"question_key": "prior_social_aid", "value": "Ja"}'::jsonb),
  ('60000000-0000-0000-0000-000000000012', '40000000-0000-0000-0000-000000000001', NULL,
   'prior_social_aid_reference_id', 16, 'short_text', true,
   'Was ist das Geschäftszeichen der Genehmigung?', NULL, NULL, '{"question_key": "prior_social_aid", "value": "Ja"}'::jsonb),
  ('60000000-0000-0000-0000-000000000013', '40000000-0000-0000-0000-000000000001', NULL,
   'power_of_attorney', 17, 'single_select', true,
   'Gibt es einen Betreuer oder Beistand?', NULL, NULL, NULL),
  ('60000000-0000-0000-0000-000000000014', '40000000-0000-0000-0000-000000000001', NULL,
   'special_origin_rights', 18, 'single_select', true,
   'Liegt ein Sonderstatus vor?', NULL, NULL, NULL),
  ('60000000-0000-0000-0000-000000000015', '40000000-0000-0000-0000-000000000001', NULL,
   'special_origin_rights_issued', 19, 'date', true,
   'Wann wurde der Sonderstatus ausgestellt?', NULL, NULL, '{"question_key": "special_origin_rights", "not_value": "Nein"}'::jsonb),
  ('60000000-0000-0000-0000-000000000016', '40000000-0000-0000-0000-000000000001', NULL,
   'special_origin_rights_issued_by', 20, 'short_text', true,
   'Welche Behörde hat den Sonderstatus ausgestellt?', NULL, NULL, '{"question_key": "special_origin_rights", "not_value": "Nein"}'::jsonb),
  ('60000000-0000-0000-0000-000000000017', '40000000-0000-0000-0000-000000000001', NULL,
   'disability_card', 21, 'single_select', true,
   'Liegt ein Schwerbehindertenausweis vor?', NULL, NULL, NULL),
  ('60000000-0000-0000-0000-000000000018', '40000000-0000-0000-0000-000000000001', NULL,
   'disablity_card_application', 22, 'single_select', true,
   'Wurde ein Antrag auf Schwerbehinderung gestellt?', NULL, NULL, '{"question_key": "disability_card", "value": "Nein"}'::jsonb),
  ('60000000-0000-0000-0000-000000000019', '40000000-0000-0000-0000-000000000001', NULL,
   'disability_card_expiry', 23, 'date', true,
   'Bis wann ist der Schwerbehindertenausweis gültig?', NULL, NULL, '{"question_key": "disability_card", "value": "Ja"}'::jsonb),
  ('60000000-0000-0000-0000-00000000001a', '40000000-0000-0000-0000-000000000001', NULL,
   'disability_card_markers', 24, 'multi_select', true,
   'Welche Merkzeichen hat der Schwerbehindertenausweis?', NULL, NULL, '{"question_key": "disability_card", "value": "Ja"}'::jsonb),
  ('60000000-0000-0000-0000-00000000001b', '40000000-0000-0000-0000-000000000001', NULL,
   'health_insurance', 25, 'short_text', true,
   'Bei welcher Krankenkasse sind Sie versichert?', NULL, NULL, NULL),
  ('60000000-0000-0000-0000-00000000001c', '40000000-0000-0000-0000-000000000001', NULL,
   'health_insurance_type', 26, 'single_select', true,
   'Wie sind Sie krankenversichert?', NULL, NULL, NULL),
  ('60000000-0000-0000-0000-00000000001d', '40000000-0000-0000-0000-000000000001', NULL,
   'care_level', 27, 'single_select', true,
   'Was ist Ihre Pflegestufe?', NULL, NULL, NULL),
  ('60000000-0000-0000-0000-00000000001e', '40000000-0000-0000-0000-000000000002', NULL,
   'in_facility_since', 0, 'date', true,
   'Wann fand/findet der Einzug in die Pflegeeinrichtung statt?', NULL, NULL, NULL),
  ('60000000-0000-0000-0000-00000000001f', '40000000-0000-0000-0000-000000000001', NULL,
   'prior_social_service_applications', 28, 'single_select', true,
   'Haben Sie weitere Sozialleistungen beantragt?', NULL, NULL, NULL),
  ('60000000-0000-0000-0000-000000000023', '40000000-0000-0000-0000-000000000002', NULL,
   'last_residence_street', 1, 'short_text', true,
   'Was ist die Straße und Hausnummer Ihrer letzten Wohnung?', NULL, NULL, NULL),
  ('60000000-0000-0000-0000-000000000024', '40000000-0000-0000-0000-000000000002', NULL,
   'last_residence_city', 2, 'short_text', true,
   'In welcher Stadt haben Sie vor Heimaufnahme gewohnt?', NULL, NULL, NULL),
  ('60000000-0000-0000-0000-000000000025', '40000000-0000-0000-0000-000000000002', NULL,
   'last_residence_plz', 3, 'short_text', true,
   'Was ist die Postleitzahl Ihres letzten Wohnortes?', NULL, NULL, NULL),
  ('60000000-0000-0000-0000-000000000026', '40000000-0000-0000-0000-000000000002', NULL,
   'berlin_since', 4, 'short_text', true,
   'Seit wann leben Sie in Berlin?', NULL, NULL, NULL),
  ('60000000-0000-0000-0000-000000000027', '40000000-0000-0000-0000-000000000002', NULL,
   'berlin_district_since', 5, 'short_text', true,
   'Seit wann leben Sie im Bezirk?', NULL, NULL, NULL),
  ('60000000-0000-0000-0000-000000000028', '40000000-0000-0000-0000-000000000002', NULL,
   'apartment_ownership', 6, 'single_select', true,
   'Was war das Mietverhältnis vor Heimeinzug?', NULL, NULL, NULL),
  ('60000000-0000-0000-0000-000000000029', '40000000-0000-0000-0000-000000000002', NULL,
   'landlord_name_and_address', 7, 'short_text', true,
   'Name und Anschrift Ihres Vermieters?', NULL, NULL, '{"question_key": "apartment_ownership", "value": "Mietwohnung"}'::jsonb),
  ('60000000-0000-0000-0000-00000000002a', '40000000-0000-0000-0000-000000000002', NULL,
   'rent_total', 8, 'amount', true,
   'Wie viel monatliche Miete zahlen Sie?', NULL, NULL, '{"question_key": "apartment_ownership", "value": "Mietwohnung"}'::jsonb),
  ('60000000-0000-0000-0000-00000000002b', '40000000-0000-0000-0000-000000000002', NULL,
   'rent_heating', 9, 'amount', true,
   'Wie hoch ist der Heizkostenvorschuss pro Monat?', NULL, NULL, NULL),
  ('60000000-0000-0000-0000-00000000002c', '40000000-0000-0000-0000-000000000002', NULL,
   'rent_warm_water', 10, 'amount', true,
   'Wie hoch sind Warmwasserkosten pro Monat?', NULL, NULL, NULL),
  ('60000000-0000-0000-0000-00000000002d', '40000000-0000-0000-0000-000000000002', NULL,
   'rent_paid_until', 11, 'date', true,
   'Bis wann ist die Miete bereits gezahlt?', NULL, NULL, '{"question_key": "apartment_ownership", "value": "Mietwohnung"}'::jsonb),
  ('60000000-0000-0000-0000-00000000002e', '40000000-0000-0000-0000-000000000002', NULL,
   'rent_debt', 12, 'amount', true,
   'Wie hoch sind mögliche Mietrückstände?', NULL, NULL, '{"question_key": "apartment_ownership", "value": "Mietwohnung"}'::jsonb),
  ('60000000-0000-0000-0000-00000000002f', '40000000-0000-0000-0000-000000000002', NULL,
   'rent_contract_termination_yes_no', 13, 'single_select', true,
   'Werden Sie Ihren Mietvertrag kündigen?', NULL, NULL, '{"question_key": "apartment_ownership", "value": "Mietwohnung"}'::jsonb),
  ('60000000-0000-0000-0000-000000000030', '40000000-0000-0000-0000-000000000002', NULL,
   'rent_contract_terminated_by', 14, 'date', true,
   'Zu welchem Datum haben Sie Ihre Wohnung gekündigt?', NULL, NULL, '{"question_key": "rent_contract_termination_yes_no", "value": "Ja"}'::jsonb),
  ('60000000-0000-0000-0000-000000000031', '40000000-0000-0000-0000-000000000003', '50000000-0000-0000-0000-000000000001',
   'child_first_name', 0, 'short_text', true,
   'Vorname Ihres Kindes?', NULL, NULL, NULL),
  ('60000000-0000-0000-0000-000000000032', '40000000-0000-0000-0000-000000000003', '50000000-0000-0000-0000-000000000001',
   'child_last_name', 1, 'short_text', true,
   'Nachname Ihres Kindes?', NULL, NULL, '{"question_key": "child_first_name", "not_empty": true}'::jsonb),
  ('60000000-0000-0000-0000-000000000033', '40000000-0000-0000-0000-000000000003', '50000000-0000-0000-0000-000000000001',
   'child_birth_name', 2, 'short_text', true,
   'Geburtsname Ihres Kindes?', NULL, NULL, '{"question_key": "child_first_name", "not_empty": true}'::jsonb),
  ('60000000-0000-0000-0000-000000000034', '40000000-0000-0000-0000-000000000003', '50000000-0000-0000-0000-000000000001',
   'child_birth_date', 3, 'date', true,
   'Geburtsdatum Ihres Kindes?', NULL, NULL, '{"question_key": "child_first_name", "not_empty": true}'::jsonb),
  ('60000000-0000-0000-0000-000000000035', '40000000-0000-0000-0000-000000000003', '50000000-0000-0000-0000-000000000001',
   'child_marital_status', 4, 'single_select', true,
   'Familienstand Ihres Kindes?', NULL, NULL, '{"question_key": "child_first_name", "not_empty": true}'::jsonb),
  ('60000000-0000-0000-0000-000000000036', '40000000-0000-0000-0000-000000000003', '50000000-0000-0000-0000-000000000001',
   'child_family_tie', 5, 'single_select', true,
   'Verwandschaftsverhältnis zu Ihrem Kind?', NULL, NULL, '{"question_key": "child_first_name", "not_empty": true}'::jsonb),
  ('60000000-0000-0000-0000-000000000037', '40000000-0000-0000-0000-000000000003', '50000000-0000-0000-0000-000000000001',
   'child_profession', 6, 'short_text', true,
   'Beruf Ihres Kindes?', NULL, NULL, '{"question_key": "child_first_name", "not_empty": true}'::jsonb),
  ('60000000-0000-0000-0000-000000000038', '40000000-0000-0000-0000-000000000003', '50000000-0000-0000-0000-000000000001',
   'child_address', 7, 'short_text', true,
   'Wohnadresse Ihres Kindes?', NULL, NULL, '{"question_key": "child_first_name", "not_empty": true}'::jsonb),
  ('60000000-0000-0000-0000-000000000039', '40000000-0000-0000-0000-000000000004', '50000000-0000-0000-0000-000000000002',
   'pension_type', 0, 'single_select', true,
   'Welche Rente/Pension beziehen Sie?', NULL, NULL, NULL),
  ('60000000-0000-0000-0000-00000000003a', '40000000-0000-0000-0000-000000000004', '50000000-0000-0000-0000-000000000002',
   'pension_amount', 1, 'amount', true,
   'Wie hoch ist die monatliche Rente/Pension?', NULL, NULL, '{"question_key": "pension_type", "not_empty": true}'::jsonb),
  ('60000000-0000-0000-0000-00000000003b', '40000000-0000-0000-0000-000000000004', '50000000-0000-0000-0000-000000000002',
   'pension_id', 2, 'short_text', true,
   'Was ist die Abrechnungsnummer der Rente/Pension?', NULL, NULL, '{"question_key": "pension_type", "not_empty": true}'::jsonb),
  ('60000000-0000-0000-0000-00000000003c', '40000000-0000-0000-0000-000000000004', '50000000-0000-0000-0000-000000000002',
   'pension_issuer', 3, 'short_text', true,
   'Wer bezahlt die Rente/Pension?', NULL, NULL, '{"question_key": "pension_type", "not_empty": true}'::jsonb),
  ('60000000-0000-0000-0000-00000000003d', '40000000-0000-0000-0000-000000000004', NULL,
   'wohngeld_yes_no', 4, 'single_select', true,
   'Beziehen Sie Wohngeld?', NULL, NULL, NULL),
  ('60000000-0000-0000-0000-00000000003e', '40000000-0000-0000-0000-000000000004', NULL,
   'wohngeld_amount', 5, 'amount', true,
   'Wie viel Wohngeld beziehen Sie?', NULL, NULL, '{"question_key": "wohngeld_yes_no", "value": "Ja"}'::jsonb),
  ('60000000-0000-0000-0000-00000000003f', '40000000-0000-0000-0000-000000000004', NULL,
   'wohngeld_id', 6, 'short_text', true,
   'Was ist die Abrechnungsnummer des Wohngeld?', NULL, NULL, '{"question_key": "wohngeld_yes_no", "value": "Ja"}'::jsonb),
  ('60000000-0000-0000-0000-000000000040', '40000000-0000-0000-0000-000000000004', NULL,
   'other_income', 7, 'single_select', true,
   'Beziehen Sie anderes Einkommen?', NULL, NULL, NULL),
  ('60000000-0000-0000-0000-000000000041', '40000000-0000-0000-0000-000000000004', '50000000-0000-0000-0000-000000000003',
   'other_income_type', 8, 'short_text', true,
   'Welche Art von Einkommen beziehen Sie?', NULL, NULL, '{"question_key": "other_income", "value": "Ja"}'::jsonb),
  ('60000000-0000-0000-0000-000000000042', '40000000-0000-0000-0000-000000000004', '50000000-0000-0000-0000-000000000003',
   'other_income_amount', 9, 'amount', true,
   'Wie hoch ist das weitere Einkommen monatlich?', NULL, NULL, '{"question_key": "other_income", "value": "Ja"}'::jsonb),
  ('60000000-0000-0000-0000-000000000043', '40000000-0000-0000-0000-000000000005', NULL,
   'govermental_employee', 0, 'single_select', true,
   'Waren Sie früher Beamter?', NULL, NULL, NULL),
  ('60000000-0000-0000-0000-000000000044', '40000000-0000-0000-0000-000000000005', NULL,
   'health_insurance_amount', 1, 'amount', true,
   'Wie hoch sind die monatlichen Ausgaben für Ihre Krankenversicherung?', NULL, NULL, '{"question_key": "govermental_employee", "value": "Ja"}'::jsonb),
  ('60000000-0000-0000-0000-000000000045', '40000000-0000-0000-0000-000000000005', NULL,
   'care_insurance_amount', 2, 'amount', true,
   'Wo hoch sind die monatlichen Ausgaben für Ihre Pflegeversicherung?', NULL, NULL, '{"question_key": "govermental_employee", "value": "Ja"}'::jsonb),
  ('60000000-0000-0000-0000-000000000046', '40000000-0000-0000-0000-000000000005', NULL,
   'general_liablity_insurance_yes_no', 3, 'single_select', true,
   'Haben Sie eine Haftpflichtversicherung?', NULL, NULL, NULL),
  ('60000000-0000-0000-0000-000000000047', '40000000-0000-0000-0000-000000000005', NULL,
   'general_liablity_insurance_provider', 4, 'short_text', true,
   'Wer ist Träger Ihrer Haftpflichtversicherung?', NULL, NULL, '{"question_key": "general_liability_insurance_yes_no", "value": "Ja"}'::jsonb),
  ('60000000-0000-0000-0000-000000000048', '40000000-0000-0000-0000-000000000005', NULL,
   'general_liability_amount', 5, 'amount', true,
   'Wo hoch ist der monatliche Betrag Ihrer Haftpflichtversicherung?', NULL, NULL, '{"question_key": "general_liability_insurance_yes_no", "value": "Ja"}'::jsonb),
  ('60000000-0000-0000-0000-000000000049', '40000000-0000-0000-0000-000000000005', NULL,
   'life_insurance', 6, 'single_select', true,
   'Haben Sie eine Lebens- oder Sterbeversicherung?', NULL, NULL, NULL),
  ('60000000-0000-0000-0000-00000000004a', '40000000-0000-0000-0000-000000000005', NULL,
   'life_insurance_monthly_amount', 7, 'amount', true,
   'Wie hoch ist der monatliche Beitrag Ihrer Lebens- oder Sterbeversicherung?', NULL, NULL, '{"question_key": "life_insurance", "not_value": "Nein"}'::jsonb),
  ('60000000-0000-0000-0000-00000000004b', '40000000-0000-0000-0000-000000000006', NULL,
   'life_insurance_total_amount', 0, 'amount', true,
   'Wie hoch ist der Auszahlungsbetrag der Versicherung?', NULL, NULL, '{"question_key": "life_insurance", "not_value": "Nein"}'::jsonb),
  ('60000000-0000-0000-0000-00000000004c', '40000000-0000-0000-0000-000000000006', NULL,
   'life_insurance_name', 1, 'short_text', true,
   'Bei welcher Versicherungsgesellschaft?', NULL, NULL, '{"question_key": "life_insurance", "not_value": "Nein"}'::jsonb),
  ('60000000-0000-0000-0000-00000000004d', '40000000-0000-0000-0000-000000000006', NULL,
   'life_insurance_number', 2, 'short_text', true,
   'Was ist die Versicherungsnummer?', NULL, NULL, '{"question_key": "life_insurance", "not_value": "Nein"}'::jsonb),
  ('60000000-0000-0000-0000-00000000004e', '40000000-0000-0000-0000-000000000006', NULL,
   'funeral_insurance_yes_no', 3, 'single_select', true,
   'Haben Sie einen Bestattungsvorsorgevertrag?', NULL, NULL, NULL),
  ('60000000-0000-0000-0000-00000000004f', '40000000-0000-0000-0000-000000000006', NULL,
   'funeral_insurance_amount', 4, 'amount', true,
   'Was ist der Auszahlungsbetrag?', NULL, NULL, '{"question_key": "funeral_insurance_yes_no", "value": "Ja"}'::jsonb),
  ('60000000-0000-0000-0000-000000000050', '40000000-0000-0000-0000-000000000006', NULL,
   'funeral_insurance_detail', 5, 'single_select', true,
   'Was trifft auf den Bestattungsvertrag zu?', NULL, NULL, '{"question_key": "funeral_insurance_yes_no", "value": "Ja"}'::jsonb),
  ('60000000-0000-0000-0000-000000000051', '40000000-0000-0000-0000-000000000006', NULL,
   'bank_giro', 6, 'short_text', true,
   'Bei welcher Bank haben Sie Ihr Girokonto?', NULL, NULL, NULL),
  ('60000000-0000-0000-0000-000000000052', '40000000-0000-0000-0000-000000000006', NULL,
   'bank_giro_blz', 7, 'short_text', true,
   'Was ist die Bankleitzahl Ihrer Bank?', NULL, NULL, NULL),
  ('60000000-0000-0000-0000-000000000053', '40000000-0000-0000-0000-000000000006', NULL,
   'bank_giro_iban', 8, 'short_text', true,
   'Was ist Ihre IBAN Nummer?', NULL, NULL, NULL),
  ('60000000-0000-0000-0000-000000000054', '40000000-0000-0000-0000-000000000006', NULL,
   'bank_giro_amount', 9, 'amount', true,
   'Wie hoch ist der Betrag auf Ihrem Girokonto?', NULL, NULL, NULL),
  ('60000000-0000-0000-0000-000000000055', '40000000-0000-0000-0000-000000000006', NULL,
   'bank_savings_account_yes_no', 10, 'single_select', true,
   'Besitzen Sie ein Sparkonto?', NULL, NULL, NULL),
  ('60000000-0000-0000-0000-000000000056', '40000000-0000-0000-0000-000000000006', NULL,
   'bank_savings_account_amount', 11, 'amount', true,
   'Wie hoch ist der Betrag auf Ihrem Sparkonto?', NULL, NULL, '{"question_key": "bank_savings_account_yes_no", "value": "Ja"}'::jsonb),
  ('60000000-0000-0000-0000-000000000057', '40000000-0000-0000-0000-000000000006', NULL,
   'bank_savings_iban', 12, 'short_text', true,
   'Was ist Ihre IBAN Nummer?', NULL, NULL, '{"question_key": "bank_savings_account_yes_no", "value": "Ja"}'::jsonb),
  ('60000000-0000-0000-0000-000000000058', '40000000-0000-0000-0000-000000000006', NULL,
   'bank_additional_account_yes_no', 13, 'single_select', true,
   'Besitzen Sie ein weiteres Konto?', NULL, NULL, NULL),
  ('60000000-0000-0000-0000-000000000059', '40000000-0000-0000-0000-000000000006', '50000000-0000-0000-0000-000000000004',
   'bank_additional_name', 14, 'short_text', true,
   'Bei welcher Bank haben Sie ein weiteres Konto?', NULL, NULL, '{"question_key": "bank_additional_account_yes_no", "value": "Ja"}'::jsonb),
  ('60000000-0000-0000-0000-00000000005a', '40000000-0000-0000-0000-000000000006', '50000000-0000-0000-0000-000000000004',
   'bank_additional_iban', 15, 'short_text', true,
   'Was ist die IBAN Nummer dieses Kontos?', NULL, NULL, '{"question_key": "bank_additional_account_yes_no", "value": "Ja"}'::jsonb),
  ('60000000-0000-0000-0000-00000000005b', '40000000-0000-0000-0000-000000000006', '50000000-0000-0000-0000-000000000004',
   'bank_additional_amount', 16, 'amount', true,
   'Wie hoch ist der Betrag auf diesem Konto?', NULL, NULL, '{"question_key": "bank_additional_account_yes_no", "value": "Ja"}'::jsonb),
  ('60000000-0000-0000-0000-00000000005c', '40000000-0000-0000-0000-000000000006', NULL,
   'cash_savings', 17, 'amount', true,
   'Wie viel Bargeld besitzen Sie?', NULL, NULL, NULL),
  ('60000000-0000-0000-0000-00000000005d', '40000000-0000-0000-0000-000000000006', NULL,
   'automobile_owner', 18, 'single_select', true,
   'Besitzen Sie ein Auto?', NULL, NULL, NULL),
  ('60000000-0000-0000-0000-00000000005e', '40000000-0000-0000-0000-000000000006', NULL,
   'automobile_numbers_plate', 19, 'short_text', true,
   'Was ist der Kennzeichen Ihres Autos?', NULL, NULL, '{"question_key": "automobile_owner", "value": "Ja"}'::jsonb),
  ('60000000-0000-0000-0000-00000000005f', '40000000-0000-0000-0000-000000000006', NULL,
   'automobile_type', 20, 'short_text', true,
   'Was ist das Modell Ihres Autos?', NULL, NULL, '{"question_key": "automobile_owner", "value": "Ja"}'::jsonb),
  ('60000000-0000-0000-0000-000000000060', '40000000-0000-0000-0000-000000000006', NULL,
   'automobile_year', 21, 'short_text', true,
   'Was ist das Baujahr Ihres Autos?', NULL, NULL, '{"question_key": "automobile_owner", "value": "Ja"}'::jsonb),
  ('60000000-0000-0000-0000-000000000061', '40000000-0000-0000-0000-000000000006', NULL,
   'automobile_holder', 22, 'short_text', true,
   'Wer ist der Fahrzeughalter?', NULL, NULL, '{"question_key": "automobile_owner", "value": "Ja"}'::jsonb),
  ('60000000-0000-0000-0000-000000000062', '40000000-0000-0000-0000-000000000006', NULL,
   'property_yes_no', 23, 'single_select', true,
   'Besitzen Sie ein Haus, Wohnung oder Land?', NULL, NULL, NULL),
  ('60000000-0000-0000-0000-000000000063', '40000000-0000-0000-0000-000000000006', NULL,
   'property_address', 24, 'short_text', true,
   'Adresse der Immobilie?', NULL, NULL, '{"question_key": "property_yes_no", "not_value": "Nein"}'::jsonb),
  ('60000000-0000-0000-0000-000000000064', '40000000-0000-0000-0000-000000000006', NULL,
   'property_usage', 25, 'short_text', true,
   'Wie wird die Immobilie genutzt?', NULL, NULL, '{"question_key": "property_yes_no", "not_value": "Nein"}'::jsonb),
  ('60000000-0000-0000-0000-000000000065', '40000000-0000-0000-0000-000000000006', NULL,
   'property_size', 26, 'number', true,
   'Größe der Immobilie in Quadratmeter?', NULL, NULL, '{"question_key": "property_yes_no", "not_value": "Nein"}'::jsonb),
  ('60000000-0000-0000-0000-000000000066', '40000000-0000-0000-0000-000000000006', NULL,
   'additional_wealth_yes_no', 27, 'single_select', true,
   'Besitzen Sie weitere Vermögenswerte?', NULL, NULL, NULL),
  ('60000000-0000-0000-0000-000000000067', '40000000-0000-0000-0000-000000000006', NULL,
   'additional_wealth_type', 28, 'short_text', true,
   'Welche Vermögenswerte besitzen Sie?', NULL, NULL, '{"question_key": "additional_wealth_yes_no", "value": "Ja"}'::jsonb),
  ('60000000-0000-0000-0000-000000000068', '40000000-0000-0000-0000-000000000006', NULL,
   'additional_wealth_amount', 29, 'amount', true,
   'Was ist der Wert Ihres Vermögenswertes?', NULL, NULL, '{"question_key": "additional_wealth_yes_no", "value": "Ja"}'::jsonb),
  ('60000000-0000-0000-0000-000000000069', '40000000-0000-0000-0000-000000000007', NULL,
   'costly_diet', 0, 'single_select', true,
   'Ist eine kostenaufwendige Ernährung aus medizinischen Gründen erforderlich?', NULL, NULL, NULL),
  ('60000000-0000-0000-0000-00000000006a', '40000000-0000-0000-0000-000000000008', NULL,
   'spouse_last_name', 0, 'short_text', true,
   'Wie lautet der Nachname Ihres Ehepartners?', NULL, NULL, '{"question_key": "marital_status", "in_values": ["eheähnliche Gemeinschaft", "eingetragene Lebenspartnerschaft", "verheiratet", "dauernd getrennt lebend"]}'::jsonb),
  ('60000000-0000-0000-0000-00000000006b', '40000000-0000-0000-0000-000000000008', NULL,
   'spouse_birth_name', 1, 'short_text', true,
   'Wie lautet der Geburtsname Ihres Ehepartners?', NULL, NULL, '{"question_key": "marital_status", "in_values": ["eheähnliche Gemeinschaft", "eingetragene Lebenspartnerschaft", "verheiratet", "dauernd getrennt lebend"]}'::jsonb),
  ('60000000-0000-0000-0000-00000000006c', '40000000-0000-0000-0000-000000000008', NULL,
   'spouse_first_name', 2, 'short_text', true,
   'Wie lautet der Vorname Ihres Ehepartners?', NULL, NULL, '{"question_key": "marital_status", "in_values": ["eheähnliche Gemeinschaft", "eingetragene Lebenspartnerschaft", "verheiratet", "dauernd getrennt lebend"]}'::jsonb),
  ('60000000-0000-0000-0000-00000000006d', '40000000-0000-0000-0000-000000000008', NULL,
   'spouse_birthdate', 3, 'date', true,
   'Wann wurden Ihr Ehepartner geboren?', NULL, NULL, '{"question_key": "marital_status", "in_values": ["eheähnliche Gemeinschaft", "eingetragene Lebenspartnerschaft", "verheiratet", "dauernd getrennt lebend"]}'::jsonb),
  ('60000000-0000-0000-0000-00000000006e', '40000000-0000-0000-0000-000000000008', NULL,
   'spouse_city_of_birth', 4, 'short_text', true,
   'In welcher Stadt wurden Ihr Ehepartner geboren?', NULL, NULL, '{"question_key": "marital_status", "in_values": ["eheähnliche Gemeinschaft", "eingetragene Lebenspartnerschaft", "verheiratet", "dauernd getrennt lebend"]}'::jsonb),
  ('60000000-0000-0000-0000-00000000006f', '40000000-0000-0000-0000-000000000008', NULL,
   'spouse_district_of_birth', 5, 'short_text', true,
   'In welchem Kreis/Bezirk wurde Ihr Ehepartner geboren?', NULL, NULL, '{"question_key": "marital_status", "in_values": ["eheähnliche Gemeinschaft", "eingetragene Lebenspartnerschaft", "verheiratet", "dauernd getrennt lebend"]}'::jsonb),
  ('60000000-0000-0000-0000-000000000070', '40000000-0000-0000-0000-000000000008', NULL,
   'spouse_country_of_birth', 6, 'short_text', true,
   'In welchem Land wurden Ihr Ehepartner geboren?', NULL, NULL, '{"question_key": "marital_status", "in_values": ["eheähnliche Gemeinschaft", "eingetragene Lebenspartnerschaft", "verheiratet", "dauernd getrennt lebend"]}'::jsonb),
  ('60000000-0000-0000-0000-000000000071', '40000000-0000-0000-0000-000000000008', NULL,
   'spouse_gender', 7, 'single_select', true,
   'Was ist das Geschlecht Ihres Ehepartners?', NULL, NULL, '{"question_key": "marital_status", "in_values": ["eheähnliche Gemeinschaft", "eingetragene Lebenspartnerschaft", "verheiratet", "dauernd getrennt lebend"]}'::jsonb),
  ('60000000-0000-0000-0000-000000000072', '40000000-0000-0000-0000-000000000008', NULL,
   'spouse_citizenship', 8, 'short_text', true,
   'Was ist die Staatsangehörigkeit Ihres Ehepartners?', NULL, NULL, '{"question_key": "marital_status", "in_values": ["eheähnliche Gemeinschaft", "eingetragene Lebenspartnerschaft", "verheiratet", "dauernd getrennt lebend"]}'::jsonb),
  ('60000000-0000-0000-0000-000000000073', '40000000-0000-0000-0000-000000000008', NULL,
   'spouse_issuer_of_id', 9, 'short_text', true,
   'Welche Behörde hat das Personaldokument ausgestellt?', NULL, NULL, '{"question_key": "marital_status", "in_values": ["eheähnliche Gemeinschaft", "eingetragene Lebenspartnerschaft", "verheiratet", "dauernd getrennt lebend"]}'::jsonb),
  ('60000000-0000-0000-0000-000000000074', '40000000-0000-0000-0000-000000000008', NULL,
   'spouse_id_expiry_date', 10, 'date', true,
   'Bis wann ist das Personaldokument Ihres Partners gültig?', NULL, NULL, '{"question_key": "marital_status", "in_values": ["eheähnliche Gemeinschaft", "eingetragene Lebenspartnerschaft", "verheiratet", "dauernd getrennt lebend"]}'::jsonb),
  ('60000000-0000-0000-0000-000000000075', '40000000-0000-0000-0000-000000000008', NULL,
   'spouse_prior_social_aid', 11, 'single_select', true,
   'Hat Ihr Partner bereits Hilfe zur Pflege Leistungen erhalten?', NULL, NULL, '{"question_key": "marital_status", "in_values": ["eheähnliche Gemeinschaft", "eingetragene Lebenspartnerschaft", "verheiratet", "dauernd getrennt lebend"]}'::jsonb),
  ('60000000-0000-0000-0000-000000000076', '40000000-0000-0000-0000-000000000008', NULL,
   'spouse_prior_social_aid_until', 12, 'date', true,
   'Bis wann hat Ihr Partner Hilfe zur Pflege erhalten?', NULL, NULL, '{"question_key": "spouse_prior_social_aid", "value": "Ja"}'::jsonb),
  ('60000000-0000-0000-0000-000000000077', '40000000-0000-0000-0000-000000000008', NULL,
   'spouse_prior_social_aid_issuer', 13, 'short_text', true,
   'Welche Behörde hat die Hilfe zur Pflege genehmigt?', NULL, NULL, '{"question_key": "spouse_prior_social_aid", "value": "Ja"}'::jsonb),
  ('60000000-0000-0000-0000-000000000078', '40000000-0000-0000-0000-000000000008', NULL,
   'spouse_prior_social_aid_reference_id', 14, 'short_text', true,
   'Was ist das Geschäftszeichen der Genehmigung?', NULL, NULL, '{"question_key": "spouse_prior_social_aid", "value": "Ja"}'::jsonb),
  ('60000000-0000-0000-0000-000000000079', '40000000-0000-0000-0000-000000000008', NULL,
   'spouse_power_of_attorney', 15, 'single_select', true,
   'Gibt es einen Betreuer oder Beistand?', NULL, NULL, '{"question_key": "marital_status", "in_values": ["eheähnliche Gemeinschaft", "eingetragene Lebenspartnerschaft", "verheiratet", "dauernd getrennt lebend"]}'::jsonb),
  ('60000000-0000-0000-0000-00000000007a', '40000000-0000-0000-0000-000000000008', NULL,
   'spouse_special_origin_rights', 16, 'single_select', true,
   'Liegt ein Sonderstatus vor?', NULL, NULL, '{"question_key": "marital_status", "in_values": ["eheähnliche Gemeinschaft", "eingetragene Lebenspartnerschaft", "verheiratet", "dauernd getrennt lebend"]}'::jsonb),
  ('60000000-0000-0000-0000-00000000007b', '40000000-0000-0000-0000-000000000008', NULL,
   'spouse_special_origin_rights_issued', 17, 'date', true,
   'Wann wurde der Sonderstatus ausgestellt?', NULL, NULL, '{"question_key": "spouse_special_origin_rights", "not_value": "Nein"}'::jsonb),
  ('60000000-0000-0000-0000-00000000007c', '40000000-0000-0000-0000-000000000008', NULL,
   'spouse_special_origin_rights_issued_by', 18, 'short_text', true,
   'Welche Behörde hat den Sonderstatus ausgestellt?', NULL, NULL, '{"question_key": "spouse_special_origin_rights", "not_value": "Nein"}'::jsonb),
  ('60000000-0000-0000-0000-00000000007d', '40000000-0000-0000-0000-000000000008', NULL,
   'spouse_disability_card', 19, 'single_select', true,
   'Liegt ein Schwerbehindertenausweis vor?', NULL, NULL, '{"question_key": "marital_status", "in_values": ["eheähnliche Gemeinschaft", "eingetragene Lebenspartnerschaft", "verheiratet", "dauernd getrennt lebend"]}'::jsonb),
  ('60000000-0000-0000-0000-00000000007e', '40000000-0000-0000-0000-000000000008', NULL,
   'spouse_disability_card_application', 20, 'single_select', true,
   'Wurde ein Antrag auf Schwerbehinderung gestellt?', NULL, NULL, '{"question_key": "spouse_disability_card", "value": "Nein"}'::jsonb),
  ('60000000-0000-0000-0000-00000000007f', '40000000-0000-0000-0000-000000000008', NULL,
   'spouse_disability_card_expiry', 21, 'date', true,
   'Bis wann ist der Schwerbehindertenausweis gültig?', NULL, NULL, '{"question_key": "spouse_disability_card", "value": "Ja"}'::jsonb),
  ('60000000-0000-0000-0000-000000000080', '40000000-0000-0000-0000-000000000008', NULL,
   'spouse_disability_card_markers', 22, 'multi_select', true,
   'Welche Merkzeichen hat der Schwerbehindertenausweis?', NULL, NULL, '{"question_key": "spouse_disability_card", "value": "Ja"}'::jsonb),
  ('60000000-0000-0000-0000-000000000081', '40000000-0000-0000-0000-000000000008', NULL,
   'spouse_health_insurance', 23, 'short_text', true,
   'Bei welcher Krankenkasse ist Ihr Partner versichert?', NULL, NULL, '{"question_key": "marital_status", "in_values": ["eheähnliche Gemeinschaft", "eingetragene Lebenspartnerschaft", "verheiratet", "dauernd getrennt lebend"]}'::jsonb),
  ('60000000-0000-0000-0000-000000000082', '40000000-0000-0000-0000-000000000008', NULL,
   'spouse_health_insurance_type', 24, 'single_select', true,
   'Wie ist Ihr Partner krankenversichert?', NULL, NULL, '{"question_key": "marital_status", "in_values": ["eheähnliche Gemeinschaft", "eingetragene Lebenspartnerschaft", "verheiratet", "dauernd getrennt lebend"]}'::jsonb),
  ('60000000-0000-0000-0000-000000000083', '40000000-0000-0000-0000-000000000008', NULL,
   'spouse_care_level', 25, 'single_select', true,
   'Was ist ihre/seine Pflegestufe?', NULL, NULL, '{"question_key": "marital_status", "in_values": ["eheähnliche Gemeinschaft", "eingetragene Lebenspartnerschaft", "verheiratet", "dauernd getrennt lebend"]}'::jsonb),
  ('60000000-0000-0000-0000-000000000084', '40000000-0000-0000-0000-000000000008', NULL,
   'spouse_in_facility_yes_no', 26, 'single_select', true,
   'Wohnt Ihr Partner in stationären Pflegeeinrichtung?', NULL, NULL, '{"question_key": "marital_status", "in_values": ["eheähnliche Gemeinschaft", "eingetragene Lebenspartnerschaft", "verheiratet", "dauernd getrennt lebend"]}'::jsonb),
  ('60000000-0000-0000-0000-000000000085', '40000000-0000-0000-0000-000000000008', NULL,
   'spouse_in_facility_since', 27, 'date', true,
   'Wann fand/findet der Einzug in die Pflegeeinrichtung statt?', NULL, NULL, '{"question_key": "spouse_in_facility_yes_no", "value": "Ja"}'::jsonb),
  ('60000000-0000-0000-0000-000000000086', '40000000-0000-0000-0000-000000000008', NULL,
   'spouse_prior_social_service_applications', 28, 'single_select', true,
   'Hat Ihr Partner weitere Sozialleistungen beantragt?', NULL, NULL, '{"question_key": "marital_status", "in_values": ["eheähnliche Gemeinschaft", "eingetragene Lebenspartnerschaft", "verheiratet", "dauernd getrennt lebend"]}'::jsonb),
  ('60000000-0000-0000-0000-000000000087', '40000000-0000-0000-0000-000000000008', '50000000-0000-0000-0000-000000000005',
   'spouse_pension_type', 29, 'single_select', true,
   'Welche Rente/Pension bezieht Ihr Partner?', NULL, NULL, '{"question_key": "marital_status", "in_values": ["eheähnliche Gemeinschaft", "eingetragene Lebenspartnerschaft", "verheiratet", "dauernd getrennt lebend"]}'::jsonb),
  ('60000000-0000-0000-0000-000000000088', '40000000-0000-0000-0000-000000000008', '50000000-0000-0000-0000-000000000005',
   'spouse_pension_amount', 30, 'amount', true,
   'Wie hoch ist die monatliche Rente/Pension?', NULL, NULL, '{"question_key": "spouse_pension_type", "not_empty": true}'::jsonb),
  ('60000000-0000-0000-0000-000000000089', '40000000-0000-0000-0000-000000000008', '50000000-0000-0000-0000-000000000005',
   'spouse_pension_id', 31, 'short_text', true,
   'Was ist die Abrechnungsnummer der Rente/Pension?', NULL, NULL, '{"question_key": "spouse_pension_type", "not_empty": true}'::jsonb),
  ('60000000-0000-0000-0000-00000000008a', '40000000-0000-0000-0000-000000000008', '50000000-0000-0000-0000-000000000005',
   'spouse_pension_issuer', 32, 'short_text', true,
   'Wer bezahlt die Rente/Pension?', NULL, NULL, '{"question_key": "spouse_pension_type", "not_empty": true}'::jsonb),
  ('60000000-0000-0000-0000-00000000008b', '40000000-0000-0000-0000-000000000008', NULL,
   'spouse_wohngeld_yes_no', 33, 'single_select', true,
   'Bezieht Ihr Partner Wohngeld?', NULL, NULL, '{"question_key": "marital_status", "in_values": ["eheähnliche Gemeinschaft", "eingetragene Lebenspartnerschaft", "verheiratet", "dauernd getrennt lebend"]}'::jsonb),
  ('60000000-0000-0000-0000-00000000008c', '40000000-0000-0000-0000-000000000008', NULL,
   'spouse_wohngeld_amount', 34, 'amount', true,
   'Wie viel Wohngeld bezieht er/sie?', NULL, NULL, '{"question_key": "spouse_wohngeld_amount", "value": "Ja"}'::jsonb),
  ('60000000-0000-0000-0000-00000000008d', '40000000-0000-0000-0000-000000000008', NULL,
   'spouse_wohngeld_id', 35, 'short_text', true,
   'Was ist die Abrechnungsnummer des Wohngeld?', NULL, NULL, '{"question_key": "spouse_wohngeld_amount", "value": "Ja"}'::jsonb),
  ('60000000-0000-0000-0000-00000000008e', '40000000-0000-0000-0000-000000000008', NULL,
   'spouse_other_income', 36, 'single_select', true,
   'Beziehen Ihr Partner anderes Einkommen?', NULL, NULL, '{"question_key": "marital_status", "in_values": ["eheähnliche Gemeinschaft", "eingetragene Lebenspartnerschaft", "verheiratet", "dauernd getrennt lebend"]}'::jsonb),
  ('60000000-0000-0000-0000-00000000008f', '40000000-0000-0000-0000-000000000008', '50000000-0000-0000-0000-000000000006',
   'spouse_other_income_type', 37, 'short_text', true,
   'Welche Art von Einkommen bezieht er/sie?', NULL, NULL, '{"question_key": "spouse_other_income", "value": "Ja"}'::jsonb),
  ('60000000-0000-0000-0000-000000000090', '40000000-0000-0000-0000-000000000008', '50000000-0000-0000-0000-000000000006',
   'spouse_other_income_amount', 38, 'amount', true,
   'Wie hoch ist das weitere Einkommen monatlich?', NULL, NULL, '{"question_key": "spouse_other_income", "value": "Ja"}'::jsonb),
  ('60000000-0000-0000-0000-000000000091', '40000000-0000-0000-0000-000000000008', NULL,
   'spouse_health_insurance_amount', 39, 'amount', true,
   'Wie hoch sind die monatlichen Ausgaben für Ihre Krankenversicherung?', NULL, NULL, '{"question_key": "spouse_govermental_employee", "value": "Ja"}'::jsonb),
  ('60000000-0000-0000-0000-000000000092', '40000000-0000-0000-0000-000000000008', NULL,
   'spouse_care_insurance_amount', 40, 'amount', true,
   'Wo hoch sind die monatlichen Ausgaben für Ihre Pflegeversicherung?', NULL, NULL, '{"question_key": "spouse_govermental_employee", "value": "Ja"}'::jsonb),
  ('60000000-0000-0000-0000-000000000093', '40000000-0000-0000-0000-000000000008', NULL,
   'spouse_general_liablity_insurance_yes_no', 41, 'single_select', true,
   'Hat Ihr Partner eine Haftpflichtversicherung?', NULL, NULL, '{"question_key": "marital_status", "in_values": ["eheähnliche Gemeinschaft", "eingetragene Lebenspartnerschaft", "verheiratet", "dauernd getrennt lebend"]}'::jsonb),
  ('60000000-0000-0000-0000-000000000094', '40000000-0000-0000-0000-000000000008', NULL,
   'spouse_general_liablity_insurance_provider', 42, 'short_text', true,
   'Wer ist Träger Ihrer Haftpflichtversicherung?', NULL, NULL, '{"question_key": "spouse_general_liability_insurance_yes_no", "value": "Ja"}'::jsonb),
  ('60000000-0000-0000-0000-000000000095', '40000000-0000-0000-0000-000000000008', NULL,
   'spouse_general_liability_amount', 43, 'amount', true,
   'Wo hoch ist der monatliche Betrag Ihrer Haftpflichtversicherung?', NULL, NULL, '{"question_key": "spouse_general_liability_insurance_yes_no", "value": "Ja"}'::jsonb),
  ('60000000-0000-0000-0000-000000000096', '40000000-0000-0000-0000-000000000008', NULL,
   'spouse_life_insurance', 44, 'single_select', true,
   'Hat Ihr Partner eine Lebens- oder Sterbeversicherung?', NULL, NULL, '{"question_key": "marital_status", "in_values": ["eheähnliche Gemeinschaft", "eingetragene Lebenspartnerschaft", "verheiratet", "dauernd getrennt lebend"]}'::jsonb),
  ('60000000-0000-0000-0000-000000000097', '40000000-0000-0000-0000-000000000008', NULL,
   'spouse_life_insurance_amount', 45, 'amount', true,
   'Wie hoch ist der monatliche Beitrag ihrer/seiner Lebens- oder Sterbeversicherung?', NULL, NULL, '{"question_key": "spouse_life_insurance", "not_value": "Nein"}'::jsonb),
  ('60000000-0000-0000-0000-000000000098', '40000000-0000-0000-0000-000000000008', NULL,
   'spouse_bank_savings_account_amount', 46, 'amount', true,
   'Wie hoch ist der Betrag auf seinem/ihrem Sparkonto?', NULL, NULL, '{"question_key": "marital_status", "in_values": ["eheähnliche Gemeinschaft", "eingetragene Lebenspartnerschaft", "verheiratet", "dauernd getrennt lebend"]}'::jsonb),
  ('60000000-0000-0000-0000-000000000099', '40000000-0000-0000-0000-000000000008', NULL,
   'spouse_bank_account_amount', 47, 'amount', true,
   'Wie hoch ist der Betrag auf ihrem/seinen Girokonto?', NULL, NULL, '{"question_key": "marital_status", "in_values": ["eheähnliche Gemeinschaft", "eingetragene Lebenspartnerschaft", "verheiratet", "dauernd getrennt lebend"]}'::jsonb),
  ('60000000-0000-0000-0000-00000000009a', '40000000-0000-0000-0000-000000000008', NULL,
   'spouse_automobile_owner', 48, 'single_select', true,
   'Besitzen Ihr Partner ein Auto?', NULL, NULL, '{"question_key": "marital_status", "in_values": ["eheähnliche Gemeinschaft", "eingetragene Lebenspartnerschaft", "verheiratet", "dauernd getrennt lebend"]}'::jsonb),
  ('60000000-0000-0000-0000-00000000009b', '40000000-0000-0000-0000-000000000008', NULL,
   'spouse_automobile_numbers_plate', 49, 'short_text', true,
   'Was ist der Kennzeichen des Autos?', NULL, NULL, '{"question_key": "spouse_automobile_owner", "value": "Ja"}'::jsonb),
  ('60000000-0000-0000-0000-00000000009c', '40000000-0000-0000-0000-000000000008', NULL,
   'spouse_automobile_type', 50, 'short_text', true,
   'Was ist das Modell des Autos?', NULL, NULL, '{"question_key": "spouse_automobile_owner", "value": "Ja"}'::jsonb),
  ('60000000-0000-0000-0000-00000000009d', '40000000-0000-0000-0000-000000000008', NULL,
   'spouse_automobile_year', 51, 'short_text', true,
   'Was ist das Baujahr des Autos?', NULL, NULL, '{"question_key": "spouse_automobile_owner", "value": "Ja"}'::jsonb),
  ('60000000-0000-0000-0000-00000000009e', '40000000-0000-0000-0000-000000000008', NULL,
   'spouse_automobile_holder', 52, 'short_text', true,
   'Wer ist der Fahrzeughalter?', NULL, NULL, '{"question_key": "spouse_automobile_owner", "value": "Ja"}'::jsonb),
  ('60000000-0000-0000-0000-00000000009f', '40000000-0000-0000-0000-000000000008', NULL,
   'spouse_property_yes_no', 53, 'single_select', true,
   'Besitzen Ihr Partner ein Haus, Wohnung oder Land?', NULL, NULL, '{"question_key": "marital_status", "in_values": ["eheähnliche Gemeinschaft", "eingetragene Lebenspartnerschaft", "verheiratet", "dauernd getrennt lebend"]}'::jsonb),
  ('60000000-0000-0000-0000-0000000000a0', '40000000-0000-0000-0000-000000000008', NULL,
   'spouse_additional_wealth_yes_no', 54, 'single_select', true,
   'Besitzen Ihr Partner weitere Vermögenswerte?', NULL, NULL, '{"question_key": "marital_status", "in_values": ["eheähnliche Gemeinschaft", "eingetragene Lebenspartnerschaft", "verheiratet", "dauernd getrennt lebend"]}'::jsonb),
  ('60000000-0000-0000-0000-0000000000a1', '40000000-0000-0000-0000-000000000008', NULL,
   'spouse_additional_wealth_type', 55, 'short_text', true,
   'Welche Vermögenswerte besitzt Ihr Partner?', NULL, NULL, '{"question_key": "spouse_additional_wealth_yes_no", "value": "Ja"}'::jsonb),
  ('60000000-0000-0000-0000-0000000000a2', '40000000-0000-0000-0000-000000000008', NULL,
   'spouse_additional_wealth_amount', 56, 'amount', true,
   'Was ist der Wert Ihres Vermögensgegenstandes?', NULL, NULL, '{"question_key": "spouse_additional_wealth_yes_no", "value": "Ja"}'::jsonb)
ON CONFLICT DO NOTHING;

-- ─── Question options ───────────────────────────────────────
INSERT INTO public.question_option (id, question_id, key, sort_order, label_de, value) VALUES
  ('70000000-0000-0000-0009-000000000000', '60000000-0000-0000-0000-000000000009', 'm_nnlich', 0, 'männlich', 'männlich'),
  ('70000000-0000-0000-0009-000000000001', '60000000-0000-0000-0000-000000000009', 'weiblich', 1, 'weiblich', 'weiblich'),
  ('70000000-0000-0000-000a-000000000000', '60000000-0000-0000-0000-00000000000a', 'ledig', 0, 'ledig', 'ledig'),
  ('70000000-0000-0000-000a-000000000001', '60000000-0000-0000-0000-00000000000a', 'ehe_hnliche_gemeinschaft', 1, 'eheähnliche Gemeinschaft', 'eheähnliche Gemeinschaft'),
  ('70000000-0000-0000-000a-000000000002', '60000000-0000-0000-0000-00000000000a', 'eingetragene_lebenspartnerschaft', 2, 'eingetragene Lebenspartnerschaft', 'eingetragene Lebenspartnerschaft'),
  ('70000000-0000-0000-000a-000000000003', '60000000-0000-0000-0000-00000000000a', 'verheiratet', 3, 'verheiratet', 'verheiratet'),
  ('70000000-0000-0000-000a-000000000004', '60000000-0000-0000-0000-00000000000a', 'dauernd_getrennt_lebend', 4, 'dauernd getrennt lebend', 'dauernd getrennt lebend'),
  ('70000000-0000-0000-000a-000000000005', '60000000-0000-0000-0000-00000000000a', 'geschieden', 5, 'geschieden', 'geschieden'),
  ('70000000-0000-0000-000a-000000000006', '60000000-0000-0000-0000-00000000000a', 'verwitwet', 6, 'verwitwet', 'verwitwet'),
  ('70000000-0000-0000-000f-000000000000', '60000000-0000-0000-0000-00000000000f', 'ja', 0, 'Ja', 'Ja'),
  ('70000000-0000-0000-000f-000000000001', '60000000-0000-0000-0000-00000000000f', 'nein', 1, 'Nein', 'Nein'),
  ('70000000-0000-0000-0013-000000000000', '60000000-0000-0000-0000-000000000013', 'betreuung', 0, 'Betreuung', 'Betreuung'),
  ('70000000-0000-0000-0013-000000000001', '60000000-0000-0000-0000-000000000013', 'beistandschaft', 1, 'Beistandschaft', 'Beistandschaft'),
  ('70000000-0000-0000-0014-000000000000', '60000000-0000-0000-0000-000000000014', 'nein', 0, 'Nein', 'Nein'),
  ('70000000-0000-0000-0014-000000000001', '60000000-0000-0000-0000-000000000014', 'heimatvertrieben_ausweis_a', 1, 'Heimatvertrieben Ausweis A', 'Heimatvertrieben Ausweis A'),
  ('70000000-0000-0000-0014-000000000002', '60000000-0000-0000-0000-000000000014', 'aussiedler_ausweis_b', 2, 'Aussiedler Ausweis B', 'Aussiedler Ausweis B'),
  ('70000000-0000-0000-0014-000000000003', '60000000-0000-0000-0000-000000000014', 'sp_taussiedler', 3, 'Spätaussiedler', 'Spätaussiedler'),
  ('70000000-0000-0000-0014-000000000004', '60000000-0000-0000-0000-000000000014', 'ehegatte_oder_kind_eines_sp_taussiedlers', 4, 'Ehegatte oder Kind eines Spätaussiedlers', 'Ehegatte oder Kind eines Spätaussiedlers'),
  ('70000000-0000-0000-0014-000000000005', '60000000-0000-0000-0000-000000000014', 'sowjetzonenfl_chtlich_ausweis_c', 5, 'Sowjetzonenflüchtlich Ausweis C', 'Sowjetzonenflüchtlich Ausweis C'),
  ('70000000-0000-0000-0017-000000000000', '60000000-0000-0000-0000-000000000017', 'ja', 0, 'Ja', 'Ja'),
  ('70000000-0000-0000-0017-000000000001', '60000000-0000-0000-0000-000000000017', 'nein', 1, 'Nein', 'Nein'),
  ('70000000-0000-0000-0018-000000000000', '60000000-0000-0000-0000-000000000018', 'ja', 0, 'Ja', 'Ja'),
  ('70000000-0000-0000-0018-000000000001', '60000000-0000-0000-0000-000000000018', 'nein', 1, 'Nein', 'Nein'),
  ('70000000-0000-0000-001a-000000000000', '60000000-0000-0000-0000-00000000001a', 'g', 0, 'G', 'G'),
  ('70000000-0000-0000-001a-000000000001', '60000000-0000-0000-0000-00000000001a', 'ag', 1, 'aG', 'aG'),
  ('70000000-0000-0000-001a-000000000002', '60000000-0000-0000-0000-00000000001a', 'rf', 2, 'RF', 'RF'),
  ('70000000-0000-0000-001c-000000000000', '60000000-0000-0000-0000-00000000001c', 'pflichtversicherung', 0, 'Pflichtversicherung', 'Pflichtversicherung'),
  ('70000000-0000-0000-001c-000000000001', '60000000-0000-0000-0000-00000000001c', 'freiwillige_versicherung', 1, 'Freiwillige Versicherung', 'Freiwillige Versicherung'),
  ('70000000-0000-0000-001c-000000000002', '60000000-0000-0000-0000-00000000001c', 'private_versicherung', 2, 'Private Versicherung', 'Private Versicherung'),
  ('70000000-0000-0000-001c-000000000003', '60000000-0000-0000-0000-00000000001c', 'familienversichert', 3, 'Familienversichert', 'Familienversichert'),
  ('70000000-0000-0000-001c-000000000004', '60000000-0000-0000-0000-00000000001c', 'betreuung_der_krankenkasse', 4, 'Betreuung der Krankenkasse', 'Betreuung der Krankenkasse'),
  ('70000000-0000-0000-001d-000000000000', '60000000-0000-0000-0000-00000000001d', 'nicht_vorhanden', 0, 'Nicht vorhanden', 'Nicht vorhanden'),
  ('70000000-0000-0000-001d-000000000001', '60000000-0000-0000-0000-00000000001d', '1', 1, '1', '1'),
  ('70000000-0000-0000-001d-000000000002', '60000000-0000-0000-0000-00000000001d', '2', 2, '2', '2'),
  ('70000000-0000-0000-001d-000000000003', '60000000-0000-0000-0000-00000000001d', '3', 3, '3', '3'),
  ('70000000-0000-0000-001d-000000000004', '60000000-0000-0000-0000-00000000001d', '4', 4, '4', '4'),
  ('70000000-0000-0000-001d-000000000005', '60000000-0000-0000-0000-00000000001d', '5', 5, '5', '5'),
  ('70000000-0000-0000-001f-000000000000', '60000000-0000-0000-0000-00000000001f', 'ja', 0, 'Ja', 'Ja'),
  ('70000000-0000-0000-001f-000000000001', '60000000-0000-0000-0000-00000000001f', 'nein', 1, 'Nein', 'Nein'),
  ('70000000-0000-0000-0028-000000000000', '60000000-0000-0000-0000-000000000028', 'eigenheim', 0, 'Eigenheim', 'Eigenheim'),
  ('70000000-0000-0000-0028-000000000001', '60000000-0000-0000-0000-000000000028', 'eigentumswohnung', 1, 'Eigentumswohnung', 'Eigentumswohnung'),
  ('70000000-0000-0000-0028-000000000002', '60000000-0000-0000-0000-000000000028', 'mietwohnung', 2, 'Mietwohnung', 'Mietwohnung'),
  ('70000000-0000-0000-002f-000000000000', '60000000-0000-0000-0000-00000000002f', 'ja', 0, 'Ja', 'Ja'),
  ('70000000-0000-0000-002f-000000000001', '60000000-0000-0000-0000-00000000002f', 'nein', 1, 'Nein', 'Nein'),
  ('70000000-0000-0000-0035-000000000000', '60000000-0000-0000-0000-000000000035', 'ledig', 0, 'ledig', 'ledig'),
  ('70000000-0000-0000-0035-000000000001', '60000000-0000-0000-0000-000000000035', 'ehe_hnliche_gemeinschaft', 1, 'eheähnliche Gemeinschaft', 'eheähnliche Gemeinschaft'),
  ('70000000-0000-0000-0035-000000000002', '60000000-0000-0000-0000-000000000035', 'eingetragene_lebenspartnerschaft', 2, 'eingetragene Lebenspartnerschaft', 'eingetragene Lebenspartnerschaft'),
  ('70000000-0000-0000-0035-000000000003', '60000000-0000-0000-0000-000000000035', 'verheiratet', 3, 'verheiratet', 'verheiratet'),
  ('70000000-0000-0000-0035-000000000004', '60000000-0000-0000-0000-000000000035', 'dauernd_getrennt_lebend', 4, 'dauernd getrennt lebend', 'dauernd getrennt lebend'),
  ('70000000-0000-0000-0035-000000000005', '60000000-0000-0000-0000-000000000035', 'geschieden', 5, 'geschieden', 'geschieden'),
  ('70000000-0000-0000-0035-000000000006', '60000000-0000-0000-0000-000000000035', 'verwitwet', 6, 'verwitwet', 'verwitwet'),
  ('70000000-0000-0000-0036-000000000000', '60000000-0000-0000-0000-000000000036', 'sohn', 0, 'Sohn', 'Sohn'),
  ('70000000-0000-0000-0036-000000000001', '60000000-0000-0000-0000-000000000036', 'tochter', 1, 'Tochter', 'Tochter'),
  ('70000000-0000-0000-0036-000000000002', '60000000-0000-0000-0000-000000000036', 'stiefsohn', 2, 'Stiefsohn', 'Stiefsohn'),
  ('70000000-0000-0000-0036-000000000003', '60000000-0000-0000-0000-000000000036', 'stieftochter', 3, 'Stieftochter', 'Stieftochter'),
  ('70000000-0000-0000-0036-000000000004', '60000000-0000-0000-0000-000000000036', 'adoptivsohn', 4, 'Adoptivsohn', 'Adoptivsohn'),
  ('70000000-0000-0000-0036-000000000005', '60000000-0000-0000-0000-000000000036', 'adoptivtochter', 5, 'Adoptivtochter', 'Adoptivtochter'),
  ('70000000-0000-0000-0039-000000000000', '60000000-0000-0000-0000-000000000039', 'erwerbsminderungsrente', 0, 'Erwerbsminderungsrente', 'Erwerbsminderungsrente'),
  ('70000000-0000-0000-0039-000000000001', '60000000-0000-0000-0000-000000000039', 'unfallrente', 1, 'Unfallrente', 'Unfallrente'),
  ('70000000-0000-0000-0039-000000000002', '60000000-0000-0000-0000-000000000039', 'altersrente', 2, 'Altersrente', 'Altersrente'),
  ('70000000-0000-0000-0039-000000000003', '60000000-0000-0000-0000-000000000039', 'eu_rente', 3, 'EU Rente', 'EU Rente'),
  ('70000000-0000-0000-0039-000000000004', '60000000-0000-0000-0000-000000000039', 'witwen_rente', 4, 'Witwen Rente', 'Witwen Rente'),
  ('70000000-0000-0000-0039-000000000005', '60000000-0000-0000-0000-000000000039', 'waisen_rente', 5, 'Waisen Rente', 'Waisen Rente'),
  ('70000000-0000-0000-0039-000000000006', '60000000-0000-0000-0000-000000000039', 'werksrente', 6, 'Werksrente', 'Werksrente'),
  ('70000000-0000-0000-0039-000000000007', '60000000-0000-0000-0000-000000000039', 'sonstige_rente_pension', 7, 'Sonstige Rente/Pension', 'Sonstige Rente/Pension'),
  ('70000000-0000-0000-003d-000000000000', '60000000-0000-0000-0000-00000000003d', 'ja', 0, 'Ja', 'Ja'),
  ('70000000-0000-0000-003d-000000000001', '60000000-0000-0000-0000-00000000003d', 'nein', 1, 'Nein', 'Nein'),
  ('70000000-0000-0000-0040-000000000000', '60000000-0000-0000-0000-000000000040', 'ja', 0, 'Ja', 'Ja'),
  ('70000000-0000-0000-0040-000000000001', '60000000-0000-0000-0000-000000000040', 'nein', 1, 'Nein', 'Nein'),
  ('70000000-0000-0000-0043-000000000000', '60000000-0000-0000-0000-000000000043', 'ja', 0, 'Ja', 'Ja'),
  ('70000000-0000-0000-0043-000000000001', '60000000-0000-0000-0000-000000000043', 'nein', 1, 'Nein', 'Nein'),
  ('70000000-0000-0000-0046-000000000000', '60000000-0000-0000-0000-000000000046', 'ja', 0, 'Ja', 'Ja'),
  ('70000000-0000-0000-0046-000000000001', '60000000-0000-0000-0000-000000000046', 'nein', 1, 'Nein', 'Nein'),
  ('70000000-0000-0000-0049-000000000000', '60000000-0000-0000-0000-000000000049', 'nein', 0, 'Nein', 'Nein'),
  ('70000000-0000-0000-0049-000000000001', '60000000-0000-0000-0000-000000000049', 'lebensversicherung', 1, 'Lebensversicherung', 'Lebensversicherung'),
  ('70000000-0000-0000-0049-000000000002', '60000000-0000-0000-0000-000000000049', 'sterbeversicherung', 2, 'Sterbeversicherung', 'Sterbeversicherung'),
  ('70000000-0000-0000-004e-000000000000', '60000000-0000-0000-0000-00000000004e', 'ja', 0, 'Ja', 'Ja'),
  ('70000000-0000-0000-004e-000000000001', '60000000-0000-0000-0000-00000000004e', 'nein', 1, 'Nein', 'Nein'),
  ('70000000-0000-0000-0050-000000000000', '60000000-0000-0000-0000-000000000050', 'unwiderruflich_abgetreten', 0, 'Unwiderruflich abgetreten', 'Unwiderruflich abgetreten'),
  ('70000000-0000-0000-0050-000000000001', '60000000-0000-0000-0000-000000000050', 'sperrkonto', 1, 'Sperrkonto', 'Sperrkonto'),
  ('70000000-0000-0000-0055-000000000000', '60000000-0000-0000-0000-000000000055', 'ja', 0, 'Ja', 'Ja'),
  ('70000000-0000-0000-0055-000000000001', '60000000-0000-0000-0000-000000000055', 'nein', 1, 'Nein', 'Nein'),
  ('70000000-0000-0000-0058-000000000000', '60000000-0000-0000-0000-000000000058', 'ja', 0, 'Ja', 'Ja'),
  ('70000000-0000-0000-0058-000000000001', '60000000-0000-0000-0000-000000000058', 'nein', 1, 'Nein', 'Nein'),
  ('70000000-0000-0000-005d-000000000000', '60000000-0000-0000-0000-00000000005d', 'ja', 0, 'Ja', 'Ja'),
  ('70000000-0000-0000-005d-000000000001', '60000000-0000-0000-0000-00000000005d', 'nein', 1, 'Nein', 'Nein'),
  ('70000000-0000-0000-0062-000000000000', '60000000-0000-0000-0000-000000000062', 'nein', 0, 'Nein', 'Nein'),
  ('70000000-0000-0000-0062-000000000001', '60000000-0000-0000-0000-000000000062', 'haus', 1, 'Haus', 'Haus'),
  ('70000000-0000-0000-0062-000000000002', '60000000-0000-0000-0000-000000000062', 'eigentumswohnung', 2, 'Eigentumswohnung', 'Eigentumswohnung'),
  ('70000000-0000-0000-0062-000000000003', '60000000-0000-0000-0000-000000000062', 'grundbesitz', 3, 'Grundbesitz', 'Grundbesitz'),
  ('70000000-0000-0000-0066-000000000000', '60000000-0000-0000-0000-000000000066', 'ja', 0, 'Ja', 'Ja'),
  ('70000000-0000-0000-0066-000000000001', '60000000-0000-0000-0000-000000000066', 'nein', 1, 'Nein', 'Nein'),
  ('70000000-0000-0000-0069-000000000000', '60000000-0000-0000-0000-000000000069', 'ja', 0, 'Ja', 'Ja'),
  ('70000000-0000-0000-0069-000000000001', '60000000-0000-0000-0000-000000000069', 'nein', 1, 'Nein', 'Nein'),
  ('70000000-0000-0000-0071-000000000000', '60000000-0000-0000-0000-000000000071', 'm_nnlich', 0, 'männlich', 'männlich'),
  ('70000000-0000-0000-0071-000000000001', '60000000-0000-0000-0000-000000000071', 'weiblich', 1, 'weiblich', 'weiblich'),
  ('70000000-0000-0000-0075-000000000000', '60000000-0000-0000-0000-000000000075', 'ja', 0, 'Ja', 'Ja'),
  ('70000000-0000-0000-0075-000000000001', '60000000-0000-0000-0000-000000000075', 'nein', 1, 'Nein', 'Nein'),
  ('70000000-0000-0000-0079-000000000000', '60000000-0000-0000-0000-000000000079', 'betreuung', 0, 'Betreuung', 'Betreuung'),
  ('70000000-0000-0000-0079-000000000001', '60000000-0000-0000-0000-000000000079', 'beistandschaft', 1, 'Beistandschaft', 'Beistandschaft'),
  ('70000000-0000-0000-007a-000000000000', '60000000-0000-0000-0000-00000000007a', 'nein', 0, 'Nein', 'Nein'),
  ('70000000-0000-0000-007a-000000000001', '60000000-0000-0000-0000-00000000007a', 'heimatvertrieben_ausweis_a', 1, 'Heimatvertrieben Ausweis A', 'Heimatvertrieben Ausweis A'),
  ('70000000-0000-0000-007a-000000000002', '60000000-0000-0000-0000-00000000007a', 'aussiedler_ausweis_b', 2, 'Aussiedler Ausweis B', 'Aussiedler Ausweis B'),
  ('70000000-0000-0000-007a-000000000003', '60000000-0000-0000-0000-00000000007a', 'sp_taussiedler', 3, 'Spätaussiedler', 'Spätaussiedler'),
  ('70000000-0000-0000-007a-000000000004', '60000000-0000-0000-0000-00000000007a', 'ehegatte_oder_kind_eines_sp_taussiedlers', 4, 'Ehegatte oder Kind eines Spätaussiedlers', 'Ehegatte oder Kind eines Spätaussiedlers'),
  ('70000000-0000-0000-007a-000000000005', '60000000-0000-0000-0000-00000000007a', 'sowjetzonenfl_chtlich_ausweis_c', 5, 'Sowjetzonenflüchtlich Ausweis C', 'Sowjetzonenflüchtlich Ausweis C'),
  ('70000000-0000-0000-007d-000000000000', '60000000-0000-0000-0000-00000000007d', 'ja', 0, 'Ja', 'Ja'),
  ('70000000-0000-0000-007d-000000000001', '60000000-0000-0000-0000-00000000007d', 'nein', 1, 'Nein', 'Nein'),
  ('70000000-0000-0000-007e-000000000000', '60000000-0000-0000-0000-00000000007e', 'ja', 0, 'Ja', 'Ja'),
  ('70000000-0000-0000-007e-000000000001', '60000000-0000-0000-0000-00000000007e', 'nein', 1, 'Nein', 'Nein'),
  ('70000000-0000-0000-0080-000000000000', '60000000-0000-0000-0000-000000000080', 'g', 0, 'G', 'G'),
  ('70000000-0000-0000-0080-000000000001', '60000000-0000-0000-0000-000000000080', 'ag', 1, 'aG', 'aG'),
  ('70000000-0000-0000-0080-000000000002', '60000000-0000-0000-0000-000000000080', 'rf', 2, 'RF', 'RF'),
  ('70000000-0000-0000-0082-000000000000', '60000000-0000-0000-0000-000000000082', 'pflichtversicherung', 0, 'Pflichtversicherung', 'Pflichtversicherung'),
  ('70000000-0000-0000-0082-000000000001', '60000000-0000-0000-0000-000000000082', 'freiwillige_versicherung', 1, 'Freiwillige Versicherung', 'Freiwillige Versicherung'),
  ('70000000-0000-0000-0082-000000000002', '60000000-0000-0000-0000-000000000082', 'private_versicherung', 2, 'Private Versicherung', 'Private Versicherung'),
  ('70000000-0000-0000-0082-000000000003', '60000000-0000-0000-0000-000000000082', 'familienversichert', 3, 'Familienversichert', 'Familienversichert'),
  ('70000000-0000-0000-0082-000000000004', '60000000-0000-0000-0000-000000000082', 'betreuung_der_krankenkasse', 4, 'Betreuung der Krankenkasse', 'Betreuung der Krankenkasse'),
  ('70000000-0000-0000-0083-000000000000', '60000000-0000-0000-0000-000000000083', 'nicht_vorhanden', 0, 'Nicht vorhanden', 'Nicht vorhanden'),
  ('70000000-0000-0000-0083-000000000001', '60000000-0000-0000-0000-000000000083', '1', 1, '1', '1'),
  ('70000000-0000-0000-0083-000000000002', '60000000-0000-0000-0000-000000000083', '2', 2, '2', '2'),
  ('70000000-0000-0000-0083-000000000003', '60000000-0000-0000-0000-000000000083', '3', 3, '3', '3'),
  ('70000000-0000-0000-0083-000000000004', '60000000-0000-0000-0000-000000000083', '4', 4, '4', '4'),
  ('70000000-0000-0000-0083-000000000005', '60000000-0000-0000-0000-000000000083', '5', 5, '5', '5'),
  ('70000000-0000-0000-0084-000000000000', '60000000-0000-0000-0000-000000000084', 'ja', 0, 'Ja', 'Ja'),
  ('70000000-0000-0000-0084-000000000001', '60000000-0000-0000-0000-000000000084', 'nein', 1, 'Nein', 'Nein'),
  ('70000000-0000-0000-0086-000000000000', '60000000-0000-0000-0000-000000000086', 'ja', 0, 'Ja', 'Ja'),
  ('70000000-0000-0000-0086-000000000001', '60000000-0000-0000-0000-000000000086', 'nein', 1, 'Nein', 'Nein'),
  ('70000000-0000-0000-0087-000000000000', '60000000-0000-0000-0000-000000000087', 'erwerbsminderungsrente', 0, 'Erwerbsminderungsrente', 'Erwerbsminderungsrente'),
  ('70000000-0000-0000-0087-000000000001', '60000000-0000-0000-0000-000000000087', 'unfallrente', 1, 'Unfallrente', 'Unfallrente'),
  ('70000000-0000-0000-0087-000000000002', '60000000-0000-0000-0000-000000000087', 'altersrente', 2, 'Altersrente', 'Altersrente'),
  ('70000000-0000-0000-0087-000000000003', '60000000-0000-0000-0000-000000000087', 'eu_rente', 3, 'EU Rente', 'EU Rente'),
  ('70000000-0000-0000-0087-000000000004', '60000000-0000-0000-0000-000000000087', 'witwen_rente', 4, 'Witwen Rente', 'Witwen Rente'),
  ('70000000-0000-0000-0087-000000000005', '60000000-0000-0000-0000-000000000087', 'waisen_rente', 5, 'Waisen Rente', 'Waisen Rente'),
  ('70000000-0000-0000-0087-000000000006', '60000000-0000-0000-0000-000000000087', 'werksrente', 6, 'Werksrente', 'Werksrente'),
  ('70000000-0000-0000-0087-000000000007', '60000000-0000-0000-0000-000000000087', 'sonstige_rente_pension', 7, 'Sonstige Rente/Pension', 'Sonstige Rente/Pension'),
  ('70000000-0000-0000-008b-000000000000', '60000000-0000-0000-0000-00000000008b', 'ja', 0, 'Ja', 'Ja'),
  ('70000000-0000-0000-008b-000000000001', '60000000-0000-0000-0000-00000000008b', 'nein', 1, 'Nein', 'Nein'),
  ('70000000-0000-0000-008e-000000000000', '60000000-0000-0000-0000-00000000008e', 'ja', 0, 'Ja', 'Ja'),
  ('70000000-0000-0000-008e-000000000001', '60000000-0000-0000-0000-00000000008e', 'nein', 1, 'Nein', 'Nein'),
  ('70000000-0000-0000-0093-000000000000', '60000000-0000-0000-0000-000000000093', 'ja', 0, 'Ja', 'Ja'),
  ('70000000-0000-0000-0093-000000000001', '60000000-0000-0000-0000-000000000093', 'nein', 1, 'Nein', 'Nein'),
  ('70000000-0000-0000-0096-000000000000', '60000000-0000-0000-0000-000000000096', 'nein', 0, 'Nein', 'Nein'),
  ('70000000-0000-0000-0096-000000000001', '60000000-0000-0000-0000-000000000096', 'lebensversicherung', 1, 'Lebensversicherung', 'Lebensversicherung'),
  ('70000000-0000-0000-0096-000000000002', '60000000-0000-0000-0000-000000000096', 'sterbeversicherung', 2, 'Sterbeversicherung', 'Sterbeversicherung'),
  ('70000000-0000-0000-009a-000000000000', '60000000-0000-0000-0000-00000000009a', 'ja', 0, 'Ja', 'Ja'),
  ('70000000-0000-0000-009a-000000000001', '60000000-0000-0000-0000-00000000009a', 'nein', 1, 'Nein', 'Nein'),
  ('70000000-0000-0000-009f-000000000000', '60000000-0000-0000-0000-00000000009f', 'nein', 0, 'Nein', 'Nein'),
  ('70000000-0000-0000-009f-000000000001', '60000000-0000-0000-0000-00000000009f', 'haus', 1, 'Haus', 'Haus'),
  ('70000000-0000-0000-009f-000000000002', '60000000-0000-0000-0000-00000000009f', 'eigentumswohnung', 2, 'Eigentumswohnung', 'Eigentumswohnung'),
  ('70000000-0000-0000-009f-000000000003', '60000000-0000-0000-0000-00000000009f', 'grundbesitz', 3, 'Grundbesitz', 'Grundbesitz'),
  ('70000000-0000-0000-00a0-000000000000', '60000000-0000-0000-0000-0000000000a0', 'ja', 0, 'Ja', 'Ja'),
  ('70000000-0000-0000-00a0-000000000001', '60000000-0000-0000-0000-0000000000a0', 'nein', 1, 'Nein', 'Nein')
ON CONFLICT DO NOTHING;

-- ─── PLZ rules — 190 Berlin codes ──────────────────────────
-- Each PLZ is an individual rule (plz_from = plz_to).
-- Unrecognised PLZs will fall to the fallback questionnaire in M3.
INSERT INTO public.postal_code_rule (id, social_office_id, plz_from, plz_to, priority) VALUES
  ('a0000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '10115', '10115', 10),
  ('a0000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '10117', '10117', 10),
  ('a0000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', '10119', '10119', 10),
  ('a0000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001', '10178', '10178', 10),
  ('a0000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000001', '10179', '10179', 10),
  ('a0000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000001', '10243', '10243', 10),
  ('a0000000-0000-0000-0000-000000000007', '10000000-0000-0000-0000-000000000001', '10245', '10245', 10),
  ('a0000000-0000-0000-0000-000000000008', '10000000-0000-0000-0000-000000000001', '10247', '10247', 10),
  ('a0000000-0000-0000-0000-000000000009', '10000000-0000-0000-0000-000000000001', '10249', '10249', 10),
  ('a0000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-000000000001', '10315', '10315', 10),
  ('a0000000-0000-0000-0000-00000000000b', '10000000-0000-0000-0000-000000000001', '10317', '10317', 10),
  ('a0000000-0000-0000-0000-00000000000c', '10000000-0000-0000-0000-000000000001', '10318', '10318', 10),
  ('a0000000-0000-0000-0000-00000000000d', '10000000-0000-0000-0000-000000000001', '10319', '10319', 10),
  ('a0000000-0000-0000-0000-00000000000e', '10000000-0000-0000-0000-000000000001', '10365', '10365', 10),
  ('a0000000-0000-0000-0000-00000000000f', '10000000-0000-0000-0000-000000000001', '10367', '10367', 10),
  ('a0000000-0000-0000-0000-000000000010', '10000000-0000-0000-0000-000000000001', '10369', '10369', 10),
  ('a0000000-0000-0000-0000-000000000011', '10000000-0000-0000-0000-000000000001', '10405', '10405', 10),
  ('a0000000-0000-0000-0000-000000000012', '10000000-0000-0000-0000-000000000001', '10407', '10407', 10),
  ('a0000000-0000-0000-0000-000000000013', '10000000-0000-0000-0000-000000000001', '10409', '10409', 10),
  ('a0000000-0000-0000-0000-000000000014', '10000000-0000-0000-0000-000000000001', '10435', '10435', 10),
  ('a0000000-0000-0000-0000-000000000015', '10000000-0000-0000-0000-000000000001', '10437', '10437', 10),
  ('a0000000-0000-0000-0000-000000000016', '10000000-0000-0000-0000-000000000001', '10439', '10439', 10),
  ('a0000000-0000-0000-0000-000000000017', '10000000-0000-0000-0000-000000000001', '10551', '10551', 10),
  ('a0000000-0000-0000-0000-000000000018', '10000000-0000-0000-0000-000000000001', '10553', '10553', 10),
  ('a0000000-0000-0000-0000-000000000019', '10000000-0000-0000-0000-000000000001', '10555', '10555', 10),
  ('a0000000-0000-0000-0000-00000000001a', '10000000-0000-0000-0000-000000000001', '10557', '10557', 10),
  ('a0000000-0000-0000-0000-00000000001b', '10000000-0000-0000-0000-000000000001', '10559', '10559', 10),
  ('a0000000-0000-0000-0000-00000000001c', '10000000-0000-0000-0000-000000000001', '10585', '10585', 10),
  ('a0000000-0000-0000-0000-00000000001d', '10000000-0000-0000-0000-000000000001', '10587', '10587', 10),
  ('a0000000-0000-0000-0000-00000000001e', '10000000-0000-0000-0000-000000000001', '10589', '10589', 10),
  ('a0000000-0000-0000-0000-00000000001f', '10000000-0000-0000-0000-000000000001', '10623', '10623', 10),
  ('a0000000-0000-0000-0000-000000000020', '10000000-0000-0000-0000-000000000001', '10625', '10625', 10),
  ('a0000000-0000-0000-0000-000000000021', '10000000-0000-0000-0000-000000000001', '10627', '10627', 10),
  ('a0000000-0000-0000-0000-000000000022', '10000000-0000-0000-0000-000000000001', '10629', '10629', 10),
  ('a0000000-0000-0000-0000-000000000023', '10000000-0000-0000-0000-000000000001', '10707', '10707', 10),
  ('a0000000-0000-0000-0000-000000000024', '10000000-0000-0000-0000-000000000001', '10709', '10709', 10),
  ('a0000000-0000-0000-0000-000000000025', '10000000-0000-0000-0000-000000000001', '10711', '10711', 10),
  ('a0000000-0000-0000-0000-000000000026', '10000000-0000-0000-0000-000000000001', '10713', '10713', 10),
  ('a0000000-0000-0000-0000-000000000027', '10000000-0000-0000-0000-000000000001', '10715', '10715', 10),
  ('a0000000-0000-0000-0000-000000000028', '10000000-0000-0000-0000-000000000001', '10717', '10717', 10),
  ('a0000000-0000-0000-0000-000000000029', '10000000-0000-0000-0000-000000000001', '10719', '10719', 10),
  ('a0000000-0000-0000-0000-00000000002a', '10000000-0000-0000-0000-000000000001', '10777', '10777', 10),
  ('a0000000-0000-0000-0000-00000000002b', '10000000-0000-0000-0000-000000000001', '10779', '10779', 10),
  ('a0000000-0000-0000-0000-00000000002c', '10000000-0000-0000-0000-000000000001', '10781', '10781', 10),
  ('a0000000-0000-0000-0000-00000000002d', '10000000-0000-0000-0000-000000000001', '10783', '10783', 10),
  ('a0000000-0000-0000-0000-00000000002e', '10000000-0000-0000-0000-000000000001', '10785', '10785', 10),
  ('a0000000-0000-0000-0000-00000000002f', '10000000-0000-0000-0000-000000000001', '10787', '10787', 10),
  ('a0000000-0000-0000-0000-000000000030', '10000000-0000-0000-0000-000000000001', '10789', '10789', 10),
  ('a0000000-0000-0000-0000-000000000031', '10000000-0000-0000-0000-000000000001', '10823', '10823', 10),
  ('a0000000-0000-0000-0000-000000000032', '10000000-0000-0000-0000-000000000001', '10825', '10825', 10),
  ('a0000000-0000-0000-0000-000000000033', '10000000-0000-0000-0000-000000000001', '10827', '10827', 10),
  ('a0000000-0000-0000-0000-000000000034', '10000000-0000-0000-0000-000000000001', '10829', '10829', 10),
  ('a0000000-0000-0000-0000-000000000035', '10000000-0000-0000-0000-000000000001', '10961', '10961', 10),
  ('a0000000-0000-0000-0000-000000000036', '10000000-0000-0000-0000-000000000001', '10963', '10963', 10),
  ('a0000000-0000-0000-0000-000000000037', '10000000-0000-0000-0000-000000000001', '10965', '10965', 10),
  ('a0000000-0000-0000-0000-000000000038', '10000000-0000-0000-0000-000000000001', '10967', '10967', 10),
  ('a0000000-0000-0000-0000-000000000039', '10000000-0000-0000-0000-000000000001', '10969', '10969', 10),
  ('a0000000-0000-0000-0000-00000000003a', '10000000-0000-0000-0000-000000000001', '10997', '10997', 10),
  ('a0000000-0000-0000-0000-00000000003b', '10000000-0000-0000-0000-000000000001', '10999', '10999', 10),
  ('a0000000-0000-0000-0000-00000000003c', '10000000-0000-0000-0000-000000000001', '12043', '12043', 10),
  ('a0000000-0000-0000-0000-00000000003d', '10000000-0000-0000-0000-000000000001', '12045', '12045', 10),
  ('a0000000-0000-0000-0000-00000000003e', '10000000-0000-0000-0000-000000000001', '12047', '12047', 10),
  ('a0000000-0000-0000-0000-00000000003f', '10000000-0000-0000-0000-000000000001', '12049', '12049', 10),
  ('a0000000-0000-0000-0000-000000000040', '10000000-0000-0000-0000-000000000001', '12051', '12051', 10),
  ('a0000000-0000-0000-0000-000000000041', '10000000-0000-0000-0000-000000000001', '12053', '12053', 10),
  ('a0000000-0000-0000-0000-000000000042', '10000000-0000-0000-0000-000000000001', '12055', '12055', 10),
  ('a0000000-0000-0000-0000-000000000043', '10000000-0000-0000-0000-000000000001', '12057', '12057', 10),
  ('a0000000-0000-0000-0000-000000000044', '10000000-0000-0000-0000-000000000001', '12059', '12059', 10),
  ('a0000000-0000-0000-0000-000000000045', '10000000-0000-0000-0000-000000000001', '12099', '12099', 10),
  ('a0000000-0000-0000-0000-000000000046', '10000000-0000-0000-0000-000000000001', '12101', '12101', 10),
  ('a0000000-0000-0000-0000-000000000047', '10000000-0000-0000-0000-000000000001', '12103', '12103', 10),
  ('a0000000-0000-0000-0000-000000000048', '10000000-0000-0000-0000-000000000001', '12105', '12105', 10),
  ('a0000000-0000-0000-0000-000000000049', '10000000-0000-0000-0000-000000000001', '12107', '12107', 10),
  ('a0000000-0000-0000-0000-00000000004a', '10000000-0000-0000-0000-000000000001', '12109', '12109', 10),
  ('a0000000-0000-0000-0000-00000000004b', '10000000-0000-0000-0000-000000000001', '12157', '12157', 10),
  ('a0000000-0000-0000-0000-00000000004c', '10000000-0000-0000-0000-000000000001', '12159', '12159', 10),
  ('a0000000-0000-0000-0000-00000000004d', '10000000-0000-0000-0000-000000000001', '12161', '12161', 10),
  ('a0000000-0000-0000-0000-00000000004e', '10000000-0000-0000-0000-000000000001', '12163', '12163', 10),
  ('a0000000-0000-0000-0000-00000000004f', '10000000-0000-0000-0000-000000000001', '12165', '12165', 10),
  ('a0000000-0000-0000-0000-000000000050', '10000000-0000-0000-0000-000000000001', '12167', '12167', 10),
  ('a0000000-0000-0000-0000-000000000051', '10000000-0000-0000-0000-000000000001', '12169', '12169', 10),
  ('a0000000-0000-0000-0000-000000000052', '10000000-0000-0000-0000-000000000001', '12203', '12203', 10),
  ('a0000000-0000-0000-0000-000000000053', '10000000-0000-0000-0000-000000000001', '12205', '12205', 10),
  ('a0000000-0000-0000-0000-000000000054', '10000000-0000-0000-0000-000000000001', '12207', '12207', 10),
  ('a0000000-0000-0000-0000-000000000055', '10000000-0000-0000-0000-000000000001', '12209', '12209', 10),
  ('a0000000-0000-0000-0000-000000000056', '10000000-0000-0000-0000-000000000001', '12247', '12247', 10),
  ('a0000000-0000-0000-0000-000000000057', '10000000-0000-0000-0000-000000000001', '12249', '12249', 10),
  ('a0000000-0000-0000-0000-000000000058', '10000000-0000-0000-0000-000000000001', '12277', '12277', 10),
  ('a0000000-0000-0000-0000-000000000059', '10000000-0000-0000-0000-000000000001', '12279', '12279', 10),
  ('a0000000-0000-0000-0000-00000000005a', '10000000-0000-0000-0000-000000000001', '12305', '12305', 10),
  ('a0000000-0000-0000-0000-00000000005b', '10000000-0000-0000-0000-000000000001', '12307', '12307', 10),
  ('a0000000-0000-0000-0000-00000000005c', '10000000-0000-0000-0000-000000000001', '12309', '12309', 10),
  ('a0000000-0000-0000-0000-00000000005d', '10000000-0000-0000-0000-000000000001', '12347', '12347', 10),
  ('a0000000-0000-0000-0000-00000000005e', '10000000-0000-0000-0000-000000000001', '12349', '12349', 10),
  ('a0000000-0000-0000-0000-00000000005f', '10000000-0000-0000-0000-000000000001', '12351', '12351', 10),
  ('a0000000-0000-0000-0000-000000000060', '10000000-0000-0000-0000-000000000001', '12353', '12353', 10),
  ('a0000000-0000-0000-0000-000000000061', '10000000-0000-0000-0000-000000000001', '12355', '12355', 10),
  ('a0000000-0000-0000-0000-000000000062', '10000000-0000-0000-0000-000000000001', '12357', '12357', 10),
  ('a0000000-0000-0000-0000-000000000063', '10000000-0000-0000-0000-000000000001', '12359', '12359', 10),
  ('a0000000-0000-0000-0000-000000000064', '10000000-0000-0000-0000-000000000001', '12435', '12435', 10),
  ('a0000000-0000-0000-0000-000000000065', '10000000-0000-0000-0000-000000000001', '12437', '12437', 10),
  ('a0000000-0000-0000-0000-000000000066', '10000000-0000-0000-0000-000000000001', '12439', '12439', 10),
  ('a0000000-0000-0000-0000-000000000067', '10000000-0000-0000-0000-000000000001', '12459', '12459', 10),
  ('a0000000-0000-0000-0000-000000000068', '10000000-0000-0000-0000-000000000001', '12487', '12487', 10),
  ('a0000000-0000-0000-0000-000000000069', '10000000-0000-0000-0000-000000000001', '12489', '12489', 10),
  ('a0000000-0000-0000-0000-00000000006a', '10000000-0000-0000-0000-000000000001', '12524', '12524', 10),
  ('a0000000-0000-0000-0000-00000000006b', '10000000-0000-0000-0000-000000000001', '12526', '12526', 10),
  ('a0000000-0000-0000-0000-00000000006c', '10000000-0000-0000-0000-000000000001', '12527', '12527', 10),
  ('a0000000-0000-0000-0000-00000000006d', '10000000-0000-0000-0000-000000000001', '12555', '12555', 10),
  ('a0000000-0000-0000-0000-00000000006e', '10000000-0000-0000-0000-000000000001', '12557', '12557', 10),
  ('a0000000-0000-0000-0000-00000000006f', '10000000-0000-0000-0000-000000000001', '12559', '12559', 10),
  ('a0000000-0000-0000-0000-000000000070', '10000000-0000-0000-0000-000000000001', '12587', '12587', 10),
  ('a0000000-0000-0000-0000-000000000071', '10000000-0000-0000-0000-000000000001', '12589', '12589', 10),
  ('a0000000-0000-0000-0000-000000000072', '10000000-0000-0000-0000-000000000001', '12619', '12619', 10),
  ('a0000000-0000-0000-0000-000000000073', '10000000-0000-0000-0000-000000000001', '12621', '12621', 10),
  ('a0000000-0000-0000-0000-000000000074', '10000000-0000-0000-0000-000000000001', '12623', '12623', 10),
  ('a0000000-0000-0000-0000-000000000075', '10000000-0000-0000-0000-000000000001', '12627', '12627', 10),
  ('a0000000-0000-0000-0000-000000000076', '10000000-0000-0000-0000-000000000001', '12629', '12629', 10),
  ('a0000000-0000-0000-0000-000000000077', '10000000-0000-0000-0000-000000000001', '12679', '12679', 10),
  ('a0000000-0000-0000-0000-000000000078', '10000000-0000-0000-0000-000000000001', '12681', '12681', 10),
  ('a0000000-0000-0000-0000-000000000079', '10000000-0000-0000-0000-000000000001', '12683', '12683', 10),
  ('a0000000-0000-0000-0000-00000000007a', '10000000-0000-0000-0000-000000000001', '12685', '12685', 10),
  ('a0000000-0000-0000-0000-00000000007b', '10000000-0000-0000-0000-000000000001', '12687', '12687', 10),
  ('a0000000-0000-0000-0000-00000000007c', '10000000-0000-0000-0000-000000000001', '12689', '12689', 10),
  ('a0000000-0000-0000-0000-00000000007d', '10000000-0000-0000-0000-000000000001', '13051', '13051', 10),
  ('a0000000-0000-0000-0000-00000000007e', '10000000-0000-0000-0000-000000000001', '13053', '13053', 10),
  ('a0000000-0000-0000-0000-00000000007f', '10000000-0000-0000-0000-000000000001', '13055', '13055', 10),
  ('a0000000-0000-0000-0000-000000000080', '10000000-0000-0000-0000-000000000001', '13057', '13057', 10),
  ('a0000000-0000-0000-0000-000000000081', '10000000-0000-0000-0000-000000000001', '13059', '13059', 10),
  ('a0000000-0000-0000-0000-000000000082', '10000000-0000-0000-0000-000000000001', '13086', '13086', 10),
  ('a0000000-0000-0000-0000-000000000083', '10000000-0000-0000-0000-000000000001', '13088', '13088', 10),
  ('a0000000-0000-0000-0000-000000000084', '10000000-0000-0000-0000-000000000001', '13089', '13089', 10),
  ('a0000000-0000-0000-0000-000000000085', '10000000-0000-0000-0000-000000000001', '13125', '13125', 10),
  ('a0000000-0000-0000-0000-000000000086', '10000000-0000-0000-0000-000000000001', '13127', '13127', 10),
  ('a0000000-0000-0000-0000-000000000087', '10000000-0000-0000-0000-000000000001', '13129', '13129', 10),
  ('a0000000-0000-0000-0000-000000000088', '10000000-0000-0000-0000-000000000001', '13156', '13156', 10),
  ('a0000000-0000-0000-0000-000000000089', '10000000-0000-0000-0000-000000000001', '13158', '13158', 10),
  ('a0000000-0000-0000-0000-00000000008a', '10000000-0000-0000-0000-000000000001', '13159', '13159', 10),
  ('a0000000-0000-0000-0000-00000000008b', '10000000-0000-0000-0000-000000000001', '13187', '13187', 10),
  ('a0000000-0000-0000-0000-00000000008c', '10000000-0000-0000-0000-000000000001', '13189', '13189', 10),
  ('a0000000-0000-0000-0000-00000000008d', '10000000-0000-0000-0000-000000000001', '13347', '13347', 10),
  ('a0000000-0000-0000-0000-00000000008e', '10000000-0000-0000-0000-000000000001', '13349', '13349', 10),
  ('a0000000-0000-0000-0000-00000000008f', '10000000-0000-0000-0000-000000000001', '13351', '13351', 10),
  ('a0000000-0000-0000-0000-000000000090', '10000000-0000-0000-0000-000000000001', '13353', '13353', 10),
  ('a0000000-0000-0000-0000-000000000091', '10000000-0000-0000-0000-000000000001', '13355', '13355', 10),
  ('a0000000-0000-0000-0000-000000000092', '10000000-0000-0000-0000-000000000001', '13357', '13357', 10),
  ('a0000000-0000-0000-0000-000000000093', '10000000-0000-0000-0000-000000000001', '13359', '13359', 10),
  ('a0000000-0000-0000-0000-000000000094', '10000000-0000-0000-0000-000000000001', '13403', '13403', 10),
  ('a0000000-0000-0000-0000-000000000095', '10000000-0000-0000-0000-000000000001', '13405', '13405', 10),
  ('a0000000-0000-0000-0000-000000000096', '10000000-0000-0000-0000-000000000001', '13407', '13407', 10),
  ('a0000000-0000-0000-0000-000000000097', '10000000-0000-0000-0000-000000000001', '13409', '13409', 10),
  ('a0000000-0000-0000-0000-000000000098', '10000000-0000-0000-0000-000000000001', '13435', '13435', 10),
  ('a0000000-0000-0000-0000-000000000099', '10000000-0000-0000-0000-000000000001', '13437', '13437', 10),
  ('a0000000-0000-0000-0000-00000000009a', '10000000-0000-0000-0000-000000000001', '13439', '13439', 10),
  ('a0000000-0000-0000-0000-00000000009b', '10000000-0000-0000-0000-000000000001', '13465', '13465', 10),
  ('a0000000-0000-0000-0000-00000000009c', '10000000-0000-0000-0000-000000000001', '13467', '13467', 10),
  ('a0000000-0000-0000-0000-00000000009d', '10000000-0000-0000-0000-000000000001', '13469', '13469', 10),
  ('a0000000-0000-0000-0000-00000000009e', '10000000-0000-0000-0000-000000000001', '13503', '13503', 10),
  ('a0000000-0000-0000-0000-00000000009f', '10000000-0000-0000-0000-000000000001', '13505', '13505', 10),
  ('a0000000-0000-0000-0000-0000000000a0', '10000000-0000-0000-0000-000000000001', '13507', '13507', 10),
  ('a0000000-0000-0000-0000-0000000000a1', '10000000-0000-0000-0000-000000000001', '13509', '13509', 10),
  ('a0000000-0000-0000-0000-0000000000a2', '10000000-0000-0000-0000-000000000001', '13581', '13581', 10),
  ('a0000000-0000-0000-0000-0000000000a3', '10000000-0000-0000-0000-000000000001', '13583', '13583', 10),
  ('a0000000-0000-0000-0000-0000000000a4', '10000000-0000-0000-0000-000000000001', '13585', '13585', 10),
  ('a0000000-0000-0000-0000-0000000000a5', '10000000-0000-0000-0000-000000000001', '13587', '13587', 10),
  ('a0000000-0000-0000-0000-0000000000a6', '10000000-0000-0000-0000-000000000001', '13589', '13589', 10),
  ('a0000000-0000-0000-0000-0000000000a7', '10000000-0000-0000-0000-000000000001', '13591', '13591', 10),
  ('a0000000-0000-0000-0000-0000000000a8', '10000000-0000-0000-0000-000000000001', '13593', '13593', 10),
  ('a0000000-0000-0000-0000-0000000000a9', '10000000-0000-0000-0000-000000000001', '13595', '13595', 10),
  ('a0000000-0000-0000-0000-0000000000aa', '10000000-0000-0000-0000-000000000001', '13597', '13597', 10),
  ('a0000000-0000-0000-0000-0000000000ab', '10000000-0000-0000-0000-000000000001', '13599', '13599', 10),
  ('a0000000-0000-0000-0000-0000000000ac', '10000000-0000-0000-0000-000000000001', '13627', '13627', 10),
  ('a0000000-0000-0000-0000-0000000000ad', '10000000-0000-0000-0000-000000000001', '13629', '13629', 10),
  ('a0000000-0000-0000-0000-0000000000ae', '10000000-0000-0000-0000-000000000001', '14050', '14050', 10),
  ('a0000000-0000-0000-0000-0000000000af', '10000000-0000-0000-0000-000000000001', '14052', '14052', 10),
  ('a0000000-0000-0000-0000-0000000000b0', '10000000-0000-0000-0000-000000000001', '14053', '14053', 10),
  ('a0000000-0000-0000-0000-0000000000b1', '10000000-0000-0000-0000-000000000001', '14055', '14055', 10),
  ('a0000000-0000-0000-0000-0000000000b2', '10000000-0000-0000-0000-000000000001', '14057', '14057', 10),
  ('a0000000-0000-0000-0000-0000000000b3', '10000000-0000-0000-0000-000000000001', '14059', '14059', 10),
  ('a0000000-0000-0000-0000-0000000000b4', '10000000-0000-0000-0000-000000000001', '14089', '14089', 10),
  ('a0000000-0000-0000-0000-0000000000b5', '10000000-0000-0000-0000-000000000001', '14109', '14109', 10),
  ('a0000000-0000-0000-0000-0000000000b6', '10000000-0000-0000-0000-000000000001', '14129', '14129', 10),
  ('a0000000-0000-0000-0000-0000000000b7', '10000000-0000-0000-0000-000000000001', '14163', '14163', 10),
  ('a0000000-0000-0000-0000-0000000000b8', '10000000-0000-0000-0000-000000000001', '14165', '14165', 10),
  ('a0000000-0000-0000-0000-0000000000b9', '10000000-0000-0000-0000-000000000001', '14167', '14167', 10),
  ('a0000000-0000-0000-0000-0000000000ba', '10000000-0000-0000-0000-000000000001', '14169', '14169', 10),
  ('a0000000-0000-0000-0000-0000000000bb', '10000000-0000-0000-0000-000000000001', '14193', '14193', 10),
  ('a0000000-0000-0000-0000-0000000000bc', '10000000-0000-0000-0000-000000000001', '14195', '14195', 10),
  ('a0000000-0000-0000-0000-0000000000bd', '10000000-0000-0000-0000-000000000001', '14197', '14197', 10),
  ('a0000000-0000-0000-0000-0000000000be', '10000000-0000-0000-0000-000000000001', '14199', '14199', 10)
ON CONFLICT DO NOTHING;

