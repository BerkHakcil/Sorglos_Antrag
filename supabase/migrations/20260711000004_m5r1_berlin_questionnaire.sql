-- M5 Round 1 — Berlin questionnaire prerequisites for the Pankow document rules.
-- D1 person-2 trigger alignment, D2 spouse bank structure, D3 citizenship gates.
-- BERLIN ONLY — every statement scoped to questionnaire 30000000-…-0001; Essen
-- untouched. Constructed German is listed as pending-Roman in the milestone log.
-- Expected denominators after this migration: fresh 57, married 94, separated 57.

BEGIN;

-- Berlin category ids
--   antragsteller: 40000000-0000-0000-0000-000000000001
--   spouse:        40000000-0000-0000-0000-000000000008

-- ── D1: 4-value marital set -> 3-value (29 direct rules; the 30th,
--    spouse_bank_savings_account_amount, is re-gated by D2 below; and
--    spouse_bank_account_amount is updated here as part of the 29) ─────────────
UPDATE public.question
SET visibility_rule = '{"in_values":["verheiratet","eingetragene Lebenspartnerschaft","eheähnliche Gemeinschaft"],"question_key":"marital_status"}'::jsonb
WHERE category_id IN (SELECT id FROM public.category WHERE questionnaire_id = '30000000-0000-0000-0000-000000000001')
  AND key IN ('spouse_last_name','spouse_birth_name','spouse_first_name','spouse_birthdate',
              'spouse_city_of_birth','spouse_district_of_birth','spouse_country_of_birth','spouse_gender',
              'spouse_citizenship','spouse_issuer_of_id','spouse_id_expiry_date','spouse_prior_social_aid',
              'spouse_power_of_attorney','spouse_special_origin_rights','spouse_disability_card',
              'spouse_health_insurance','spouse_health_insurance_type','spouse_care_level',
              'spouse_in_facility_yes_no','spouse_prior_social_service_applications','spouse_pension_type',
              'spouse_wohngeld_yes_no','spouse_other_income','spouse_general_liablity_insurance_yes_no',
              'spouse_life_insurance','spouse_bank_account_amount','spouse_automobile_owner',
              'spouse_property_yes_no','spouse_additional_wealth_yes_no');
-- (spouse_citizenship is re-gated by D3 right after; harmless intermediate state.)

-- ── D3: citizenship gates (both persons) ──────────────────────────────────────
INSERT INTO public.question (id, category_id, group_id, key, sort_order, answer_type, is_required, prompt_de, help_de, validation, visibility_rule) VALUES
  ('60000000-0000-0000-0000-0000000000f4', '40000000-0000-0000-0000-000000000001', NULL,
   'german_citizenship_yes_no', 12, 'single_select'::public.answer_type, true,
   'Haben Sie die deutsche Staatsangehörigkeit?', NULL, NULL, NULL),
  ('60000000-0000-0000-0000-0000000000f5', '40000000-0000-0000-0000-000000000008', NULL,
   'spouse_german_citizenship_yes_no', 8, 'single_select'::public.answer_type, true,
   'Hat Ihr Partner die deutsche Staatsangehörigkeit?', NULL, NULL,
   '{"in_values":["verheiratet","eingetragene Lebenspartnerschaft","eheähnliche Gemeinschaft"],"question_key":"marital_status"}'::jsonb)
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.question_option (question_id, key, sort_order, label_de, value) VALUES
  ('60000000-0000-0000-0000-0000000000f4', 'o0', 0, 'Ja', 'Ja'),
  ('60000000-0000-0000-0000-0000000000f4', 'o1', 1, 'Nein', 'Nein'),
  ('60000000-0000-0000-0000-0000000000f5', 'o0', 0, 'Ja', 'Ja'),
  ('60000000-0000-0000-0000-0000000000f5', 'o1', 1, 'Nein', 'Nein')
ON CONFLICT (question_id, key) DO NOTHING;

UPDATE public.question SET visibility_rule = '{"value":"Nein","question_key":"german_citizenship_yes_no"}'::jsonb
WHERE key = 'citizenship'
  AND category_id IN (SELECT id FROM public.category WHERE questionnaire_id = '30000000-0000-0000-0000-000000000001');
UPDATE public.question SET visibility_rule = '{"value":"Nein","question_key":"spouse_german_citizenship_yes_no"}'::jsonb
WHERE key = 'spouse_citizenship'
  AND category_id IN (SELECT id FROM public.category WHERE questionnaire_id = '30000000-0000-0000-0000-000000000001');
