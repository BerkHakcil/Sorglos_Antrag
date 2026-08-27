-- Go-live round 2, item 6 (Phase-1 report docs/feedback/golive_round2.md,
-- GO 2026-08-13): unbefristet-gate for the Schwerbehindertenausweis expiry.
--
-- Problem: expiry is a required date whenever the card question is "Ja", but
-- Schwerbehindertenausweise can be unbefristet — such users cannot answer
-- truthfully. Remedy (decided): a required Ja/Nein gate question shown exactly
-- where the expiry shows today; the expiry becomes visible only on gate="Nein".
-- Spouse mirrors included (founder GO on the Phase-1 recommendation). Standard
-- question+visibility machinery — ZERO code changes ride on this migration.
--
-- Gate prompts are PLACEHOLDER_DE (ledgered; round-2 Roman package). Fresh
-- denominators are UNCHANGED BY THIS MIGRATION (gate hidden until the card
-- question is "Ja") — m7's "von 53/49 Fragen" anchors stand (Berlin 53 since
-- item 1 / 20260813000001, which runs first in this push).
--
-- ⚠ SEQUENCING RULE (founder, 2026-08-13): run THIS migration BEFORE any
-- ops-side correction of case 52e364f1's expiry dates (the item-5 follow-up
-- asks the customer to re-confirm "2027-08-11"). The named drift assert below
-- pins that exact value; if ops corrects the date first, the assert aborts and
-- must be updated to the corrected value before pushing.
--
-- REAL-DATA REPORT (R2, 2026-08-12 dumps; asserts below re-verify at execution
-- time): exactly ONE expiry answer exists in prod — case 52e364f1 (REAL
-- customer, LOCKED under_review): disability_card="Ja",
-- disability_card_expiry="2027-08-11". Without backfill his locked case would
-- read 75/76 (~99%) — counted AFTER 20260813000001, which runs first in this
-- push and takes him 75/75 -> 76/76 — and his answered expiry bubble would
-- vanish from the chat history. The backfill (gate="Nein" — he gave a date,
-- so the card is not unbefristet) lands the batch end state at 77/77 = 100%
-- with the bubble intact. The generic
-- INSERT..SELECT form also covers any case created between review and push,
-- and closes the stale-answer-sweep data-loss window for in_progress
-- expiry-holders. Zero spouse/Essen expiry answers exist — those backfills
-- no-op today. Local replay: cases table empty -> backfills no-op, named
-- asserts skip with NOTICE.

BEGIN;

-- ════════════════════════════════════════════════════════════════════════════
-- 0) Pre-check: named drift assert on the one known affected real case
-- ════════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  v text;
BEGIN
  IF EXISTS (SELECT 1 FROM public.cases WHERE id = '52e364f1-e27e-4e79-b455-55d658e1be95') THEN
    SELECT value #>> '{}' INTO v FROM public.answer
    WHERE case_id = '52e364f1-e27e-4e79-b455-55d658e1be95'
      AND question_id = '60000000-0000-0000-0000-000000000017'  -- disability_card
      AND group_instance = 'default';
    IF v IS DISTINCT FROM 'Ja' THEN
      RAISE EXCEPTION '52e364f1 drift: disability_card = % (report says Ja) — STOP', v;
    END IF;
    SELECT value #>> '{}' INTO v FROM public.answer
    WHERE case_id = '52e364f1-e27e-4e79-b455-55d658e1be95'
      AND question_id = '60000000-0000-0000-0000-000000000019'  -- disability_card_expiry
      AND group_instance = 'default';
    IF v IS DISTINCT FROM '2027-08-11' THEN
      RAISE EXCEPTION '52e364f1 drift: disability_card_expiry = % (report says 2027-08-11; if ops corrected the date first, update this assert) — STOP', v;
    END IF;
    RAISE NOTICE '52e364f1 pre-check passed (disability_card=Ja, expiry=2027-08-11)';
  ELSE
    RAISE NOTICE '52e364f1 absent — local replay, pre-check skipped';
  END IF;
END $$;

