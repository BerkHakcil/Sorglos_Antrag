-- ============================================================
-- Migration: 20260607000002_rls_policies
-- Hilfe-zur-Pflege — Row Level Security, Milestone 1
--
-- Strategy: RLS is defense-in-depth. The primary identity check
-- is supabase.auth.getClaims() in server code (lib/dal.ts).
-- These policies ensure that even a direct API call carrying
-- the publishable key can only touch the caller's own data.
--
-- Two app-level principals:
--   authenticated  — logged-in user (profiles.role = 'user')
--   admin          — staff row with profiles.role = 'admin'
--
-- The service role (SUPABASE_SECRET_KEY / createAdminClient)
-- bypasses RLS unconditionally; it is used for cross-ownership
-- writes: trigger fallback, document reconcile, status changes.
-- ============================================================

-- ─── Helper: cheap admin check ────────────────────────────
--
-- SECURITY DEFINER so it reads profiles without triggering the
-- profiles RLS policies (runs as function owner = postgres).
-- STABLE: result is fixed within one statement; Postgres caches
-- it across multiple policy evaluations in the same query.

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
$$;

-- ═══════════════════════════════════════════════════════════
-- ENABLE RLS ON ALL TABLES
-- ═══════════════════════════════════════════════════════════

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

-- ═══════════════════════════════════════════════════════════
-- CONFIG TABLES — read-only for authenticated users
--
-- Nobody writes to these tables via client — changes go
-- through migrations / supabase/seed.sql / Supabase Studio.
-- The questionnaire engine and PLZ resolver are server-side
-- but use the publishable-key client (RLS applies), so these
-- SELECT policies are necessary for the engine to function.
-- ═══════════════════════════════════════════════════════════

-- Care-home dropdown in M2
CREATE POLICY "care_home: authenticated read active"
  ON public.care_home FOR SELECT TO authenticated
  USING (is_active = true);

-- Social-office display after PLZ resolution
CREATE POLICY "social_office: authenticated read active"
  ON public.social_office FOR SELECT TO authenticated
  USING (is_active = true);

-- PLZ resolver (M2)
CREATE POLICY "postal_code_rule: authenticated read"
  ON public.postal_code_rule FOR SELECT TO authenticated
  USING (true);

-- Questionnaire engine (M2)
CREATE POLICY "questionnaire: authenticated read active"
  ON public.questionnaire FOR SELECT TO authenticated
  USING (is_active = true);

CREATE POLICY "category: authenticated read"
  ON public.category FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "question_group: authenticated read"
  ON public.question_group FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "question: authenticated read"
  ON public.question FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "question_option: authenticated read"
  ON public.question_option FOR SELECT TO authenticated
  USING (true);

-- Document engine (M4)
CREATE POLICY "document_type: authenticated read"
  ON public.document_type FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "document_rule: authenticated read"
  ON public.document_rule FOR SELECT TO authenticated
  USING (true);

-- ═══════════════════════════════════════════════════════════
-- PROFILES
-- ═══════════════════════════════════════════════════════════

-- Permissive SELECT policies are OR-ed by Postgres:
-- a user matches the first (own row); an admin matches the second.
CREATE POLICY "profiles: user reads own"
  ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "profiles: admin reads all"
  ON public.profiles FOR SELECT TO authenticated
  USING (public.is_admin());

-- Users update their own profile (full_name, consents).
-- WITH CHECK prevents role self-escalation: the role value in
-- the new row must equal what is already stored for this user.
CREATE POLICY "profiles: user updates own"
  ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND role = (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid())
  );

-- INSERT: handled by handle_new_user() trigger (SECURITY DEFINER).
-- DELETE: cascades from auth.users — no policy needed.

-- ═══════════════════════════════════════════════════════════
-- CASES
-- ═══════════════════════════════════════════════════════════

CREATE POLICY "cases: user reads own"
  ON public.cases FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "cases: admin reads all"
  ON public.cases FOR SELECT TO authenticated
  USING (public.is_admin());

-- User updates their own case via Server Actions (care_home_id,
-- plz_before_move, questionnaire_id, status). Business rules
-- (e.g. status can only go forward) are enforced in server code.
CREATE POLICY "cases: user updates own"
  ON public.cases FOR UPDATE TO authenticated
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- INSERT: handle_new_user() trigger. DELETE: cascades from auth.users.

