-- Fix boolean-vs-string type mismatch in rentenbetrag visibility rule.
--
-- yes_no answer_type stores strings 'Ja' and 'Nein' (confirmed in
-- question-renderer.tsx: value={opt} where opt ∈ ['Ja', 'Nein']).
-- The original seed had {"value": true} (JavaScript boolean) for rentenbetrag,
-- which never matches the stored string → pension amount is permanently hidden
-- even when hat_rente = 'Ja'.
--
-- Programmatic scan of all 159 live questions (2026-07-01) confirms this is
-- the only boolean-value bug remaining after:
--   20260628000001 — fixed Haftpflicht key typos
--   20260628000002 — fixed spouse_wohngeld self-refs + spouse_special_origin
--                     not_value bugs + spouse_life_insurance not_value bug
--   20260629000001 — removed orphaned spouse_govermental_employee references
--
-- No self-referencing rules and no dead-key references found in current DB.
-- No schema changes. Safe to re-run (idempotent WHERE key = 'rentenbetrag').

UPDATE public.question
SET visibility_rule = '{"question_key":"hat_rente","value":"Ja"}'::jsonb
WHERE key = 'rentenbetrag';
