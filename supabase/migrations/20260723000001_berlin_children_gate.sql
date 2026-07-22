-- Mini content pass — Berlin children gate (Essen CP3 parity, founder
-- decision: Essen-only scoping superseded now that Berlin serves as the
-- universal fallback questionnaire).
--
-- Adds the flat required gate "Haben Sie Kinder?" (children_yes_no, Ja/Nein)
-- at the top of Berlin's kinder category and gates child_first_name on it —
-- the exact Essen shape (all other members already chain off child_first_name
-- via not_empty; transitive visibility hides them with the gate).
--
-- Denominator: ±0 (gate +1, child_first_name hidden fresh −1) → fresh 53,
-- married 92 unchanged.
--
-- ADDITIVE BACKFILL (REAL-DATA pattern): three real, completed Berlin cases
-- hold child answers (audit 2026-07-23). The gate would hide their children
-- and break their locked 100% progress, so they get children_yes_no = "Ja"
-- backfilled. Guarded INSERT..SELECT: a no-op on local replay (cases absent)
-- and idempotent on re-run.

BEGIN;

-- 1) Shift the 8 existing kinder members from sort 0..7 to 1..8
--    (the category holds only the children-group members today).
UPDATE public.question
SET sort_order = sort_order + 1
WHERE category_id = '40000000-0000-0000-0000-000000000003';

-- 2) The gate question (flat, required, top of the category)
INSERT INTO public.question
  (id, category_id, group_id, key, sort_order, answer_type, is_required,
   prompt_de, help_de, validation, visibility_rule)
VALUES
  ('60000000-0000-0000-0000-0000000000ff',
   '40000000-0000-0000-0000-000000000003',
   NULL, 'children_yes_no', 0, 'single_select', TRUE,
   'Haben Sie Kinder?', NULL, NULL, NULL);

INSERT INTO public.question_option (id, question_id, key, sort_order, label_de, value) VALUES
  ('61ff0000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-0000000000ff', 'o0', 0, 'Ja', 'Ja'),
  ('61ff0000-0000-0000-0000-000000000002', '60000000-0000-0000-0000-0000000000ff', 'o1', 1, 'Nein', 'Nein');

-- 3) Gate child_first_name (Essen-identical rule shape)
UPDATE public.question
SET visibility_rule = '{"value": "Ja", "question_key": "children_yes_no"}'::jsonb
WHERE key = 'child_first_name'
  AND category_id = '40000000-0000-0000-0000-000000000003';

-- 4) Backfill "Ja" for the three real completed cases with child answers
INSERT INTO public.answer (case_id, question_id, group_instance, value)
SELECT c.id, '60000000-0000-0000-0000-0000000000ff', 'default', '"Ja"'::jsonb
FROM public.cases c
WHERE c.id IN (
  'fc446257-5f3e-4e8f-8e02-7a59b200e4ac',
  '2c8a5ca2-51c1-4c17-baf5-6418daeece91',
  '298ac66b-8778-4d9a-b833-f478f3304b55'
)
ON CONFLICT (case_id, question_id, group_instance) DO NOTHING;

COMMIT;
