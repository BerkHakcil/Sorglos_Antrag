-- ============================================================
-- Migration: 20260702000001_baseline_questionnaire_state
-- Generated: 2026-07-01T19:01:30.116Z
--
-- Faithful snapshot of the live production questionnaire captured
-- after 73 questions were added and 5 were removed via dashboard
-- edits that bypassed migrations.
--
-- Idempotent: safe to re-run. Every statement uses ON CONFLICT DO
-- UPDATE or an explicit WHERE-keyed DELETE/UPDATE so replaying
-- produces the same result.
--
-- document_upload resolution: 20260622000001 was never applied to
-- production. The DELETE below folds that intent into this baseline
-- and removes personalausweis_upload from production on first run.
-- ============================================================

-- ─── 1. Resolve document_upload debt (20260622000001 catch-up) ─
-- Idempotent: no-op on fresh replay (seed never had document_upload).
-- Removes personalausweis_upload from production on first application.
DELETE FROM public.question WHERE answer_type = 'document_upload';

-- ─── 2. Category key + label renames (3 categories, by UUID) ───
-- The seed inserted categories with old keys (personal, home, children).
-- The dashboard renamed both key and label_de for 3 of them.
-- Must use WHERE id = '...' so fresh-replay works (old keys gone after update).
UPDATE public.category SET key = 'antragsteller', label_de = 'Angaben zur pflegebedürftigen Person' WHERE id = '40000000-0000-0000-0000-000000000001';
UPDATE public.category SET key = 'einkommen', label_de = 'Einnahmen und Rente' WHERE id = '40000000-0000-0000-0000-000000000002';
UPDATE public.category SET key = 'dokumente', label_de = 'Erforderliche Dokumente' WHERE id = '40000000-0000-0000-0000-000000000003';

-- ─── 3. Delete seed questions removed from production ────────────
-- These keys were inserted by 20260614000001 but deleted via dashboard.
-- Deleted: last_name, birth_name, first_name, birthdate, city_of_birth
DELETE FROM public.question
WHERE key IN ('last_name', 'birth_name', 'first_name', 'birthdate', 'city_of_birth');

-- ─── 4. Question groups ─────────────────────────────────────────
INSERT INTO public.question_group
  (id, category_id, key, sort_order, label_de, is_repeatable, min_count, max_count)
VALUES
  ('50000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000003', 'children', 0, 'Kinder', true, 0, NULL),
  ('50000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000004', 'pension', 0, 'Rente / Pension', true, 0, NULL),
  ('50000000-0000-0000-0000-000000000003', '40000000-0000-0000-0000-000000000004', 'other_income', 1, 'Sonstige Einkünfte', true, 0, NULL),
  ('50000000-0000-0000-0000-000000000004', '40000000-0000-0000-0000-000000000006', 'bank_additional', 0, 'Weitere Bankkonten', true, 0, NULL),
  ('50000000-0000-0000-0000-000000000005', '40000000-0000-0000-0000-000000000008', 'spouse_pension', 0, 'Rente / Pension des Ehepartners', true, 0, NULL),
  ('50000000-0000-0000-0000-000000000006', '40000000-0000-0000-0000-000000000008', 'spouse_other_income', 1, 'Sonstige Einkünfte des Ehepartners', true, 0, NULL)
ON CONFLICT (id) DO UPDATE SET
  label_de      = EXCLUDED.label_de,
  sort_order    = EXCLUDED.sort_order,
  is_repeatable = EXCLUDED.is_repeatable,
  min_count     = EXCLUDED.min_count,
  max_count     = EXCLUDED.max_count;

-- ─── 5. Questions (158 total, excl. document_upload) ──────────────
-- ON CONFLICT DO UPDATE ensures prompt edits made in the dashboard are
-- also captured, not just the new questions.
INSERT INTO public.question
  (id, category_id, group_id, key, sort_order, answer_type,
   is_required, prompt_de, help_de, validation, visibility_rule)
VALUES
  ('60000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', NULL, 'name_pflegebedueftiger', 0, 'short_text'::public.answer_type, true, 'Vollständiger Name der pflegebedürftigen Person', 'Bitte geben Sie Vor- und Nachname an.', NULL, NULL),
  ('60000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000001', NULL, 'geburtsdatum', 1, 'date'::public.answer_type, true, 'Geburtsdatum der pflegebedürftigen Person', NULL, NULL, NULL),
  ('60000000-0000-0000-0000-000000000007', '40000000-0000-0000-0000-000000000001', NULL, 'district_of_birth', 5, 'short_text'::public.answer_type, true, 'In welchem Kreis/Bezirk wurden Sie geboren?', NULL, NULL, NULL),
  ('60000000-0000-0000-0000-000000000008', '40000000-0000-0000-0000-000000000001', NULL, 'country_of_birth', 6, 'short_text'::public.answer_type, true, 'In welchem Land wurden Sie geboren?', NULL, NULL, NULL),
  ('60000000-0000-0000-0000-000000000009', '40000000-0000-0000-0000-000000000001', NULL, 'gender', 7, 'single_select'::public.answer_type, true, 'Was ist Ihr Geschlecht?', NULL, NULL, NULL),
  ('60000000-0000-0000-0000-00000000000a', '40000000-0000-0000-0000-000000000001', NULL, 'marital_status', 8, 'single_select'::public.answer_type, true, 'Was ist Ihr Familienstand?', NULL, NULL, NULL),
  ('60000000-0000-0000-0000-00000000000b', '40000000-0000-0000-0000-000000000001', NULL, 'marital_status_since', 9, 'date'::public.answer_type, true, 'Seit wann ist dies Ihr Familienstand?', NULL, NULL, NULL),
  ('60000000-0000-0000-0000-00000000000c', '40000000-0000-0000-0000-000000000001', NULL, 'citizenship', 10, 'short_text'::public.answer_type, true, 'Was ist Ihre Staatsangehörigkeit?', NULL, NULL, NULL),
  ('60000000-0000-0000-0000-00000000000d', '40000000-0000-0000-0000-000000000001', NULL, 'issuer_of_id', 11, 'short_text'::public.answer_type, true, 'Welche Behörde hat Ihr Personaldokument ausgestellt?', NULL, NULL, NULL),
  ('60000000-0000-0000-0000-00000000000e', '40000000-0000-0000-0000-000000000001', NULL, 'id_expiry_date', 12, 'date'::public.answer_type, true, 'Bis wann ist Ihr Personaldokument gültig?', NULL, NULL, NULL),
  ('60000000-0000-0000-0000-00000000000f', '40000000-0000-0000-0000-000000000001', NULL, 'prior_social_aid', 13, 'single_select'::public.answer_type, true, 'Haben Sie bereits Hilfe zur Pflege Leistungen erhalten?', NULL, NULL, NULL),
  ('60000000-0000-0000-0000-000000000010', '40000000-0000-0000-0000-000000000001', NULL, 'prior_social_aid_until', 14, 'date'::public.answer_type, true, 'Bis wann haben Sie Hilfe zur Pflege erhalten?', NULL, NULL, '{"value":"Ja","question_key":"prior_social_aid"}'::jsonb),
  ('60000000-0000-0000-0000-000000000011', '40000000-0000-0000-0000-000000000001', NULL, 'prior_social_aid_issuer', 15, 'short_text'::public.answer_type, true, 'Welche Behörde hat die Hilfe zur Pflege genehmigt?', NULL, NULL, '{"value":"Ja","question_key":"prior_social_aid"}'::jsonb),
  ('60000000-0000-0000-0000-000000000012', '40000000-0000-0000-0000-000000000001', NULL, 'prior_social_aid_reference_id', 16, 'short_text'::public.answer_type, true, 'Was ist das Geschäftszeichen der Genehmigung?', NULL, NULL, '{"value":"Ja","question_key":"prior_social_aid"}'::jsonb),
  ('60000000-0000-0000-0000-000000000013', '40000000-0000-0000-0000-000000000001', NULL, 'power_of_attorney', 17, 'single_select'::public.answer_type, true, 'Gibt es einen Betreuer oder Beistand?', NULL, NULL, NULL),
  ('60000000-0000-0000-0000-000000000014', '40000000-0000-0000-0000-000000000001', NULL, 'special_origin_rights', 18, 'single_select'::public.answer_type, true, 'Liegt ein Sonderstatus vor?', NULL, NULL, NULL),
  ('60000000-0000-0000-0000-000000000015', '40000000-0000-0000-0000-000000000001', NULL, 'special_origin_rights_issued', 19, 'date'::public.answer_type, true, 'Wann wurde der Sonderstatus ausgestellt?', NULL, NULL, '{"not_value":"Nein","question_key":"special_origin_rights"}'::jsonb),
  ('60000000-0000-0000-0000-000000000016', '40000000-0000-0000-0000-000000000001', NULL, 'special_origin_rights_issued_by', 20, 'short_text'::public.answer_type, true, 'Welche Behörde hat den Sonderstatus ausgestellt?', NULL, NULL, '{"not_value":"Nein","question_key":"special_origin_rights"}'::jsonb),
  ('60000000-0000-0000-0000-000000000017', '40000000-0000-0000-0000-000000000001', NULL, 'disability_card', 21, 'single_select'::public.answer_type, true, 'Liegt ein Schwerbehindertenausweis vor?', NULL, NULL, NULL),
  ('60000000-0000-0000-0000-000000000018', '40000000-0000-0000-0000-000000000001', NULL, 'disablity_card_application', 22, 'single_select'::public.answer_type, true, 'Wurde ein Antrag auf Schwerbehinderung gestellt?', NULL, NULL, '{"value":"Nein","question_key":"disability_card"}'::jsonb),
  ('60000000-0000-0000-0000-000000000019', '40000000-0000-0000-0000-000000000001', NULL, 'disability_card_expiry', 23, 'date'::public.answer_type, true, 'Bis wann ist der Schwerbehindertenausweis gültig?', NULL, NULL, '{"value":"Ja","question_key":"disability_card"}'::jsonb),
  ('60000000-0000-0000-0000-00000000001a', '40000000-0000-0000-0000-000000000001', NULL, 'disability_card_markers', 24, 'multi_select'::public.answer_type, true, 'Welche Merkzeichen hat der Schwerbehindertenausweis?', NULL, NULL, '{"value":"Ja","question_key":"disability_card"}'::jsonb),
  ('60000000-0000-0000-0000-00000000001b', '40000000-0000-0000-0000-000000000001', NULL, 'health_insurance', 25, 'short_text'::public.answer_type, true, 'Bei welcher Krankenkasse sind Sie versichert?', NULL, NULL, NULL),
  ('60000000-0000-0000-0000-00000000001c', '40000000-0000-0000-0000-000000000001', NULL, 'health_insurance_type', 26, 'single_select'::public.answer_type, true, 'Wie sind Sie krankenversichert?', NULL, NULL, NULL),
  ('60000000-0000-0000-0000-00000000001d', '40000000-0000-0000-0000-000000000001', NULL, 'care_level', 27, 'single_select'::public.answer_type, true, 'Was ist Ihre Pflegestufe?', NULL, NULL, NULL)
ON CONFLICT (id) DO UPDATE SET
  category_id     = EXCLUDED.category_id,
  group_id        = EXCLUDED.group_id,
  sort_order      = EXCLUDED.sort_order,
  answer_type     = EXCLUDED.answer_type,
  is_required     = EXCLUDED.is_required,
  prompt_de       = EXCLUDED.prompt_de,
  help_de         = EXCLUDED.help_de,
  validation      = EXCLUDED.validation,
  visibility_rule = EXCLUDED.visibility_rule;

INSERT INTO public.question
  (id, category_id, group_id, key, sort_order, answer_type,
   is_required, prompt_de, help_de, validation, visibility_rule)
