-- Content pass 4, Batch 2 — Berlin pension redesign, structural half (D15).
-- Design of record: docs/feedback/pass4_phase_a.md §A1 (approved 2026-08-01;
-- count-decrease = confirm-and-clear).
--
-- 1. question.active — the retirement mechanism (Phase-C `active` pattern).
--    hat_rente + rentenbetrag flip to false: never loaded, never rendered,
--    never in the denominator. ⚠ Their preserved real answers are protected
--    from the stale-answer sweep by the CODE half (the keyMap filter in
--    getCaseAnswers) — that code deploys only after this migration (R8).
-- 2. question_group.count_source_key — data-driven count-driven rendering:
--    a repeatable group with this key renders exactly N instances where N is
--    the answer to that question. Set to 'pension_count' for the Berlin
--    pension group only; every other group keeps add-another.
-- 3. pension_count — NEW required single_select, Roman's German verbatim
--    (D15b), nine permanent option values "0".."8" (R4: additions only),
--    placed at the head of the income category (its detail group follows).
-- 4. pension_type loses "Keine Rente" (count 0 replaces it; CP3 option-delete
--    precedent). The ONE stored answer keeps its raw value (display falls
--    back to the stored string; the case is backfilled to count 0 in the
--    companion migration, so the instance no longer renders).
-- 5. The three member visibility rules (in_values of the 8 real types) go
--    NULL — all four detail questions are unconditionally required within an
--    instance (D15c "all required"); the gates only existed for Keine Rente.
-- 6. pension_amount gets the netto hint as help_de — PLACEHOLDER_DE, on
--    Roman's nod list (roman_package_pass4.md §4); his D15 note permits a
--    netto clarification.
--
-- Real-data impact: config tables only; zero answer rows touched here (the
-- backfill is 20260801000004). Fresh Berlin denominator: 53 → 52
-- (−hat_rente, −auto-instance pension_type, +pension_count).
-- Essen is untouched by every statement (all ids are Berlin rows).

-- ── 1a. question.active ───────────────────────────────────────────────────────
ALTER TABLE public.question ADD COLUMN active boolean NOT NULL DEFAULT true;

DO $$
DECLARE
  n_total integer;
  n_active integer;
BEGIN
  SELECT count(*), count(*) FILTER (WHERE active) INTO n_total, n_active FROM public.question;
  IF n_total <> 413 OR n_active <> 413 THEN
    RAISE EXCEPTION 'question.active backfill check failed: % total, % active (expected 413/413)', n_total, n_active;
  END IF;
  RAISE NOTICE 'question.active added: all 413 rows active';
END $$;

-- ── 1b. retire hat_rente + rentenbetrag ──────────────────────────────────────
DO $$
DECLARE
  n integer;
BEGIN
  UPDATE public.question SET active = false
  WHERE id IN ('60000000-0000-0000-0000-000000000004', '60000000-0000-0000-0000-000000000005')
    AND key IN ('hat_rente', 'rentenbetrag')
    AND active = true;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 2 THEN
    RAISE EXCEPTION 'pair retirement failed: expected 2 rows, got %', n;
  END IF;
  RAISE NOTICE 'retired: hat_rente + rentenbetrag (rows preserved, active=false)';
END $$;

-- ── 2. question_group.count_source_key ───────────────────────────────────────
ALTER TABLE public.question_group ADD COLUMN count_source_key text NULL;

DO $$
DECLARE
  n integer;
BEGIN
  UPDATE public.question_group SET count_source_key = 'pension_count'
  WHERE id = '50000000-0000-0000-0000-000000000002' AND key = 'pension';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN
    RAISE EXCEPTION 'pension group count_source_key failed: expected 1 row, got %', n;
  END IF;
  RAISE NOTICE 'pension group is count-driven via pension_count';
END $$;

-- ── 3a. make room at the head of the income category ─────────────────────────
DO $$
DECLARE
  n integer;
BEGIN
  UPDATE public.question SET sort_order = sort_order + 1
  WHERE category_id = '40000000-0000-0000-0000-000000000004';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 10 THEN
    RAISE EXCEPTION 'income renumber failed: expected 10 rows, got %', n;
  END IF;
  RAISE NOTICE 'income category renumbered (+1), slot 0 free';
END $$;

-- ── 3b. pension_count (fixed id for replay determinism) ─────────────────────
INSERT INTO public.question
  (id, category_id, group_id, key, sort_order, answer_type, is_required, prompt_de, help_de, validation, visibility_rule)
