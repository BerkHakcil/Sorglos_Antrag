-- Berlin content pass, Tier 4 — reorder the front of the flow + split the name field.
--
-- Scope (confirmed plan, Option A): position + name-split ONLY. No visibility_rule,
-- validation, or prompt changes to any OTHER question. The three previous-residence
-- questions move category (einkommen -> antragsteller) — the one category change we
-- agreed to, needed to place them at the front.
--
-- Target front order of category 'antragsteller':
--   first_name -> last_name -> geburtsdatum -> last_residence_plz ->
--   last_residence_street -> last_residence_city -> district_of_birth -> ...(rest unchanged)
--
-- Notes:
--  * "Nursing-home selection" is NOT a question — it's the pre-questionnaire care-home
--    step (cases.care_home_id) and already runs before the questionnaire; nothing to do.
--  * Routing is driven by cases.plz_before_move (pre-questionnaire PlzForm), NOT by the
--    last_residence_plz question, so moving that question has no routing effect.
--  * The merged-name question has 10 pre-launch TEST answers; they are dropped via the
--    answer.question_id ON DELETE CASCADE (confirmed: no real cases to preserve).
--  * Answers for reordered/moved questions are preserved (they key on question_id, which
--    is unchanged by sort_order / category_id updates).
--  * einkommen keeps its remaining questions in their existing relative order (not
--    renumbered); its pre-existing duplicate sort_orders are intentionally left as-is.
--
-- Idempotent (safe to re-run / re-apply via `supabase db push`).

BEGIN;

-- 1. Split the merged name into two separate required free-text questions.
INSERT INTO public.question
  (id, category_id, group_id, key, sort_order, answer_type, is_required, prompt_de, help_de, validation, visibility_rule)
VALUES
  ('60000000-0000-0000-0000-0000000000f1', '40000000-0000-0000-0000-000000000001', NULL,
   'first_name', 0, 'short_text'::public.answer_type, true,
   'Vorname der pflegebedürftigen Person', NULL, NULL, NULL),
  ('60000000-0000-0000-0000-0000000000f2', '40000000-0000-0000-0000-000000000001', NULL,
   'last_name', 1, 'short_text'::public.answer_type, true,
   'Nachname der pflegebedürftigen Person', NULL, NULL, NULL)
ON CONFLICT (id) DO NOTHING;

-- 2. Remove the merged name question (its test answers cascade-delete).
DELETE FROM public.question WHERE key = 'name_pflegebedueftiger';

-- 3. Move the three previous-residence questions into 'antragsteller' (Option A).
UPDATE public.question
SET category_id = '40000000-0000-0000-0000-000000000001'
WHERE key IN ('last_residence_plz', 'last_residence_street', 'last_residence_city');

-- 4. Renumber 'antragsteller' into the target order (contiguous 0..29, no ties).
UPDATE public.question
SET sort_order = CASE key
  WHEN 'first_name'                        THEN 0
  WHEN 'last_name'                         THEN 1
  WHEN 'geburtsdatum'                      THEN 2
  WHEN 'last_residence_plz'                THEN 3
  WHEN 'last_residence_street'             THEN 4
  WHEN 'last_residence_city'               THEN 5
  WHEN 'district_of_birth'                 THEN 6
  WHEN 'country_of_birth'                  THEN 7
  WHEN 'gender'                            THEN 8
  WHEN 'marital_status'                    THEN 9
  WHEN 'marital_status_since'              THEN 10
  WHEN 'citizenship'                       THEN 11
  WHEN 'issuer_of_id'                      THEN 12
  WHEN 'id_expiry_date'                    THEN 13
  WHEN 'prior_social_aid'                  THEN 14
  WHEN 'prior_social_aid_until'            THEN 15
  WHEN 'prior_social_aid_issuer'           THEN 16
  WHEN 'prior_social_aid_reference_id'     THEN 17
  WHEN 'power_of_attorney'                 THEN 18
  WHEN 'special_origin_rights'             THEN 19
  WHEN 'special_origin_rights_issued'      THEN 20
  WHEN 'special_origin_rights_issued_by'   THEN 21
  WHEN 'disability_card'                   THEN 22
  WHEN 'disablity_card_application'        THEN 23
  WHEN 'disability_card_expiry'            THEN 24
  WHEN 'disability_card_markers'           THEN 25
  WHEN 'health_insurance'                  THEN 26
  WHEN 'health_insurance_type'             THEN 27
  WHEN 'care_level'                        THEN 28
  WHEN 'prior_social_service_applications' THEN 29
  ELSE sort_order
END
WHERE category_id = '40000000-0000-0000-0000-000000000001';

COMMIT;
