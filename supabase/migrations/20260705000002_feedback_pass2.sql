-- Feedback pass 2 (post-M4 co-founder review) — all data-only changes.
-- Companion code changes ship in the same push (consent copy, infobox removal,
-- Fall-ID row, dropdown label, date bounds, locked-banner rendering).
-- Idempotent (safe to re-run).

BEGIN;

-- ── Item 4: real care homes ───────────────────────────────────────────────────
-- PROD DRIFT HEALED: prod still held the 7 FAKE Frankfurt facilities under ids
-- 20000000-…-01..07 — the repo seed (20260614000001) lists the real homes under
-- the same ids, but was backfilled as "applied" without re-running, so repo and
-- prod disagreed. The 12 pre-launch TEST cases referencing the fakes are deleted
-- first (answers + status events cascade; the throwaway auth users/profiles
-- remain and simply get a fresh case on next login). The care_home rows are then
-- UPDATEd IN PLACE to the real facilities — same ids as the repo seed, so repo
-- and prod agree afterwards, and no FK dance is needed (cases.care_home_id has
-- no ON DELETE rule, so DELETE+INSERT would have been blocked by references).
--
-- CSV columns NOT imported — care_home has only name / address / is_active and
-- the schema is deliberately not extended now: federal_state, country,
-- legal_name, operator_name, billing_* (all billing values are empty in the
-- CSV; billing_same_as_facility=true). Revisit at the billing milestone.
DELETE FROM public.cases
WHERE care_home_id IN (
  '20000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000002',
  '20000000-0000-0000-0000-000000000003',
  '20000000-0000-0000-0000-000000000004',
  '20000000-0000-0000-0000-000000000005',
  '20000000-0000-0000-0000-000000000006',
  '20000000-0000-0000-0000-000000000007'
);

UPDATE public.care_home SET name = 'Seniorenresidenz Haus Pankow', address = 'Schulzestraße 10, 13187 Berlin',      is_active = true WHERE id = '20000000-0000-0000-0000-000000000001';
UPDATE public.care_home SET name = 'Seniorenzentrum Altenessen',   address = 'Altenessenerstraße 170, 45326 Essen', is_active = true WHERE id = '20000000-0000-0000-0000-000000000002';
UPDATE public.care_home SET name = 'Seniorenzentrum Brauck',       address = 'Brauckstraße 52, 45968 Gladbeck',     is_active = true WHERE id = '20000000-0000-0000-0000-000000000003';
UPDATE public.care_home SET name = 'Seniorenzentrum Brauck 2',     address = 'Brauckstraße 54, 45968 Gladbeck',     is_active = true WHERE id = '20000000-0000-0000-0000-000000000004';
UPDATE public.care_home SET name = 'Seniorenzentrum Homberg',      address = 'Zechenstraße 50, 47198 Duisburg',     is_active = true WHERE id = '20000000-0000-0000-0000-000000000005';
UPDATE public.care_home SET name = 'Seniorenzentrum Feldstraße',   address = 'Feldstraße 17, 47198 Duisburg',       is_active = true WHERE id = '20000000-0000-0000-0000-000000000006';
UPDATE public.care_home SET name = 'K&S Seniorenresidenz Stade',   address = 'Am Hinterdeich 4, 21680 Stade',       is_active = true WHERE id = '20000000-0000-0000-0000-000000000007';

-- ── Item 5: new opening order + birth_name ────────────────────────────────────
-- New OPTIONAL question birth_name at position 2; the move-in date
-- (in_facility_since, from einkommen — no dependents, no visibility rule) and
-- the last-address block (street/city, from wohnsituation) move into
-- antragsteller so the flow opens: first_name → birth_name → last_name →
-- geburtsdatum → move-in → street → city → rest as before.
INSERT INTO public.question
  (id, category_id, group_id, key, sort_order, answer_type, is_required, prompt_de, help_de, validation, visibility_rule)
VALUES
  ('60000000-0000-0000-0000-0000000000f3', '40000000-0000-0000-0000-000000000001', NULL,
   'birth_name', 1, 'short_text'::public.answer_type, false,
   'Was ist Ihr Geburtsname?', NULL, NULL, NULL)
ON CONFLICT (id) DO NOTHING;

UPDATE public.question
SET category_id = '40000000-0000-0000-0000-000000000001'
WHERE key IN ('in_facility_since', 'last_residence_street', 'last_residence_city');

