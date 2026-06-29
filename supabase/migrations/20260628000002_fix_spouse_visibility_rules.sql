-- Fix spouse question visibility rules that caused questions to appear for
-- users with marital_status = "ledig" (single).
--
-- Root causes (all data bugs — the engine behavior is correct):
--
-- 1. spouse_special_origin_rights_issued + spouse_special_origin_rights_issued_by
--    Used {not_value: "Nein"} on spouse_special_origin_rights. When that parent
--    question is hidden (marital_status = ledig → undefined), isVisible returns
--    true (undefined !== "Nein"). Fix: use {value: "Ja"} — correct for a yes_no
--    field and properly returns false when the parent is undefined.
--
-- 2. spouse_life_insurance_amount
--    Same pattern: {not_value: "Nein"} on spouse_life_insurance (a yes_no field).
--    Fix: use {value: "Ja"}.
--
-- 3. spouse_wohngeld_amount
--    Self-referenced its OWN key as the controller (spouse_wohngeld_amount, value
--    "Ja") — always hidden because an amount value never equals "Ja". Should
--    reference spouse_wohngeld_yes_no.
--
-- 4. spouse_wohngeld_id
--    Referenced spouse_wohngeld_amount (an amount field) instead of
--    spouse_wohngeld_yes_no. Fix: point to spouse_wohngeld_yes_no.
--
-- No schema changes. Safe to re-run.

UPDATE public.question
SET visibility_rule = '{"question_key": "spouse_special_origin_rights", "value": "Ja"}'::jsonb
WHERE key IN ('spouse_special_origin_rights_issued', 'spouse_special_origin_rights_issued_by');

UPDATE public.question
SET visibility_rule = '{"question_key": "spouse_life_insurance", "value": "Ja"}'::jsonb
WHERE key = 'spouse_life_insurance_amount';

UPDATE public.question
SET visibility_rule = '{"question_key": "spouse_wohngeld_yes_no", "value": "Ja"}'::jsonb
WHERE key IN ('spouse_wohngeld_amount', 'spouse_wohngeld_id');