VALUES
  ('60000000-0000-0000-0000-000000000100',
   '40000000-0000-0000-0000-000000000004',
   NULL, 'pension_count', 0, 'single_select', true,
   'Wie viele Renten oder Pensionen bekommen Sie?',
   NULL, NULL, NULL)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.question_option (id, question_id, key, sort_order, label_de, value) VALUES
  ('70000000-0000-0000-0100-000000000000', '60000000-0000-0000-0000-000000000100', 'pension_count_0', 0, '0', '0'),
  ('70000000-0000-0000-0100-000000000001', '60000000-0000-0000-0000-000000000100', 'pension_count_1', 1, '1', '1'),
  ('70000000-0000-0000-0100-000000000002', '60000000-0000-0000-0000-000000000100', 'pension_count_2', 2, '2', '2'),
  ('70000000-0000-0000-0100-000000000003', '60000000-0000-0000-0000-000000000100', 'pension_count_3', 3, '3', '3'),
  ('70000000-0000-0000-0100-000000000004', '60000000-0000-0000-0000-000000000100', 'pension_count_4', 4, '4', '4'),
  ('70000000-0000-0000-0100-000000000005', '60000000-0000-0000-0000-000000000100', 'pension_count_5', 5, '5', '5'),
  ('70000000-0000-0000-0100-000000000006', '60000000-0000-0000-0000-000000000100', 'pension_count_6', 6, '6', '6'),
  ('70000000-0000-0000-0100-000000000007', '60000000-0000-0000-0000-000000000100', 'pension_count_7', 7, '7', '7'),
  ('70000000-0000-0000-0100-000000000008', '60000000-0000-0000-0000-000000000100', 'pension_count_8', 8, '8', '8')
ON CONFLICT (id) DO NOTHING;

DO $$
DECLARE
  n integer;
BEGIN
  SELECT count(*) INTO n FROM public.question
  WHERE id = '60000000-0000-0000-0000-000000000100' AND key = 'pension_count'
    AND is_required AND sort_order = 0
    AND prompt_de = 'Wie viele Renten oder Pensionen bekommen Sie?';
  IF n <> 1 THEN RAISE EXCEPTION 'pension_count insert check failed'; END IF;
  SELECT count(*) INTO n FROM public.question_option
  WHERE question_id = '60000000-0000-0000-0000-000000000100';
  IF n <> 9 THEN RAISE EXCEPTION 'pension_count options check failed: % rows (expected 9)', n; END IF;
  RAISE NOTICE 'pension_count seeded with options 0..8';
END $$;

-- ── 4. retire the "Keine Rente" option ────────────────────────────────────────
DO $$
DECLARE
  n integer;
BEGIN
  DELETE FROM public.question_option
  WHERE question_id = '60000000-0000-0000-0000-000000000039' AND value = 'Keine Rente';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN
    RAISE EXCEPTION 'Keine-Rente option delete failed: expected 1 row, got %', n;
  END IF;
  RAISE NOTICE 'Keine-Rente option removed (stored answers keep the raw value)';
END $$;

-- ── 5. member visibility rules → NULL ─────────────────────────────────────────
DO $$
DECLARE
  n integer;
BEGIN
  UPDATE public.question SET visibility_rule = NULL
  WHERE id IN ('60000000-0000-0000-0000-00000000003a',
               '60000000-0000-0000-0000-00000000003b',
               '60000000-0000-0000-0000-00000000003c')
    AND visibility_rule ? 'in_values';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 3 THEN
    RAISE EXCEPTION 'member vis-rule NULLing failed: expected 3 rows, got %', n;
  END IF;
  RAISE NOTICE 'pension_amount/id/issuer are unconditional within an instance';
END $$;

-- ── 6. netto hint (PLACEHOLDER_DE, Roman nod list §4) ─────────────────────────
DO $$
DECLARE
  n integer;
BEGIN
  UPDATE public.question SET help_de = 'Bitte geben Sie den Nettobetrag an.'
  WHERE id = '60000000-0000-0000-0000-00000000003a' AND help_de IS NULL;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN
    RAISE EXCEPTION 'netto help_de failed: expected 1 row, got %', n;
  END IF;
  RAISE NOTICE 'netto hint set on pension_amount (PLACEHOLDER_DE)';
END $$;
