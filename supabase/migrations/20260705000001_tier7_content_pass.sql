-- Berlin content pass, Tier 7 — final bundle of independent content fixes.
--
-- Confirmed decisions:
--  * Item 1  country_of_birth -> single_select (full country list), pre-selected
--            "Deutschland" via validation.default (consumed client-side).
--  * Item 2  power_of_attorney -> exactly 3 options, optional (is_required=false).
--  * Item 3  berlin_since / berlin_district_since -> single_select year dropdowns
--            (1930–2026, newest first) moved into wohnsituation right after the
--            address block (link-by-proximity).
--  * Item 4  apartment_ownership -> add "Mietfrei bei Freunden/Familie".
--  * Item 5  move ALL THREE wealth-resident life-insurance follow-ups
--            (total_amount, name, number) into expenditure after the trigger.
--  * Item 6  bank_savings_iban prompt copy fix.
--  * Item 7  pension_type -> add "Keine Rente"; its follow-ups switch from
--            not_empty to in_values(real pension types) so "Keine Rente" (and
--            unanswered) hide them.
--  * Item 8  question_group.custom_prompt_de column + the 4 exact loop prompts.
--
-- Scope: main-applicant questions only (spouse mirrors intentionally untouched).
-- answer.value is JSONB (single_select stored as a JSON string).
-- Idempotent (ON CONFLICT / IF NOT EXISTS / absolute sort_order + category moves).

BEGIN;

-- Category ids used below (from prior tiers).
--   wohnsituation = 40000000-…-0009 (so=1)
--   income        = 40000000-…-0004 (so=4)
--   expenditure   = 40000000-…-0005 (so=5)
--   wealth        = 40000000-…-0006 (so=6)

-- ── Item 1: country_of_birth → single_select + Deutschland default ────────────
UPDATE public.question
SET answer_type = 'single_select'::public.answer_type,
    validation  = '{"default":"Deutschland"}'::jsonb
WHERE key = 'country_of_birth';

