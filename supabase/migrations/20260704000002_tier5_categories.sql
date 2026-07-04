-- Berlin content pass, Tier 5 — category restructuring.
--
-- Confirmed plan (Phase 1 flags A–F):
--  * New category 'wohnsituation' at sort_order 1 (right after antragsteller);
--    other categories renumbered to stay contiguous.
--  * Move last_residence_plz / _street / _city (from antragsteller) and
--    apartment_ownership (from einkommen) into 'wohnsituation' in that order.
--  * Rename category 'dokumente' -> 'kinder' IN PLACE (same id …0003). The 8
--    child_* questions and the 'children' question_group already point at …0003,
--    so they stay consistent — no reassignment/repoint needed (FLAG E).
--  * Delete the duplicate marital-status question 'familienstand' (…0003); it
--    controls nothing, so only its 9 pre-launch TEST answers cascade-delete.
--  * marital_status stays put at the front of antragsteller (FLAG A option b).
--  * No visibility_rule / validation / content changes. "Mietfrei" option is
--    intentionally NOT added here (FLAG F — stays Tier 7).
--
-- Idempotent (absolute renumber by key + upsert + absolute question moves).
-- Wohnsituation (so=1) sits before einkommen (so=2), so apartment_ownership stays
-- ahead of its 5 einkommen dependents in flow order.

BEGIN;

-- 1a. Rename 'dokumente' -> 'kinder' in place (keeps id …0003; group + questions follow).
UPDATE public.category
SET key = 'kinder', label_de = 'Kinder'
WHERE id = '40000000-0000-0000-0000-000000000003';

-- 1b. Create the 'wohnsituation' category (position set by the renumber below).
INSERT INTO public.category (id, questionnaire_id, key, sort_order, label_de)
VALUES ('40000000-0000-0000-0000-000000000009', '30000000-0000-0000-0000-000000000001',
        'wohnsituation', 1, 'Wohnsituation')
ON CONFLICT (id) DO NOTHING;

-- 1c. Absolute category order (contiguous 0..8), by key — idempotent.
UPDATE public.category
SET sort_order = CASE key
  WHEN 'antragsteller' THEN 0
  WHEN 'wohnsituation' THEN 1
  WHEN 'einkommen'     THEN 2
  WHEN 'kinder'        THEN 3
  WHEN 'income'        THEN 4
  WHEN 'expenditure'   THEN 5
  WHEN 'wealth'        THEN 6
  WHEN 'additional'    THEN 7
  WHEN 'spouse'        THEN 8
  ELSE sort_order
END
WHERE questionnaire_id = '30000000-0000-0000-0000-000000000001';

-- 2. Move residence + Mietverhältnis questions into 'wohnsituation'
--    (order: PLZ -> street -> city -> apartment_ownership).
UPDATE public.question SET category_id = '40000000-0000-0000-0000-000000000009', sort_order = 0 WHERE key = 'last_residence_plz';
UPDATE public.question SET category_id = '40000000-0000-0000-0000-000000000009', sort_order = 1 WHERE key = 'last_residence_street';
UPDATE public.question SET category_id = '40000000-0000-0000-0000-000000000009', sort_order = 2 WHERE key = 'last_residence_city';
UPDATE public.question SET category_id = '40000000-0000-0000-0000-000000000009', sort_order = 3 WHERE key = 'apartment_ownership';

-- 3. Delete the duplicate marital-status question (its 9 test answers cascade).
DELETE FROM public.question WHERE key = 'familienstand';

COMMIT;