VALUES
  ('60000000-0000-0000-0000-00000000001f', '40000000-0000-0000-0000-000000000001', NULL, 'prior_social_service_applications', 28, 'single_select'::public.answer_type, true, 'Haben Sie weitere Sozialleistungen beantragt?', NULL, NULL, NULL),
  ('60000000-0000-0000-0000-000000000003', '40000000-0000-0000-0000-000000000002', NULL, 'familienstand', 0, 'single_select'::public.answer_type, true, 'Familienstand der pflegebedürftigen Person', NULL, NULL, NULL),
  ('60000000-0000-0000-0000-00000000001e', '40000000-0000-0000-0000-000000000002', NULL, 'in_facility_since', 0, 'date'::public.answer_type, true, 'Wann fand/findet der Einzug in die Pflegeeinrichtung statt?', NULL, NULL, NULL),
  ('60000000-0000-0000-0000-000000000004', '40000000-0000-0000-0000-000000000002', NULL, 'hat_rente', 1, 'yes_no'::public.answer_type, true, 'Erhält die pflegebedürftige Person Rente?', NULL, NULL, NULL),
  ('60000000-0000-0000-0000-000000000023', '40000000-0000-0000-0000-000000000002', NULL, 'last_residence_street', 1, 'short_text'::public.answer_type, true, 'Was ist die Straße und Hausnummer Ihrer letzten Wohnung?', NULL, NULL, NULL),
  ('60000000-0000-0000-0000-000000000024', '40000000-0000-0000-0000-000000000002', NULL, 'last_residence_city', 2, 'short_text'::public.answer_type, true, 'In welcher Stadt haben Sie vor Heimaufnahme gewohnt?', NULL, NULL, NULL),
  ('60000000-0000-0000-0000-000000000005', '40000000-0000-0000-0000-000000000002', NULL, 'rentenbetrag', 2, 'amount'::public.answer_type, true, 'Monatlicher Rentenbetrag (€)', 'Bitte geben Sie den Bruttobetrag aus dem aktuellen Rentenbescheid an.', '{"max":99999,"min":0}'::jsonb, '{"value":"Ja","question_key":"hat_rente"}'::jsonb),
  ('60000000-0000-0000-0000-000000000025', '40000000-0000-0000-0000-000000000002', NULL, 'last_residence_plz', 3, 'short_text'::public.answer_type, true, 'Was ist die Postleitzahl Ihres letzten Wohnortes?', NULL, NULL, NULL),
  ('60000000-0000-0000-0000-000000000026', '40000000-0000-0000-0000-000000000002', NULL, 'berlin_since', 4, 'short_text'::public.answer_type, true, 'Seit wann leben Sie in Berlin?', NULL, NULL, NULL),
  ('60000000-0000-0000-0000-000000000027', '40000000-0000-0000-0000-000000000002', NULL, 'berlin_district_since', 5, 'short_text'::public.answer_type, true, 'Seit wann leben Sie im Bezirk?', NULL, NULL, NULL),
  ('60000000-0000-0000-0000-000000000028', '40000000-0000-0000-0000-000000000002', NULL, 'apartment_ownership', 6, 'single_select'::public.answer_type, true, 'Was war das Mietverhältnis vor Heimeinzug?', NULL, NULL, NULL),
  ('60000000-0000-0000-0000-000000000029', '40000000-0000-0000-0000-000000000002', NULL, 'landlord_name_and_address', 7, 'short_text'::public.answer_type, true, 'Name und Anschrift Ihres Vermieters?', NULL, NULL, '{"value":"Mietwohnung","question_key":"apartment_ownership"}'::jsonb),
  ('60000000-0000-0000-0000-00000000002a', '40000000-0000-0000-0000-000000000002', NULL, 'rent_total', 8, 'amount'::public.answer_type, true, 'Wie viel monatliche Miete zahlen Sie?', NULL, NULL, '{"value":"Mietwohnung","question_key":"apartment_ownership"}'::jsonb),
  ('60000000-0000-0000-0000-00000000002b', '40000000-0000-0000-0000-000000000002', NULL, 'rent_heating', 9, 'amount'::public.answer_type, true, 'Wie hoch ist der Heizkostenvorschuss pro Monat?', NULL, NULL, NULL),
  ('60000000-0000-0000-0000-00000000002c', '40000000-0000-0000-0000-000000000002', NULL, 'rent_warm_water', 10, 'amount'::public.answer_type, true, 'Wie hoch sind Warmwasserkosten pro Monat?', NULL, NULL, NULL),
  ('60000000-0000-0000-0000-00000000002d', '40000000-0000-0000-0000-000000000002', NULL, 'rent_paid_until', 11, 'date'::public.answer_type, true, 'Bis wann ist die Miete bereits gezahlt?', NULL, NULL, '{"value":"Mietwohnung","question_key":"apartment_ownership"}'::jsonb),
  ('60000000-0000-0000-0000-00000000002e', '40000000-0000-0000-0000-000000000002', NULL, 'rent_debt', 12, 'amount'::public.answer_type, true, 'Wie hoch sind mögliche Mietrückstände?', NULL, NULL, '{"value":"Mietwohnung","question_key":"apartment_ownership"}'::jsonb),
  ('60000000-0000-0000-0000-00000000002f', '40000000-0000-0000-0000-000000000002', NULL, 'rent_contract_termination_yes_no', 13, 'single_select'::public.answer_type, true, 'Werden Sie Ihren Mietvertrag kündigen?', NULL, NULL, '{"value":"Mietwohnung","question_key":"apartment_ownership"}'::jsonb),
  ('60000000-0000-0000-0000-000000000030', '40000000-0000-0000-0000-000000000002', NULL, 'rent_contract_terminated_by', 14, 'date'::public.answer_type, true, 'Zu welchem Datum haben Sie Ihre Wohnung gekündigt?', NULL, NULL, '{"value":"Ja","question_key":"rent_contract_termination_yes_no"}'::jsonb),
  ('60000000-0000-0000-0000-000000000031', '40000000-0000-0000-0000-000000000003', '50000000-0000-0000-0000-000000000001', 'child_first_name', 0, 'short_text'::public.answer_type, true, 'Vorname Ihres Kindes?', NULL, NULL, NULL),
  ('60000000-0000-0000-0000-000000000032', '40000000-0000-0000-0000-000000000003', '50000000-0000-0000-0000-000000000001', 'child_last_name', 1, 'short_text'::public.answer_type, true, 'Nachname Ihres Kindes?', NULL, NULL, '{"not_empty":true,"question_key":"child_first_name"}'::jsonb),
  ('60000000-0000-0000-0000-000000000033', '40000000-0000-0000-0000-000000000003', '50000000-0000-0000-0000-000000000001', 'child_birth_name', 2, 'short_text'::public.answer_type, true, 'Geburtsname Ihres Kindes?', NULL, NULL, '{"not_empty":true,"question_key":"child_first_name"}'::jsonb),
  ('60000000-0000-0000-0000-000000000034', '40000000-0000-0000-0000-000000000003', '50000000-0000-0000-0000-000000000001', 'child_birth_date', 3, 'date'::public.answer_type, true, 'Geburtsdatum Ihres Kindes?', NULL, NULL, '{"not_empty":true,"question_key":"child_first_name"}'::jsonb),
  ('60000000-0000-0000-0000-000000000035', '40000000-0000-0000-0000-000000000003', '50000000-0000-0000-0000-000000000001', 'child_marital_status', 4, 'single_select'::public.answer_type, true, 'Familienstand Ihres Kindes?', NULL, NULL, '{"not_empty":true,"question_key":"child_first_name"}'::jsonb),
  ('60000000-0000-0000-0000-000000000036', '40000000-0000-0000-0000-000000000003', '50000000-0000-0000-0000-000000000001', 'child_family_tie', 5, 'single_select'::public.answer_type, true, 'Verwandschaftsverhältnis zu Ihrem Kind?', NULL, NULL, '{"not_empty":true,"question_key":"child_first_name"}'::jsonb)
ON CONFLICT (id) DO UPDATE SET
  category_id     = EXCLUDED.category_id,
  group_id        = EXCLUDED.group_id,
  sort_order      = EXCLUDED.sort_order,
  answer_type     = EXCLUDED.answer_type,
  is_required     = EXCLUDED.is_required,
  prompt_de       = EXCLUDED.prompt_de,
  help_de         = EXCLUDED.help_de,
  validation      = EXCLUDED.validation,
  visibility_rule = EXCLUDED.visibility_rule;

INSERT INTO public.question
  (id, category_id, group_id, key, sort_order, answer_type,
   is_required, prompt_de, help_de, validation, visibility_rule)
