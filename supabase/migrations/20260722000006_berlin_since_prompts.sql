-- Feedback pass item 6 — berlin_since / berlin_district_since reworded
-- (Roman-authored, verbatim). Rationale: Berlin serves as the universal
-- fallback questionnaire; Berlin-specific wording confuses non-Berlin users.

BEGIN;

UPDATE public.question
SET prompt_de = 'Seit wann haben Sie vor dem Einzug ins Pflegeheim in Ihrer letzten Stadt oder Gemeinde gewohnt?'
WHERE key = 'berlin_since'
  AND category_id IN (
    SELECT id FROM public.category
    WHERE questionnaire_id = '30000000-0000-0000-0000-000000000001'
  );

UPDATE public.question
SET prompt_de = 'Seit wann haben Sie vor dem Einzug ins Pflegeheim in diesem Stadtbezirk oder Landkreis gewohnt?'
WHERE key = 'berlin_district_since'
  AND category_id IN (
    SELECT id FROM public.category
    WHERE questionnaire_id = '30000000-0000-0000-0000-000000000001'
  );

COMMIT;
