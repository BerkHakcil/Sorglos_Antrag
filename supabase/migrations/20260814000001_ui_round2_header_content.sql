-- UI round 2 (Phase-1 report docs/feedback/ui_round2_phase1.md §6, GO
-- 2026-08-14): the three static_content rows the round's header and chat card
-- need. Batched into ONE push by founder instruction — R2-2 consumes the first
-- two, R2-3 the third; an unused row is inert, so shipping them together costs
-- nothing and saves a push.
--
-- PROVENANCE: all three are mockup-adopted German under the founder's copy
-- waiver — "approved by Erman 2026-08-14, Roman review waived" (decision D4).
-- They are FINAL COPY, not PLACEHOLDER_DE. Ledgered in
-- docs/document-rules/german_copy_for_roman.md.
--
-- Config table, zero user rows. Benign additive class (CLAUDE.md rule 8):
-- getStaticContent degrades a missing key to '' by design, and every consumer
-- ''-guards, so code-before-rows renders today's UI rather than an empty
-- scaffold. Migration-first is still the convention and the order used here.
-- ON CONFLICT DO NOTHING per the Essen-seed precedent — a replay never
-- clobbers later content edits.
--
-- NOT in this migration, deliberately:
--   * the Angaben header intro. F2 reuses Roman's EXISTING
--     'case.patient_banner_body' row verbatim rather than adopting the
--     mockup's near-identical sentence — his grammar wins and no row is added.
--   * the mockup's second Unterlagen sentence ("Vor der Einreichung fragen wir
--     Sie immer nach Ihrer Freigabe.") — F3: it promises an approval step the
--     product does not have.
--   * the docs.* vocabulary — F5: those rows keep Roman's "Dokumente" wording.

BEGIN;

INSERT INTO public.static_content (key, value_de) VALUES
  -- R2-2 (D3). Case-header title pattern. {first_name}/{last_name} are
  -- replaced at render time from the care recipient's answers; when either is
  -- unanswered the header falls back to the EXISTING 'case.subheading' row
  -- ("Mein Hilfe zur Pflege Antrag") verbatim, so no fallback row is needed.
  ('case.header_title_pattern',   'Antrag für {first_name} {last_name}'),
  -- R2-2 (D3). Intro line under the title on the Unterlagen tab. The Angaben
  -- tab reuses case.patient_banner_body instead (F2, see above).
  ('case.header_intro_documents', 'Laden Sie die Unterlagen hoch, die Ihnen bereits vorliegen. Wir prüfen alles und melden uns, falls etwas fehlt.'),
  -- R2-3. Autosave reassurance, rendered as a sage hint bubble at the top of
  -- the chat history. Static: the mockup hides it on scroll, which is demo
  -- behaviour we do not adopt.
  ('case.autosave_notice',        'Ihre Angaben werden automatisch gespeichert. Sie können jederzeit pausieren.')
ON CONFLICT (key) DO NOTHING;

DO $$
DECLARE
  n integer;
  pattern_ok boolean;
BEGIN
  SELECT count(*) INTO n FROM public.static_content
  WHERE key IN ('case.header_title_pattern', 'case.header_intro_documents',
                'case.autosave_notice')
    AND coalesce(value_de, '') <> '';
  IF n <> 3 THEN
    RAISE EXCEPTION 'UI round 2 content rows incomplete: % of 3 present and non-empty', n;
  END IF;

  -- The title pattern is consumed by a placeholder replace, so a row that lost
  -- its tokens would silently render the same literal string for every case.
  SELECT value_de LIKE '%{first_name}%' AND value_de LIKE '%{last_name}%'
    INTO pattern_ok
  FROM public.static_content WHERE key = 'case.header_title_pattern';
  IF NOT pattern_ok THEN
    RAISE EXCEPTION 'case.header_title_pattern must contain both {first_name} and {last_name}';
  END IF;

  RAISE NOTICE 'UI round 2 content present: 3 rows non-empty, title pattern carries both tokens';
END $$;

-- The fallback row this round depends on must exist, or an unanswered case
-- would render an empty header. It has been live since Tier 2 (2026-07-03);
-- asserted rather than assumed.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.static_content
    WHERE key = 'case.subheading' AND coalesce(value_de, '') <> ''
  ) THEN
    RAISE EXCEPTION 'case.subheading missing — the header fallback would render empty';
  END IF;
  RAISE NOTICE 'header fallback row case.subheading present';
END $$;

COMMIT;