VALUES
  ('60000000-0000-0000-0000-000000000037', '40000000-0000-0000-0000-000000000003', '50000000-0000-0000-0000-000000000001', 'child_profession', 6, 'short_text'::public.answer_type, true, 'Beruf Ihres Kindes?', NULL, NULL, '{"not_empty":true,"question_key":"child_first_name"}'::jsonb),
  ('60000000-0000-0000-0000-000000000038', '40000000-0000-0000-0000-000000000003', '50000000-0000-0000-0000-000000000001', 'child_address', 7, 'short_text'::public.answer_type, true, 'Wohnadresse Ihres Kindes?', NULL, NULL, '{"not_empty":true,"question_key":"child_first_name"}'::jsonb),
  ('60000000-0000-0000-0000-000000000039', '40000000-0000-0000-0000-000000000004', '50000000-0000-0000-0000-000000000002', 'pension_type', 0, 'single_select'::public.answer_type, true, 'Welche Rente/Pension beziehen Sie?', NULL, NULL, NULL),
  ('60000000-0000-0000-0000-00000000003a', '40000000-0000-0000-0000-000000000004', '50000000-0000-0000-0000-000000000002', 'pension_amount', 1, 'amount'::public.answer_type, true, 'Wie hoch ist die monatliche Rente/Pension?', NULL, NULL, '{"not_empty":true,"question_key":"pension_type"}'::jsonb),
  ('60000000-0000-0000-0000-00000000003b', '40000000-0000-0000-0000-000000000004', '50000000-0000-0000-0000-000000000002', 'pension_id', 2, 'short_text'::public.answer_type, true, 'Was ist die Abrechnungsnummer der Rente/Pension?', NULL, NULL, '{"not_empty":true,"question_key":"pension_type"}'::jsonb),
  ('60000000-0000-0000-0000-00000000003c', '40000000-0000-0000-0000-000000000004', '50000000-0000-0000-0000-000000000002', 'pension_issuer', 3, 'short_text'::public.answer_type, true, 'Wer bezahlt die Rente/Pension?', NULL, NULL, '{"not_empty":true,"question_key":"pension_type"}'::jsonb),
  ('60000000-0000-0000-0000-00000000003d', '40000000-0000-0000-0000-000000000004', NULL, 'wohngeld_yes_no', 4, 'single_select'::public.answer_type, true, 'Beziehen Sie Wohngeld?', NULL, NULL, NULL),
  ('60000000-0000-0000-0000-00000000003e', '40000000-0000-0000-0000-000000000004', NULL, 'wohngeld_amount', 5, 'amount'::public.answer_type, true, 'Wie viel Wohngeld beziehen Sie?', NULL, NULL, '{"value":"Ja","question_key":"wohngeld_yes_no"}'::jsonb),
  ('60000000-0000-0000-0000-00000000003f', '40000000-0000-0000-0000-000000000004', NULL, 'wohngeld_id', 6, 'short_text'::public.answer_type, true, 'Was ist die Abrechnungsnummer des Wohngeld?', NULL, NULL, '{"value":"Ja","question_key":"wohngeld_yes_no"}'::jsonb),
  ('60000000-0000-0000-0000-000000000040', '40000000-0000-0000-0000-000000000004', NULL, 'other_income', 7, 'single_select'::public.answer_type, true, 'Beziehen Sie anderes Einkommen?', NULL, NULL, NULL),
  ('60000000-0000-0000-0000-000000000041', '40000000-0000-0000-0000-000000000004', '50000000-0000-0000-0000-000000000003', 'other_income_type', 8, 'short_text'::public.answer_type, true, 'Welche Art von Einkommen beziehen Sie?', NULL, NULL, '{"value":"Ja","question_key":"other_income"}'::jsonb),
  ('60000000-0000-0000-0000-000000000042', '40000000-0000-0000-0000-000000000004', '50000000-0000-0000-0000-000000000003', 'other_income_amount', 9, 'amount'::public.answer_type, true, 'Wie hoch ist das weitere Einkommen monatlich?', NULL, NULL, '{"value":"Ja","question_key":"other_income"}'::jsonb),
  ('60000000-0000-0000-0000-000000000043', '40000000-0000-0000-0000-000000000005', NULL, 'govermental_employee', 0, 'single_select'::public.answer_type, true, 'Waren Sie früher Beamter?', NULL, NULL, NULL),
  ('60000000-0000-0000-0000-000000000044', '40000000-0000-0000-0000-000000000005', NULL, 'health_insurance_amount', 1, 'amount'::public.answer_type, true, 'Wie hoch sind die monatlichen Ausgaben für Ihre Krankenversicherung?', NULL, NULL, '{"value":"Ja","question_key":"govermental_employee"}'::jsonb),
  ('60000000-0000-0000-0000-000000000045', '40000000-0000-0000-0000-000000000005', NULL, 'care_insurance_amount', 2, 'amount'::public.answer_type, true, 'Wo hoch sind die monatlichen Ausgaben für Ihre Pflegeversicherung?', NULL, NULL, '{"value":"Ja","question_key":"govermental_employee"}'::jsonb),
  ('60000000-0000-0000-0000-000000000046', '40000000-0000-0000-0000-000000000005', NULL, 'general_liablity_insurance_yes_no', 3, 'single_select'::public.answer_type, true, 'Haben Sie eine Haftpflichtversicherung?', NULL, NULL, NULL),
  ('60000000-0000-0000-0000-000000000047', '40000000-0000-0000-0000-000000000005', NULL, 'general_liablity_insurance_provider', 4, 'short_text'::public.answer_type, true, 'Wer ist Träger Ihrer Haftpflichtversicherung?', NULL, NULL, '{"value":"Ja","question_key":"general_liablity_insurance_yes_no"}'::jsonb),
  ('60000000-0000-0000-0000-000000000048', '40000000-0000-0000-0000-000000000005', NULL, 'general_liability_amount', 5, 'amount'::public.answer_type, true, 'Wo hoch ist der monatliche Betrag Ihrer Haftpflichtversicherung?', NULL, NULL, '{"value":"Ja","question_key":"general_liablity_insurance_yes_no"}'::jsonb),
  ('60000000-0000-0000-0000-000000000049', '40000000-0000-0000-0000-000000000005', NULL, 'life_insurance', 6, 'single_select'::public.answer_type, true, 'Haben Sie eine Lebens- oder Sterbeversicherung?', NULL, NULL, NULL),
  ('60000000-0000-0000-0000-00000000004a', '40000000-0000-0000-0000-000000000005', NULL, 'life_insurance_monthly_amount', 7, 'amount'::public.answer_type, true, 'Wie hoch ist der monatliche Beitrag Ihrer Lebens- oder Sterbeversicherung?', NULL, NULL, '{"not_value":"Nein","question_key":"life_insurance"}'::jsonb),
  ('60000000-0000-0000-0000-00000000004b', '40000000-0000-0000-0000-000000000006', NULL, 'life_insurance_total_amount', 0, 'amount'::public.answer_type, true, 'Wie hoch ist der Auszahlungsbetrag der Versicherung?', NULL, NULL, '{"not_value":"Nein","question_key":"life_insurance"}'::jsonb),
  ('60000000-0000-0000-0000-00000000004c', '40000000-0000-0000-0000-000000000006', NULL, 'life_insurance_name', 1, 'short_text'::public.answer_type, true, 'Bei welcher Versicherungsgesellschaft?', NULL, NULL, '{"not_value":"Nein","question_key":"life_insurance"}'::jsonb),
  ('60000000-0000-0000-0000-00000000004d', '40000000-0000-0000-0000-000000000006', NULL, 'life_insurance_number', 2, 'short_text'::public.answer_type, true, 'Was ist die Versicherungsnummer?', NULL, NULL, '{"not_value":"Nein","question_key":"life_insurance"}'::jsonb),
  ('60000000-0000-0000-0000-00000000004e', '40000000-0000-0000-0000-000000000006', NULL, 'funeral_insurance_yes_no', 3, 'single_select'::public.answer_type, true, 'Haben Sie einen Bestattungsvorsorgevertrag?', NULL, NULL, NULL),
  ('60000000-0000-0000-0000-00000000004f', '40000000-0000-0000-0000-000000000006', NULL, 'funeral_insurance_amount', 4, 'amount'::public.answer_type, true, 'Was ist der Auszahlungsbetrag?', NULL, NULL, '{"value":"Ja","question_key":"funeral_insurance_yes_no"}'::jsonb)
ON CONFLICT (id) DO UPDATE SET
  category_id     = EXCLUDED.category_id,
  group_id        = EXCLUDED.group_id,
  sort_order      = EXCLUDED.sort_order,
  answer_type     = EXCLUDED.answer_type,
  is_required     = EXCLUDED.is_required,
  prompt_de       = EXCLUDED.prompt_de,
  help_de         = EXCLUDED.help_de,
  validation      = EXCLUDED.validation,
  visibility_rule = EXCLUDED.visibility_rule;

INSERT INTO public.question
  (id, category_id, group_id, key, sort_order, answer_type,
   is_required, prompt_de, help_de, validation, visibility_rule)
VALUES
  ('60000000-0000-0000-0000-000000000050', '40000000-0000-0000-0000-000000000006', NULL, 'funeral_insurance_detail', 5, 'single_select'::public.answer_type, true, 'Was trifft auf den Bestattungsvertrag zu?', NULL, NULL, '{"value":"Ja","question_key":"funeral_insurance_yes_no"}'::jsonb),
  ('60000000-0000-0000-0000-000000000051', '40000000-0000-0000-0000-000000000006', NULL, 'bank_giro', 6, 'short_text'::public.answer_type, true, 'Bei welcher Bank haben Sie Ihr Girokonto?', NULL, NULL, NULL),
  ('60000000-0000-0000-0000-000000000052', '40000000-0000-0000-0000-000000000006', NULL, 'bank_giro_blz', 7, 'short_text'::public.answer_type, true, 'Was ist die Bankleitzahl Ihrer Bank?', NULL, NULL, NULL),
  ('60000000-0000-0000-0000-000000000053', '40000000-0000-0000-0000-000000000006', NULL, 'bank_giro_iban', 8, 'short_text'::public.answer_type, true, 'Was ist Ihre IBAN Nummer?', NULL, NULL, NULL),
  ('60000000-0000-0000-0000-000000000054', '40000000-0000-0000-0000-000000000006', NULL, 'bank_giro_amount', 9, 'amount'::public.answer_type, true, 'Wie hoch ist der Betrag auf Ihrem Girokonto?', NULL, NULL, NULL),
  ('60000000-0000-0000-0000-000000000055', '40000000-0000-0000-0000-000000000006', NULL, 'bank_savings_account_yes_no', 10, 'single_select'::public.answer_type, true, 'Besitzen Sie ein Sparkonto?', NULL, NULL, NULL),
  ('60000000-0000-0000-0000-000000000056', '40000000-0000-0000-0000-000000000006', NULL, 'bank_savings_account_amount', 11, 'amount'::public.answer_type, true, 'Wie hoch ist der Betrag auf Ihrem Sparkonto?', NULL, NULL, '{"value":"Ja","question_key":"bank_savings_account_yes_no"}'::jsonb),
  ('60000000-0000-0000-0000-000000000057', '40000000-0000-0000-0000-000000000006', NULL, 'bank_savings_iban', 12, 'short_text'::public.answer_type, true, 'Was ist Ihre IBAN Nummer?', NULL, NULL, '{"value":"Ja","question_key":"bank_savings_account_yes_no"}'::jsonb),
  ('60000000-0000-0000-0000-000000000058', '40000000-0000-0000-0000-000000000006', NULL, 'bank_additional_account_yes_no', 13, 'single_select'::public.answer_type, true, 'Besitzen Sie ein weiteres Konto?', NULL, NULL, NULL),
  ('60000000-0000-0000-0000-000000000059', '40000000-0000-0000-0000-000000000006', '50000000-0000-0000-0000-000000000004', 'bank_additional_name', 14, 'short_text'::public.answer_type, true, 'Bei welcher Bank haben Sie ein weiteres Konto?', NULL, NULL, '{"value":"Ja","question_key":"bank_additional_account_yes_no"}'::jsonb),
  ('60000000-0000-0000-0000-00000000005a', '40000000-0000-0000-0000-000000000006', '50000000-0000-0000-0000-000000000004', 'bank_additional_iban', 15, 'short_text'::public.answer_type, true, 'Was ist die IBAN Nummer dieses Kontos?', NULL, NULL, '{"value":"Ja","question_key":"bank_additional_account_yes_no"}'::jsonb),
  ('60000000-0000-0000-0000-00000000005b', '40000000-0000-0000-0000-000000000006', '50000000-0000-0000-0000-000000000004', 'bank_additional_amount', 16, 'amount'::public.answer_type, true, 'Wie hoch ist der Betrag auf diesem Konto?', NULL, NULL, '{"value":"Ja","question_key":"bank_additional_account_yes_no"}'::jsonb),
  ('60000000-0000-0000-0000-00000000005c', '40000000-0000-0000-0000-000000000006', NULL, 'cash_savings', 17, 'amount'::public.answer_type, true, 'Wie viel Bargeld besitzen Sie?', NULL, NULL, NULL),
  ('60000000-0000-0000-0000-00000000005d', '40000000-0000-0000-0000-000000000006', NULL, 'automobile_owner', 18, 'single_select'::public.answer_type, true, 'Besitzen Sie ein Auto?', NULL, NULL, NULL),
  ('60000000-0000-0000-0000-00000000005e', '40000000-0000-0000-0000-000000000006', NULL, 'automobile_numbers_plate', 19, 'short_text'::public.answer_type, true, 'Was ist der Kennzeichen Ihres Autos?', NULL, NULL, '{"value":"Ja","question_key":"automobile_owner"}'::jsonb),
  ('60000000-0000-0000-0000-00000000005f', '40000000-0000-0000-0000-000000000006', NULL, 'automobile_type', 20, 'short_text'::public.answer_type, true, 'Was ist das Modell Ihres Autos?', NULL, NULL, '{"value":"Ja","question_key":"automobile_owner"}'::jsonb),
  ('60000000-0000-0000-0000-000000000060', '40000000-0000-0000-0000-000000000006', NULL, 'automobile_year', 21, 'short_text'::public.answer_type, true, 'Was ist das Baujahr Ihres Autos?', NULL, NULL, '{"value":"Ja","question_key":"automobile_owner"}'::jsonb),
  ('60000000-0000-0000-0000-000000000061', '40000000-0000-0000-0000-000000000006', NULL, 'automobile_holder', 22, 'short_text'::public.answer_type, true, 'Wer ist der Fahrzeughalter?', NULL, NULL, '{"value":"Ja","question_key":"automobile_owner"}'::jsonb),
  ('60000000-0000-0000-0000-000000000062', '40000000-0000-0000-0000-000000000006', NULL, 'property_yes_no', 23, 'single_select'::public.answer_type, true, 'Besitzen Sie ein Haus, Wohnung oder Land?', NULL, NULL, NULL),
  ('60000000-0000-0000-0000-000000000063', '40000000-0000-0000-0000-000000000006', NULL, 'property_address', 24, 'short_text'::public.answer_type, true, 'Adresse der Immobilie?', NULL, NULL, '{"not_value":"Nein","question_key":"property_yes_no"}'::jsonb),
  ('60000000-0000-0000-0000-000000000064', '40000000-0000-0000-0000-000000000006', NULL, 'property_usage', 25, 'short_text'::public.answer_type, true, 'Wie wird die Immobilie genutzt?', NULL, NULL, '{"not_value":"Nein","question_key":"property_yes_no"}'::jsonb),
  ('60000000-0000-0000-0000-000000000065', '40000000-0000-0000-0000-000000000006', NULL, 'property_size', 26, 'number'::public.answer_type, true, 'Größe der Immobilie in Quadratmeter?', NULL, NULL, '{"not_value":"Nein","question_key":"property_yes_no"}'::jsonb),
  ('60000000-0000-0000-0000-000000000066', '40000000-0000-0000-0000-000000000006', NULL, 'additional_wealth_yes_no', 27, 'single_select'::public.answer_type, true, 'Besitzen Sie weitere Vermögenswerte?', NULL, NULL, NULL),
  ('60000000-0000-0000-0000-000000000067', '40000000-0000-0000-0000-000000000006', NULL, 'additional_wealth_type', 28, 'short_text'::public.answer_type, true, 'Welche Vermögenswerte besitzen Sie?', NULL, NULL, '{"value":"Ja","question_key":"additional_wealth_yes_no"}'::jsonb),
  ('60000000-0000-0000-0000-000000000068', '40000000-0000-0000-0000-000000000006', NULL, 'additional_wealth_amount', 29, 'amount'::public.answer_type, true, 'Was ist der Wert Ihres Vermögenswertes?', NULL, NULL, '{"value":"Ja","question_key":"additional_wealth_yes_no"}'::jsonb)
