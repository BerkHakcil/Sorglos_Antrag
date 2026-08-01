-- Content pass 4, Batch 3 — approved copy (D5 perspective + D12 partner
-- intros). Provenance: roman_package_pass4.md §1 + §2 proposals APPROVED AS
-- PROPOSED by Erman 2026-08-01; Roman review waived. Seeded
-- character-for-character from the approved package text.
--
-- D5 ("Sie/Ihr im Fragebogen meint die pflegebedürftige Person"): the three
-- surviving Berlin third-person prompts move to the second person, matching
-- the Essen wording family. The other two violations (hat_rente,
-- rentenbetrag) were retired by D15 — no statement needed. Essen was
-- re-verified clean immediately before this file was written.
--
-- D12: the three Essen spouse bulk intros that never named the partner now
-- mirror their applicant counterparts ("absetzbaren" drops with the founder's
-- approval — the applicant version never carried it).
-- spouse_applicant_bulk_topics already mirrored and is untouched.
--
-- Real-data impact: prompt_de only — display text, no answer rows, no
-- visibility rules, no option values (R4 untouched). Every UPDATE is guarded
-- by id + the exact live text verified at execution time; a replay or drift
-- makes the guard miss and the count assert abort.

DO $$
DECLARE
  n integer;
BEGIN
  -- ── D5: Berlin perspective (3 rows) ────────────────────────────────────────
  UPDATE public.question SET prompt_de = 'Wie lautet Ihr Vorname?'
  WHERE id = '60000000-0000-0000-0000-0000000000f1'
    AND prompt_de = 'Vorname der pflegebedürftigen Person';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'D5 first_name guard failed (%)', n; END IF;

  UPDATE public.question SET prompt_de = 'Wie lautet Ihr Nachname?'
  WHERE id = '60000000-0000-0000-0000-0000000000f2'
    AND prompt_de = 'Nachname der pflegebedürftigen Person';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'D5 last_name guard failed (%)', n; END IF;

  UPDATE public.question SET prompt_de = 'Wann wurden Sie geboren?'
  WHERE id = '60000000-0000-0000-0000-000000000002'
    AND prompt_de = 'Geburtsdatum der pflegebedürftigen Person';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'D5 geburtsdatum guard failed (%)', n; END IF;
  RAISE NOTICE 'D5 applied: three Berlin prompts now second-person';

  -- ── D12: Essen spouse bulk intros (3 rows) ─────────────────────────────────
  UPDATE public.question
  SET prompt_de = 'Trifft eine dieser besonderen Einkommens- oder Rentensituationen auf Ihren Partner zu?'
  WHERE id = '61000000-0000-0000-0000-0000000000f2'
    AND prompt_de = 'Treffen eine oder mehrere dieser besonderen Einkommens- oder Rentensituationen zu?';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'D12 spouse_income guard failed (%)', n; END IF;

  UPDATE public.question SET prompt_de = 'Hat Ihr Partner eine dieser Ausgaben?'
  WHERE id = '61000000-0000-0000-0000-0000000000f3'
    AND prompt_de = 'Gibt es eine oder mehrere dieser absetzbaren Ausgaben?';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'D12 spouse_expense guard failed (%)', n; END IF;

  UPDATE public.question SET prompt_de = 'Hat Ihr Partner eine dieser besonderen Vermögensarten?'
  WHERE id = '61000000-0000-0000-0000-0000000000f4'
    AND prompt_de = 'Gibt es eine oder mehrere dieser besonderen Vermögensarten?';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'D12 spouse_wealth guard failed (%)', n; END IF;
  RAISE NOTICE 'D12 applied: three Essen partner intros mirror the applicant wording';
END $$;