-- Stale free-text test answers on the now-gated questions (pre-launch data):
DELETE FROM public.answer WHERE question_id IN (
  SELECT q.id FROM public.question q
  JOIN public.category c ON c.id = q.category_id
  WHERE c.questionnaire_id = '30000000-0000-0000-0000-000000000001'
    AND q.key IN ('citizenship','spouse_citizenship'));

-- ── D2: spouse bank structure (mirrors the live applicant side) ───────────────
-- New repeatable group (Roman's approved loop prompt).
INSERT INTO public.question_group (id, category_id, key, sort_order, label_de, custom_prompt_de, is_repeatable, min_count, max_count)
VALUES ('50000000-0000-0000-0000-000000000008', '40000000-0000-0000-0000-000000000008',
        'spouse_bank_additional', 2, 'Weitere Bankkonten des Ehepartners',
        'Möchten Sie weitere Bankkonten Ihres Partners hinzufügen?', true, 0, NULL)
ON CONFLICT (id) DO NOTHING;

-- New questions f6..fe. Prompts: subject-neutral applicant wording reused where
-- possible; the five constructed strings are pending-Roman (milestone log).
INSERT INTO public.question (id, category_id, group_id, key, sort_order, answer_type, is_required, prompt_de, help_de, validation, visibility_rule) VALUES
  ('60000000-0000-0000-0000-0000000000f6', '40000000-0000-0000-0000-000000000008', NULL,
   'spouse_bank_giro', 48, 'short_text'::public.answer_type, true,
   'Bei welcher Bank hat Ihr Partner sein Girokonto?', NULL, NULL,
   '{"in_values":["verheiratet","eingetragene Lebenspartnerschaft","eheähnliche Gemeinschaft"],"question_key":"marital_status"}'::jsonb),
  ('60000000-0000-0000-0000-0000000000f7', '40000000-0000-0000-0000-000000000008', NULL,
   'spouse_bank_giro_blz', 49, 'short_text'::public.answer_type, true,
   'Wie lautet die Bankleitzahl der Bank Ihres Partners?', NULL, NULL,
   '{"in_values":["verheiratet","eingetragene Lebenspartnerschaft","eheähnliche Gemeinschaft"],"question_key":"marital_status"}'::jsonb),
  ('60000000-0000-0000-0000-0000000000f8', '40000000-0000-0000-0000-000000000008', NULL,
   'spouse_bank_giro_iban', 50, 'short_text'::public.answer_type, true,
   'Wie lautet die IBAN des Girokontos Ihres Partners?', NULL,
   '{"placeholder_de":"DE89 3704 0044 0532 0130 00"}'::jsonb,
   '{"in_values":["verheiratet","eingetragene Lebenspartnerschaft","eheähnliche Gemeinschaft"],"question_key":"marital_status"}'::jsonb),
  ('60000000-0000-0000-0000-0000000000f9', '40000000-0000-0000-0000-000000000008', NULL,
   'spouse_bank_savings_account_yes_no', 52, 'single_select'::public.answer_type, true,
   'Hat Ihr Partner ein Sparkonto?', NULL, NULL,
   '{"in_values":["verheiratet","eingetragene Lebenspartnerschaft","eheähnliche Gemeinschaft"],"question_key":"marital_status"}'::jsonb),
  ('60000000-0000-0000-0000-0000000000fa', '40000000-0000-0000-0000-000000000008', NULL,
   'spouse_bank_savings_iban', 54, 'short_text'::public.answer_type, true,
   'Wie lautet die IBAN des Sparkontos Ihres Partners?', NULL,
   '{"placeholder_de":"DE89 3704 0044 0532 0130 00"}'::jsonb,
   '{"value":"Ja","question_key":"spouse_bank_savings_account_yes_no"}'::jsonb),
  ('60000000-0000-0000-0000-0000000000fb', '40000000-0000-0000-0000-000000000008', NULL,
   'spouse_bank_additional_account_yes_no', 55, 'single_select'::public.answer_type, true,
   'Hat Ihr Partner noch ein weiteres Konto?', NULL, NULL,
   '{"in_values":["verheiratet","eingetragene Lebenspartnerschaft","eheähnliche Gemeinschaft"],"question_key":"marital_status"}'::jsonb),
  ('60000000-0000-0000-0000-0000000000fc', '40000000-0000-0000-0000-000000000008',
   '50000000-0000-0000-0000-000000000008',
   'spouse_bank_additional_name', 56, 'short_text'::public.answer_type, true,
   'Bei welcher Bank ist dieses weitere Konto?', NULL,
   '{"placeholder_de":"Sparkasse Berlin"}'::jsonb,
   '{"value":"Ja","question_key":"spouse_bank_additional_account_yes_no"}'::jsonb),
  ('60000000-0000-0000-0000-0000000000fd', '40000000-0000-0000-0000-000000000008',
   '50000000-0000-0000-0000-000000000008',
   'spouse_bank_additional_iban', 57, 'short_text'::public.answer_type, true,
   'Wie lautet die IBAN dieses Kontos?', NULL,
   '{"placeholder_de":"DE89 3704 0044 0532 0130 00"}'::jsonb,
   '{"value":"Ja","question_key":"spouse_bank_additional_account_yes_no"}'::jsonb),
  ('60000000-0000-0000-0000-0000000000fe', '40000000-0000-0000-0000-000000000008',
   '50000000-0000-0000-0000-000000000008',
   'spouse_bank_additional_amount', 58, 'amount'::public.answer_type, true,
   'Wie viel Geld ist auf diesem Konto?', NULL, NULL,
   '{"value":"Ja","question_key":"spouse_bank_additional_account_yes_no"}'::jsonb)
ON CONFLICT (id) DO NOTHING;
-- Ja/Nein options for the two new yes/no selects:
INSERT INTO public.question_option (question_id, key, sort_order, label_de, value) VALUES
  ('60000000-0000-0000-0000-0000000000f9', 'o0', 0, 'Ja', 'Ja'),
  ('60000000-0000-0000-0000-0000000000f9', 'o1', 1, 'Nein', 'Nein'),
  ('60000000-0000-0000-0000-0000000000fb', 'o0', 0, 'Ja', 'Ja'),
  ('60000000-0000-0000-0000-0000000000fb', 'o1', 1, 'Nein', 'Nein')
ON CONFLICT (question_id, key) DO NOTHING;

-- Integrations: existing spouse amounts join the mirrored structure.
-- spouse_bank_account_amount = giro amount (kept its marital rule via D1 above).
-- spouse_bank_savings_account_amount re-gates on the new savings yes/no:
UPDATE public.question SET visibility_rule = '{"value":"Ja","question_key":"spouse_bank_savings_account_yes_no"}'::jsonb
WHERE key = 'spouse_bank_savings_account_amount'
  AND category_id IN (SELECT id FROM public.category WHERE questionnaire_id = '30000000-0000-0000-0000-000000000001');

-- ── Renumber antragsteller (gate before citizenship) ─────────────────────────
UPDATE public.question SET sort_order = CASE key
  WHEN 'first_name' THEN 0 WHEN 'birth_name' THEN 1 WHEN 'last_name' THEN 2 WHEN 'geburtsdatum' THEN 3
  WHEN 'in_facility_since' THEN 4 WHEN 'last_residence_street' THEN 5 WHEN 'last_residence_city' THEN 6
  WHEN 'district_of_birth' THEN 7 WHEN 'country_of_birth' THEN 8 WHEN 'gender' THEN 9
  WHEN 'marital_status' THEN 10 WHEN 'marital_status_since' THEN 11
  WHEN 'german_citizenship_yes_no' THEN 12 WHEN 'citizenship' THEN 13
  WHEN 'issuer_of_id' THEN 14 WHEN 'id_expiry_date' THEN 15
  WHEN 'prior_social_aid' THEN 16 WHEN 'prior_social_aid_until' THEN 17 WHEN 'prior_social_aid_issuer' THEN 18
  WHEN 'prior_social_aid_reference_id' THEN 19 WHEN 'power_of_attorney' THEN 20
  WHEN 'special_origin_rights' THEN 21 WHEN 'special_origin_rights_issued' THEN 22
  WHEN 'special_origin_rights_issued_by' THEN 23 WHEN 'disability_card' THEN 24
  WHEN 'disablity_card_application' THEN 25 WHEN 'disability_card_expiry' THEN 26
  WHEN 'disability_card_markers' THEN 27 WHEN 'health_insurance' THEN 28
  WHEN 'health_insurance_type' THEN 29 WHEN 'care_level' THEN 30
  WHEN 'prior_social_service_applications' THEN 31
  ELSE sort_order END
WHERE category_id = '40000000-0000-0000-0000-000000000001';

-- ── Renumber spouse (gate at 8; bank block after life insurance) ──────────────
UPDATE public.question SET sort_order = CASE key
  WHEN 'spouse_last_name' THEN 0 WHEN 'spouse_birth_name' THEN 1 WHEN 'spouse_first_name' THEN 2
  WHEN 'spouse_birthdate' THEN 3 WHEN 'spouse_city_of_birth' THEN 4 WHEN 'spouse_district_of_birth' THEN 5
  WHEN 'spouse_country_of_birth' THEN 6 WHEN 'spouse_gender' THEN 7
  WHEN 'spouse_german_citizenship_yes_no' THEN 8 WHEN 'spouse_citizenship' THEN 9
  WHEN 'spouse_issuer_of_id' THEN 10 WHEN 'spouse_id_expiry_date' THEN 11
  WHEN 'spouse_prior_social_aid' THEN 12 WHEN 'spouse_prior_social_aid_until' THEN 13
  WHEN 'spouse_prior_social_aid_issuer' THEN 14 WHEN 'spouse_prior_social_aid_reference_id' THEN 15
  WHEN 'spouse_power_of_attorney' THEN 16 WHEN 'spouse_special_origin_rights' THEN 17
  WHEN 'spouse_special_origin_rights_issued' THEN 18 WHEN 'spouse_special_origin_rights_issued_by' THEN 19
  WHEN 'spouse_disability_card' THEN 20 WHEN 'spouse_disability_card_application' THEN 21
  WHEN 'spouse_disability_card_expiry' THEN 22 WHEN 'spouse_disability_card_markers' THEN 23
  WHEN 'spouse_health_insurance' THEN 24 WHEN 'spouse_health_insurance_type' THEN 25
  WHEN 'spouse_care_level' THEN 26 WHEN 'spouse_in_facility_yes_no' THEN 27
  WHEN 'spouse_in_facility_since' THEN 28 WHEN 'spouse_prior_social_service_applications' THEN 29
  WHEN 'spouse_pension_type' THEN 30 WHEN 'spouse_pension_amount' THEN 31
  WHEN 'spouse_pension_id' THEN 32 WHEN 'spouse_pension_issuer' THEN 33
  WHEN 'spouse_wohngeld_yes_no' THEN 34 WHEN 'spouse_wohngeld_amount' THEN 35 WHEN 'spouse_wohngeld_id' THEN 36
  WHEN 'spouse_other_income' THEN 37 WHEN 'spouse_other_income_type' THEN 38 WHEN 'spouse_other_income_amount' THEN 39
  WHEN 'spouse_health_insurance_amount' THEN 40 WHEN 'spouse_care_insurance_amount' THEN 41
  WHEN 'spouse_general_liablity_insurance_yes_no' THEN 42 WHEN 'spouse_general_liablity_insurance_provider' THEN 43
  WHEN 'spouse_general_liability_amount' THEN 44 WHEN 'spouse_life_insurance' THEN 45
  WHEN 'spouse_life_insurance_amount' THEN 46
  WHEN 'spouse_bank_giro' THEN 47 WHEN 'spouse_bank_giro_blz' THEN 48 WHEN 'spouse_bank_giro_iban' THEN 49
  WHEN 'spouse_bank_account_amount' THEN 50
  WHEN 'spouse_bank_savings_account_yes_no' THEN 51 WHEN 'spouse_bank_savings_account_amount' THEN 52
  WHEN 'spouse_bank_savings_iban' THEN 53
  WHEN 'spouse_bank_additional_account_yes_no' THEN 54
  WHEN 'spouse_bank_additional_name' THEN 55 WHEN 'spouse_bank_additional_iban' THEN 56
  WHEN 'spouse_bank_additional_amount' THEN 57
  WHEN 'spouse_automobile_owner' THEN 58 WHEN 'spouse_automobile_numbers_plate' THEN 59
  WHEN 'spouse_automobile_type' THEN 60 WHEN 'spouse_automobile_year' THEN 61 WHEN 'spouse_automobile_holder' THEN 62
  WHEN 'spouse_property_yes_no' THEN 63 WHEN 'spouse_additional_wealth_yes_no' THEN 64
  WHEN 'spouse_additional_wealth_type' THEN 65 WHEN 'spouse_additional_wealth_amount' THEN 66
  ELSE sort_order END
WHERE category_id = '40000000-0000-0000-0000-000000000008';

COMMIT;
