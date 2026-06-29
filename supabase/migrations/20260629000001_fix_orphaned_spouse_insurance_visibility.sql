-- Fix permanently-hidden spouse insurance-amount questions.
--
-- spouse_health_insurance_amount and spouse_care_insurance_amount both had
-- visibility_rule = { question_key: "spouse_govermental_employee", value: "Ja" }.
-- The question "spouse_govermental_employee" does not exist in the DB, so
-- isVisible() always evaluated to false → both questions were permanently hidden.
--
-- The patient counterparts (health_insurance_amount, care_insurance_amount) correctly
-- reference govermental_employee (which exists). A spouse_govermental_employee question
-- needs to be added in a separate content migration if the same civil-servant gating
-- is required for spouses. Until then, remove the orphaned rules so these questions
-- are always shown for spouses — this is the data-complete safe default (Sozialämter
-- need to know all spouse insurance expenses regardless of civil-servant status).
--
-- No schema changes. Safe to re-run.

UPDATE public.question
SET visibility_rule = NULL
WHERE key IN ('spouse_health_insurance_amount', 'spouse_care_insurance_amount');
