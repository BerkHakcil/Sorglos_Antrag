-- Feedback pass 3, item 5 (Phase C) — deactivate the Pankow person_2 Vollmacht
-- rule (PAN-011): a spouse "Vertretungsvollmacht / Betreuungsnachweis" slot was
-- appearing on married Pankow/default checklists. Roman flagged it; Essen is
-- correct already (ESS-012 is person_1-only, no person_2 twin).
--
-- R6 (prefer deactivation over deletion) — and here deletion is impossible
-- anyway: document_upload.rule_id REFERENCES office_document_rule(id) with no
-- ON DELETE, so a DELETE would be blocked the moment any upload referenced the
-- rule. The table had no deactivation flag, hence the additive column below.
--
-- ORDER INSIDE THIS FILE IS DELIBERATE (founder instruction):
--   1. add `active` (NOT NULL DEFAULT true — existing rows backfill to true)
--   2. ASSERT the backfill covered every row (105 at this point in history)
--   3. only then flip PAN-011 to false (asserting exactly one row)
-- Each assertion aborts the whole migration (single transaction) rather than
-- leaving a half-applied state.
--
-- REAL-DATA REPORT (checked against the LIVE upload table at execution time):
--   14 upload rows — PAN-001 x7, PAN-002 x1, PAN-005 x2, PAN-012 x1,
--   PAN-014 x2, PAN-017 x1. References to PAN-011: ZERO. Uploads of DOC-0006
--   (Vollmacht) via any rule: ZERO. No user file is stranded by this flip.
--   Deactivating a rule that DOES have uploads would hide those files from the
--   user's checklist (they remain in storage + in `case:export`) — documented
--   trade-off, see docs/feedback/pass3_state.md and the milestone log.
--
-- Read paths filter `active = true`: lib/dal.ts (own office + default-office
-- fallback) and scripts/case-export.mjs. The existing RLS SELECT policy is
-- USING (true) and covers the new column unchanged.

BEGIN;

-- 1. additive column ---------------------------------------------------------
ALTER TABLE public.office_document_rule
  ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE;

-- 2. verify the backfill BEFORE touching any row -----------------------------
DO $$
DECLARE
  total   INTEGER;
  actives INTEGER;
BEGIN
  SELECT COUNT(*), COUNT(*) FILTER (WHERE active IS TRUE)
    INTO total, actives
    FROM public.office_document_rule;

  IF actives <> total THEN
    RAISE EXCEPTION 'Backfill incomplete: % of % rows are active', actives, total;
  END IF;

  IF total <> 105 THEN
    RAISE EXCEPTION 'Unexpected rule count %: expected 105 (50 PAN + 55 ESS)', total;
  END IF;

  RAISE NOTICE 'Backfill verified: all % rules active', total;
END $$;

-- 3. deactivate PAN-011 ------------------------------------------------------
DO $$
DECLARE
  touched INTEGER;
BEGIN
  UPDATE public.office_document_rule
     SET active = FALSE
   WHERE id = 'PAN-011';

  GET DIAGNOSTICS touched = ROW_COUNT;
  IF touched <> 1 THEN
    RAISE EXCEPTION 'Expected to deactivate exactly 1 rule (PAN-011), touched %', touched;
  END IF;

  RAISE NOTICE 'PAN-011 deactivated (person_2 Vollmacht slot removed)';
END $$;

COMMIT;
