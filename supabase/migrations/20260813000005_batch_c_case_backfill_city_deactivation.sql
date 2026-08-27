-- Batch C push 2 (C1 + C2), founder-approved D-5/D-6 2026-08-13.
-- SEQUENCING SATISFIED: ships only after push 1 (20260813000004, Parts A/B)
-- was applied AND live-verified on 2026-08-13 (post-push data checks ALL
-- PASS incl. customer 52e364f1 slot-set byte-identity at missing=0; live drives: 12619 ->
-- new MH office + fallback banner + suppressed suffix, 13187 -> Pankow own
-- list unchanged; record: docs/feedback/golive_round2_batch_c.md §VI).
--
-- C1 (D-5): backfill ALL cases parked on the city-level office (3 at the
-- time of writing: customer 52e364f1 -> Marzahn-Hellersdorf, berk -> Friedrichshain-
-- Kreuzberg, completion-fixture -> Mitte). ZERO user-visible effect — both
-- source and target offices hold zero document rules, so the fallback chain
-- (app_config default = Pankow set + banner, suffix suppressed) is
-- byte-identical from either side; re-proven at execution time on 2026-08-13
-- and re-guarded below. Two of the three cases are LOCKED (under_review) —
-- the founder ordered status_event audit rows documenting the administrative
-- write; we add one per backfilled case (append-only log, free-form
-- event_type, written via migrations/admin only per RLS design).
-- No new case can ever land on the city office again (push 1 left it with
-- zero PLZ rules), so the exact-set pre-assert below is stable; the one
-- benign exception is a completion.spec fixture re-seed, which would replace
-- case 461038b0 (post-push-1 it resolves 10115 -> Mitte on its own) and
-- trip the assert for a trivial re-derive.
--
-- C2 (D-6): deactivate the city-level office row — asserts run AFTER C1 in
-- this same file (founder: C1+C2 may ride one push in this order).
-- NEVER DELETE the row: the Berlin default questionnaire
-- 30000000-…-0001 (the D12 product default, verified active) FKs to it via
-- questionnaire.social_office_id. social_office.is_active is checked
-- NOWHERE in app code (verified 2026-08-13: the only is_active filter in
-- lib/dal.ts is on questionnaire) — this flip is bookkeeping hygiene, not
-- behavior.

BEGIN;

-- ── C1: backfill the 3 city-office cases, audit each ─────────────────────────
DO $$
DECLARE
  n integer;
  city constant uuid := '10000000-0000-0000-0000-000000000001';
  mh    constant uuid := '11000000-0000-0000-0000-000000000010';
  fk    constant uuid := '11000000-0000-0000-0000-000000000003';
  mitte constant uuid := '11000000-0000-0000-0000-000000000002';
BEGIN
  -- Exact-set pre-assert: exactly the 3 surveyed cases, else ABORT
  -- (drift means the census must be re-derived, not guessed around).
  SELECT count(*) INTO n FROM public.cases WHERE social_office_id = city;
  IF n <> 3 THEN RAISE EXCEPTION 'C1 blocked: expected 3 city-office cases, found %', n; END IF;
  SELECT count(*) INTO n FROM public.cases
   WHERE social_office_id = city
     AND id IN ('52e364f1-e27e-4e79-b455-55d658e1be95',
                'c8542a35-b5b1-4748-b054-a7a1914b2d62',
                '461038b0-8846-4194-bff9-043f2d76d6dd');
  IF n <> 3 THEN RAISE EXCEPTION 'C1 blocked: city-office case set drifted from the surveyed ids'; END IF;

  -- customer 52e364f1 (REAL, LOCKED under_review) -> Marzahn-Hellersdorf
  UPDATE public.cases SET social_office_id = mh
   WHERE id = '52e364f1-e27e-4e79-b455-55d658e1be95'
     AND plz_before_move = '12687' AND social_office_id = city;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'customer 52e364f1 backfill matched % rows', n; END IF;
  INSERT INTO public.status_event (case_id, event_type, payload) VALUES
    ('52e364f1-e27e-4e79-b455-55d658e1be95', 'social_office_backfilled',
     jsonb_build_object('from', city, 'to', mh, 'plz', '12687',
       'migration', '20260813000005_batch_c_c1',
       'note', 'administrative remap (Batch C D-5); display byte-identical — both offices rule-less, fallback chain unchanged; case locked'));

  -- berk (REAL, in_progress) -> Friedrichshain-Kreuzberg
  UPDATE public.cases SET social_office_id = fk
   WHERE id = 'c8542a35-b5b1-4748-b054-a7a1914b2d62'
     AND plz_before_move = '10245' AND social_office_id = city;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'berk backfill matched % rows', n; END IF;
  INSERT INTO public.status_event (case_id, event_type, payload) VALUES
    ('c8542a35-b5b1-4748-b054-a7a1914b2d62', 'social_office_backfilled',
     jsonb_build_object('from', city, 'to', fk, 'plz', '10245',
       'migration', '20260813000005_batch_c_c1',
       'note', 'administrative remap (Batch C D-5); display unchanged'));

  -- completion fixture (TEST, LOCKED under_review) -> Mitte
  UPDATE public.cases SET social_office_id = mitte
   WHERE id = '461038b0-8846-4194-bff9-043f2d76d6dd'
     AND plz_before_move = '10115' AND social_office_id = city;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'fixture backfill matched % rows', n; END IF;
  INSERT INTO public.status_event (case_id, event_type, payload) VALUES
    ('461038b0-8846-4194-bff9-043f2d76d6dd', 'social_office_backfilled',
     jsonb_build_object('from', city, 'to', mitte, 'plz', '10115',
       'migration', '20260813000005_batch_c_c1',
       'note', 'administrative remap (Batch C D-5); TEST fixture case'));

  SELECT count(*) INTO n FROM public.cases WHERE social_office_id = city;
  IF n <> 0 THEN RAISE EXCEPTION 'C1 end-state: % cases still on the city office', n; END IF;
  RAISE NOTICE 'C1 applied: 3 cases backfilled (customer 52e364f1->MH, berk->FK, fixture->Mitte), 3 audit rows, 0 cases remain on the city office';
END $$;

-- ── C2: deactivate the city-level row (asserts, not assumptions) ─────────────
DO $$
DECLARE
  n integer;
  city constant uuid := '10000000-0000-0000-0000-000000000001';
BEGIN
  SELECT count(*) INTO n FROM public.postal_code_rule WHERE social_office_id = city;
  IF n <> 0 THEN RAISE EXCEPTION 'C2 blocked: % PLZ rules still reference the city office', n; END IF;
  SELECT count(*) INTO n FROM public.cases WHERE social_office_id = city;
  IF n <> 0 THEN RAISE EXCEPTION 'C2 blocked: % cases still reference the city office', n; END IF;
  -- the D12 default questionnaire stays anchored here and stays active —
  -- assert it is untouched rather than silently assuming.
  IF NOT EXISTS (SELECT 1 FROM public.questionnaire
                 WHERE id = '30000000-0000-0000-0000-000000000001'
                   AND social_office_id = city AND is_active = true) THEN
    RAISE EXCEPTION 'C2 blocked: Berlin default questionnaire anchor is not in the expected state';
  END IF;
  UPDATE public.social_office SET is_active = false
   WHERE id = city AND is_active = true;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'C2: deactivation matched % rows', n; END IF;
  RAISE NOTICE 'C2 applied: city-level office deactivated (row preserved — questionnaire FK anchor; is_active is unread by app code)';
END $$;

COMMIT;
