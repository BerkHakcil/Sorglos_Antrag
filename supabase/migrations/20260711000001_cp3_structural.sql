-- Content pass 3 — structural changes (Roman's 08.07 review, decisions D1-D12).
-- Copy-only updates follow in 20260711000002/3 (generated from the committed CSVs).
-- All deleted answers are pre-launch test data (each ≤1 row, verified in Phase 1).
-- Essen question ids are hex-of-master-row (61000000-…-{id:x}); new questions
-- continue the synthetic sequence at 253+.

BEGIN;

-- ── D1: member_since — type date -> short_text + docx prompts ─────────────────
-- (spouse prompt is constructed — pending Roman review, see milestone log)
UPDATE public.question SET answer_type = 'short_text'::public.answer_type,
  prompt_de = 'Wie lange sind Sie schon Mitglied dieser Krankenversicherung?'
WHERE id = '61000000-0000-0000-0000-00000000003b';
UPDATE public.question SET answer_type = 'short_text'::public.answer_type,
  prompt_de = 'Wie lange ist Ihr Partner schon Mitglied dieser Krankenversicherung?'
WHERE id = '61000000-0000-0000-0000-0000000000a2';
DELETE FROM public.answer WHERE question_id = '61000000-0000-0000-0000-00000000003b'; -- stale date-format test answer

-- ── D1: Mietrückstände prompts (docx overrides the CSV "Gibt es…" phrasing) ───
UPDATE public.question SET prompt_de = 'Wie hoch sind die Mietrückstände für Ihre letzte Wohnung?'
WHERE id = '60000000-0000-0000-0000-00000000002e';  -- Berlin rent_debt
UPDATE public.question SET prompt_de = 'Wie hoch sind die Mietrückstände für die letzte Wohnung?'
WHERE id = '61000000-0000-0000-0000-000000000026';  -- Essen former_rent_debt

-- ── D3: Essen children gate ───────────────────────────────────────────────────
INSERT INTO public.question (id, category_id, group_id, key, sort_order, answer_type, is_required, prompt_de, help_de, validation, visibility_rule)
VALUES ('61000000-0000-0000-0000-0000000000fd', '41000000-0000-0000-0000-000000000003', NULL,
        'children_yes_no', 0, 'single_select'::public.answer_type, true, 'Haben Sie Kinder?', NULL, NULL, NULL)
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.question_option (id, question_id, key, sort_order, label_de, value) VALUES
  ('71000000-0000-0000-00fd-000000000000', '61000000-0000-0000-0000-0000000000fd', 'o0', 0, 'Ja', 'Ja'),
  ('71000000-0000-0000-00fd-000000000001', '61000000-0000-0000-0000-0000000000fd', 'o1', 1, 'Nein', 'Nein')
ON CONFLICT (id) DO NOTHING;
UPDATE public.question SET visibility_rule = '{"value":"Ja","question_key":"children_yes_no"}'::jsonb
WHERE id = '61000000-0000-0000-0000-000000000029';  -- child_first_name (rest of the group chains on it)

-- ── D4: Unterhalt restructure ─────────────────────────────────────────────────
DELETE FROM public.question WHERE id = '61000000-0000-0000-0000-000000000031';  -- maintenance_bulk_topics (options + 1 test answer cascade)
INSERT INTO public.question (id, category_id, group_id, key, sort_order, answer_type, is_required, prompt_de, help_de, validation, visibility_rule)
VALUES ('61000000-0000-0000-0000-0000000000fe', '41000000-0000-0000-0000-000000000003', NULL,
        'maintenance_claims_status', 10, 'single_select'::public.answer_type, true,
        'Bestehen Unterhaltsansprüche gegenüber ex Partner?', NULL, NULL, NULL)
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.question_option (id, question_id, key, sort_order, label_de, value) VALUES
  ('71000000-0000-0000-00fe-000000000000', '61000000-0000-0000-0000-0000000000fe', 'o0', 0, 'Nein', 'Nein'),
  ('71000000-0000-0000-00fe-000000000001', '61000000-0000-0000-0000-0000000000fe', 'o1', 1, 'Auf Unterhalt wurde verzichtet', 'Auf Unterhalt wurde verzichtet'),
  ('71000000-0000-0000-00fe-000000000002', '61000000-0000-0000-0000-0000000000fe', 'o2', 2, 'Unterhalt wird bereits bezahlt', 'Unterhalt wird bereits bezahlt'),
  ('71000000-0000-0000-00fe-000000000003', '61000000-0000-0000-0000-0000000000fe', 'o3', 3, 'Unterhalt wurde noch nicht geltend gemacht', 'Unterhalt wurde noch nicht geltend gemacht'),
  ('71000000-0000-0000-00fe-000000000004', '61000000-0000-0000-0000-0000000000fe', 'o4', 4, 'Unterhalt ist bereits tituliert', 'Unterhalt ist bereits tituliert')
ON CONFLICT (id) DO NOTHING;
-- ex_partner_* re-gate (in_values variant per Phase-2 decision 1 — no fresh-case inflation)
UPDATE public.question SET visibility_rule =
  '{"in_values":["Auf Unterhalt wurde verzichtet","Unterhalt wird bereits bezahlt","Unterhalt wurde noch nicht geltend gemacht","Unterhalt ist bereits tituliert"],"question_key":"maintenance_claims_status"}'::jsonb
WHERE id IN ('61000000-0000-0000-0000-000000000032','61000000-0000-0000-0000-000000000033',
             '61000000-0000-0000-0000-000000000034','61000000-0000-0000-0000-000000000035',
             '61000000-0000-0000-0000-000000000036','61000000-0000-0000-0000-000000000037',
             '61000000-0000-0000-0000-000000000038','61000000-0000-0000-0000-000000000039');

-- Kinder category renumber (gate first, children group, select, ex_partner block)
UPDATE public.question SET sort_order = CASE key
  WHEN 'children_yes_no' THEN 0
  WHEN 'child_first_name' THEN 1  WHEN 'child_last_name' THEN 2  WHEN 'child_birth_name' THEN 3
  WHEN 'child_birth_date' THEN 4  WHEN 'child_marital_status' THEN 5  WHEN 'child_family_tie' THEN 6
  WHEN 'child_profession' THEN 7  WHEN 'child_address' THEN 8  WHEN 'child_high_income_100k_yes_no' THEN 9
  WHEN 'maintenance_claims_status' THEN 10
  WHEN 'ex_partner_first_name' THEN 11  WHEN 'ex_partner_last_name' THEN 12  WHEN 'ex_partner_street' THEN 13
  WHEN 'ex_partner_house_number' THEN 14 WHEN 'ex_partner_plz' THEN 15 WHEN 'ex_partner_city' THEN 16
  WHEN 'ex_partner_birthdate' THEN 17   WHEN 'ex_partner_city_of_birth' THEN 18
  ELSE sort_order END
WHERE category_id = '41000000-0000-0000-0000-000000000003';

-- ── D6: Hausratversicherung — delete everywhere ───────────────────────────────
DELETE FROM public.question_option WHERE question_id = '61000000-0000-0000-0000-000000000055' AND key = 'o4'; -- expense bulk
DELETE FROM public.question_option WHERE question_id = '61000000-0000-0000-0000-0000000000f3' AND key = 'o4'; -- spouse expense bulk
DELETE FROM public.question WHERE id IN ('61000000-0000-0000-0000-00000000005a',   -- home_contents_insurance_amount (1 test answer cascades)
                                         '61000000-0000-0000-0000-0000000000df');  -- spouse mirror

-- ── D7: cash merge ────────────────────────────────────────────────────────────
DELETE FROM public.question WHERE id IN ('61000000-0000-0000-0000-00000000005d',   -- cash_savings_yes_no (1 test answer cascades)
                                         '61000000-0000-0000-0000-0000000000b7');  -- spouse mirror
UPDATE public.question SET visibility_rule = NULL
WHERE id = '61000000-0000-0000-0000-00000000005e';  -- cash_savings_amount: unconditional (prompt via CSV migration)
UPDATE public.question SET visibility_rule =
  '{"in_values":["verheiratet","Lebenspartnerschaft","eheähnliche Gemeinschaft"],"question_key":"marital_status"}'::jsonb
WHERE id = '61000000-0000-0000-0000-0000000000b8';  -- spouse amount keeps only the marital gate

-- ── D8: Ausland restructure ───────────────────────────────────────────────────
DELETE FROM public.question_option WHERE question_id = '61000000-0000-0000-0000-000000000078' AND key = 'o8'; -- wealth bulk
DELETE FROM public.question_option WHERE question_id = '61000000-0000-0000-0000-0000000000f4' AND key = 'o8'; -- spouse wealth bulk
INSERT INTO public.question (id, category_id, group_id, key, sort_order, answer_type, is_required, prompt_de, help_de, validation, visibility_rule) VALUES
  ('61000000-0000-0000-0000-0000000000ff', '41000000-0000-0000-0000-000000000006', NULL,
   'abroad_lived_yes_no', 43, 'single_select'::public.answer_type, true, 'Haben Sie jemals im Ausland gelebt?', NULL, NULL, NULL),
  ('61000000-0000-0000-0000-000000000100', '41000000-0000-0000-0000-000000000008', NULL,
   'spouse_abroad_lived_yes_no', 102, 'single_select'::public.answer_type, true, 'Hat Ihr Partner jemals im Ausland gelebt?', NULL, NULL,
   '{"in_values":["verheiratet","Lebenspartnerschaft","eheähnliche Gemeinschaft"],"question_key":"marital_status"}'::jsonb)
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.question_option (id, question_id, key, sort_order, label_de, value) VALUES
  ('71000000-0000-0000-00ff-000000000000', '61000000-0000-0000-0000-0000000000ff', 'o0', 0, 'Ja', 'Ja'),
  ('71000000-0000-0000-00ff-000000000001', '61000000-0000-0000-0000-0000000000ff', 'o1', 1, 'Nein', 'Nein'),
  ('71000000-0000-0000-0100-000000000000', '61000000-0000-0000-0000-000000000100', 'o0', 0, 'Ja', 'Ja'),
  ('71000000-0000-0000-0100-000000000001', '61000000-0000-0000-0000-000000000100', 'o1', 1, 'Nein', 'Nein')
ON CONFLICT (id) DO NOTHING;
UPDATE public.question SET visibility_rule = '{"value":"Ja","question_key":"abroad_lived_yes_no"}'::jsonb, sort_order = sort_order + 1
WHERE id IN ('61000000-0000-0000-0000-000000000085','61000000-0000-0000-0000-000000000086','61000000-0000-0000-0000-000000000087');
UPDATE public.question SET visibility_rule = '{"value":"Ja","question_key":"spouse_abroad_lived_yes_no"}'::jsonb, sort_order = sort_order + 1
WHERE id IN ('61000000-0000-0000-0000-0000000000ee','61000000-0000-0000-0000-0000000000ef','61000000-0000-0000-0000-0000000000f0');

-- ── D9: applicant_bulk_topics — reword option 2, delete option 4 ─────────────
UPDATE public.question_option SET label_de = 'Es wurden bereits in der Vergangenheit Sozialleistungen bezogen'
WHERE question_id = '61000000-0000-0000-0000-000000000017' AND key = 'o1';  -- value unchanged, rules keep matching
DELETE FROM public.question_option
WHERE question_id = '61000000-0000-0000-0000-000000000017' AND key = 'o3';  -- "Es besteht weiterer Beratungsbedarf" (verified flag-only)

-- ── D10: funeral due-date questions ───────────────────────────────────────────
DELETE FROM public.question WHERE id IN ('61000000-0000-0000-0000-000000000067',   -- funeral_insurance_due_date (1 test answer cascades)
                                         '61000000-0000-0000-0000-0000000000c1');  -- spouse mirror

-- ── Test-answer cleanup on the three modified multi-selects ──────────────────
-- (arrays may contain deleted option values; all pre-launch test rows)
DELETE FROM public.answer WHERE question_id IN (
  '61000000-0000-0000-0000-000000000017',  -- applicant_bulk_topics
  '61000000-0000-0000-0000-000000000055',  -- expense_bulk_topics
  '61000000-0000-0000-0000-000000000078'); -- wealth_bulk_topics

-- ── D12: deactivate the empty fallback questionnaire ──────────────────────────
-- resolvePlzAction now defaults to the Berlin questionnaire; the row stays for
-- old test cases' FK references.
UPDATE public.questionnaire SET is_active = false WHERE id = '30000000-0000-0000-0000-000000000002';

COMMIT;
