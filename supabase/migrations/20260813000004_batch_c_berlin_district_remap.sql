-- Batch C (go-live round 2): dissolve the city-level "Sozialamt Berlin" PLZ
-- routing into the 11 missing Berlin district offices (Pankow already exists
-- as 11000000-…-0001 and keeps its 21 prio-20 rules untouched).
-- Founder-approved D-1..D-8, 2026-08-13. Full report + decision log:
-- docs/feedback/golive_round2_batch_c.md.
--
-- D-1 OFFICE NAMES are the OFFICIAL government designations (factual, not
-- creative copy — founder decision): pattern "Bezirksamt <X> von Berlin –
-- Amt für Soziales". Source: Senatsverwaltung für Arbeit, Soziales,
-- Gleichstellung, Integration, Vielfalt und Antidiskriminierung,
-- "Zuständige Ämter" (Sozialhilfe),
-- https://www.berlin.de/sen/soziales/soziale-sicherung/sozialhilfe/zustaendige-aemter/
-- — each Bezirk's Sozialhilfe office is the "Amt für Soziales" of
-- "Bezirksamt <X> von Berlin" (authority naming also on record at
-- fragdenstaat.de, e.g. "Amt für Soziales - Bezirksamt Mitte von Berlin").
-- The full 11-name list goes to Roman as confirm-or-correct
-- (docs/feedback/roman_package_round2.md). Office names render user-facing
-- NOWHERE in the app today; sole consumer is the ops-facing case-export
-- header (scripts/case-export.mjs) — verified 2026-08-13.
--
-- EFFECTS: FUTURE cases only. cases.social_office_id is frozen at PLZ entry
-- (app/case/actions.ts is the sole writer; PlzForm is unreachable once
-- questionnaire_id is set). The existing-case backfill (rico -> Marzahn-
-- Hellersdorf, berk -> Friedrichshain-Kreuzberg, test fixture -> Mitte) is
-- Part C1 — a SEPARATE migration in push 2, only after THIS migration is
-- verified live (founder sequencing rule, 2026-08-13).
--
-- The new district offices have ZERO office_document_rule rows and ZERO
-- questionnaires BY DESIGN: the document checklist degrades to the
-- app_config default set (Pankow rules, rulesSource='fallback', banner
-- visible — lib/dal.ts) and the questionnaire degrades to the Berlin
-- default 30000000-…-0001 (D12, actions.ts). No checklist changes anywhere
-- (D-7): banner-gone/suffix-back for a district requires authoring that
-- district's own rule set — deliberately NOT part of this batch.
--
-- R2 EXECUTION-TIME REPORT (fresh prod dumps 2026-08-13 evening,
-- census-batch-c.mjs ALL PASS; the asserts below re-verify at apply time):
-- 8180 rules total; 190 city rules (all prio 1, all single-PLZ); 21 Pankow
-- prio-20 rules = exactly the shadowed set; the remaining 169 partition
-- exactly into the 11 district lists below; id range 0002..0012 free;
-- 3 cases parked on the city office (berk 10245, rico 12687 LOCKED, test
-- fixture 10115 LOCKED). Rico slot-set identity re-proven: 17 slots,
-- byte-identical under city office vs MH office, missing count 0 under both.
-- (Drift on record vs the morning report: rico's missing count was 3
-- [PAN-016/017/018]; he uploaded all documents since — 19 files, all slots
-- covered. Legitimate user activity; nothing in this migration depends on
-- his uploads.) Post-state resolver anchors simulated in memory: 12687->MH,
-- 10245->FK, 10115->Mitte, 13187/13189->Pankow (prio 20), 10247/13051 stay
-- Pankow (policy), 45127 Essen / 21682 Stade / 12529 Dahme-Spreewald /
-- 14467 Potsdam untouched.
--
-- DATA-ONLY: zero dependent code (rule 8 trivially satisfied — routing and
-- fallback are fully data-driven; no column or table shape changes).