-- ════════════════════════════════════════════════════════════════════════════
-- 1) Berlin antragsteller (40…0001): shift sorts >=18 (8 rows), gate at 18
--    Chain today: disability_card(16, Ja/Nein) -> disablity_card_application(17,
--    on "Nein") -> disability_card_expiry(18, on "Ja") -> markers(19) -> …(25)
-- ════════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  n integer;
BEGIN
  UPDATE public.question SET sort_order = sort_order + 1
  WHERE category_id = '40000000-0000-0000-0000-000000000001' AND sort_order >= 18;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 8 THEN
    RAISE EXCEPTION 'Berlin antragsteller shift: expected 8 rows, got %', n;
  END IF;
END $$;

INSERT INTO public.question
  (id, category_id, group_id, key, sort_order, answer_type, is_required,
   prompt_de, help_de, validation, visibility_rule)
VALUES
  ('60000000-0000-0000-0000-000000000101',
   '40000000-0000-0000-0000-000000000001',
   NULL, 'disability_card_unlimited', 18, 'single_select', TRUE,
   'Ist der Ausweis unbefristet gültig?', NULL, NULL,
   '{"value": "Ja", "question_key": "disability_card"}'::jsonb);

INSERT INTO public.question_option (id, question_id, key, sort_order, label_de, value) VALUES
  ('60010100-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000101', 'o0', 0, 'Ja', 'Ja'),
  ('60010100-0000-0000-0000-000000000002', '60000000-0000-0000-0000-000000000101', 'o1', 1, 'Nein', 'Nein');

-- ════════════════════════════════════════════════════════════════════════════
-- 2) Berlin spouse (40…0008): shift sorts >=22 (54 rows), spouse gate at 22
-- ════════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  n integer;
BEGIN
  UPDATE public.question SET sort_order = sort_order + 1
  WHERE category_id = '40000000-0000-0000-0000-000000000008' AND sort_order >= 22;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 54 THEN
    RAISE EXCEPTION 'Berlin spouse shift: expected 54 rows, got %', n;
  END IF;
END $$;

INSERT INTO public.question
  (id, category_id, group_id, key, sort_order, answer_type, is_required,
   prompt_de, help_de, validation, visibility_rule)
VALUES
  ('60000000-0000-0000-0000-000000000102',
   '40000000-0000-0000-0000-000000000008',
   NULL, 'spouse_disability_card_unlimited', 22, 'single_select', TRUE,
   'Ist der Ausweis Ihres Partners unbefristet gültig?', NULL, NULL,
   '{"value": "Ja", "question_key": "spouse_disability_card"}'::jsonb);

INSERT INTO public.question_option (id, question_id, key, sort_order, label_de, value) VALUES
  ('60010200-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000102', 'o0', 0, 'Ja', 'Ja'),
  ('60010200-0000-0000-0000-000000000002', '60000000-0000-0000-0000-000000000102', 'o1', 1, 'Nein', 'Nein');

-- ════════════════════════════════════════════════════════════════════════════
-- 3) Essen antragsteller (41…0001): shift sorts >=17 (8 rows), gate at 17
--    (Essen's "Beantragt" branch is untouched — its application-date question
--    keys on the card question, not on the gate.)
-- ════════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  n integer;
BEGIN
  UPDATE public.question SET sort_order = sort_order + 1
  WHERE category_id = '41000000-0000-0000-0000-000000000001' AND sort_order >= 17;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 8 THEN
    RAISE EXCEPTION 'Essen antragsteller shift: expected 8 rows, got %', n;
  END IF;
END $$;

INSERT INTO public.question
  (id, category_id, group_id, key, sort_order, answer_type, is_required,
   prompt_de, help_de, validation, visibility_rule)
VALUES
  ('61000000-0000-0000-0000-000000000101',
   '41000000-0000-0000-0000-000000000001',
   NULL, 'disability_card_unlimited', 17, 'single_select', TRUE,
   'Ist der Ausweis unbefristet gültig?', NULL, NULL,
   '{"value": "Ja", "question_key": "disability_card"}'::jsonb);

