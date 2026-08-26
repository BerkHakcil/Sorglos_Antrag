-- ============================================================
-- Migration: 20260826000001_fallback_excluded_rule_ids
-- Fallback document list fix — Gate 1 (founder, 2026-08-26): Line A.
--
-- Cases served by the default-office FALLBACK branch (rule-less or
-- office-less cases — lib/rules-source.ts) stop being asked for the default
-- office's house-specific entries. Line A drops exactly the trio the repo
-- documents as the accepted over-collection (known-limitations.md), each
-- confirmed office-specific by Roman's master (used_for_offices: "Pankow"):
--   PAN-016  DOC-0009  Nachweis Bedarfsanzeige
--   PAN-017  DOC-0010  Polizeiliche Anmeldung im Heim
--   PAN-018  DOC-0011  Mobilitaetsnachweis
--
-- ADDITIVE ONLY: one new app_config row. No office_document_rule row, no
-- catalog row, no upload row, no storage object is touched — Pankow's and
-- Essen's own-office checklists are byte-identical by construction (the
-- exclusion list is read on the fallback branch only; see
-- lib/rules-source.ts resolveEffectiveRules and its unit tests).
--
-- REAL-DATA REPORT: zero user rows read or written. Effect on live cases
-- (Phase-1 impact table, docs/feedback/fallback_docs_phase1.md §4 Line A):
-- every fallback-served case loses the same three always-fire person_1
-- slots; no missing count increases; the complete case 52e364f1 stays at
-- missing 0; 4 existing uploads (3 on 52e364f1, 1 on 78293a6c) become
-- hidden-but-retained (not_required in the case export). Verified after
-- push by scripts/verify-fallback-doclist.mjs.
--
-- DEPLOY ORDERING: the benign row-add case (CLAUDE.md #8) — the dependent
-- code fail-opens to "no exclusions" while this row is absent, so code and
-- migration may land in either order with no outage window.
--
-- STANDING RULE (recorded in architecture.md §4): any future migration that
-- touches PAN rules OR repoints default_document_office_id must re-review
-- this list — the ids are keyed to the default office's rule set.
--
-- FUTURE CHANGES to the list (e.g. Roman confirms Line B) must use UPDATE:
-- the ON CONFLICT DO NOTHING below is first-insert-only and would silently
-- no-op against the existing row.
-- ============================================================

BEGIN;

-- ── Guard: every excluded id must be an ACTIVE rule of the CURRENT default
--    office. A typo'd or stale id would exclude nothing at runtime
--    (fail-open by design) — catch it here, at push time, instead.
DO $$
DECLARE
  v_default_office TEXT;
  v_id TEXT;
BEGIN
  SELECT value #>> '{}' INTO v_default_office
    FROM public.app_config WHERE key = 'default_document_office_id';
  IF v_default_office IS NULL THEN
    RAISE EXCEPTION 'default_document_office_id missing - fallback exclusions would be meaningless';
  END IF;

  FOR v_id IN SELECT jsonb_array_elements_text('["PAN-016","PAN-017","PAN-018"]'::jsonb) LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.office_document_rule
       WHERE id = v_id AND social_office_id = v_default_office::uuid AND active
    ) THEN
      RAISE EXCEPTION 'excluded id % is not an active rule of the default office %', v_id, v_default_office;
    END IF;
  END LOOP;

  RAISE NOTICE 'fallback-exclusion guards passed: default office %, all 3 ids active there', v_default_office;
END $$;

INSERT INTO public.app_config (key, value)
VALUES ('fallback_excluded_rule_ids', '["PAN-016","PAN-017","PAN-018"]'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- ── Post-check: the row exists and holds exactly the approved Line-A trio.
DO $$
DECLARE
  v_value JSONB;
BEGIN
  SELECT value INTO v_value
    FROM public.app_config WHERE key = 'fallback_excluded_rule_ids';
  IF v_value IS NULL THEN
    RAISE EXCEPTION 'fallback_excluded_rule_ids row missing after insert';
  END IF;
  IF v_value <> '["PAN-016","PAN-017","PAN-018"]'::jsonb THEN
    RAISE EXCEPTION 'fallback_excluded_rule_ids holds unexpected value % - a pre-existing row was kept (ON CONFLICT DO NOTHING); reconcile deliberately', v_value;
  END IF;
  RAISE NOTICE 'fallback_excluded_rule_ids present: Line A trio';
END $$;

COMMIT;