BEGIN;

-- ── Part A: create the 11 missing district offices (D-1) ─────────────────────
-- Namespace 11000000-… continues the Pankow precedent; the 10000000-…
-- namespace is occupied by the nationwide seed (…0001..0376).

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.social_office
             WHERE id BETWEEN '11000000-0000-0000-0000-000000000002'
                          AND '11000000-0000-0000-0000-000000000012') THEN
    RAISE EXCEPTION 'Batch C: district office id range 0002..0012 already occupied';
  END IF;
END $$;

INSERT INTO public.social_office (id, name, is_active) VALUES
  ('11000000-0000-0000-0000-000000000002', 'Bezirksamt Mitte von Berlin – Amt für Soziales',                      true),
  ('11000000-0000-0000-0000-000000000003', 'Bezirksamt Friedrichshain-Kreuzberg von Berlin – Amt für Soziales',   true),
  ('11000000-0000-0000-0000-000000000004', 'Bezirksamt Charlottenburg-Wilmersdorf von Berlin – Amt für Soziales', true),
  ('11000000-0000-0000-0000-000000000005', 'Bezirksamt Spandau von Berlin – Amt für Soziales',                    true),
  ('11000000-0000-0000-0000-000000000006', 'Bezirksamt Steglitz-Zehlendorf von Berlin – Amt für Soziales',        true),
  ('11000000-0000-0000-0000-000000000007', 'Bezirksamt Tempelhof-Schöneberg von Berlin – Amt für Soziales',       true),
  ('11000000-0000-0000-0000-000000000008', 'Bezirksamt Neukölln von Berlin – Amt für Soziales',                   true),
  ('11000000-0000-0000-0000-000000000009', 'Bezirksamt Treptow-Köpenick von Berlin – Amt für Soziales',           true),
  ('11000000-0000-0000-0000-000000000010', 'Bezirksamt Marzahn-Hellersdorf von Berlin – Amt für Soziales',        true),
  ('11000000-0000-0000-0000-000000000011', 'Bezirksamt Lichtenberg von Berlin – Amt für Soziales',                true),
  ('11000000-0000-0000-0000-000000000012', 'Bezirksamt Reinickendorf von Berlin – Amt für Soziales',              true);

DO $$
DECLARE
  n integer;
BEGIN
  SELECT count(*) INTO n FROM public.social_office
   WHERE id BETWEEN '11000000-0000-0000-0000-000000000002'
                AND '11000000-0000-0000-0000-000000000012';
  IF n <> 11 THEN
    RAISE EXCEPTION 'Part A failed: expected 11 district offices, found %', n;
  END IF;
  RAISE NOTICE 'Part A applied: 11 district offices created (0002..0012, official names)';
END $$;

-- ── Part B: remap the 190 city-level PLZ rules (D-2/D-3/D-4) ─────────────────

DO $$
DECLARE
  n integer;
  p text;
  city   constant uuid := '10000000-0000-0000-0000-000000000001';
  pankow constant uuid := '11000000-0000-0000-0000-000000000001';
  shadowed constant text[] := ARRAY[
    '10119','10247','10249','10405','10407','10409','10435','10437','10439',
    '13051','13086','13088','13089','13125','13127','13129','13156','13158',
    '13159','13187','13189'];
