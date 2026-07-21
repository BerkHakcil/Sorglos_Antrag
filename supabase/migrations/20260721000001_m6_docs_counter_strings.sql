-- M6 — missing-documents counter strings (document-area header).
-- Constructed German — ALL THREE pending Roman review.
-- {n} is replaced client-side with the number of required slots that have
-- zero uploads; the singular string is used when exactly one is missing.

BEGIN;

INSERT INTO public.static_content (key, value_de) VALUES
  ('docs.missing_count',     'Es fehlen noch {n} Dokumente.'),
  ('docs.missing_count_one', 'Es fehlt noch 1 Dokument.'),
  ('docs.all_uploaded',      'Alle erforderlichen Dokumente sind hochgeladen.')
ON CONFLICT (key) DO UPDATE SET value_de = EXCLUDED.value_de, updated_at = NOW();

COMMIT;
