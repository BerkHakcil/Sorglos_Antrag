-- Fix visibility_rule key mismatches in the Haftpflicht questions.
--
-- Root cause: the controlling question keys were written with a typo
-- ("liablity" instead of "liability"), but the dependent questions'
-- visibility_rule used the correctly-spelled key → the rule never matched
-- → dependent questions never appeared regardless of the controlling answer.
--
-- Fix: update the four dependent questions so their visibility_rule
-- question_key matches the actual (typo) key of the controlling question.
--
-- No schema changes. Safe to re-run.

UPDATE public.question
SET visibility_rule = '{"question_key": "general_liablity_insurance_yes_no", "value": "Ja"}'::jsonb
WHERE key IN ('general_liablity_insurance_provider', 'general_liability_amount');

UPDATE public.question
SET visibility_rule = '{"question_key": "spouse_general_liablity_insurance_yes_no", "value": "Ja"}'::jsonb
WHERE key IN ('spouse_general_liablity_insurance_provider', 'spouse_general_liability_amount');
