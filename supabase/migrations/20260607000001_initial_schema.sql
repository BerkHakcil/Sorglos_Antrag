-- ============================================================
-- Migration: 20260607000001_initial_schema
-- Hilfe-zur-Pflege — full data model, Milestone 1
--
-- Tables follow docs/architecture.md §3 exactly.
-- "case" is a SQL reserved word — we use "cases" throughout.
-- German user-facing text is in *_de columns, never in code.
-- ============================================================

-- ─── Extensions ───────────────────────────────────────────
-- gen_random_uuid() is built into Postgres 13+; no extension needed.

-- ─── Enums ────────────────────────────────────────────────

CREATE TYPE public.user_role AS ENUM ('user', 'admin');

-- All answer types the questionnaire engine supports.
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

-- How well the PLZ resolver matched the user's pre-move postal code.
CREATE TYPE public.plz_resolution_status AS ENUM (
  'resolved',    -- matched to a specific Sozialamt
  'unclear',     -- default initial value; not yet looked up
  'unsupported'  -- no matching rule; fallback questionnaire loaded
);

-- A case moves forward but never backward.
CREATE TYPE public.case_status AS ENUM (
  'in_progress',   -- user is still filling out the questionnaire
  'under_review'   -- all required questions answered; locked for editing
);

-- Life-cycle of one document requirement slot.
CREATE TYPE public.document_requirement_status AS ENUM (
  'please_upload',  -- waiting for the user to upload
  'in_review',      -- uploaded, team is checking
  'checked',        -- accepted
  'resubmit'        -- rejected; user must re-upload
);

-- ─── Shared trigger: set updated_at on any UPDATE ─────────

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- ═══════════════════════════════════════════════════════════
-- CONFIG TABLES  (seeded by developers; German text authored
--                by the co-founder in *_de columns)
-- ═══════════════════════════════════════════════════════════