ON CONFLICT (id) DO UPDATE SET
  category_id     = EXCLUDED.category_id,
  group_id        = EXCLUDED.group_id,
  sort_order      = EXCLUDED.sort_order,
  answer_type     = EXCLUDED.answer_type,
  is_required     = EXCLUDED.is_required,
  prompt_de       = EXCLUDED.prompt_de,
  help_de         = EXCLUDED.help_de,
  validation      = EXCLUDED.validation,
  visibility_rule = EXCLUDED.visibility_rule;

INSERT INTO public.question
  (id, category_id, group_id, key, sort_order, answer_type,
   is_required, prompt_de, help_de, validation, visibility_rule)
VALUES
  ('60000000-0000-0000-0000-000000000069', '40000000-0000-0000-0000-000000000007', NULL, 'costly_diet', 0, 'single_select'::public.answer_type, true, 'Ist eine kostenaufwendige Ernährung aus medizinischen Gründen erforderlich?', NULL, NULL, NULL),
  ('60000000-0000-0000-0000-00000000006a', '40000000-0000-0000-0000-000000000008', NULL, 'spouse_last_name', 0, 'short_text'::public.answer_type, true, 'Wie lautet der Nachname Ihres Ehepartners?', NULL, NULL, '{"in_values":["eheähnliche Gemeinschaft","eingetragene Lebenspartnerschaft","verheiratet","dauernd getrennt lebend"],"question_key":"marital_status"}'::jsonb),
  ('60000000-0000-0000-0000-00000000006b', '40000000-0000-0000-0000-000000000008', NULL, 'spouse_birth_name', 1, 'short_text'::public.answer_type, true, 'Wie lautet der Geburtsname Ihres Ehepartners?', NULL, NULL, '{"in_values":["eheähnliche Gemeinschaft","eingetragene Lebenspartnerschaft","verheiratet","dauernd getrennt lebend"],"question_key":"marital_status"}'::jsonb),
  ('60000000-0000-0000-0000-00000000006c', '40000000-0000-0000-0000-000000000008', NULL, 'spouse_first_name', 2, 'short_text'::public.answer_type, true, 'Wie lautet der Vorname Ihres Ehepartners?', NULL, NULL, '{"in_values":["eheähnliche Gemeinschaft","eingetragene Lebenspartnerschaft","verheiratet","dauernd getrennt lebend"],"question_key":"marital_status"}'::jsonb),
  ('60000000-0000-0000-0000-00000000006d', '40000000-0000-0000-0000-000000000008', NULL, 'spouse_birthdate', 3, 'date'::public.answer_type, true, 'Wann wurden Ihr Ehepartner geboren?', NULL, NULL, '{"in_values":["eheähnliche Gemeinschaft","eingetragene Lebenspartnerschaft","verheiratet","dauernd getrennt lebend"],"question_key":"marital_status"}'::jsonb),
  ('60000000-0000-0000-0000-00000000006e', '40000000-0000-0000-0000-000000000008', NULL, 'spouse_city_of_birth', 4, 'short_text'::public.answer_type, true, 'In welcher Stadt wurden Ihr Ehepartner geboren?', NULL, NULL, '{"in_values":["eheähnliche Gemeinschaft","eingetragene Lebenspartnerschaft","verheiratet","dauernd getrennt lebend"],"question_key":"marital_status"}'::jsonb),
  ('60000000-0000-0000-0000-00000000006f', '40000000-0000-0000-0000-000000000008', NULL, 'spouse_district_of_birth', 5, 'short_text'::public.answer_type, true, 'In welchem Kreis/Bezirk wurde Ihr Ehepartner geboren?', NULL, NULL, '{"in_values":["eheähnliche Gemeinschaft","eingetragene Lebenspartnerschaft","verheiratet","dauernd getrennt lebend"],"question_key":"marital_status"}'::jsonb),
  ('60000000-0000-0000-0000-000000000070', '40000000-0000-0000-0000-000000000008', NULL, 'spouse_country_of_birth', 6, 'short_text'::public.answer_type, true, 'In welchem Land wurden Ihr Ehepartner geboren?', NULL, NULL, '{"in_values":["eheähnliche Gemeinschaft","eingetragene Lebenspartnerschaft","verheiratet","dauernd getrennt lebend"],"question_key":"marital_status"}'::jsonb),
  ('60000000-0000-0000-0000-000000000071', '40000000-0000-0000-0000-000000000008', NULL, 'spouse_gender', 7, 'single_select'::public.answer_type, true, 'Was ist das Geschlecht Ihres Ehepartners?', NULL, NULL, '{"in_values":["eheähnliche Gemeinschaft","eingetragene Lebenspartnerschaft","verheiratet","dauernd getrennt lebend"],"question_key":"marital_status"}'::jsonb),
  ('60000000-0000-0000-0000-000000000072', '40000000-0000-0000-0000-000000000008', NULL, 'spouse_citizenship', 8, 'short_text'::public.answer_type, true, 'Was ist die Staatsangehörigkeit Ihres Ehepartners?', NULL, NULL, '{"in_values":["eheähnliche Gemeinschaft","eingetragene Lebenspartnerschaft","verheiratet","dauernd getrennt lebend"],"question_key":"marital_status"}'::jsonb),
  ('60000000-0000-0000-0000-000000000073', '40000000-0000-0000-0000-000000000008', NULL, 'spouse_issuer_of_id', 9, 'short_text'::public.answer_type, true, 'Welche Behörde hat das Personaldokument ausgestellt?', NULL, NULL, '{"in_values":["eheähnliche Gemeinschaft","eingetragene Lebenspartnerschaft","verheiratet","dauernd getrennt lebend"],"question_key":"marital_status"}'::jsonb),
  ('60000000-0000-0000-0000-000000000074', '40000000-0000-0000-0000-000000000008', NULL, 'spouse_id_expiry_date', 10, 'date'::public.answer_type, true, 'Bis wann ist das Personaldokument Ihres Partners gültig?', NULL, NULL, '{"in_values":["eheähnliche Gemeinschaft","eingetragene Lebenspartnerschaft","verheiratet","dauernd getrennt lebend"],"question_key":"marital_status"}'::jsonb),
  ('60000000-0000-0000-0000-000000000075', '40000000-0000-0000-0000-000000000008', NULL, 'spouse_prior_social_aid', 11, 'single_select'::public.answer_type, true, 'Hat Ihr Partner bereits Hilfe zur Pflege Leistungen erhalten?', NULL, NULL, '{"in_values":["eheähnliche Gemeinschaft","eingetragene Lebenspartnerschaft","verheiratet","dauernd getrennt lebend"],"question_key":"marital_status"}'::jsonb),
  ('60000000-0000-0000-0000-000000000076', '40000000-0000-0000-0000-000000000008', NULL, 'spouse_prior_social_aid_until', 12, 'date'::public.answer_type, true, 'Bis wann hat Ihr Partner Hilfe zur Pflege erhalten?', NULL, NULL, '{"value":"Ja","question_key":"spouse_prior_social_aid"}'::jsonb),
  ('60000000-0000-0000-0000-000000000077', '40000000-0000-0000-0000-000000000008', NULL, 'spouse_prior_social_aid_issuer', 13, 'short_text'::public.answer_type, true, 'Welche Behörde hat die Hilfe zur Pflege genehmigt?', NULL, NULL, '{"value":"Ja","question_key":"spouse_prior_social_aid"}'::jsonb),
  ('60000000-0000-0000-0000-000000000078', '40000000-0000-0000-0000-000000000008', NULL, 'spouse_prior_social_aid_reference_id', 14, 'short_text'::public.answer_type, true, 'Was ist das Geschäftszeichen der Genehmigung?', NULL, NULL, '{"value":"Ja","question_key":"spouse_prior_social_aid"}'::jsonb),
  ('60000000-0000-0000-0000-000000000079', '40000000-0000-0000-0000-000000000008', NULL, 'spouse_power_of_attorney', 15, 'single_select'::public.answer_type, true, 'Gibt es einen Betreuer oder Beistand?', NULL, NULL, '{"in_values":["eheähnliche Gemeinschaft","eingetragene Lebenspartnerschaft","verheiratet","dauernd getrennt lebend"],"question_key":"marital_status"}'::jsonb),
  ('60000000-0000-0000-0000-00000000007a', '40000000-0000-0000-0000-000000000008', NULL, 'spouse_special_origin_rights', 16, 'single_select'::public.answer_type, true, 'Liegt ein Sonderstatus vor?', NULL, NULL, '{"in_values":["eheähnliche Gemeinschaft","eingetragene Lebenspartnerschaft","verheiratet","dauernd getrennt lebend"],"question_key":"marital_status"}'::jsonb),
  ('60000000-0000-0000-0000-00000000007b', '40000000-0000-0000-0000-000000000008', NULL, 'spouse_special_origin_rights_issued', 17, 'date'::public.answer_type, true, 'Wann wurde der Sonderstatus ausgestellt?', NULL, NULL, '{"value":"Ja","question_key":"spouse_special_origin_rights"}'::jsonb),
  ('60000000-0000-0000-0000-00000000007c', '40000000-0000-0000-0000-000000000008', NULL, 'spouse_special_origin_rights_issued_by', 18, 'short_text'::public.answer_type, true, 'Welche Behörde hat den Sonderstatus ausgestellt?', NULL, NULL, '{"value":"Ja","question_key":"spouse_special_origin_rights"}'::jsonb),
  ('60000000-0000-0000-0000-00000000007d', '40000000-0000-0000-0000-000000000008', NULL, 'spouse_disability_card', 19, 'single_select'::public.answer_type, true, 'Liegt ein Schwerbehindertenausweis vor?', NULL, NULL, '{"in_values":["eheähnliche Gemeinschaft","eingetragene Lebenspartnerschaft","verheiratet","dauernd getrennt lebend"],"question_key":"marital_status"}'::jsonb),
  ('60000000-0000-0000-0000-00000000007e', '40000000-0000-0000-0000-000000000008', NULL, 'spouse_disability_card_application', 20, 'single_select'::public.answer_type, true, 'Wurde ein Antrag auf Schwerbehinderung gestellt?', NULL, NULL, '{"value":"Nein","question_key":"spouse_disability_card"}'::jsonb),
  ('60000000-0000-0000-0000-00000000007f', '40000000-0000-0000-0000-000000000008', NULL, 'spouse_disability_card_expiry', 21, 'date'::public.answer_type, true, 'Bis wann ist der Schwerbehindertenausweis gültig?', NULL, NULL, '{"value":"Ja","question_key":"spouse_disability_card"}'::jsonb),
  ('60000000-0000-0000-0000-000000000080', '40000000-0000-0000-0000-000000000008', NULL, 'spouse_disability_card_markers', 22, 'multi_select'::public.answer_type, true, 'Welche Merkzeichen hat der Schwerbehindertenausweis?', NULL, NULL, '{"value":"Ja","question_key":"spouse_disability_card"}'::jsonb),
  ('60000000-0000-0000-0000-000000000081', '40000000-0000-0000-0000-000000000008', NULL, 'spouse_health_insurance', 23, 'short_text'::public.answer_type, true, 'Bei welcher Krankenkasse ist Ihr Partner versichert?', NULL, NULL, '{"in_values":["eheähnliche Gemeinschaft","eingetragene Lebenspartnerschaft","verheiratet","dauernd getrennt lebend"],"question_key":"marital_status"}'::jsonb)
