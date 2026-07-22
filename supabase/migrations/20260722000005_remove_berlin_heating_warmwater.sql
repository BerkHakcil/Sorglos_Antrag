-- Feedback pass item 5 — remove Berlin rent_heating + rent_warm_water
-- (prompts "Wie hoch waren Ihre monatlichen Heizkosten?" / "…Warmwasserkosten?").
-- Pre-push audit 2026-07-22 (REAL-DATA RULE): zero visibility dependents;
-- 3 answers each across 3 cases, ALL REAL accounts — all three cases were
-- snapshotted with case:export BEFORE this migration (snapshot-first
-- precedent). Founders approved deletion incl. those 6 answer rows (cascade).
-- Denominator impact: Berlin fresh 57 -> 53 / married 94 -> 92 (combined with
-- 20260722000001, which gates two always-visible spouse questions).

DELETE FROM public.question
WHERE key IN ('rent_heating', 'rent_warm_water')
  AND category_id IN (
    SELECT id FROM public.category
    WHERE questionnaire_id = '30000000-0000-0000-0000-000000000001'
  );
