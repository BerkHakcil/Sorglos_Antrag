-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: 20260809000001_docs_fallback_notice
-- Go-live: out-of-coverage banner text for the document checklist.
--
-- Cases served by the DEFAULT-OFFICE fallback branch (dal.ts getDocumentData:
-- the resolved office has no rules, or no office resolved at all) show this
-- notice above the checklist. Cases whose own office has rules (Pankow, Essen)
-- never render it — the trigger is rulesSource = 'fallback', carried by the
-- same query result the checklist already uses.
--
-- ⚠ PLACEHOLDER_DE — developer-authored German, logged for Roman in
-- docs/document-rules/german_copy_for_roman.md. A rewording is a one-line
-- UPDATE migration.
--
-- Real-data impact: static_content is a config table — zero user rows are
-- touched. Additive row only (missing key degrades to '' → no banner), so
-- this is CLAUDE.md rule #8's benign row-add case; it still ships before the
-- dependent code deploy per the standing founder-push protocol.
-- ─────────────────────────────────────────────────────────────────────────────

-- ON CONFLICT DO NOTHING: post-launch edits to this row go through their own
-- UPDATE migrations (Essen-seed precedent) — a replay never clobbers them.
INSERT INTO public.static_content (key, value_de) VALUES
  ('docs.fallback_notice', 'Hinweis: Für Ihre Postleitzahl liegt uns noch keine spezifische Dokumentenliste vor. Diese Übersicht zeigt die üblicherweise benötigten Unterlagen — Ihr zuständiges Sozialamt kann zusätzliche oder abweichende Dokumente verlangen.')
ON CONFLICT (key) DO NOTHING;

DO $$
DECLARE
  n integer;
BEGIN
  SELECT count(*) INTO n FROM public.static_content
  WHERE key = 'docs.fallback_notice' AND length(value_de) > 0;
  IF n <> 1 THEN
    RAISE EXCEPTION 'fallback-notice post-check failed: expected 1 non-empty row, found %', n;
  END IF;
  RAISE NOTICE 'docs.fallback_notice present and non-empty';
END $$;