ON CONFLICT (id) DO UPDATE SET
  category_id     = EXCLUDED.category_id,
  group_id        = EXCLUDED.group_id,
  sort_order      = EXCLUDED.sort_order,
  answer_type     = EXCLUDED.answer_type,
  is_required     = EXCLUDED.is_required,
  prompt_de       = EXCLUDED.prompt_de,
  help_de         = EXCLUDED.help_de,
  validation      = EXCLUDED.validation,
  visibility_rule = EXCLUDED.visibility_rule;

INSERT INTO public.question
  (id, category_id, group_id, key, sort_order, answer_type,
   is_required, prompt_de, help_de, validation, visibility_rule)
VALUES
  ('60000000-0000-0000-0000-000000000082', '40000000-0000-0000-0000-000000000008', NULL, 'spouse_health_insurance_type', 24, 'single_select'::public.answer_type, true, 'Wie ist Ihr Partner krankenversichert?', NULL, NULL, '{"in_values":["eheähnliche Gemeinschaft","eingetragene Lebenspartnerschaft","verheiratet","dauernd getrennt lebend"],"question_key":"marital_status"}'::jsonb),
  ('60000000-0000-0000-0000-000000000083', '40000000-0000-0000-0000-000000000008', NULL, 'spouse_care_level', 25, 'single_select'::public.answer_type, true, 'Was ist ihre/seine Pflegestufe?', NULL, NULL, '{"in_values":["eheähnliche Gemeinschaft","eingetragene Lebenspartnerschaft","verheiratet","dauernd getrennt lebend"],"question_key":"marital_status"}'::jsonb),
  ('60000000-0000-0000-0000-000000000084', '40000000-0000-0000-0000-000000000008', NULL, 'spouse_in_facility_yes_no', 26, 'single_select'::public.answer_type, true, 'Wohnt Ihr Partner in stationären Pflegeeinrichtung?', NULL, NULL, '{"in_values":["eheähnliche Gemeinschaft","eingetragene Lebenspartnerschaft","verheiratet","dauernd getrennt lebend"],"question_key":"marital_status"}'::jsonb),
  ('60000000-0000-0000-0000-000000000085', '40000000-0000-0000-0000-000000000008', NULL, 'spouse_in_facility_since', 27, 'date'::public.answer_type, true, 'Wann fand/findet der Einzug in die Pflegeeinrichtung statt?', NULL, NULL, '{"value":"Ja","question_key":"spouse_in_facility_yes_no"}'::jsonb),
  ('60000000-0000-0000-0000-000000000086', '40000000-0000-0000-0000-000000000008', NULL, 'spouse_prior_social_service_applications', 28, 'single_select'::public.answer_type, true, 'Hat Ihr Partner weitere Sozialleistungen beantragt?', NULL, NULL, '{"in_values":["eheähnliche Gemeinschaft","eingetragene Lebenspartnerschaft","verheiratet","dauernd getrennt lebend"],"question_key":"marital_status"}'::jsonb),
  ('60000000-0000-0000-0000-000000000087', '40000000-0000-0000-0000-000000000008', '50000000-0000-0000-0000-000000000005', 'spouse_pension_type', 29, 'single_select'::public.answer_type, true, 'Welche Rente/Pension bezieht Ihr Partner?', NULL, NULL, '{"in_values":["eheähnliche Gemeinschaft","eingetragene Lebenspartnerschaft","verheiratet","dauernd getrennt lebend"],"question_key":"marital_status"}'::jsonb),
  ('60000000-0000-0000-0000-000000000088', '40000000-0000-0000-0000-000000000008', '50000000-0000-0000-0000-000000000005', 'spouse_pension_amount', 30, 'amount'::public.answer_type, true, 'Wie hoch ist die monatliche Rente/Pension?', NULL, NULL, '{"not_empty":true,"question_key":"spouse_pension_type"}'::jsonb),
  ('60000000-0000-0000-0000-000000000089', '40000000-0000-0000-0000-000000000008', '50000000-0000-0000-0000-000000000005', 'spouse_pension_id', 31, 'short_text'::public.answer_type, true, 'Was ist die Abrechnungsnummer der Rente/Pension?', NULL, NULL, '{"not_empty":true,"question_key":"spouse_pension_type"}'::jsonb),
  ('60000000-0000-0000-0000-00000000008a', '40000000-0000-0000-0000-000000000008', '50000000-0000-0000-0000-000000000005', 'spouse_pension_issuer', 32, 'short_text'::public.answer_type, true, 'Wer bezahlt die Rente/Pension?', NULL, NULL, '{"not_empty":true,"question_key":"spouse_pension_type"}'::jsonb),
  ('60000000-0000-0000-0000-00000000008b', '40000000-0000-0000-0000-000000000008', NULL, 'spouse_wohngeld_yes_no', 33, 'single_select'::public.answer_type, true, 'Bezieht Ihr Partner Wohngeld?', NULL, NULL, '{"in_values":["eheähnliche Gemeinschaft","eingetragene Lebenspartnerschaft","verheiratet","dauernd getrennt lebend"],"question_key":"marital_status"}'::jsonb),
  ('60000000-0000-0000-0000-00000000008c', '40000000-0000-0000-0000-000000000008', NULL, 'spouse_wohngeld_amount', 34, 'amount'::public.answer_type, true, 'Wie viel Wohngeld bezieht er/sie?', NULL, NULL, '{"value":"Ja","question_key":"spouse_wohngeld_yes_no"}'::jsonb),
  ('60000000-0000-0000-0000-00000000008d', '40000000-0000-0000-0000-000000000008', NULL, 'spouse_wohngeld_id', 35, 'short_text'::public.answer_type, true, 'Was ist die Abrechnungsnummer des Wohngeld?', NULL, NULL, '{"value":"Ja","question_key":"spouse_wohngeld_yes_no"}'::jsonb),
  ('60000000-0000-0000-0000-00000000008e', '40000000-0000-0000-0000-000000000008', NULL, 'spouse_other_income', 36, 'single_select'::public.answer_type, true, 'Beziehen Ihr Partner anderes Einkommen?', NULL, NULL, '{"in_values":["eheähnliche Gemeinschaft","eingetragene Lebenspartnerschaft","verheiratet","dauernd getrennt lebend"],"question_key":"marital_status"}'::jsonb),
  ('60000000-0000-0000-0000-00000000008f', '40000000-0000-0000-0000-000000000008', '50000000-0000-0000-0000-000000000006', 'spouse_other_income_type', 37, 'short_text'::public.answer_type, true, 'Welche Art von Einkommen bezieht er/sie?', NULL, NULL, '{"value":"Ja","question_key":"spouse_other_income"}'::jsonb),
  ('60000000-0000-0000-0000-000000000090', '40000000-0000-0000-0000-000000000008', '50000000-0000-0000-0000-000000000006', 'spouse_other_income_amount', 38, 'amount'::public.answer_type, true, 'Wie hoch ist das weitere Einkommen monatlich?', NULL, NULL, '{"value":"Ja","question_key":"spouse_other_income"}'::jsonb),
  ('60000000-0000-0000-0000-000000000091', '40000000-0000-0000-0000-000000000008', NULL, 'spouse_health_insurance_amount', 39, 'amount'::public.answer_type, true, 'Wie hoch sind die monatlichen Ausgaben für Ihre Krankenversicherung?', NULL, NULL, NULL),
  ('60000000-0000-0000-0000-000000000092', '40000000-0000-0000-0000-000000000008', NULL, 'spouse_care_insurance_amount', 40, 'amount'::public.answer_type, true, 'Wo hoch sind die monatlichen Ausgaben für Ihre Pflegeversicherung?', NULL, NULL, NULL),
  ('60000000-0000-0000-0000-000000000093', '40000000-0000-0000-0000-000000000008', NULL, 'spouse_general_liablity_insurance_yes_no', 41, 'single_select'::public.answer_type, true, 'Hat Ihr Partner eine Haftpflichtversicherung?', NULL, NULL, '{"in_values":["eheähnliche Gemeinschaft","eingetragene Lebenspartnerschaft","verheiratet","dauernd getrennt lebend"],"question_key":"marital_status"}'::jsonb),
  ('60000000-0000-0000-0000-000000000094', '40000000-0000-0000-0000-000000000008', NULL, 'spouse_general_liablity_insurance_provider', 42, 'short_text'::public.answer_type, true, 'Wer ist Träger Ihrer Haftpflichtversicherung?', NULL, NULL, '{"value":"Ja","question_key":"spouse_general_liablity_insurance_yes_no"}'::jsonb),
  ('60000000-0000-0000-0000-000000000095', '40000000-0000-0000-0000-000000000008', NULL, 'spouse_general_liability_amount', 43, 'amount'::public.answer_type, true, 'Wo hoch ist der monatliche Betrag Ihrer Haftpflichtversicherung?', NULL, NULL, '{"value":"Ja","question_key":"spouse_general_liablity_insurance_yes_no"}'::jsonb),
  ('60000000-0000-0000-0000-000000000096', '40000000-0000-0000-0000-000000000008', NULL, 'spouse_life_insurance', 44, 'single_select'::public.answer_type, true, 'Hat Ihr Partner eine Lebens- oder Sterbeversicherung?', NULL, NULL, '{"in_values":["eheähnliche Gemeinschaft","eingetragene Lebenspartnerschaft","verheiratet","dauernd getrennt lebend"],"question_key":"marital_status"}'::jsonb),
  ('60000000-0000-0000-0000-000000000097', '40000000-0000-0000-0000-000000000008', NULL, 'spouse_life_insurance_amount', 45, 'amount'::public.answer_type, true, 'Wie hoch ist der monatliche Beitrag ihrer/seiner Lebens- oder Sterbeversicherung?', NULL, NULL, '{"value":"Ja","question_key":"spouse_life_insurance"}'::jsonb),
  ('60000000-0000-0000-0000-000000000098', '40000000-0000-0000-0000-000000000008', NULL, 'spouse_bank_savings_account_amount', 46, 'amount'::public.answer_type, true, 'Wie hoch ist der Betrag auf seinem/ihrem Sparkonto?', NULL, NULL, '{"in_values":["eheähnliche Gemeinschaft","eingetragene Lebenspartnerschaft","verheiratet","dauernd getrennt lebend"],"question_key":"marital_status"}'::jsonb),
  ('60000000-0000-0000-0000-000000000099', '40000000-0000-0000-0000-000000000008', NULL, 'spouse_bank_account_amount', 47, 'amount'::public.answer_type, true, 'Wie hoch ist der Betrag auf ihrem/seinen Girokonto?', NULL, NULL, '{"in_values":["eheähnliche Gemeinschaft","eingetragene Lebenspartnerschaft","verheiratet","dauernd getrennt lebend"],"question_key":"marital_status"}'::jsonb),
  ('60000000-0000-0000-0000-00000000009a', '40000000-0000-0000-0000-000000000008', NULL, 'spouse_automobile_owner', 48, 'single_select'::public.answer_type, true, 'Besitzen Ihr Partner ein Auto?', NULL, NULL, '{"in_values":["eheähnliche Gemeinschaft","eingetragene Lebenspartnerschaft","verheiratet","dauernd getrennt lebend"],"question_key":"marital_status"}'::jsonb)
