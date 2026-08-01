-- Content pass 4, Batch 1 — copy layer (D1, D2, D3, D11).
--
-- D1: the all-answered and locked states carried byte-identical German since
--     FP2 (co-founder's interim choice, flagged in E-6, decided by Roman
--     2026-07-31). The four rows get his approved distinct copy, verbatim.
-- D2: "Nächste Schritte" 3-step list for the LOCKED state (placement decided
--     2026-08-01: locked only). Bullets are Roman-verbatim; the heading is
--     PLACEHOLDER_DE pending his nod (asked in roman_package_pass4.md §4).
-- D3: document tab visible from first login; before the PLZ is known the tab
--     shows Roman's placeholder text, verbatim.
-- D11: Ansprechpartner contact card (header Hilfe sheet). Name/phone/email
--     are Roman-approved data; card label + button word are PLACEHOLDER_DE
--     (roman_package_pass4.md §4). Stored as content so Roman can edit
--     without a deploy.
-- D10 rider: the per-office bank-statement period renders as a suffix built
--     from office_document_rule.period_months at render time; the template
--     lives here as data ({n} replaced in code), derived from Roman's
--     approved example "Kontoauszüge – Girokonto (letzte 4 Monate)".
--
-- Real-data impact: static_content is a config table — zero user rows are
-- touched. Missing rows degrade to '' in the app (M6 precedent), so the
-- deploy order is safe in both directions; migration still goes first (R8/R9
-- discipline). Each UPDATE is value-guarded; a replay on already-migrated
-- data is a no-op and drift surfaces in verify-baseline instead of being
-- silently overwritten.

-- ── D1 pre-state guard: the four rows still carry the known identical copy ──
DO $$
DECLARE
  n integer;
BEGIN
  SELECT count(*) INTO n
  FROM public.static_content
  WHERE (key IN ('case.all_answered_heading', 'case.locked_heading')
         AND value_de = 'Sie haben alle Fragen beantwortet!')
     OR (key IN ('case.all_answered_message', 'case.locked_body')
         AND value_de = 'Wir prüfen nun alle Ihre Angaben und übertragen diese in das Antragsformular. Sofern Dinge unklar sind, melden wir uns bei Ihnen.');
  IF n <> 4 THEN
    RAISE EXCEPTION 'D1 guard failed: expected the 4 known byte-identical rows, found %', n;
  END IF;
  RAISE NOTICE 'D1 guard passed: 4 rows carry the known identical copy';
END $$;

-- ── D1: distinct copy per state (Roman-verbatim) ─────────────────────────────
UPDATE public.static_content
SET value_de = 'Alle Fragen beantwortet', updated_at = now()
WHERE key = 'case.all_answered_heading'
  AND value_de = 'Sie haben alle Fragen beantwortet!';

UPDATE public.static_content
SET value_de = 'Sie haben alle Fragen beantwortet. Bitte laden Sie noch fehlende Unterlagen hoch — danach prüfen wir Ihre Angaben.', updated_at = now()
WHERE key = 'case.all_answered_message';

UPDATE public.static_content
SET value_de = 'Ihr Antrag wird geprüft', updated_at = now()
WHERE key = 'case.locked_heading'
  AND value_de = 'Sie haben alle Fragen beantwortet!';

UPDATE public.static_content
SET value_de = 'Wir prüfen Ihre Angaben und Unterlagen. Sie müssen nichts weiter tun — wir melden uns bei Ihnen.', updated_at = now()
WHERE key = 'case.locked_body';

DO $$
DECLARE
  n integer;
BEGIN
  SELECT count(*) INTO n
  FROM public.static_content
  WHERE (key = 'case.all_answered_heading' AND value_de = 'Alle Fragen beantwortet')
     OR (key = 'case.all_answered_message' AND value_de = 'Sie haben alle Fragen beantwortet. Bitte laden Sie noch fehlende Unterlagen hoch — danach prüfen wir Ihre Angaben.')
     OR (key = 'case.locked_heading' AND value_de = 'Ihr Antrag wird geprüft')
     OR (key = 'case.locked_body' AND value_de = 'Wir prüfen Ihre Angaben und Unterlagen. Sie müssen nichts weiter tun — wir melden uns bei Ihnen.');
  IF n <> 4 THEN
    RAISE EXCEPTION 'D1 post-check failed: expected 4 updated rows, found %', n;
  END IF;
  RAISE NOTICE 'D1 applied: all-answered and locked copy are now distinct';
END $$;

-- ── D2 / D3 / D11 / D10 rider: new rows ──────────────────────────────────────
-- ON CONFLICT DO NOTHING: post-launch edits to these rows go through their own
-- UPDATE migrations (Essen-seed precedent) — a replay never clobbers them.
INSERT INTO public.static_content (key, value_de) VALUES
  -- D3 (Roman-verbatim)
  ('docs.placeholder_needs_plz', 'Bitte geben Sie zuerst die Postleitzahl des letzten Wohnortes an, dann können wir Ihnen anzeigen welche Dokumente benötigt werden.'),
  -- D2 bullets (Roman-verbatim); heading PLACEHOLDER_DE
  ('case.next_steps_heading', 'Nächste Schritte'),
  ('case.next_steps_1', 'Wir prüfen Ihre Angaben und Unterlagen.'),
  ('case.next_steps_2', 'Sie erhalten den vorbereiteten Antrag zur Unterschrift.'),
  ('case.next_steps_3', 'Danach kann der Antrag eingereicht werden.'),
  -- D11 contact data (Roman-approved); labels PLACEHOLDER_DE
  ('contact.name', 'Roman Pfeiffer'),
  ('contact.phone', '0159 0469 5761'),
  ('contact.email', 'roman.pfeiffer@sorglosantrag.de'),
  ('contact.card_label', 'Ihr Ansprechpartner'),
  ('contact.help_button', 'Hilfe'),
  -- D10 suffix template ({n} replaced at render time; from Roman's example)
  ('docs.period_suffix', '(letzte {n} Monate)')
ON CONFLICT (key) DO NOTHING;

DO $$
DECLARE
  n integer;
BEGIN
  SELECT count(*) INTO n FROM public.static_content WHERE key IN (
    'docs.placeholder_needs_plz', 'docs.period_suffix',
    'case.next_steps_heading', 'case.next_steps_1', 'case.next_steps_2', 'case.next_steps_3',
    'contact.name', 'contact.phone', 'contact.email', 'contact.card_label', 'contact.help_button'
  );
  IF n <> 11 THEN
    RAISE EXCEPTION 'Batch-1 insert post-check failed: expected 11 rows, found %', n;
  END IF;
  RAISE NOTICE 'Batch-1 copy rows present: 11/11';
END $$;
