-- Feedback pass item 1 — spouse-question leak (Berlin).
-- spouse_health_insurance_amount + spouse_care_insurance_amount had NO
-- visibility_rule (NULL) — shown to and required of every user regardless of
-- marital status. All six sibling spouse-insurance questions carry the 3-value
-- marital gate; these two get the identical rule.
--
-- Then: the leak was completion-blocking, so non-partnered users were forced
-- to answer them — those junk rows are deleted for cases whose marital_status
-- is not in the partner set (pre-push audit 2026-07-22: 4 rows across 2 real
-- cases, both captured by case:export snapshots first per the REAL-DATA RULE;
-- the one partnered case's rows are kept).

BEGIN;

UPDATE public.question
SET visibility_rule =
  '{"in_values": ["verheiratet", "eingetragene Lebenspartnerschaft", "eheähnliche Gemeinschaft"], "question_key": "marital_status"}'::jsonb
WHERE key IN ('spouse_health_insurance_amount', 'spouse_care_insurance_amount')
  AND category_id IN (
    SELECT id FROM public.category
    WHERE questionnaire_id = '30000000-0000-0000-0000-000000000001'
  );

DELETE FROM public.answer a
USING public.question q
WHERE a.question_id = q.id
  AND q.key IN ('spouse_health_insurance_amount', 'spouse_care_insurance_amount')
  AND q.category_id IN (
    SELECT id FROM public.category
    WHERE questionnaire_id = '30000000-0000-0000-0000-000000000001'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.answer ma
    JOIN public.question mq ON mq.id = ma.question_id
    WHERE ma.case_id = a.case_id
      AND mq.key = 'marital_status'
      AND mq.category_id IN (
        SELECT id FROM public.category
        WHERE questionnaire_id = '30000000-0000-0000-0000-000000000001'
      )
      AND (ma.value #>> '{}') IN
        ('verheiratet', 'eingetragene Lebenspartnerschaft', 'eheähnliche Gemeinschaft')
  );

COMMIT;
