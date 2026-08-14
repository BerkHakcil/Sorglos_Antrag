-- ESS-056: Essen requires the deceased partner's death certificate for
-- widowed applicants (Sterbeurkunde Partner, DOC-0016).
--
-- PROVENANCE: Roman approved 2026-08-13 (answer to round-2 item 4 — the
-- Phase-1 finding that the only real Sterbeurkunde gap was Essen).
-- INSERT-only, next free ESS id (census: exactly ESS-001..055 exist).
-- Mirrors PAN-025's proven shape: conditional, subject person_1, condition
-- marital_status equals 'verwitwet' (the evaluator reads the same answer
-- key in both questionnaires).
--
-- WORKBOOK DEVIATION (seeded-vs-file audit convention): the canonical Essen
-- master (essen_document_rules_cto_master.xlsx) tags DOC-0016
-- used_for_offices = "Pankow" only. This rule is an APPROVED OVERRIDE of
-- that tag — recorded in docs/document-rules/essen_document_rules.json
-- (rule entry + meta note) and the ledger. The workbook itself is Roman's
-- to update.
--
-- The char-for-char guard below re-verifies at apply time that the Essen
-- questionnaire's marital_status widowed option value is EXACTLY
-- 'verwitwet' (byte-equal to the condition value) — the rule must never
-- ship against a reworded option.

BEGIN;

DO $$
DECLARE
  n integer;
  essen constant uuid := '10000000-0000-0000-0000-000000000162';
BEGIN
  -- Guard 1: the catalog document exists and is active.
  IF NOT EXISTS (SELECT 1 FROM public.document_catalog
                 WHERE id = 'DOC-0016'
                   AND technical_key = 'spouse_death_certificate'
                   AND active = true) THEN
    RAISE EXCEPTION 'ESS-056 blocked: DOC-0016 (spouse_death_certificate) not in expected state';
  END IF;

  -- Guard 2: the Essen office exists under the surveyed id.
  IF NOT EXISTS (SELECT 1 FROM public.social_office
                 WHERE id = essen AND name = 'Sozialamt Essen') THEN
    RAISE EXCEPTION 'ESS-056 blocked: Sozialamt Essen not found at the surveyed id';
  END IF;

  -- Guard 3: id space exactly as surveyed — 55 Essen rules, ESS-056 free,
  -- zero Essen DOC-0016 rules.
  SELECT count(*) INTO n FROM public.office_document_rule
   WHERE social_office_id = essen;
  IF n <> 55 THEN RAISE EXCEPTION 'ESS-056 blocked: expected 55 Essen rules, found %', n; END IF;
  IF EXISTS (SELECT 1 FROM public.office_document_rule WHERE id = 'ESS-056') THEN
    RAISE EXCEPTION 'ESS-056 blocked: id already taken';
  END IF;
  SELECT count(*) INTO n FROM public.office_document_rule
   WHERE social_office_id = essen AND document_id = 'DOC-0016';
  IF n <> 0 THEN RAISE EXCEPTION 'ESS-056 blocked: % Essen DOC-0016 rules already exist', n; END IF;

  -- Guard 4 (char-for-char): the Essen questionnaire's marital_status
  -- question carries an option whose value is byte-equal to the condition
  -- value 'verwitwet'.
  SELECT count(*) INTO n
    FROM public.question_option o
    JOIN public.question q ON q.id = o.question_id
    JOIN public.category c ON c.id = q.category_id
   WHERE c.questionnaire_id = '30000000-0000-0000-0000-000000000003'
     AND q.key = 'marital_status'
     AND o.value = 'verwitwet';
  IF n <> 1 THEN
    RAISE EXCEPTION 'ESS-056 blocked: Essen widowed option value is not exactly ''verwitwet'' (found % matches)', n;
  END IF;
  RAISE NOTICE 'ESS-056 guards passed (DOC-0016 active, 55 rules, id free, widowed value verified char-for-char)';

  INSERT INTO public.office_document_rule
    (id, social_office_id, document_id, requirement_type, subject,
     instance_note, period_months, condition, active)
  VALUES
    ('ESS-056', essen, 'DOC-0016', 'conditional', 'person_1',
     'one slot for applicant', NULL,
     '{"field": "marital_status", "operator": "equals", "value": "verwitwet"}'::jsonb,
     true);

  SELECT count(*) INTO n FROM public.office_document_rule
   WHERE social_office_id = essen;
  IF n <> 56 THEN RAISE EXCEPTION 'ESS-056 end-state: expected 56 Essen rules, found %', n; END IF;
  SELECT count(*) INTO n FROM public.office_document_rule
   WHERE social_office_id = essen AND document_id = 'DOC-0016' AND active = true;
  IF n <> 1 THEN RAISE EXCEPTION 'ESS-056 end-state: expected exactly 1 Essen DOC-0016 rule, found %', n; END IF;
  RAISE NOTICE 'ESS-056 applied: Essen widowed applicants now get the Sterbeurkunde Partner slot';
END $$;

COMMIT;
