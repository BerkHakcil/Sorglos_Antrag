-- Berlin content pass, Tier 6 — make "other assets" repeatable.
--
-- Only 'additional_wealth' needs this: pensions (pension), additional income
-- (other_income) and bank accounts (bank_additional) are ALREADY is_repeatable
-- groups that loop via the existing "add another?" prompt. This converts the
-- last flat section to the same shape as bank_additional: a flat yes/no trigger
-- (additional_wealth_yes_no) gating a repeatable group of member questions.
--
-- No visibility_rule / validation / content changes. Uncapped (max_count NULL),
-- consistent with the other three groups. Idempotent (safe to re-run).

BEGIN;

-- 1. New repeatable group for additional assets.
INSERT INTO public.question_group
  (id, category_id, key, sort_order, label_de, is_repeatable, min_count, max_count)
VALUES
  ('50000000-0000-0000-0000-000000000007', '40000000-0000-0000-0000-000000000006',
   'additional_wealth', 1, 'Weitere Vermögenswerte', true, 0, NULL)
ON CONFLICT (id) DO NOTHING;

-- 2. Move the two member questions into the group (question_ids unchanged; their
--    visibility {value:"Ja", question_key:"additional_wealth_yes_no"} is kept, and
--    additional_wealth_yes_no stays flat as the trigger — exactly the bank_additional shape).
UPDATE public.question
SET group_id = '50000000-0000-0000-0000-000000000007'
WHERE key IN ('additional_wealth_type', 'additional_wealth_amount');

-- 3. Drop the 8 stale pre-launch TEST answers (group_instance='default') on those two
--    questions — once they're instance-keyed, 'default' rows no longer render. No live
--    cases affected (same precedent as Tier 4/5).
DELETE FROM public.answer
WHERE group_instance = 'default'
  AND question_id IN (
    SELECT id FROM public.question
    WHERE key IN ('additional_wealth_type', 'additional_wealth_amount')
  );

COMMIT;
