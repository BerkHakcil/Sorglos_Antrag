-- Content pass — Roman's answers (A+B), 2026-07-23.
--
-- A) Pankow PLZ expansion: Roman approved all 18 seeded PLZs and added three:
--    10247, 10249, 13051 (his reply listed 10247 twice — deduped; final set =
--    21 unique). Same pattern as the original 18: single-PLZ ranges at
--    priority 20, overriding the generic priority-1 rules for those PLZs.
--    NOTE: 10247/10249 are administratively Friedrichshain and 13051
--    Lichtenberg — included DELIBERATELY per Roman's routing policy
--    ("when in doubt, include"); not an error to "fix" later. Policy recorded
--    verbatim in docs/operations.md §7.
--
-- B) Grammar fix (Roman): spouse_bank_giro "sein Girokonto" -> "ein Girokonto"
--    (Berlin; the only question with the old wording).

BEGIN;

-- Id note: the 18 seeded Pankow rules use DECIMAL-style suffixes 01–18 (no
-- hex letters), so the continuation is 19/20/21 — the first push attempt with
-- hex-continuation 13/14/15 collided and applied nothing (BEGIN/COMMIT).
INSERT INTO public.postal_code_rule (id, social_office_id, plz_from, plz_to, priority) VALUES
  ('b0000000-0000-0000-0000-000000000019', '11000000-0000-0000-0000-000000000001', '10247', '10247', 20),
  ('b0000000-0000-0000-0000-000000000020', '11000000-0000-0000-0000-000000000001', '10249', '10249', 20),
  ('b0000000-0000-0000-0000-000000000021', '11000000-0000-0000-0000-000000000001', '13051', '13051', 20);

UPDATE public.question
SET prompt_de = 'Bei welcher Bank hat Ihr Partner ein Girokonto?'
WHERE key = 'spouse_bank_giro'
  AND prompt_de = 'Bei welcher Bank hat Ihr Partner sein Girokonto?';

COMMIT;
