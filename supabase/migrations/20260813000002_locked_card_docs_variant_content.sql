-- Go-live round 2, item 3 (Phase-1 report docs/feedback/golive_round2.md,
-- GO 2026-08-13): four static_content rows for the docs-aware locked-card
-- variant (missing > 0 -> variant heading/body + "Zu den Dokumenten" button +
-- prefixed upload step; missing == 0 -> today's card byte-identical).
--
-- ALL FOUR TEXTS ARE PLACEHOLDER_DE — proposed wording shipped so the feature
-- is live, ledgered in docs/document-rules/german_copy_for_roman.md and sent
-- to Roman in the round-2 package; his rewording (if any) lands as value-
-- guarded UPDATE migrations per the ledger convention.
--
-- Config table, zero user rows. Benign additive class (rule 8): the code's
-- variant condition requires non-empty heading+body, so code-before-rows just
-- keeps today's card (same ''-degradation contract as docs.fallback_notice).
-- ON CONFLICT DO NOTHING per the Essen-seed precedent — a replay never
-- clobbers later content edits.

BEGIN;

INSERT INTO public.static_content (key, value_de) VALUES
  -- Variant heading + body (PLACEHOLDER_DE)
  ('case.locked_docs_heading', 'Es fehlen noch Unterlagen'),
  ('case.locked_docs_body',    'Sie haben alle Fragen beantwortet — vielen Dank. Damit wir Ihren Antrag prüfen können, laden Sie bitte noch die fehlenden Unterlagen hoch.'),
  -- Petrol button label (PLACEHOLDER_DE; wording per the decided direction)
  ('case.locked_docs_button',  'Zu den Dokumenten'),
  -- Upload step, rendered as step 1 before case.next_steps_1..3 (PLACEHOLDER_DE)
  ('case.next_steps_upload',   'Sie laden die noch fehlenden Unterlagen hoch.')
ON CONFLICT (key) DO NOTHING;

DO $$
DECLARE
  n integer;
BEGIN
  SELECT count(*) INTO n FROM public.static_content
  WHERE key IN ('case.locked_docs_heading', 'case.locked_docs_body',
                'case.locked_docs_button', 'case.next_steps_upload')
    AND coalesce(value_de, '') <> '';
  IF n <> 4 THEN
    RAISE EXCEPTION 'item 3 content rows incomplete: % of 4 present and non-empty', n;
  END IF;
  RAISE NOTICE 'item 3 content present: 4 locked-docs variant rows non-empty';
END $$;

COMMIT;
