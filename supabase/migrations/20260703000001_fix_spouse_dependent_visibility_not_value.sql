-- Correct the spouse "Sonderstatus" + life-insurance-amount dependent rules.
--
-- These three questions gate on single_select controllers that have NO "Ja"
-- option:
--   spouse_special_origin_rights  → options: Nein + Ausweis types
--   spouse_life_insurance         → options: Nein + Lebensversicherung/Sterbeversicherung
--
-- Migration 20260628000002 set the dependents to {"value":"Ja"} on the mistaken
-- assumption these were yes/no fields. Because "Ja" is never a stored value, the
-- three dependents became permanently hidden (they can never appear even when the
-- spouse genuinely has the special status / a life insurance).
--
-- The correct match is {"not_value":"Nein"} — mirroring the working patient
-- equivalents (special_origin_rights_issued / _issued_by use not_value:"Nein" on
-- special_origin_rights; life_insurance_* use not_value:"Nein" on life_insurance).
--
-- ORDERING REQUIREMENT: this depends on the transitive-visibility engine change
-- (BUG A) being deployed first. not_value:"Nein" evaluates true when the
-- controller is undefined; the patient controllers are always visible so that is
-- safe, but the spouse controllers are marital-status-gated and become undefined
-- for single users. Only transitive isVisible() — which additionally requires the
-- controller (spouse_special_origin_rights / spouse_life_insurance) to itself be
-- visible — keeps these hidden for "ledig". Do NOT apply this migration to an
-- environment still running the old one-level engine, or the "shows when single"
-- bug returns.
--
-- No schema changes. Safe to re-run.

UPDATE public.question
SET visibility_rule = '{"question_key": "spouse_special_origin_rights", "not_value": "Nein"}'::jsonb
WHERE key IN ('spouse_special_origin_rights_issued', 'spouse_special_origin_rights_issued_by');

UPDATE public.question
SET visibility_rule = '{"question_key": "spouse_life_insurance", "not_value": "Nein"}'::jsonb
WHERE key = 'spouse_life_insurance_amount';