INSERT INTO public.question_option (id, question_id, key, sort_order, label_de, value) VALUES
  ('61010100-0000-0000-0000-000000000001', '61000000-0000-0000-0000-000000000101', 'o0', 0, 'Ja', 'Ja'),
  ('61010100-0000-0000-0000-000000000002', '61000000-0000-0000-0000-000000000101', 'o1', 1, 'Nein', 'Nein');

-- ════════════════════════════════════════════════════════════════════════════
-- 4) Essen spouse (41…0008): shift sorts >=15 (88 rows incl. the pre-existing
--    holes at 41/54/87, which shift harmlessly), spouse gate at 15
-- ════════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  n integer;
BEGIN
  UPDATE public.question SET sort_order = sort_order + 1
  WHERE category_id = '41000000-0000-0000-0000-000000000008' AND sort_order >= 15;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 88 THEN
    RAISE EXCEPTION 'Essen spouse shift: expected 88 rows, got %', n;
  END IF;
END $$;

INSERT INTO public.question
  (id, category_id, group_id, key, sort_order, answer_type, is_required,
   prompt_de, help_de, validation, visibility_rule)
VALUES
  ('61000000-0000-0000-0000-000000000102',
   '41000000-0000-0000-0000-000000000008',
   NULL, 'spouse_disability_card_unlimited', 15, 'single_select', TRUE,
   'Ist der Ausweis Ihres Partners unbefristet gültig?', NULL, NULL,
   '{"value": "Ja", "question_key": "spouse_disability_card"}'::jsonb);

INSERT INTO public.question_option (id, question_id, key, sort_order, label_de, value) VALUES
  ('61010200-0000-0000-0000-000000000001', '61000000-0000-0000-0000-000000000102', 'o0', 0, 'Ja', 'Ja'),
  ('61010200-0000-0000-0000-000000000002', '61000000-0000-0000-0000-000000000102', 'o1', 1, 'Nein', 'Nein');

-- ════════════════════════════════════════════════════════════════════════════
-- 5) Re-gate the four expiry questions onto their gate (value-guarded on the
--    exact current rule; JSONB equality is key-order-insensitive)
-- ════════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  n integer;
BEGIN
  UPDATE public.question
  SET visibility_rule = '{"value": "Nein", "question_key": "disability_card_unlimited"}'::jsonb
  WHERE id = '60000000-0000-0000-0000-000000000019'
    AND visibility_rule = '{"value": "Ja", "question_key": "disability_card"}'::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'Berlin expiry re-gate: expected 1 row, got %', n; END IF;

  UPDATE public.question
  SET visibility_rule = '{"value": "Nein", "question_key": "spouse_disability_card_unlimited"}'::jsonb
  WHERE id = '60000000-0000-0000-0000-00000000007f'
    AND visibility_rule = '{"value": "Ja", "question_key": "spouse_disability_card"}'::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'Berlin spouse expiry re-gate: expected 1 row, got %', n; END IF;

  UPDATE public.question
  SET visibility_rule = '{"value": "Nein", "question_key": "disability_card_unlimited"}'::jsonb
  WHERE id = '61000000-0000-0000-0000-000000000014'
    AND visibility_rule = '{"value": "Ja", "question_key": "disability_card"}'::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'Essen expiry re-gate: expected 1 row, got %', n; END IF;

  UPDATE public.question
  SET visibility_rule = '{"value": "Nein", "question_key": "spouse_disability_card_unlimited"}'::jsonb
  WHERE id = '61000000-0000-0000-0000-00000000009e'
    AND visibility_rule = '{"value": "Ja", "question_key": "spouse_disability_card"}'::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'Essen spouse expiry re-gate: expected 1 row, got %', n; END IF;

  RAISE NOTICE 'four expiry questions re-gated onto their unbefristet gates';
END $$;

-- ════════════════════════════════════════════════════════════════════════════
-- 6) ADDITIVE BACKFILL (pass-4 precedent): every case holding an expiry answer
--    gave a date -> the card is NOT unbefristet -> gate = "Nein" is the
--    uniquely consistent answer. Generic + idempotent; no-op on local replay.
-- ════════════════════════════════════════════════════════════════════════════
INSERT INTO public.answer (case_id, question_id, group_instance, value)
SELECT a.case_id, '60000000-0000-0000-0000-000000000101', 'default', to_jsonb('Nein'::text)
FROM public.answer a
WHERE a.question_id = '60000000-0000-0000-0000-000000000019' AND a.group_instance = 'default'
ON CONFLICT (case_id, question_id, group_instance) DO NOTHING;