INSERT INTO public.question_option (question_id, key, sort_order, label_de, value)
SELECT q.id, 'country_' || r.rn, r.rn - 1, r.name, r.name
FROM public.question q
CROSS JOIN (
  SELECT name, row_number() OVER (ORDER BY (name = 'Deutschland') DESC, name) AS rn
  FROM (VALUES
    ('Deutschland'),
    ('Afghanistan'),('Ägypten'),('Albanien'),('Algerien'),('Andorra'),('Angola'),
    ('Antigua und Barbuda'),('Äquatorialguinea'),('Argentinien'),('Armenien'),
    ('Aserbaidschan'),('Äthiopien'),('Australien'),('Bahamas'),('Bahrain'),
    ('Bangladesch'),('Barbados'),('Belarus'),('Belgien'),('Belize'),('Benin'),
    ('Bhutan'),('Bolivien'),('Bosnien und Herzegowina'),('Botsuana'),('Brasilien'),
    ('Brunei Darussalam'),('Bulgarien'),('Burkina Faso'),('Burundi'),('Chile'),
    ('China'),('Costa Rica'),('Côte d''Ivoire'),('Dänemark'),('Dominica'),
    ('Dominikanische Republik'),('Dschibuti'),('Ecuador'),('El Salvador'),
    ('Eritrea'),('Estland'),('Eswatini'),('Fidschi'),('Finnland'),('Frankreich'),
    ('Gabun'),('Gambia'),('Georgien'),('Ghana'),('Grenada'),('Griechenland'),
    ('Guatemala'),('Guinea'),('Guinea-Bissau'),('Guyana'),('Haiti'),('Honduras'),
    ('Indien'),('Indonesien'),('Irak'),('Iran'),('Irland'),('Island'),('Israel'),
    ('Italien'),('Jamaika'),('Japan'),('Jemen'),('Jordanien'),('Kambodscha'),
    ('Kamerun'),('Kanada'),('Kap Verde'),('Kasachstan'),('Katar'),('Kenia'),
    ('Kirgisistan'),('Kiribati'),('Kolumbien'),('Komoren'),('Kongo (Republik)'),
    ('Kongo (Demokratische Republik)'),('Kosovo'),('Kroatien'),('Kuba'),('Kuwait'),
    ('Laos'),('Lesotho'),('Lettland'),('Libanon'),('Liberia'),('Libyen'),
    ('Liechtenstein'),('Litauen'),('Luxemburg'),('Madagaskar'),('Malawi'),
    ('Malaysia'),('Malediven'),('Mali'),('Malta'),('Marokko'),('Marshallinseln'),
    ('Mauretanien'),('Mauritius'),('Mexiko'),('Mikronesien'),('Moldau'),('Monaco'),
    ('Mongolei'),('Montenegro'),('Mosambik'),('Myanmar'),('Namibia'),('Nauru'),
    ('Nepal'),('Neuseeland'),('Nicaragua'),('Niederlande'),('Niger'),('Nigeria'),
    ('Nordkorea'),('Nordmazedonien'),('Norwegen'),('Oman'),('Österreich'),
    ('Pakistan'),('Palau'),('Panama'),('Papua-Neuguinea'),('Paraguay'),('Peru'),
    ('Philippinen'),('Polen'),('Portugal'),('Ruanda'),('Rumänien'),
    ('Russische Föderation'),('Salomonen'),('Sambia'),('Samoa'),('San Marino'),
    ('São Tomé und Príncipe'),('Saudi-Arabien'),('Schweden'),('Schweiz'),
    ('Senegal'),('Serbien'),('Seychellen'),('Sierra Leone'),('Simbabwe'),
    ('Singapur'),('Slowakei'),('Slowenien'),('Somalia'),('Spanien'),('Sri Lanka'),
    ('St. Kitts und Nevis'),('St. Lucia'),('St. Vincent und die Grenadinen'),
    ('Südafrika'),('Südkorea'),('Sudan'),('Südsudan'),('Suriname'),('Syrien'),
    ('Tadschikistan'),('Tansania'),('Thailand'),('Timor-Leste'),('Togo'),('Tonga'),
    ('Trinidad und Tobago'),('Tschad'),('Tschechien'),('Tunesien'),('Türkei'),
    ('Turkmenistan'),('Tuvalu'),('Uganda'),('Ukraine'),('Ungarn'),('Uruguay'),
    ('Usbekistan'),('Vanuatu'),('Vatikanstadt'),('Venezuela'),
    ('Vereinigte Arabische Emirate'),('Vereinigte Staaten'),
    ('Vereinigtes Königreich'),('Vietnam'),('Zentralafrikanische Republik'),
    ('Zypern')
  ) AS c(name)
) r
WHERE q.key = 'country_of_birth'
ON CONFLICT (question_id, key) DO NOTHING;

-- Drop old free-text TEST answers that don't match any country option (kept if
-- they happen to match, e.g. someone typed exactly "Deutschland").
DELETE FROM public.answer a
USING public.question q
WHERE a.question_id = q.id
  AND q.key = 'country_of_birth'
  AND NOT EXISTS (
    SELECT 1 FROM public.question_option o
    WHERE o.question_id = q.id AND to_jsonb(o.value) = a.value
  );

-- ── Item 2: power_of_attorney → 3 options, optional ──────────────────────────
UPDATE public.question SET is_required = false WHERE key = 'power_of_attorney';

DELETE FROM public.question_option
WHERE question_id = (SELECT id FROM public.question WHERE key = 'power_of_attorney');

INSERT INTO public.question_option (question_id, key, sort_order, label_de, value)
SELECT q.id, v.key, v.so, v.label, v.label
FROM public.question q
CROSS JOIN (VALUES
  ('poa_gesetzlicher_betreuer', 0, 'Gesetzlicher Betreuer'),
  ('poa_bevollmaechtigter_angehoeriger', 1, 'Bevollmächtigter Angehöriger'),
  ('poa_beistandschaft', 2, 'Beistandschaft')
) AS v(key, so, label)
WHERE q.key = 'power_of_attorney'
ON CONFLICT (question_id, key) DO NOTHING;

-- Drop pre-launch TEST answers whose value is no longer a valid option (e.g. old "Betreuung").
DELETE FROM public.answer
WHERE question_id = (SELECT id FROM public.question WHERE key = 'power_of_attorney')
  AND value NOT IN ('"Gesetzlicher Betreuer"'::jsonb, '"Bevollmächtigter Angehöriger"'::jsonb, '"Beistandschaft"'::jsonb);

-- ── Item 3: year dropdowns + move into wohnsituation after the address block ──
UPDATE public.question
SET answer_type = 'single_select'::public.answer_type,
    category_id = '40000000-0000-0000-0000-000000000009'