-- Pflegeheim — care homes that are customers
CREATE TABLE public.care_home (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT        NOT NULL,
  address    TEXT,
  is_active  BOOLEAN     NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE public.care_home IS 'Partner care homes. Users choose one at case start.';

-- Sozialamt — responsible social offices
CREATE TABLE public.social_office (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT        NOT NULL,
  address       TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  is_active     BOOLEAN     NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE public.social_office IS 'Social offices (Sozialämter). Resolved from PLZ rules.';

-- PLZ-Regel — maps postal-code ranges to Sozialämter
-- Equal plz_from / plz_to = single code.
-- Higher priority wins when ranges overlap.
CREATE TABLE public.postal_code_rule (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  social_office_id UUID        NOT NULL REFERENCES public.social_office(id),
  plz_from         TEXT        NOT NULL CHECK (plz_from ~ '^\d{5}$'),
  plz_to           TEXT        NOT NULL CHECK (plz_to   ~ '^\d{5}$'),
  priority         INTEGER     NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT plz_range_valid CHECK (plz_from <= plz_to)
);
COMMENT ON TABLE public.postal_code_rule IS
  'Maps 5-digit German PLZ ranges to a Sozialamt. No match → unsupported/fallback.';

-- Fragebogen — one questionnaire per Sozialamt; NULL social_office_id = fallback
CREATE TABLE public.questionnaire (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  social_office_id UUID        REFERENCES public.social_office(id),
  name             TEXT        NOT NULL,
  version          INTEGER     NOT NULL DEFAULT 1,
  is_active        BOOLEAN     NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE public.questionnaire IS
  'One per Sozialamt plus one fallback (social_office_id IS NULL).';

-- Kategorie — top-level sections within a questionnaire
CREATE TABLE public.category (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  questionnaire_id UUID        NOT NULL REFERENCES public.questionnaire(id) ON DELETE CASCADE,
  key              TEXT        NOT NULL,
  sort_order       INTEGER     NOT NULL DEFAULT 0,
  label_de         TEXT        NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (questionnaire_id, key)
);

-- Wiederholbare Gruppe — optional repeatable group within a category
-- e.g. "children", "pensions" where the user adds N instances
CREATE TABLE public.question_group (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id   UUID        NOT NULL REFERENCES public.category(id) ON DELETE CASCADE,
  key           TEXT        NOT NULL,
  sort_order    INTEGER     NOT NULL DEFAULT 0,
  label_de      TEXT        NOT NULL,
  is_repeatable BOOLEAN     NOT NULL DEFAULT false,
  min_count     INTEGER     NOT NULL DEFAULT 0,
  max_count     INTEGER,               -- NULL = unlimited
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Frage — individual questions; belongs to a category, optionally to a group
-- visibility_rule JSONB example: {"question_key": "marital_status", "value": "married"}
-- validation JSONB example:      {"min": 0, "max": 99999}
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

-- Option — choices for single_select / multi_select questions
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

-- Dokumenttyp catalog — all possible document types
-- is_base = true means the document is always required (no condition needed)
CREATE TABLE public.document_type (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  key            TEXT        NOT NULL UNIQUE,
  label_de       TEXT        NOT NULL,
  description_de TEXT,
  is_base        BOOLEAN     NOT NULL DEFAULT false,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE public.document_type IS
  'Catalog of all possible document types. is_base = always required.';

-- Dokumentregel — expresses which documents are required for a questionnaire
-- condition IS NULL              → base document; always required
-- condition IS NOT NULL          → conditional; required when answers match
-- repeat_per_group_key IS NOT NULL → one requirement per group instance
--   (e.g. one Rentenbescheid per pension the user adds)
CREATE TABLE public.document_rule (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  questionnaire_id     UUID        REFERENCES public.questionnaire(id),
  document_type_id     UUID        NOT NULL REFERENCES public.document_type(id),
  condition            JSONB,
  repeat_per_group_key TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE public.document_rule IS
  'condition NULL = base doc. condition set = conditional doc. '
  'repeat_per_group_key set = one requirement per group instance.';

-- ═══════════════════════════════════════════════════════════
-- RUNTIME TABLES  (populated as users work through the app)
-- ═══════════════════════════════════════════════════════════

-- Extends auth.users with app-specific fields.
-- Consents are set false by default; the signup Server Action updates them.
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

-- One case per user, enforced by the UNIQUE constraint on user_id.
-- 'case' is a SQL reserved word — table is named 'cases'.
-- care_home_id, social_office_id, questionnaire_id are nullable on creation;
-- filled in as the user progresses through the first steps of M2.
CREATE TABLE public.cases (
  id                    UUID                        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID                        NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  care_home_id          UUID                        REFERENCES public.care_home(id),
  social_office_id      UUID                        REFERENCES public.social_office(id),
  questionnaire_id      UUID                        REFERENCES public.questionnaire(id),
  plz_before_move       TEXT,
  plz_resolution_status public.plz_resolution_status NOT NULL DEFAULT 'unclear',
  status                public.case_status           NOT NULL DEFAULT 'in_progress',
  created_at            TIMESTAMPTZ                 NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ                 NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE public.cases IS
  'One row per user. UNIQUE(user_id) is the one-case-per-user enforcement.';

CREATE TRIGGER cases_set_updated_at
  BEFORE UPDATE ON public.cases
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Generic answer store — one row per (case, question, group instance).
--
-- group_instance is a STABLE identifier for repeatable-group instances.
-- Use a generated UUID, not a positional index.  Deleting instance "2"
-- must never renumber instance "3".
-- Non-repeating questions use the sentinel value 'default'.
--
-- The UNIQUE constraint powers idempotent upserts:
--   INSERT ... ON CONFLICT (case_id, question_id, group_instance) DO UPDATE
-- This gives: immediate save + reliable edit + resume-after-reload.
--
-- value JSONB stores any answer type:
--   short_text  → "hello"
--   number      → 42
--   yes_no      → true
--   date        → "2024-01-15"
--   single_select → "option_key"
--   multi_select  → ["opt_a", "opt_b"]
--   address     → {"street": "...", "city": "...", "plz": "..."}
--   person      → {"first_name": "...", "last_name": "...", "dob": "..."}
--   bank_account → {"iban": "...", "bic": "..."}
--   document_upload → null (upload handled by case_document_requirement)
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

-- Materialized per-case document list, computed from document_rule + answers.
-- Never hard-delete rows: mark is_active = false when a requirement becomes
-- irrelevant so existing uploads are never orphaned.
-- Missing docs count = COUNT WHERE status IN ('please_upload','resubmit') AND is_active
CREATE TABLE public.case_document_requirement (
  id               UUID                              PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id          UUID                              NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  document_type_id UUID                              NOT NULL REFERENCES public.document_type(id),
  source_rule_id   UUID                              REFERENCES public.document_rule(id),
  repeat_ref       TEXT,          -- e.g. the group_instance of the pension this covers
  label_de         TEXT           NOT NULL,          -- resolved label, e.g. "Rentenbescheid für Rente 2"
  status           public.document_requirement_status NOT NULL DEFAULT 'please_upload',
  is_active        BOOLEAN        NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE TRIGGER case_document_requirement_set_updated_at
  BEFORE UPDATE ON public.case_document_requirement
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- File metadata only — the actual file lives in private Supabase Storage.
-- storage_path is the object key; signed URLs are generated server-side
-- after an ownership check (Milestone 4). Never store a public URL here.
CREATE TABLE public.document_upload (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  requirement_id    UUID        NOT NULL REFERENCES public.case_document_requirement(id) ON DELETE CASCADE,
  storage_path      TEXT        NOT NULL,
  original_filename TEXT        NOT NULL,
  content_type      TEXT        NOT NULL CHECK (content_type IN ('application/pdf','image/jpeg','image/png','image/heic','image/heif')),
  size_bytes        BIGINT      NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 15728640), -- 15 MB
  uploaded_by       UUID        NOT NULL REFERENCES auth.users(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON COLUMN public.document_upload.storage_path IS
  'Private Supabase Storage object key. NEVER a public URL.';

-- Append-only event log. No updated_at — events are immutable.
-- event_type examples: case_created, social_office_resolved,
--   mandatory_complete, document_uploaded, document_status_changed
CREATE TABLE public.status_event (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id    UUID        NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  event_type TEXT        NOT NULL,
  payload    JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE public.status_event IS
  'Append-only audit log. Rows are never updated or deleted.';

-- ─── New-user trigger ─────────────────────────────────────
--
-- When Supabase Auth creates a user row, this trigger atomically creates:
--   1. A profiles row  (role = 'user'; consents set false until signup form submits)
--   2. A cases row     (the one-and-only case for this user)
--
-- SECURITY DEFINER + search_path = public: runs as the function owner
-- (postgres) so it can write to public.profiles which references auth.users
-- across schemas.  The UNIQUE on cases.user_id prevents any double-insert.

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
-- Postgres does NOT auto-index FK columns; add them explicitly.

-- Primary lookup path: find a case by its owner
CREATE INDEX idx_cases_user_id
  ON public.cases (user_id);

-- Fetch all answers for a case (questionnaire rendering)
CREATE INDEX idx_answer_case_id
  ON public.answer (case_id);

-- Fetch answers for a specific question + group instance (upsert path)
CREATE INDEX idx_answer_question_instance
  ON public.answer (case_id, question_id, group_instance);

-- PLZ resolver: range scan ordered by priority (highest wins)
CREATE INDEX idx_postal_code_rule_plz
  ON public.postal_code_rule (plz_from, plz_to, priority DESC);

-- Load questionnaire structure: categories → question groups → questions
CREATE INDEX idx_category_questionnaire_id
  ON public.category (questionnaire_id, sort_order);

CREATE INDEX idx_question_group_category_id
  ON public.question_group (category_id, sort_order);

CREATE INDEX idx_question_category_id
  ON public.question (category_id, sort_order);

-- Document requirements per case
CREATE INDEX idx_case_doc_req_case_id
  ON public.case_document_requirement (case_id);

-- Status event log per case, in time order
CREATE INDEX idx_status_event_case_created
  ON public.status_event (case_id, created_at);
