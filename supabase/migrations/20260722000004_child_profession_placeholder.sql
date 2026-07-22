-- Feedback pass item 4 — child_profession input placeholder, both
-- questionnaires ("Kauffrau" -> broader examples). Key-global on purpose:
-- child_profession exists in Berlin + Essen (and would harmlessly cover the
-- deactivated fallback if it had one).

UPDATE public.question
SET validation = jsonb_set(
  COALESCE(validation, '{}'::jsonb),
  '{placeholder_de}',
  '"Pflegefachkraft, Rentner, etc."'::jsonb
)
WHERE key = 'child_profession';