-- Absolute antragsteller order (contiguous 0..30, no ties).
UPDATE public.question
SET sort_order = CASE key
  WHEN 'first_name'                        THEN 0
  WHEN 'birth_name'                        THEN 1
  WHEN 'last_name'                         THEN 2
  WHEN 'geburtsdatum'                      THEN 3
  WHEN 'in_facility_since'                 THEN 4
  WHEN 'last_residence_street'             THEN 5
  WHEN 'last_residence_city'               THEN 6
  WHEN 'district_of_birth'                 THEN 7
  WHEN 'country_of_birth'                  THEN 8
  WHEN 'gender'                            THEN 9
  WHEN 'marital_status'                    THEN 10
  WHEN 'marital_status_since'              THEN 11
  WHEN 'citizenship'                       THEN 12
  WHEN 'issuer_of_id'                      THEN 13
  WHEN 'id_expiry_date'                    THEN 14
  WHEN 'prior_social_aid'                  THEN 15
  WHEN 'prior_social_aid_until'            THEN 16
  WHEN 'prior_social_aid_issuer'           THEN 17
  WHEN 'prior_social_aid_reference_id'     THEN 18
  WHEN 'power_of_attorney'                 THEN 19
  WHEN 'special_origin_rights'             THEN 20
  WHEN 'special_origin_rights_issued'      THEN 21
  WHEN 'special_origin_rights_issued_by'   THEN 22
  WHEN 'disability_card'                   THEN 23
  WHEN 'disablity_card_application'        THEN 24
  WHEN 'disability_card_expiry'            THEN 25
  WHEN 'disability_card_markers'           THEN 26
  WHEN 'health_insurance'                  THEN 27
  WHEN 'health_insurance_type'             THEN 28
  WHEN 'care_level'                        THEN 29
  WHEN 'prior_social_service_applications' THEN 30
  ELSE sort_order
END
WHERE category_id = '40000000-0000-0000-0000-000000000001';

-- wohnsituation keeps its remaining three questions, renumbered contiguously.
-- (einkommen's remaining questions keep their existing sort_orders — the gap
-- left by in_facility_since is harmless, ordering is numeric.)
UPDATE public.question
SET sort_order = CASE key
  WHEN 'berlin_since'          THEN 0
  WHEN 'berlin_district_since' THEN 1
  WHEN 'apartment_ownership'   THEN 2
  ELSE sort_order
END
WHERE category_id = '40000000-0000-0000-0000-000000000009';

-- ── Item 7: delete the duplicate PLZ question ─────────────────────────────────
-- last_residence_plz duplicated the routing PLZ captured PRE-questionnaire.
-- Verified before deletion: it controls nothing, no visibility rule references
-- it, and no code path reads it. Its 9 pre-launch TEST answers cascade-delete.
--
-- ⚠ IMPORTANT — for the future PDF/Antragsformular generation: the previous-
-- address PLZ must be sourced from cases.plz_before_move (set by the
-- pre-questionnaire PlzForm / resolvePlzAction step), NOT from an answer row.
-- After this migration no questionnaire question captures the PLZ anymore.
DELETE FROM public.question WHERE key = 'last_residence_plz';

-- ── Item 8: Betreuer/Beistand — explicit "Nein" option, first ────────────────
UPDATE public.question_option
SET sort_order = CASE key
  WHEN 'poa_gesetzlicher_betreuer'           THEN 1
  WHEN 'poa_bevollmaechtigter_angehoeriger'  THEN 2
  WHEN 'poa_beistandschaft'                  THEN 3
  ELSE sort_order
END
WHERE question_id = (SELECT id FROM public.question WHERE key = 'power_of_attorney');

INSERT INTO public.question_option (question_id, key, sort_order, label_de, value)
SELECT q.id, 'poa_nein', 0, 'Nein', 'Nein'
FROM public.question q
WHERE q.key = 'power_of_attorney'
ON CONFLICT (question_id, key) DO NOTHING;

-- ── Item 9: children loop prompt (mechanism from Tier 7) ──────────────────────
UPDATE public.question_group
SET custom_prompt_de = 'Haben Sie weitere Kinder?'
WHERE key = 'children';

-- ── Item 10: locked-banner copy → static_content ──────────────────────────────
-- The under-review banner (EditLockedCard) was hardcoded in de.ts; moved to the
-- DB per Tier 2 precedent. Values are currently identical to
-- case.all_answered_* by the co-founder's choice, but kept as SEPARATE keys so
-- the two states stay independently editable.
INSERT INTO public.static_content (key, value_de) VALUES
  ('case.locked_heading', 'Sie haben alle Fragen beantwortet!'),
  ('case.locked_body',    'Wir prüfen nun alle Ihre Angaben und übertragen diese in das Antragsformular. Sofern Dinge unklar sind, melden wir uns bei Ihnen.')
ON CONFLICT (key) DO UPDATE SET value_de = EXCLUDED.value_de, updated_at = NOW();

COMMIT;