ON CONFLICT (id) DO UPDATE SET
  category_id     = EXCLUDED.category_id,
  group_id        = EXCLUDED.group_id,
  sort_order      = EXCLUDED.sort_order,
  answer_type     = EXCLUDED.answer_type,
  is_required     = EXCLUDED.is_required,
  prompt_de       = EXCLUDED.prompt_de,
  help_de         = EXCLUDED.help_de,
  validation      = EXCLUDED.validation,
  visibility_rule = EXCLUDED.visibility_rule;

INSERT INTO public.question
  (id, category_id, group_id, key, sort_order, answer_type,
   is_required, prompt_de, help_de, validation, visibility_rule)
VALUES
  ('60000000-0000-0000-0000-00000000009b', '40000000-0000-0000-0000-000000000008', NULL, 'spouse_automobile_numbers_plate', 49, 'short_text'::public.answer_type, true, 'Was ist der Kennzeichen des Autos?', NULL, NULL, '{"value":"Ja","question_key":"spouse_automobile_owner"}'::jsonb),
  ('60000000-0000-0000-0000-00000000009c', '40000000-0000-0000-0000-000000000008', NULL, 'spouse_automobile_type', 50, 'short_text'::public.answer_type, true, 'Was ist das Modell des Autos?', NULL, NULL, '{"value":"Ja","question_key":"spouse_automobile_owner"}'::jsonb),
  ('60000000-0000-0000-0000-00000000009d', '40000000-0000-0000-0000-000000000008', NULL, 'spouse_automobile_year', 51, 'short_text'::public.answer_type, true, 'Was ist das Baujahr des Autos?', NULL, NULL, '{"value":"Ja","question_key":"spouse_automobile_owner"}'::jsonb),
  ('60000000-0000-0000-0000-00000000009e', '40000000-0000-0000-0000-000000000008', NULL, 'spouse_automobile_holder', 52, 'short_text'::public.answer_type, true, 'Wer ist der Fahrzeughalter?', NULL, NULL, '{"value":"Ja","question_key":"spouse_automobile_owner"}'::jsonb),
  ('60000000-0000-0000-0000-00000000009f', '40000000-0000-0000-0000-000000000008', NULL, 'spouse_property_yes_no', 53, 'single_select'::public.answer_type, true, 'Besitzen Ihr Partner ein Haus, Wohnung oder Land?', NULL, NULL, '{"in_values":["eheähnliche Gemeinschaft","eingetragene Lebenspartnerschaft","verheiratet","dauernd getrennt lebend"],"question_key":"marital_status"}'::jsonb),
  ('60000000-0000-0000-0000-0000000000a0', '40000000-0000-0000-0000-000000000008', NULL, 'spouse_additional_wealth_yes_no', 54, 'single_select'::public.answer_type, true, 'Besitzen Ihr Partner weitere Vermögenswerte?', NULL, NULL, '{"in_values":["eheähnliche Gemeinschaft","eingetragene Lebenspartnerschaft","verheiratet","dauernd getrennt lebend"],"question_key":"marital_status"}'::jsonb),
  ('60000000-0000-0000-0000-0000000000a1', '40000000-0000-0000-0000-000000000008', NULL, 'spouse_additional_wealth_type', 55, 'short_text'::public.answer_type, true, 'Welche Vermögenswerte besitzt Ihr Partner?', NULL, NULL, '{"value":"Ja","question_key":"spouse_additional_wealth_yes_no"}'::jsonb),
  ('60000000-0000-0000-0000-0000000000a2', '40000000-0000-0000-0000-000000000008', NULL, 'spouse_additional_wealth_amount', 56, 'amount'::public.answer_type, true, 'Was ist der Wert Ihres Vermögensgegenstandes?', NULL, NULL, '{"value":"Ja","question_key":"spouse_additional_wealth_yes_no"}'::jsonb)
ON CONFLICT (id) DO UPDATE SET
  category_id     = EXCLUDED.category_id,
  group_id        = EXCLUDED.group_id,
  sort_order      = EXCLUDED.sort_order,
  answer_type     = EXCLUDED.answer_type,
  is_required     = EXCLUDED.is_required,
  prompt_de       = EXCLUDED.prompt_de,
  help_de         = EXCLUDED.help_de,
  validation      = EXCLUDED.validation,
  visibility_rule = EXCLUDED.visibility_rule;

-- ─── 6. Question options (157 total) ────────────────────────
INSERT INTO public.question_option (id, question_id, key, sort_order, label_de, value)
VALUES
  ('70000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000003', 'ledig', 0, 'Ledig', 'ledig'),
  ('70000000-0000-0000-0000-000000000002', '60000000-0000-0000-0000-000000000003', 'verheiratet', 1, 'Verheiratet', 'verheiratet'),
  ('70000000-0000-0000-0000-000000000003', '60000000-0000-0000-0000-000000000003', 'verwitwet', 2, 'Verwitwet', 'verwitwet'),
  ('70000000-0000-0000-0000-000000000004', '60000000-0000-0000-0000-000000000003', 'geschieden', 3, 'Geschieden', 'geschieden'),
  ('70000000-0000-0000-0009-000000000000', '60000000-0000-0000-0000-000000000009', 'm_nnlich', 0, 'männlich', 'männlich'),
  ('70000000-0000-0000-0009-000000000001', '60000000-0000-0000-0000-000000000009', 'weiblich', 1, 'weiblich', 'weiblich'),
  ('70000000-0000-0000-000a-000000000000', '60000000-0000-0000-0000-00000000000a', 'ledig', 0, 'ledig', 'ledig'),
  ('70000000-0000-0000-000a-000000000001', '60000000-0000-0000-0000-00000000000a', 'ehe_hnliche_gemeinschaft', 1, 'eheähnliche Gemeinschaft', 'eheähnliche Gemeinschaft'),
  ('70000000-0000-0000-000a-000000000002', '60000000-0000-0000-0000-00000000000a', 'eingetragene_lebenspartnerschaft', 2, 'eingetragene Lebenspartnerschaft', 'eingetragene Lebenspartnerschaft'),
  ('70000000-0000-0000-000a-000000000003', '60000000-0000-0000-0000-00000000000a', 'verheiratet', 3, 'verheiratet', 'verheiratet'),
  ('70000000-0000-0000-000a-000000000004', '60000000-0000-0000-0000-00000000000a', 'dauernd_getrennt_lebend', 4, 'dauernd getrennt lebend', 'dauernd getrennt lebend'),
  ('70000000-0000-0000-000a-000000000005', '60000000-0000-0000-0000-00000000000a', 'geschieden', 5, 'geschieden', 'geschieden'),
  ('70000000-0000-0000-000a-000000000006', '60000000-0000-0000-0000-00000000000a', 'verwitwet', 6, 'verwitwet', 'verwitwet'),
  ('70000000-0000-0000-000f-000000000000', '60000000-0000-0000-0000-00000000000f', 'ja', 0, 'Ja', 'Ja'),
  ('70000000-0000-0000-000f-000000000001', '60000000-0000-0000-0000-00000000000f', 'nein', 1, 'Nein', 'Nein'),
  ('70000000-0000-0000-0013-000000000000', '60000000-0000-0000-0000-000000000013', 'betreuung', 0, 'Betreuung', 'Betreuung'),
  ('70000000-0000-0000-0013-000000000001', '60000000-0000-0000-0000-000000000013', 'beistandschaft', 1, 'Beistandschaft', 'Beistandschaft'),
  ('70000000-0000-0000-0014-000000000000', '60000000-0000-0000-0000-000000000014', 'nein', 0, 'Nein', 'Nein'),
  ('70000000-0000-0000-0014-000000000001', '60000000-0000-0000-0000-000000000014', 'heimatvertrieben_ausweis_a', 1, 'Heimatvertrieben Ausweis A', 'Heimatvertrieben Ausweis A'),
  ('70000000-0000-0000-0014-000000000002', '60000000-0000-0000-0000-000000000014', 'aussiedler_ausweis_b', 2, 'Aussiedler Ausweis B', 'Aussiedler Ausweis B'),
  ('70000000-0000-0000-0014-000000000003', '60000000-0000-0000-0000-000000000014', 'sp_taussiedler', 3, 'Spätaussiedler', 'Spätaussiedler'),
  ('70000000-0000-0000-0014-000000000004', '60000000-0000-0000-0000-000000000014', 'ehegatte_oder_kind_eines_sp_taussiedlers', 4, 'Ehegatte oder Kind eines Spätaussiedlers', 'Ehegatte oder Kind eines Spätaussiedlers'),
  ('70000000-0000-0000-0014-000000000005', '60000000-0000-0000-0000-000000000014', 'sowjetzonenfl_chtlich_ausweis_c', 5, 'Sowjetzonenflüchtlich Ausweis C', 'Sowjetzonenflüchtlich Ausweis C'),
  ('70000000-0000-0000-0017-000000000000', '60000000-0000-0000-0000-000000000017', 'ja', 0, 'Ja', 'Ja'),
  ('70000000-0000-0000-0017-000000000001', '60000000-0000-0000-0000-000000000017', 'nein', 1, 'Nein', 'Nein'),
  ('70000000-0000-0000-0018-000000000000', '60000000-0000-0000-0000-000000000018', 'ja', 0, 'Ja', 'Ja'),
  ('70000000-0000-0000-0018-000000000001', '60000000-0000-0000-0000-000000000018', 'nein', 1, 'Nein', 'Nein'),
  ('70000000-0000-0000-001a-000000000000', '60000000-0000-0000-0000-00000000001a', 'g', 0, 'G', 'G'),
  ('70000000-0000-0000-001a-000000000001', '60000000-0000-0000-0000-00000000001a', 'ag', 1, 'aG', 'aG'),
  ('70000000-0000-0000-001a-000000000002', '60000000-0000-0000-0000-00000000001a', 'rf', 2, 'RF', 'RF')
ON CONFLICT (question_id, key) DO UPDATE SET
  sort_order = EXCLUDED.sort_order,
  label_de   = EXCLUDED.label_de,
  value      = EXCLUDED.value;