WHERE key IN ('berlin_since', 'berlin_district_since');

-- Absolute wohnsituation order: address → seit-wann → Mietverhältnis.
UPDATE public.question
SET sort_order = CASE key
  WHEN 'last_residence_plz'    THEN 0
  WHEN 'last_residence_street' THEN 1
  WHEN 'last_residence_city'   THEN 2
  WHEN 'berlin_since'          THEN 3
  WHEN 'berlin_district_since' THEN 4
  WHEN 'apartment_ownership'   THEN 5
  ELSE sort_order
END
WHERE category_id = '40000000-0000-0000-0000-000000000009';

-- Year options 1930–2026, newest first.
INSERT INTO public.question_option (question_id, key, sort_order, label_de, value)
SELECT q.id, 'year_' || y, (2026 - y), y::text, y::text
FROM public.question q
CROSS JOIN generate_series(1930, 2026) AS y
WHERE q.key IN ('berlin_since', 'berlin_district_since')
ON CONFLICT (question_id, key) DO NOTHING;

-- Drop old free-text TEST answers (won't match a year option).
DELETE FROM public.answer
WHERE question_id IN (SELECT id FROM public.question WHERE key IN ('berlin_since', 'berlin_district_since'));

-- ── Item 4: Mietfrei option on apartment_ownership ───────────────────────────
INSERT INTO public.question_option (question_id, key, sort_order, label_de, value)
SELECT q.id, 'apartment_mietfrei', 3, 'Mietfrei bei Freunden/Familie', 'Mietfrei bei Freunden/Familie'
FROM public.question q
WHERE q.key = 'apartment_ownership'
ON CONFLICT (question_id, key) DO NOTHING;

-- ── Item 5: move the 3 wealth life-insurance follow-ups after the trigger ─────
-- Trigger life_insurance (expenditure so=6) + life_insurance_monthly_amount (so=7)
-- already adjacent; place the wealth trio at so=8/9/10. Visibility rules unchanged
-- (still {not_value:"Nein", question_key:"life_insurance"}); none are controllers.
UPDATE public.question SET category_id = '40000000-0000-0000-0000-000000000005', sort_order = 8  WHERE key = 'life_insurance_total_amount';
UPDATE public.question SET category_id = '40000000-0000-0000-0000-000000000005', sort_order = 9  WHERE key = 'life_insurance_name';
UPDATE public.question SET category_id = '40000000-0000-0000-0000-000000000005', sort_order = 10 WHERE key = 'life_insurance_number';

-- ── Item 6: IBAN copy fix ────────────────────────────────────────────────────
UPDATE public.question
SET prompt_de = 'Was ist Ihre IBAN Nummer Ihres Sparkontos?'
WHERE key = 'bank_savings_iban';

-- ── Item 7: pension "Keine Rente" + gate follow-ups on real pensions ─────────
INSERT INTO public.question_option (question_id, key, sort_order, label_de, value)
SELECT q.id, 'pension_keine', 8, 'Keine Rente', 'Keine Rente'
FROM public.question q
WHERE q.key = 'pension_type'
ON CONFLICT (question_id, key) DO NOTHING;

UPDATE public.question
SET visibility_rule = '{"in_values":["Erwerbsminderungsrente","Unfallrente","Altersrente","EU Rente","Witwen Rente","Waisen Rente","Werksrente","Sonstige Rente/Pension"],"question_key":"pension_type"}'::jsonb
WHERE key IN ('pension_amount', 'pension_id', 'pension_issuer');

-- ── Item 8: per-group custom loop-prompt text ────────────────────────────────
ALTER TABLE public.question_group ADD COLUMN IF NOT EXISTS custom_prompt_de TEXT;

UPDATE public.question_group SET custom_prompt_de = CASE key
  WHEN 'pension'           THEN 'Möchten Sie weitere Renten hinzufügen?'
  WHEN 'other_income'      THEN 'Möchten Sie sonstiges Einkommen hinzufügen?'
  WHEN 'bank_additional'   THEN 'Möchten Sie weitere Bankkonten hinzufügen?'
  WHEN 'additional_wealth' THEN 'Möchten Sie weitere Vermögenswerte hinzufügen?'
  ELSE custom_prompt_de
END
WHERE key IN ('pension', 'other_income', 'bank_additional', 'additional_wealth');

COMMIT;
