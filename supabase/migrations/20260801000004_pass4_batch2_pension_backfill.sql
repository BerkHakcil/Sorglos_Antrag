-- Content pass 4, Batch 2 — pension_count backfill for existing cases (D15).
-- Approved table: docs/feedback/pass4_phase_a.md §A1.5 (founder 2026-08-01:
-- instances where present, Ja→1/Nein→0; the locked Keine-Rente case → 0 with
-- the accepted history-row disappearance).
--
-- Execution-time R2 re-verification ran read-only on 2026-08-01 immediately
-- before this file was handed over: the three REAL cases matched the
-- approved table byte-for-byte. ⚠ One recorded deviation from the table:
-- the tabled TEST fixture (88eede8b, → 1) no longer exists — it was
-- garbage-collected by the completion-fixture re-seeds during the Batch-1
-- gate. TEST fixtures get NO backfill (they are re-seeded throwaways; the
-- current one is consumed and will be GC'd by the next seed). Only the
-- three REAL cases are backfilled below.
--
-- Guards: each real case's CURRENT state is asserted before its insert —
-- any drift from the approved table ABORTS the whole migration (founder
-- gate). A case that does not exist at all is skipped with a NOTICE: that
-- is the local-replay path (no prod cases exist there — Additive-Backfill
-- precedent, 2026-07-23); on prod, existence was verified pre-push and is
-- re-verified post-push.
--
-- Locked-case invariant: both under_review cases end at 100 % — their
-- pension_count is answered and their remaining instances are complete
-- (fc446257) or excluded by count 0 (298ac66b).

DO $$
DECLARE
  n integer;
  v_pair text;
BEGIN
  -- ── d345b0f9 (REAL, in_progress): 2 filled instances, hat_rente=Ja → '2' ──
  IF EXISTS (SELECT 1 FROM public.cases WHERE id = 'd345b0f9-5c67-4600-a897-eee87338547f') THEN
    SELECT value #>> '{}' INTO v_pair FROM public.answer
    WHERE case_id = 'd345b0f9-5c67-4600-a897-eee87338547f'
      AND question_id = '60000000-0000-0000-0000-000000000004' AND group_instance = 'default';
    IF v_pair IS DISTINCT FROM 'Ja' THEN
      RAISE EXCEPTION 'd345b0f9 drift: hat_rente = % (approved table says Ja) — STOP', v_pair;
    END IF;
    SELECT count(DISTINCT group_instance) INTO n FROM public.answer
    WHERE case_id = 'd345b0f9-5c67-4600-a897-eee87338547f'
      AND question_id = '60000000-0000-0000-0000-000000000039' AND group_instance <> 'default';
    IF n <> 2 THEN
      RAISE EXCEPTION 'd345b0f9 drift: % pension instances (approved table says 2) — STOP', n;
    END IF;
    INSERT INTO public.answer (case_id, question_id, group_instance, value)
    VALUES ('d345b0f9-5c67-4600-a897-eee87338547f', '60000000-0000-0000-0000-000000000100', 'default', to_jsonb('2'::text))
    ON CONFLICT (case_id, question_id, group_instance) DO NOTHING;
    RAISE NOTICE 'd345b0f9 backfilled: pension_count = 2';
  ELSE
    RAISE NOTICE 'd345b0f9 absent — local replay, skipped';
  END IF;

  -- ── fc446257 (REAL, locked): 1 complete instance, hat_rente=Ja → '1' ──────
  IF EXISTS (SELECT 1 FROM public.cases WHERE id = 'fc446257-5f3e-4e8f-8e02-7a59b200e4ac') THEN
    SELECT value #>> '{}' INTO v_pair FROM public.answer
    WHERE case_id = 'fc446257-5f3e-4e8f-8e02-7a59b200e4ac'
      AND question_id = '60000000-0000-0000-0000-000000000004' AND group_instance = 'default';
    IF v_pair IS DISTINCT FROM 'Ja' THEN
      RAISE EXCEPTION 'fc446257 drift: hat_rente = % (approved table says Ja) — STOP', v_pair;
    END IF;
    SELECT count(DISTINCT group_instance) INTO n FROM public.answer
    WHERE case_id = 'fc446257-5f3e-4e8f-8e02-7a59b200e4ac'
      AND question_id = '60000000-0000-0000-0000-000000000039' AND group_instance <> 'default';
    IF n <> 1 THEN
      RAISE EXCEPTION 'fc446257 drift: % pension instances (approved table says 1) — STOP', n;
    END IF;
    INSERT INTO public.answer (case_id, question_id, group_instance, value)
    VALUES ('fc446257-5f3e-4e8f-8e02-7a59b200e4ac', '60000000-0000-0000-0000-000000000100', 'default', to_jsonb('1'::text))
    ON CONFLICT (case_id, question_id, group_instance) DO NOTHING;
    RAISE NOTICE 'fc446257 backfilled: pension_count = 1 (locked case stays 100%%)';
  ELSE
    RAISE NOTICE 'fc446257 absent — local replay, skipped';
  END IF;

  -- ── 298ac66b (REAL, locked): Keine-Rente instance, hat_rente=Nein → '0' ───
  -- Accepted side effect (founder 2026-08-01): the "Rente / Pension 1 —
  -- Keine Rente" exchange disappears from the visible chat history; the
  -- answer rows persist in the DB and in case-export answers.md.
  IF EXISTS (SELECT 1 FROM public.cases WHERE id = '298ac66b-8778-4d9a-b833-f478f3304b55') THEN
    SELECT value #>> '{}' INTO v_pair FROM public.answer
    WHERE case_id = '298ac66b-8778-4d9a-b833-f478f3304b55'
      AND question_id = '60000000-0000-0000-0000-000000000004' AND group_instance = 'default';
    IF v_pair IS DISTINCT FROM 'Nein' THEN
      RAISE EXCEPTION '298ac66b drift: hat_rente = % (approved table says Nein) — STOP', v_pair;
    END IF;
    SELECT count(*) INTO n FROM public.answer
    WHERE case_id = '298ac66b-8778-4d9a-b833-f478f3304b55'
      AND question_id = '60000000-0000-0000-0000-000000000039'
      AND group_instance <> 'default'
      AND value #>> '{}' = 'Keine Rente';
    IF n <> 1 THEN
      RAISE EXCEPTION '298ac66b drift: expected exactly 1 Keine-Rente instance, found % — STOP', n;
    END IF;
    INSERT INTO public.answer (case_id, question_id, group_instance, value)
    VALUES ('298ac66b-8778-4d9a-b833-f478f3304b55', '60000000-0000-0000-0000-000000000100', 'default', to_jsonb('0'::text))
    ON CONFLICT (case_id, question_id, group_instance) DO NOTHING;
    RAISE NOTICE '298ac66b backfilled: pension_count = 0 (Keine-Rente instance no longer renders; rows preserved)';
  ELSE
    RAISE NOTICE '298ac66b absent — local replay, skipped';
  END IF;
END $$;

-- ── Post-check: every existing tabled case carries its backfill ──────────────
DO $$
DECLARE
  r record;
  v text;
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      ('d345b0f9-5c67-4600-a897-eee87338547f'::uuid, '2'),
      ('fc446257-5f3e-4e8f-8e02-7a59b200e4ac'::uuid, '1'),
      ('298ac66b-8778-4d9a-b833-f478f3304b55'::uuid, '0')
    ) AS t(case_id, expected)
  LOOP
    IF EXISTS (SELECT 1 FROM public.cases WHERE id = r.case_id) THEN
      SELECT value #>> '{}' INTO v FROM public.answer
      WHERE case_id = r.case_id
        AND question_id = '60000000-0000-0000-0000-000000000100'
        AND group_instance = 'default';
      IF v IS DISTINCT FROM r.expected THEN
        RAISE EXCEPTION 'post-check failed for %: pension_count = % (expected %)', r.case_id, v, r.expected;
      END IF;
    END IF;
  END LOOP;
  RAISE NOTICE 'backfill post-check passed for all existing tabled cases';
END $$;
