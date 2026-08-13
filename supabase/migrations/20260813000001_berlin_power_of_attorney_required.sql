-- Go-live round 2, item 1 (Phase-1 report docs/feedback/golive_round2.md,
-- GO 2026-08-13): Berlin power_of_attorney becomes REQUIRED.
-- Essen legal_guardian_yes_no is already required — assert-only, no change.
--
-- Berlin fresh denominator 52 -> 53; the e2e asserts move in the same batch
-- (feedback-pass L1/L2, m7-regression x2, docs/uat-m7.md) — push this
-- migration FIRST, then run the gate (the suite drives prod data).
--
-- REAL-DATA REPORT (R2, verified 2026-08-12 dumps; the guard below re-verifies
-- at execution time): exactly ONE power_of_attorney answer exists in prod —
-- case 52e364f1 (REAL customer, LOCKED under_review) holds the non-empty value
-- "Bevollmächtigter Angehöriger", so the flip leaves him at 100% (75/75 ->
-- 76/76). ZERO cases hold an empty-string answer for it. The two in_progress
-- cases have no row (they have not reached sort 20) — the question simply
-- surfaces as required for them, which is the desired behavior.
--
-- NO backfill ships (founder decision, Phase-1 open decision 1): if a locked
-- Berlin case WITHOUT a non-empty answer appears between review and push, the
-- guard ABORTS the migration for a named per-case founder decision instead of
-- inventing an answer for a locked real case (pass-4 backfill precedent had an
-- approved per-case table).

BEGIN;

-- ── R2 execution-time guard: no LOCKED Berlin case may lack a non-empty answer ──
DO $$
DECLARE
  bad integer;
BEGIN
  SELECT count(*) INTO bad
  FROM public.cases c
  WHERE c.status = 'under_review'
    AND c.questionnaire_id = '30000000-0000-0000-0000-000000000001'
    AND NOT EXISTS (
      SELECT 1 FROM public.answer a
      WHERE a.case_id = c.id
        AND a.question_id = '60000000-0000-0000-0000-000000000013'
        AND a.group_instance = 'default'
        AND coalesce(a.value #>> '{}', '') <> ''
    );
  IF bad > 0 THEN
    RAISE EXCEPTION 'power_of_attorney flip blocked: % locked case(s) would drop below 100%% — founder decision needed', bad;
  END IF;
  RAISE NOTICE 'locked-case guard passed (0 locked Berlin cases without a non-empty answer)';
END $$;

-- ── The flip: value-guarded + asserted ────────────────────────────────────────
DO $$
DECLARE
  n integer;
BEGIN
  UPDATE public.question
  SET is_required = true
  WHERE id = '60000000-0000-0000-0000-000000000013'
    AND key = 'power_of_attorney'
    AND is_required = false;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN
    RAISE EXCEPTION 'item 1 failed: expected exactly 1 Berlin power_of_attorney row flipped, got %', n;
  END IF;
  RAISE NOTICE 'item 1 applied: Berlin power_of_attorney is required (fresh denominator 52 -> 53)';
END $$;

-- ── Essen assert-only: must already be required ───────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.question
    WHERE id = '61000000-0000-0000-0000-000000000011'
      AND key = 'legal_guardian_yes_no'
      AND is_required = true
  ) THEN
    RAISE EXCEPTION 'Essen legal_guardian_yes_no is not in the expected already-required state';
  END IF;
  RAISE NOTICE 'Essen verified: legal_guardian_yes_no already required — no change';
END $$;

COMMIT;
