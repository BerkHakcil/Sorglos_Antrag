-- Mobile round 3 (GATE 1 APPROVED 2026-08-27, gate answer 3 + amendment):
-- the ONE data change of the round. UPDATEs the docs-page intro row to the
-- founder's R10 sentence, verbatim. Roman's type/size information from the
-- old value is NOT lost: it moved into code as the smaller secondary line
-- (lib/strings/de.ts, case.docs.typesLine), character-for-character —
-- ledgered in docs/document-rules/german_copy_for_roman.md.
--
-- Impact report (written BEFORE this file, per the amendment):
-- docs/feedback/mobile_round3_phase2.md — exactly ONE row of the config
-- table public.static_content; no schema change; no user data; no other
-- DB writes in this round (case.patient_banner_body and contact.phone are
-- deliberately untouched, gate answers 2 and 4).
--
-- Benign-row class (CLAUDE.md #8): the consuming code renders whatever the
-- row holds, so code-before-push shows the OLD intro plus the new secondary
-- line (the type/size info twice — cosmetic); the push closes that window.
--
-- THE FOUNDER RUNS THIS via `supabase db push` from the repo root.

BEGIN;

DO $$
DECLARE
  current_value text;
BEGIN
  SELECT value_de INTO current_value
  FROM public.static_content
  WHERE key = 'docs.area_intro';

  IF current_value IS NULL THEN
    RAISE EXCEPTION 'docs.area_intro row missing or NULL — it was seeded by 20260711000005; investigate before pushing';
  END IF;

  -- The impact report promises exactly this before-state. If the live value
  -- has drifted (e.g. a manual content edit since 2026-08-27), STOP: the
  -- impact report must be re-reviewed against the live value — this
  -- migration never overwrites an unexpected value blind.
  IF current_value <> 'Bitte laden Sie die folgenden Unterlagen hoch. Erlaubt sind PDF, JPG, PNG und HEIC bis 15 MB pro Datei.' THEN
    RAISE EXCEPTION 'docs.area_intro live value differs from the impact report before-state — ABORT and re-review. Live value: %', current_value;
  END IF;

  RAISE NOTICE 'docs.area_intro before: %', current_value;
END $$;

UPDATE public.static_content
SET value_de = 'PDFs, Fotos und mehrere Dateien pro Unterlage sind möglich. Vor der Einreichung prüfen wir alle Ihre Unterlagen.'
WHERE key = 'docs.area_intro';

DO $$
DECLARE
  new_value text;
BEGIN
  SELECT value_de INTO new_value
  FROM public.static_content
  WHERE key = 'docs.area_intro';

  IF new_value <> 'PDFs, Fotos und mehrere Dateien pro Unterlage sind möglich. Vor der Einreichung prüfen wir alle Ihre Unterlagen.' THEN
    RAISE EXCEPTION 'docs.area_intro update did not stick — value now: %', new_value;
  END IF;

  RAISE NOTICE 'docs.area_intro after: %', new_value;
  RAISE NOTICE 'mobile round 3 R10 content change complete (1 row)';
END $$;

COMMIT;