INSERT INTO public.question_option (id, question_id, key, sort_order, label_de, value)
VALUES
  ('70000000-0000-0000-001c-000000000000', '60000000-0000-0000-0000-00000000001c', 'pflichtversicherung', 0, 'Pflichtversicherung', 'Pflichtversicherung'),
  ('70000000-0000-0000-001c-000000000001', '60000000-0000-0000-0000-00000000001c', 'freiwillige_versicherung', 1, 'Freiwillige Versicherung', 'Freiwillige Versicherung'),
  ('70000000-0000-0000-001c-000000000002', '60000000-0000-0000-0000-00000000001c', 'private_versicherung', 2, 'Private Versicherung', 'Private Versicherung'),
  ('70000000-0000-0000-001c-000000000003', '60000000-0000-0000-0000-00000000001c', 'familienversichert', 3, 'Familienversichert', 'Familienversichert'),
  ('70000000-0000-0000-001c-000000000004', '60000000-0000-0000-0000-00000000001c', 'betreuung_der_krankenkasse', 4, 'Betreuung der Krankenkasse', 'Betreuung der Krankenkasse'),
  ('70000000-0000-0000-001d-000000000000', '60000000-0000-0000-0000-00000000001d', 'nicht_vorhanden', 0, 'Nicht vorhanden', 'Nicht vorhanden'),
  ('70000000-0000-0000-001d-000000000001', '60000000-0000-0000-0000-00000000001d', '1', 1, '1', '1'),
  ('70000000-0000-0000-001d-000000000002', '60000000-0000-0000-0000-00000000001d', '2', 2, '2', '2'),
  ('70000000-0000-0000-001d-000000000003', '60000000-0000-0000-0000-00000000001d', '3', 3, '3', '3'),
  ('70000000-0000-0000-001d-000000000004', '60000000-0000-0000-0000-00000000001d', '4', 4, '4', '4'),
  ('70000000-0000-0000-001d-000000000005', '60000000-0000-0000-0000-00000000001d', '5', 5, '5', '5'),
  ('70000000-0000-0000-001f-000000000000', '60000000-0000-0000-0000-00000000001f', 'ja', 0, 'Ja', 'Ja'),
  ('70000000-0000-0000-001f-000000000001', '60000000-0000-0000-0000-00000000001f', 'nein', 1, 'Nein', 'Nein'),
  ('70000000-0000-0000-0028-000000000000', '60000000-0000-0000-0000-000000000028', 'eigenheim', 0, 'Eigenheim', 'Eigenheim'),
  ('70000000-0000-0000-0028-000000000001', '60000000-0000-0000-0000-000000000028', 'eigentumswohnung', 1, 'Eigentumswohnung', 'Eigentumswohnung'),
  ('70000000-0000-0000-0028-000000000002', '60000000-0000-0000-0000-000000000028', 'mietwohnung', 2, 'Mietwohnung', 'Mietwohnung'),
  ('70000000-0000-0000-002f-000000000000', '60000000-0000-0000-0000-00000000002f', 'ja', 0, 'Ja', 'Ja'),
  ('70000000-0000-0000-002f-000000000001', '60000000-0000-0000-0000-00000000002f', 'nein', 1, 'Nein', 'Nein'),
  ('70000000-0000-0000-0035-000000000000', '60000000-0000-0000-0000-000000000035', 'ledig', 0, 'ledig', 'ledig'),
  ('70000000-0000-0000-0035-000000000001', '60000000-0000-0000-0000-000000000035', 'ehe_hnliche_gemeinschaft', 1, 'eheähnliche Gemeinschaft', 'eheähnliche Gemeinschaft'),
  ('70000000-0000-0000-0035-000000000002', '60000000-0000-0000-0000-000000000035', 'eingetragene_lebenspartnerschaft', 2, 'eingetragene Lebenspartnerschaft', 'eingetragene Lebenspartnerschaft'),
  ('70000000-0000-0000-0035-000000000003', '60000000-0000-0000-0000-000000000035', 'verheiratet', 3, 'verheiratet', 'verheiratet'),
  ('70000000-0000-0000-0035-000000000004', '60000000-0000-0000-0000-000000000035', 'dauernd_getrennt_lebend', 4, 'dauernd getrennt lebend', 'dauernd getrennt lebend'),
  ('70000000-0000-0000-0035-000000000005', '60000000-0000-0000-0000-000000000035', 'geschieden', 5, 'geschieden', 'geschieden'),
  ('70000000-0000-0000-0035-000000000006', '60000000-0000-0000-0000-000000000035', 'verwitwet', 6, 'verwitwet', 'verwitwet'),
  ('70000000-0000-0000-0036-000000000000', '60000000-0000-0000-0000-000000000036', 'sohn', 0, 'Sohn', 'Sohn'),
  ('70000000-0000-0000-0036-000000000001', '60000000-0000-0000-0000-000000000036', 'tochter', 1, 'Tochter', 'Tochter'),
  ('70000000-0000-0000-0036-000000000002', '60000000-0000-0000-0000-000000000036', 'stiefsohn', 2, 'Stiefsohn', 'Stiefsohn'),
  ('70000000-0000-0000-0036-000000000003', '60000000-0000-0000-0000-000000000036', 'stieftochter', 3, 'Stieftochter', 'Stieftochter'),
  ('70000000-0000-0000-0036-000000000004', '60000000-0000-0000-0000-000000000036', 'adoptivsohn', 4, 'Adoptivsohn', 'Adoptivsohn')
ON CONFLICT (question_id, key) DO UPDATE SET
  sort_order = EXCLUDED.sort_order,
  label_de   = EXCLUDED.label_de,
  value      = EXCLUDED.value;

INSERT INTO public.question_option (id, question_id, key, sort_order, label_de, value)
VALUES
  ('70000000-0000-0000-0036-000000000005', '60000000-0000-0000-0000-000000000036', 'adoptivtochter', 5, 'Adoptivtochter', 'Adoptivtochter'),
  ('70000000-0000-0000-0039-000000000000', '60000000-0000-0000-0000-000000000039', 'erwerbsminderungsrente', 0, 'Erwerbsminderungsrente', 'Erwerbsminderungsrente'),
  ('70000000-0000-0000-0039-000000000001', '60000000-0000-0000-0000-000000000039', 'unfallrente', 1, 'Unfallrente', 'Unfallrente'),
  ('70000000-0000-0000-0039-000000000002', '60000000-0000-0000-0000-000000000039', 'altersrente', 2, 'Altersrente', 'Altersrente'),
  ('70000000-0000-0000-0039-000000000003', '60000000-0000-0000-0000-000000000039', 'eu_rente', 3, 'EU Rente', 'EU Rente'),
  ('70000000-0000-0000-0039-000000000004', '60000000-0000-0000-0000-000000000039', 'witwen_rente', 4, 'Witwen Rente', 'Witwen Rente'),
  ('70000000-0000-0000-0039-000000000005', '60000000-0000-0000-0000-000000000039', 'waisen_rente', 5, 'Waisen Rente', 'Waisen Rente'),
  ('70000000-0000-0000-0039-000000000006', '60000000-0000-0000-0000-000000000039', 'werksrente', 6, 'Werksrente', 'Werksrente'),
  ('70000000-0000-0000-0039-000000000007', '60000000-0000-0000-0000-000000000039', 'sonstige_rente_pension', 7, 'Sonstige Rente/Pension', 'Sonstige Rente/Pension'),
  ('70000000-0000-0000-003d-000000000000', '60000000-0000-0000-0000-00000000003d', 'ja', 0, 'Ja', 'Ja'),
  ('70000000-0000-0000-003d-000000000001', '60000000-0000-0000-0000-00000000003d', 'nein', 1, 'Nein', 'Nein'),
  ('70000000-0000-0000-0040-000000000000', '60000000-0000-0000-0000-000000000040', 'ja', 0, 'Ja', 'Ja'),
  ('70000000-0000-0000-0040-000000000001', '60000000-0000-0000-0000-000000000040', 'nein', 1, 'Nein', 'Nein'),
  ('70000000-0000-0000-0043-000000000000', '60000000-0000-0000-0000-000000000043', 'ja', 0, 'Ja', 'Ja'),
  ('70000000-0000-0000-0043-000000000001', '60000000-0000-0000-0000-000000000043', 'nein', 1, 'Nein', 'Nein'),
  ('70000000-0000-0000-0046-000000000000', '60000000-0000-0000-0000-000000000046', 'ja', 0, 'Ja', 'Ja'),
  ('70000000-0000-0000-0046-000000000001', '60000000-0000-0000-0000-000000000046', 'nein', 1, 'Nein', 'Nein'),
  ('70000000-0000-0000-0049-000000000000', '60000000-0000-0000-0000-000000000049', 'nein', 0, 'Nein', 'Nein'),
  ('70000000-0000-0000-0049-000000000001', '60000000-0000-0000-0000-000000000049', 'lebensversicherung', 1, 'Lebensversicherung', 'Lebensversicherung'),
  ('70000000-0000-0000-0049-000000000002', '60000000-0000-0000-0000-000000000049', 'sterbeversicherung', 2, 'Sterbeversicherung', 'Sterbeversicherung'),
  ('70000000-0000-0000-004e-000000000000', '60000000-0000-0000-0000-00000000004e', 'ja', 0, 'Ja', 'Ja'),
  ('70000000-0000-0000-004e-000000000001', '60000000-0000-0000-0000-00000000004e', 'nein', 1, 'Nein', 'Nein'),
  ('70000000-0000-0000-0050-000000000000', '60000000-0000-0000-0000-000000000050', 'unwiderruflich_abgetreten', 0, 'Unwiderruflich abgetreten', 'Unwiderruflich abgetreten'),
  ('70000000-0000-0000-0050-000000000001', '60000000-0000-0000-0000-000000000050', 'sperrkonto', 1, 'Sperrkonto', 'Sperrkonto'),
  ('70000000-0000-0000-0055-000000000000', '60000000-0000-0000-0000-000000000055', 'ja', 0, 'Ja', 'Ja'),
  ('70000000-0000-0000-0055-000000000001', '60000000-0000-0000-0000-000000000055', 'nein', 1, 'Nein', 'Nein'),
  ('70000000-0000-0000-0058-000000000000', '60000000-0000-0000-0000-000000000058', 'ja', 0, 'Ja', 'Ja'),
  ('70000000-0000-0000-0058-000000000001', '60000000-0000-0000-0000-000000000058', 'nein', 1, 'Nein', 'Nein'),
  ('70000000-0000-0000-005d-000000000000', '60000000-0000-0000-0000-00000000005d', 'ja', 0, 'Ja', 'Ja'),
  ('70000000-0000-0000-005d-000000000001', '60000000-0000-0000-0000-00000000005d', 'nein', 1, 'Nein', 'Nein')
ON CONFLICT (question_id, key) DO UPDATE SET
  sort_order = EXCLUDED.sort_order,
  label_de   = EXCLUDED.label_de,
  value      = EXCLUDED.value;