INSERT INTO public.answer (case_id, question_id, group_instance, value)
SELECT a.case_id, '60000000-0000-0000-0000-000000000102', 'default', to_jsonb('Nein'::text)
FROM public.answer a
WHERE a.question_id = '60000000-0000-0000-0000-00000000007f' AND a.group_instance = 'default'
ON CONFLICT (case_id, question_id, group_instance) DO NOTHING;

INSERT INTO public.answer (case_id, question_id, group_instance, value)
SELECT a.case_id, '61000000-0000-0000-0000-000000000101', 'default', to_jsonb('Nein'::text)
FROM public.answer a
WHERE a.question_id = '61000000-0000-0000-0000-000000000014' AND a.group_instance = 'default'
ON CONFLICT (case_id, question_id, group_instance) DO NOTHING;

INSERT INTO public.answer (case_id, question_id, group_instance, value)
SELECT a.case_id, '61000000-0000-0000-0000-000000000102', 'default', to_jsonb('Nein'::text)
FROM public.answer a
WHERE a.question_id = '61000000-0000-0000-0000-00000000009e' AND a.group_instance = 'default'
ON CONFLICT (case_id, question_id, group_instance) DO NOTHING;

-- ════════════════════════════════════════════════════════════════════════════
-- 7) Post-check: customer 52e364f1 carries gate="Nein"; generically, no case anywhere holds
--    an expiry answer without its gate answer (all four pairs)
-- ════════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  v text;
  orphans integer;
BEGIN
  IF EXISTS (SELECT 1 FROM public.cases WHERE id = '52e364f1-e27e-4e79-b455-55d658e1be95') THEN
    SELECT value #>> '{}' INTO v FROM public.answer
    WHERE case_id = '52e364f1-e27e-4e79-b455-55d658e1be95'
      AND question_id = '60000000-0000-0000-0000-000000000101'
      AND group_instance = 'default';
    IF v IS DISTINCT FROM 'Nein' THEN
      RAISE EXCEPTION '52e364f1 post-check failed: gate = % (expected Nein backfill)', v;
    END IF;
    RAISE NOTICE '52e364f1 backfilled: disability_card_unlimited = Nein (locked case stays 100%%, expiry bubble survives)';
  ELSE
    RAISE NOTICE '52e364f1 absent — local replay, post-check skipped';
  END IF;

  SELECT count(*) INTO orphans FROM public.answer e
  WHERE e.group_instance = 'default'
    AND (
      (e.question_id = '60000000-0000-0000-0000-000000000019' AND NOT EXISTS (
        SELECT 1 FROM public.answer g WHERE g.case_id = e.case_id
          AND g.question_id = '60000000-0000-0000-0000-000000000101' AND g.group_instance = 'default'))
      OR
      (e.question_id = '60000000-0000-0000-0000-00000000007f' AND NOT EXISTS (
        SELECT 1 FROM public.answer g WHERE g.case_id = e.case_id
          AND g.question_id = '60000000-0000-0000-0000-000000000102' AND g.group_instance = 'default'))
      OR
      (e.question_id = '61000000-0000-0000-0000-000000000014' AND NOT EXISTS (
        SELECT 1 FROM public.answer g WHERE g.case_id = e.case_id
          AND g.question_id = '61000000-0000-0000-0000-000000000101' AND g.group_instance = 'default'))
      OR
      (e.question_id = '61000000-0000-0000-0000-00000000009e' AND NOT EXISTS (
        SELECT 1 FROM public.answer g WHERE g.case_id = e.case_id
          AND g.question_id = '61000000-0000-0000-0000-000000000102' AND g.group_instance = 'default'))
    );
  IF orphans <> 0 THEN
    RAISE EXCEPTION 'post-check failed: % expiry answer(s) without a gate answer', orphans;
  END IF;
  RAISE NOTICE 'post-check passed: zero expiry answers without a gate answer';
END $$;

COMMIT;
