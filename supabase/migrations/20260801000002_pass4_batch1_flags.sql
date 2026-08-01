-- Content pass 4, Batch 1 — content flags (D4, D9).
--
-- D4: Essen birth_name becomes OPTIONAL (Roman 2026-07-31), matching Berlin.
--     The B1 optional-completion mechanics are engine-level and already cover
--     Essen (isAnsweredValue in lib/questionnaire-nav.ts); no code change.
--     Real-data impact re-verified 2026-08-01: ZERO Essen-questionnaire cases
--     and ZERO answer rows on this question exist in prod. Essen fresh
--     denominator 50 -> 49 (e2e asserts updated in the Batch-1 code commit).
--
-- D9: Roman's folder assignments — three storage_category flips (the two
--     known flips from his decision + DOC-0042, surfaced by the Phase-A live
--     verification: docs/feedback/pass4_phase_a.md §5). Forward-only by
--     design: categories are read at upload time only; stored files keep
--     their paths. Re-verified 2026-08-01: all 11 prod uploads are legacy
--     UUID paths — zero files under the new scheme, nothing is stranded.
--
-- Each UPDATE is guarded by id + exact current value and asserted; the final
-- block asserts the full partition (Phase-D precedent) so a drifted catalog
-- aborts instead of half-applying.

-- ── D4: Essen birth_name optional ────────────────────────────────────────────
DO $$
DECLARE
  n integer;
BEGIN
  UPDATE public.question
  SET is_required = false
  WHERE id = '61000000-0000-0000-0000-000000000005'
    AND key = 'birth_name'
    AND is_required = true;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN
    RAISE EXCEPTION 'D4 failed: expected exactly 1 Essen birth_name row flipped, got %', n;
  END IF;
  RAISE NOTICE 'D4 applied: Essen birth_name is optional';
END $$;

-- ── D9: three storage_category flips -> Financial ────────────────────────────
DO $$
DECLARE
  n integer;
BEGIN
  UPDATE public.document_catalog
  SET storage_category = 'Financial'
  WHERE id = 'DOC-0005' AND storage_category = 'Insurance';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'D9 DOC-0005 guard failed (rows: %)', n; END IF;

  UPDATE public.document_catalog
  SET storage_category = 'Financial'
  WHERE id = 'DOC-0030' AND storage_category = 'Housing';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'D9 DOC-0030 guard failed (rows: %)', n; END IF;

  UPDATE public.document_catalog
  SET storage_category = 'Financial'
  WHERE id = 'DOC-0042' AND storage_category = 'Housing';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'D9 DOC-0042 guard failed (rows: %)', n; END IF;

  RAISE NOTICE 'D9 applied: DOC-0005 / DOC-0030 / DOC-0042 -> Financial';
END $$;

-- ── D9 post-check: full partition assertion (was 11/7/16/9) ──────────────────
DO $$
DECLARE
  n_personal  integer;
  n_housing   integer;
  n_financial integer;
  n_insurance integer;
  n_total     integer;
BEGIN
  SELECT count(*) FILTER (WHERE storage_category = 'Personal'),
         count(*) FILTER (WHERE storage_category = 'Housing'),
         count(*) FILTER (WHERE storage_category = 'Financial'),
         count(*) FILTER (WHERE storage_category = 'Insurance'),
         count(*)
    INTO n_personal, n_housing, n_financial, n_insurance, n_total
  FROM public.document_catalog;
  IF n_personal <> 11 OR n_housing <> 5 OR n_financial <> 19
     OR n_insurance <> 8 OR n_total <> 43 THEN
    RAISE EXCEPTION 'D9 partition check failed: Personal %, Housing %, Financial %, Insurance %, total % (expected 11/5/19/8/43)',
      n_personal, n_housing, n_financial, n_insurance, n_total;
  END IF;
  RAISE NOTICE 'D9 partition verified: Personal 11, Housing 5, Financial 19, Insurance 8 (43 total)';
END $$;