INSERT INTO public.question_option (id, question_id, key, sort_order, label_de, value)
VALUES
  ('70000000-0000-0000-0062-000000000000', '60000000-0000-0000-0000-000000000062', 'nein', 0, 'Nein', 'Nein'),
  ('70000000-0000-0000-0062-000000000001', '60000000-0000-0000-0000-000000000062', 'haus', 1, 'Haus', 'Haus'),
  ('70000000-0000-0000-0062-000000000002', '60000000-0000-0000-0000-000000000062', 'eigentumswohnung', 2, 'Eigentumswohnung', 'Eigentumswohnung'),
  ('70000000-0000-0000-0062-000000000003', '60000000-0000-0000-0000-000000000062', 'grundbesitz', 3, 'Grundbesitz', 'Grundbesitz'),
  ('70000000-0000-0000-0066-000000000000', '60000000-0000-0000-0000-000000000066', 'ja', 0, 'Ja', 'Ja'),
  ('70000000-0000-0000-0066-000000000001', '60000000-0000-0000-0000-000000000066', 'nein', 1, 'Nein', 'Nein'),
  ('70000000-0000-0000-0069-000000000000', '60000000-0000-0000-0000-000000000069', 'ja', 0, 'Ja', 'Ja'),
  ('70000000-0000-0000-0069-000000000001', '60000000-0000-0000-0000-000000000069', 'nein', 1, 'Nein', 'Nein'),
  ('70000000-0000-0000-0071-000000000000', '60000000-0000-0000-0000-000000000071', 'm_nnlich', 0, 'männlich', 'männlich'),
  ('70000000-0000-0000-0071-000000000001', '60000000-0000-0000-0000-000000000071', 'weiblich', 1, 'weiblich', 'weiblich'),
  ('70000000-0000-0000-0075-000000000000', '60000000-0000-0000-0000-000000000075', 'ja', 0, 'Ja', 'Ja'),
  ('70000000-0000-0000-0075-000000000001', '60000000-0000-0000-0000-000000000075', 'nein', 1, 'Nein', 'Nein'),
  ('70000000-0000-0000-0079-000000000000', '60000000-0000-0000-0000-000000000079', 'betreuung', 0, 'Betreuung', 'Betreuung'),
  ('70000000-0000-0000-0079-000000000001', '60000000-0000-0000-0000-000000000079', 'beistandschaft', 1, 'Beistandschaft', 'Beistandschaft'),
  ('70000000-0000-0000-007a-000000000000', '60000000-0000-0000-0000-00000000007a', 'nein', 0, 'Nein', 'Nein'),
  ('70000000-0000-0000-007a-000000000001', '60000000-0000-0000-0000-00000000007a', 'heimatvertrieben_ausweis_a', 1, 'Heimatvertrieben Ausweis A', 'Heimatvertrieben Ausweis A'),
  ('70000000-0000-0000-007a-000000000002', '60000000-0000-0000-0000-00000000007a', 'aussiedler_ausweis_b', 2, 'Aussiedler Ausweis B', 'Aussiedler Ausweis B'),
  ('70000000-0000-0000-007a-000000000003', '60000000-0000-0000-0000-00000000007a', 'sp_taussiedler', 3, 'Spätaussiedler', 'Spätaussiedler'),
  ('70000000-0000-0000-007a-000000000004', '60000000-0000-0000-0000-00000000007a', 'ehegatte_oder_kind_eines_sp_taussiedlers', 4, 'Ehegatte oder Kind eines Spätaussiedlers', 'Ehegatte oder Kind eines Spätaussiedlers'),
  ('70000000-0000-0000-007a-000000000005', '60000000-0000-0000-0000-00000000007a', 'sowjetzonenfl_chtlich_ausweis_c', 5, 'Sowjetzonenflüchtlich Ausweis C', 'Sowjetzonenflüchtlich Ausweis C'),
  ('70000000-0000-0000-007d-000000000000', '60000000-0000-0000-0000-00000000007d', 'ja', 0, 'Ja', 'Ja'),
  ('70000000-0000-0000-007d-000000000001', '60000000-0000-0000-0000-00000000007d', 'nein', 1, 'Nein', 'Nein'),
  ('70000000-0000-0000-007e-000000000000', '60000000-0000-0000-0000-00000000007e', 'ja', 0, 'Ja', 'Ja'),
  ('70000000-0000-0000-007e-000000000001', '60000000-0000-0000-0000-00000000007e', 'nein', 1, 'Nein', 'Nein'),
  ('70000000-0000-0000-0080-000000000000', '60000000-0000-0000-0000-000000000080', 'g', 0, 'G', 'G'),
  ('70000000-0000-0000-0080-000000000001', '60000000-0000-0000-0000-000000000080', 'ag', 1, 'aG', 'aG'),
  ('70000000-0000-0000-0080-000000000002', '60000000-0000-0000-0000-000000000080', 'rf', 2, 'RF', 'RF'),
  ('70000000-0000-0000-0082-000000000000', '60000000-0000-0000-0000-000000000082', 'pflichtversicherung', 0, 'Pflichtversicherung', 'Pflichtversicherung'),
  ('70000000-0000-0000-0082-000000000001', '60000000-0000-0000-0000-000000000082', 'freiwillige_versicherung', 1, 'Freiwillige Versicherung', 'Freiwillige Versicherung'),
  ('70000000-0000-0000-0082-000000000002', '60000000-0000-0000-0000-000000000082', 'private_versicherung', 2, 'Private Versicherung', 'Private Versicherung')
ON CONFLICT (question_id, key) DO UPDATE SET
  sort_order = EXCLUDED.sort_order,
  label_de   = EXCLUDED.label_de,
  value      = EXCLUDED.value;

INSERT INTO public.question_option (id, question_id, key, sort_order, label_de, value)
VALUES
  ('70000000-0000-0000-0082-000000000003', '60000000-0000-0000-0000-000000000082', 'familienversichert', 3, 'Familienversichert', 'Familienversichert'),
  ('70000000-0000-0000-0082-000000000004', '60000000-0000-0000-0000-000000000082', 'betreuung_der_krankenkasse', 4, 'Betreuung der Krankenkasse', 'Betreuung der Krankenkasse'),
  ('70000000-0000-0000-0083-000000000000', '60000000-0000-0000-0000-000000000083', 'nicht_vorhanden', 0, 'Nicht vorhanden', 'Nicht vorhanden'),
  ('70000000-0000-0000-0083-000000000001', '60000000-0000-0000-0000-000000000083', '1', 1, '1', '1'),
  ('70000000-0000-0000-0083-000000000002', '60000000-0000-0000-0000-000000000083', '2', 2, '2', '2'),
  ('70000000-0000-0000-0083-000000000003', '60000000-0000-0000-0000-000000000083', '3', 3, '3', '3'),
  ('70000000-0000-0000-0083-000000000004', '60000000-0000-0000-0000-000000000083', '4', 4, '4', '4'),
  ('70000000-0000-0000-0083-000000000005', '60000000-0000-0000-0000-000000000083', '5', 5, '5', '5'),
  ('70000000-0000-0000-0084-000000000000', '60000000-0000-0000-0000-000000000084', 'ja', 0, 'Ja', 'Ja'),
  ('70000000-0000-0000-0084-000000000001', '60000000-0000-0000-0000-000000000084', 'nein', 1, 'Nein', 'Nein'),
  ('70000000-0000-0000-0086-000000000000', '60000000-0000-0000-0000-000000000086', 'ja', 0, 'Ja', 'Ja'),
  ('70000000-0000-0000-0086-000000000001', '60000000-0000-0000-0000-000000000086', 'nein', 1, 'Nein', 'Nein'),
  ('70000000-0000-0000-0087-000000000000', '60000000-0000-0000-0000-000000000087', 'erwerbsminderungsrente', 0, 'Erwerbsminderungsrente', 'Erwerbsminderungsrente'),
  ('70000000-0000-0000-0087-000000000001', '60000000-0000-0000-0000-000000000087', 'unfallrente', 1, 'Unfallrente', 'Unfallrente'),
  ('70000000-0000-0000-0087-000000000002', '60000000-0000-0000-0000-000000000087', 'altersrente', 2, 'Altersrente', 'Altersrente'),
  ('70000000-0000-0000-0087-000000000003', '60000000-0000-0000-0000-000000000087', 'eu_rente', 3, 'EU Rente', 'EU Rente'),
  ('70000000-0000-0000-0087-000000000004', '60000000-0000-0000-0000-000000000087', 'witwen_rente', 4, 'Witwen Rente', 'Witwen Rente'),
  ('70000000-0000-0000-0087-000000000005', '60000000-0000-0000-0000-000000000087', 'waisen_rente', 5, 'Waisen Rente', 'Waisen Rente'),
  ('70000000-0000-0000-0087-000000000006', '60000000-0000-0000-0000-000000000087', 'werksrente', 6, 'Werksrente', 'Werksrente'),
  ('70000000-0000-0000-0087-000000000007', '60000000-0000-0000-0000-000000000087', 'sonstige_rente_pension', 7, 'Sonstige Rente/Pension', 'Sonstige Rente/Pension'),
  ('70000000-0000-0000-008b-000000000000', '60000000-0000-0000-0000-00000000008b', 'ja', 0, 'Ja', 'Ja'),
  ('70000000-0000-0000-008b-000000000001', '60000000-0000-0000-0000-00000000008b', 'nein', 1, 'Nein', 'Nein'),
  ('70000000-0000-0000-008e-000000000000', '60000000-0000-0000-0000-00000000008e', 'ja', 0, 'Ja', 'Ja'),
  ('70000000-0000-0000-008e-000000000001', '60000000-0000-0000-0000-00000000008e', 'nein', 1, 'Nein', 'Nein'),
  ('70000000-0000-0000-0093-000000000000', '60000000-0000-0000-0000-000000000093', 'ja', 0, 'Ja', 'Ja'),
  ('70000000-0000-0000-0093-000000000001', '60000000-0000-0000-0000-000000000093', 'nein', 1, 'Nein', 'Nein'),
  ('70000000-0000-0000-0096-000000000000', '60000000-0000-0000-0000-000000000096', 'nein', 0, 'Nein', 'Nein'),
  ('70000000-0000-0000-0096-000000000001', '60000000-0000-0000-0000-000000000096', 'lebensversicherung', 1, 'Lebensversicherung', 'Lebensversicherung'),
  ('70000000-0000-0000-0096-000000000002', '60000000-0000-0000-0000-000000000096', 'sterbeversicherung', 2, 'Sterbeversicherung', 'Sterbeversicherung'),
  ('70000000-0000-0000-009a-000000000000', '60000000-0000-0000-0000-00000000009a', 'ja', 0, 'Ja', 'Ja')
ON CONFLICT (question_id, key) DO UPDATE SET
  sort_order = EXCLUDED.sort_order,
  label_de   = EXCLUDED.label_de,
  value      = EXCLUDED.value;

INSERT INTO public.question_option (id, question_id, key, sort_order, label_de, value)
VALUES
  ('70000000-0000-0000-009a-000000000001', '60000000-0000-0000-0000-00000000009a', 'nein', 1, 'Nein', 'Nein'),
  ('70000000-0000-0000-009f-000000000000', '60000000-0000-0000-0000-00000000009f', 'nein', 0, 'Nein', 'Nein'),
  ('70000000-0000-0000-009f-000000000001', '60000000-0000-0000-0000-00000000009f', 'haus', 1, 'Haus', 'Haus'),
  ('70000000-0000-0000-009f-000000000002', '60000000-0000-0000-0000-00000000009f', 'eigentumswohnung', 2, 'Eigentumswohnung', 'Eigentumswohnung'),
  ('70000000-0000-0000-009f-000000000003', '60000000-0000-0000-0000-00000000009f', 'grundbesitz', 3, 'Grundbesitz', 'Grundbesitz'),
  ('70000000-0000-0000-00a0-000000000000', '60000000-0000-0000-0000-0000000000a0', 'ja', 0, 'Ja', 'Ja'),
  ('70000000-0000-0000-00a0-000000000001', '60000000-0000-0000-0000-0000000000a0', 'nein', 1, 'Nein', 'Nein')
ON CONFLICT (question_id, key) DO UPDATE SET
  sort_order = EXCLUDED.sort_order,
  label_de   = EXCLUDED.label_de,
  value      = EXCLUDED.value;