BEGIN
  -- Pre-asserts: the world is exactly as surveyed on 2026-08-13.
  SELECT count(*) INTO n FROM public.postal_code_rule
   WHERE social_office_id = city;
  IF n <> 190 THEN RAISE EXCEPTION 'expected 190 city rules, found %', n; END IF;
  SELECT count(*) INTO n FROM public.postal_code_rule
   WHERE social_office_id = city AND (priority <> 1 OR plz_from <> plz_to);
  IF n <> 0 THEN RAISE EXCEPTION '% city rules at unexpected priority or range shape', n; END IF;
  SELECT count(*) INTO n FROM public.postal_code_rule
   WHERE social_office_id = pankow AND priority = 20;
  IF n <> 21 THEN RAISE EXCEPTION 'expected 21 Pankow prio-20 rules, found %', n; END IF;
  RAISE NOTICE 'Part B pre-asserts passed (190 city prio-1 single-PLZ, 21 Pankow prio-20)';

  -- B1 (D-4): delete the 21 city rules shadowed by Pankow prio-20 rules,
  -- each guarded per-row: the Pankow twin must exist BEFORE the delete.
  -- (17 fully-Pankow codes + 10119/10247/10249/13051 kept on Pankow per
  -- Roman's recorded "when in doubt, include" policy — D-3, docs/operations.md §7.)
  FOREACH p IN ARRAY shadowed LOOP
    SELECT count(*) INTO n FROM public.postal_code_rule
     WHERE social_office_id = pankow AND priority = 20
       AND plz_from = p AND plz_to = p;
    IF n <> 1 THEN
      RAISE EXCEPTION 'shadow delete %: expected exactly 1 Pankow prio-20 twin, found %', p, n;
    END IF;
    DELETE FROM public.postal_code_rule
     WHERE social_office_id = city AND plz_from = p AND plz_to = p;
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n <> 1 THEN
      RAISE EXCEPTION 'shadow delete %: expected to delete exactly 1 city rule, deleted %', p, n;
    END IF;
  END LOOP;
  SELECT count(*) INTO n FROM public.postal_code_rule
   WHERE social_office_id = city;
  IF n <> 169 THEN RAISE EXCEPTION 'after B1: expected 169 city rules, found %', n; END IF;
  RAISE NOTICE 'B1 applied: 21 shadowed duplicates deleted (each twin-guarded), 169 city rules remain';

  -- B2 (D-2): repoint the remaining 169 rules to their primary district
  -- (largest-area-share Bezirk, official Geoportal Berlin / ALKIS geometry).
  -- Guarded UPDATEs preserve rule ids for auditability. Priority stays 1.

  UPDATE public.postal_code_rule SET social_office_id = '11000000-0000-0000-0000-000000000002'
   WHERE social_office_id = city AND plz_from IN
   ('10115','10117','10178','10179','10551','10553','10555','10557','10559',
    '10785','10787','13347','13349','13351','13353','13355','13357','13359');
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 18 THEN RAISE EXCEPTION 'Mitte: expected 18, got %', n; END IF;

  UPDATE public.postal_code_rule SET social_office_id = '11000000-0000-0000-0000-000000000003'
   WHERE social_office_id = city AND plz_from IN
   ('10243','10245','10961','10963','10965','10967','10969','10997','10999');
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 9 THEN RAISE EXCEPTION 'Friedrichshain-Kreuzberg: expected 9, got %', n; END IF;

  UPDATE public.postal_code_rule SET social_office_id = '11000000-0000-0000-0000-000000000004'
   WHERE social_office_id = city AND plz_from IN
   ('10585','10587','10589','10623','10625','10627','10629','10707','10709',
    '10711','10713','10715','10717','10719','10789','13627','14050','14052',
    '14053','14055','14057','14059','14193','14197','14199');
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 25 THEN RAISE EXCEPTION 'Charlottenburg-Wilmersdorf: expected 25, got %', n; END IF;

  UPDATE public.postal_code_rule SET social_office_id = '11000000-0000-0000-0000-000000000005'
   WHERE social_office_id = city AND plz_from IN
   ('13581','13583','13585','13587','13589','13591','13593','13595','13597',
    '13599','13629','14089');
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 12 THEN RAISE EXCEPTION 'Spandau: expected 12, got %', n; END IF;

  UPDATE public.postal_code_rule SET social_office_id = '11000000-0000-0000-0000-000000000006'
   WHERE social_office_id = city AND plz_from IN
   ('12163','12165','12167','12169','12203','12205','12207','12209','12247',
    '12249','14109','14129','14163','14165','14167','14169','14195');
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 17 THEN RAISE EXCEPTION 'Steglitz-Zehlendorf: expected 17, got %', n; END IF;

  UPDATE public.postal_code_rule SET social_office_id = '11000000-0000-0000-0000-000000000007'
   WHERE social_office_id = city AND plz_from IN
   ('10777','10779','10781','10783','10823','10825','10827','10829','12099',
    '12101','12103','12105','12107','12109','12157','12159','12161','12277',
    '12279','12305','12307','12309');
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 22 THEN RAISE EXCEPTION 'Tempelhof-Schöneberg: expected 22, got %', n; END IF;

  UPDATE public.postal_code_rule SET social_office_id = '11000000-0000-0000-0000-000000000008'
   WHERE social_office_id = city AND plz_from IN
   ('12043','12045','12047','12049','12051','12053','12055','12057','12059',
    '12347','12349','12351','12353','12355','12357','12359');
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 16 THEN RAISE EXCEPTION 'Neukölln: expected 16, got %', n; END IF;

  UPDATE public.postal_code_rule SET social_office_id = '11000000-0000-0000-0000-000000000009'
   WHERE social_office_id = city AND plz_from IN
   ('12435','12437','12439','12459','12487','12489','12524','12526','12527',
    '12555','12557','12559','12587','12589');
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 14 THEN RAISE EXCEPTION 'Treptow-Köpenick: expected 14, got %', n; END IF;

  UPDATE public.postal_code_rule SET social_office_id = '11000000-0000-0000-0000-000000000010'
   WHERE social_office_id = city AND plz_from IN
   ('12619','12621','12623','12627','12629','12679','12681','12683','12685',
    '12687','12689');
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 11 THEN RAISE EXCEPTION 'Marzahn-Hellersdorf: expected 11, got %', n; END IF;

  UPDATE public.postal_code_rule SET social_office_id = '11000000-0000-0000-0000-000000000011'
   WHERE social_office_id = city AND plz_from IN
   ('10315','10317','10318','10319','10365','10367','10369','13053','13055',
    '13057','13059');
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 11 THEN RAISE EXCEPTION 'Lichtenberg: expected 11, got %', n; END IF;

  UPDATE public.postal_code_rule SET social_office_id = '11000000-0000-0000-0000-000000000012'
   WHERE social_office_id = city AND plz_from IN
   ('13403','13405','13407','13409','13435','13437','13439','13465','13467',
    '13469','13503','13505','13507','13509');
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 14 THEN RAISE EXCEPTION 'Reinickendorf: expected 14, got %', n; END IF;

  RAISE NOTICE 'B2 applied: 169 rules repointed to their primary district (ids preserved, priority 1)';

  -- ── End-state asserts ──────────────────────────────────────────────────────
  SELECT count(*) INTO n FROM public.postal_code_rule
   WHERE social_office_id = city;
  IF n <> 0 THEN RAISE EXCEPTION 'end-state: city office still referenced by % rules', n; END IF;

  SELECT count(*) INTO n FROM public.postal_code_rule
   WHERE social_office_id = pankow AND priority = 20;
  IF n <> 21 THEN RAISE EXCEPTION 'end-state: Pankow prio-20 set changed (%)', n; END IF;

  SELECT count(*) INTO n FROM public.postal_code_rule
   WHERE social_office_id BETWEEN '11000000-0000-0000-0000-000000000002'
                              AND '11000000-0000-0000-0000-000000000012';
  IF n <> 169 THEN RAISE EXCEPTION 'end-state: expected 169 district rules, found %', n; END IF;

  SELECT count(*) INTO n FROM public.postal_code_rule;
  IF n <> 8159 THEN RAISE EXCEPTION 'end-state: expected 8159 total rules, found %', n; END IF;

  RAISE NOTICE 'Batch C Parts A/B complete: 0 rules on the city office, 21 Pankow + 169 district rules, 8159 total';
END $$;

COMMIT;
