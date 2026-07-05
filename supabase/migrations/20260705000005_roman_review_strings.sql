-- Roman's content review — string-only pass. No engine logic, no structure.
--
-- 1. Essen spouse bank-account field prompts: Roman's mechanical rule — insert
--    " Ihres Partners" before the trailing "?" of the applicant wording the D4
--    fields shipped with. Targeted by fixed question id (keys repeat across
--    questionnaires since the Essen milestone; ids are the safe handle).
-- 2. Spouse group loop prompts (custom_prompt_de), Roman's pattern
--    "Möchten Sie {X} Ihres Partners hinzufügen?" — the four Essen spouse
--    groups AND Berlin's two spouse groups (both map to the same concepts;
--    Berlin has no spouse group outside these, so nothing is left on the
--    template).
--
-- The pattern-failure validation string ("Ungültiges Format.") lives in
-- lib/strings/de.ts, not static_content — shipped as a code change alongside.
--
-- NOTE (generator contract): these seven strings supersede the constants the
-- Essen generator shipped with; scripts/generate_essen_seed.py is updated in
-- the same commit so a future regeneration matches. Regeneration alone never
-- updates existing rows (the seed migration is ON CONFLICT DO NOTHING) —
-- post-launch content edits always need explicit UPDATE migrations like this.

BEGIN;

-- ── 1. Essen spouse bank-account field prompts ────────────────────────────────
UPDATE public.question SET prompt_de = 'Bei welcher Bank haben Sie ein weiteres Konto Ihres Partners?'
WHERE id = '61000000-0000-0000-0000-0000000000f8';  -- spouse_bank_additional_name

UPDATE public.question SET prompt_de = 'Was ist die IBAN Nummer dieses Kontos Ihres Partners?'
WHERE id = '61000000-0000-0000-0000-0000000000f9';  -- spouse_bank_additional_iban

UPDATE public.question SET prompt_de = 'Wie lautet die BIC Ihres Partners?'
WHERE id = '61000000-0000-0000-0000-0000000000fa';  -- spouse_bank_additional_bic

-- ── 2. Spouse group loop prompts ──────────────────────────────────────────────
UPDATE public.question_group SET custom_prompt_de = 'Möchten Sie weitere Renten Ihres Partners hinzufügen?'
WHERE id IN ('51000000-0000-0000-0000-000000000006',   -- Essen spouse_pension
             '50000000-0000-0000-0000-000000000005');  -- Berlin spouse_pension

UPDATE public.question_group SET custom_prompt_de = 'Möchten Sie sonstiges Einkommen Ihres Partners hinzufügen?'
WHERE id IN ('51000000-0000-0000-0000-000000000007',   -- Essen spouse_other_income
             '50000000-0000-0000-0000-000000000006');  -- Berlin spouse_other_income

UPDATE public.question_group SET custom_prompt_de = 'Möchten Sie weitere Bankkonten Ihres Partners hinzufügen?'
WHERE id = '51000000-0000-0000-0000-000000000008';    -- Essen spouse_bank_additional

UPDATE public.question_group SET custom_prompt_de = 'Möchten Sie weitere Vermögenswerte Ihres Partners hinzufügen?'
WHERE id = '51000000-0000-0000-0000-000000000009';    -- Essen spouse_additional_wealth

COMMIT;