-- ═══════════════════════════════════════════════════════════
-- ANSWER
-- ═══════════════════════════════════════════════════════════
--
-- All operations are scoped to the caller's case.
-- The sub-select is safe: UNIQUE(cases.user_id) guarantees
-- at most one row, so no set-returning ambiguity.
-- cases RLS also filters the sub-select, adding a second layer.

CREATE POLICY "answer: user reads own"
  ON public.answer FOR SELECT TO authenticated
  USING (case_id = (SELECT id FROM public.cases WHERE user_id = auth.uid()));

CREATE POLICY "answer: admin reads all"
  ON public.answer FOR SELECT TO authenticated
  USING (public.is_admin());

CREATE POLICY "answer: user inserts own"
  ON public.answer FOR INSERT TO authenticated
  WITH CHECK (case_id = (SELECT id FROM public.cases WHERE user_id = auth.uid()));

CREATE POLICY "answer: user updates own"
  ON public.answer FOR UPDATE TO authenticated
  USING  (case_id = (SELECT id FROM public.cases WHERE user_id = auth.uid()))
  WITH CHECK (case_id = (SELECT id FROM public.cases WHERE user_id = auth.uid()));

-- DELETE needed in M2 when a user removes a repeatable-group instance.
CREATE POLICY "answer: user deletes own"
  ON public.answer FOR DELETE TO authenticated
  USING (case_id = (SELECT id FROM public.cases WHERE user_id = auth.uid()));

-- ═══════════════════════════════════════════════════════════
-- CASE_DOCUMENT_REQUIREMENT
-- ═══════════════════════════════════════════════════════════
--
-- Users read their own requirement list.
-- INSERT/UPDATE (reconcile, status changes) go through server
-- code using createAdminClient(), which bypasses RLS.
-- No client-side write policies are needed or wanted here.

CREATE POLICY "case_document_requirement: user reads own"
  ON public.case_document_requirement FOR SELECT TO authenticated
  USING (case_id = (SELECT id FROM public.cases WHERE user_id = auth.uid()));

CREATE POLICY "case_document_requirement: admin reads all"
  ON public.case_document_requirement FOR SELECT TO authenticated
  USING (public.is_admin());

-- ═══════════════════════════════════════════════════════════
-- DOCUMENT_UPLOAD
-- ═══════════════════════════════════════════════════════════

-- Read: user sees their own uploads (joined through requirement → case).
CREATE POLICY "document_upload: user reads own"
  ON public.document_upload FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM   public.case_document_requirement cdr
      JOIN   public.cases c ON c.id = cdr.case_id
      WHERE  cdr.id = document_upload.requirement_id
        AND  c.user_id = auth.uid()
    )
  );

CREATE POLICY "document_upload: admin reads all"
  ON public.document_upload FOR SELECT TO authenticated
  USING (public.is_admin());

-- Insert (M4): uploader must be the authenticated user, and the
-- requirement must belong to that user's own case.
CREATE POLICY "document_upload: user inserts own"
  ON public.document_upload FOR INSERT TO authenticated
  WITH CHECK (
    uploaded_by = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM   public.case_document_requirement cdr
      JOIN   public.cases c ON c.id = cdr.case_id
      WHERE  cdr.id = requirement_id
        AND  c.user_id = auth.uid()
    )
  );

-- Uploads are immutable — no UPDATE or DELETE policies.

-- ═══════════════════════════════════════════════════════════
-- STATUS_EVENT
-- ═══════════════════════════════════════════════════════════
--
-- Append-only audit log. Users can read their own events.
-- INSERTs go exclusively through createAdminClient() in server
-- code — no client INSERT policy is needed or granted.

CREATE POLICY "status_event: user reads own"
  ON public.status_event FOR SELECT TO authenticated
  USING (case_id = (SELECT id FROM public.cases WHERE user_id = auth.uid()));

CREATE POLICY "status_event: admin reads all"
  ON public.status_event FOR SELECT TO authenticated
  USING (public.is_admin());

-- No INSERT/UPDATE/DELETE policies — written via admin client only.
