-- Bank docs pass, Item A (GATE 1 APPROVED 2026-08-29; impact report at the
-- top of docs/feedback/bank_docs_phase2.md — per-row before-states verified
-- live 2026-08-29 and re-asserted below).
--
-- Roman's ruling 2026-08-29: Pankow = 3 Monate (and the default/fallback,
-- which serves these same Pankow rows, = 3). Essen = 4 → ESS-010/011 are
-- deliberately NOT touched.
--
-- Exactly 2 rows change: PAN-005 and PAN-006 go period_months 4 -> 3, in
-- BOTH the column (the value runtime reads) and the condition jsonb's
-- seed-time mirror of the office master (kept in lockstep so the stored
-- copy cannot mislead a future reader; lib/document-rules.ts reads only the
-- column). Display-time label only — uploads attach by (rule_id,
-- instance_key) and stored filenames never carry the suffix.
--
-- GOVERNANCE (standing rule): a migration touching PAN rules re-reviews
-- app_config.fallback_excluded_rule_ids. Phase-1 outcome: no update needed
-- (the exclusion trio PAN-016/017/018 is untouched; neither edited rule is
-- excluded). The DO-block below re-proves that at push time and ABORTS on
-- any drift.
--
-- Push sequence: this migration FIRST, then the code deploy / e2e gate
-- (the suite asserts "(letzte 3 Monate)" on Pankow and fallback lists).

BEGIN;

-- ── Before-state guard: both rows must match the impact report exactly ──────
DO $$
DECLARE
  r RECORD;
BEGIN
  SELECT period_months, condition INTO r
  FROM public.office_document_rule WHERE id = 'PAN-005';
  IF r IS NULL THEN
    RAISE EXCEPTION 'PAN-005 not found — ABORT (impact report assumed it exists)';
  END IF;
  IF r.period_months IS DISTINCT FROM 4 THEN
    RAISE EXCEPTION 'PAN-005 period_months expected 4, got % — live state differs from the impact report, ABORT and re-review', r.period_months;
  END IF;
  IF (r.condition ->> 'period_months') IS DISTINCT FROM '4' THEN
    RAISE EXCEPTION 'PAN-005 condition jsonb period_months expected 4, got % — ABORT and re-review', r.condition ->> 'period_months';
  END IF;
  RAISE NOTICE 'PAN-005 before: period_months=%, condition=%', r.period_months, r.condition;

  SELECT period_months, condition INTO r
  FROM public.office_document_rule WHERE id = 'PAN-006';
  IF r IS NULL THEN
    RAISE EXCEPTION 'PAN-006 not found — ABORT (impact report assumed it exists)';
  END IF;
  IF r.period_months IS DISTINCT FROM 4 THEN
    RAISE EXCEPTION 'PAN-006 period_months expected 4, got % — live state differs from the impact report, ABORT and re-review', r.period_months;
  END IF;
  IF (r.condition #>> '{all,1,period_months}') IS DISTINCT FROM '4' THEN
    RAISE EXCEPTION 'PAN-006 condition jsonb all[1].period_months expected 4, got % — condition shape differs from the impact report, ABORT and re-review', r.condition #>> '{all,1,period_months}';
  END IF;
  RAISE NOTICE 'PAN-006 before: period_months=%, condition=%', r.period_months, r.condition;
END $$;

-- ── Governance re-review, re-proven at push time ────────────────────────────
DO $$
DECLARE
  excluded text[];
  default_office uuid;
  bad integer;
BEGIN
  SELECT (value #>> '{}')::uuid INTO default_office
  FROM public.app_config WHERE key = 'default_document_office_id';
  IF default_office IS NULL THEN
    RAISE EXCEPTION 'default_document_office_id missing — governance re-review cannot be proven, ABORT';
  END IF;

  SELECT array_agg(x) INTO excluded
  FROM jsonb_array_elements_text(
    (SELECT value FROM public.app_config WHERE key = 'fallback_excluded_rule_ids')
  ) AS t(x);
  IF excluded IS NULL THEN
    RAISE EXCEPTION 'fallback_excluded_rule_ids missing or empty — the Phase-1 re-review assumed [PAN-016,PAN-017,PAN-018]; ABORT and re-review manually';
  END IF;

  SELECT count(*) INTO bad
  FROM unnest(excluded) AS e(id)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.office_document_rule r
    WHERE r.id = e.id AND r.active = true AND r.social_office_id = default_office
  );
  IF bad > 0 THEN
    RAISE EXCEPTION '% excluded rule id(s) no longer exist active in the default office set — exclusion list has drifted, ABORT and re-review', bad;
  END IF;

  IF 'PAN-005' = ANY(excluded) OR 'PAN-006' = ANY(excluded) THEN
    RAISE EXCEPTION 'PAN-005/PAN-006 unexpectedly in the exclusion list — the Phase-1 re-review is invalid, ABORT';
  END IF;

  RAISE NOTICE 'governance re-review re-proven: exclusions % all active in default office %; PAN-005/006 not excluded — no list update needed', excluded, default_office;
END $$;

-- ── The 2-row change, value-guarded + asserted ──────────────────────────────
DO $$
DECLARE
  n integer;
BEGIN
  UPDATE public.office_document_rule
  SET period_months = 3,
      condition = jsonb_set(condition, '{period_months}', '3'::jsonb)
  WHERE id = 'PAN-005' AND period_months = 4;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN
    RAISE EXCEPTION 'PAN-005 update touched % rows (expected 1) — ABORT', n;
  END IF;

  UPDATE public.office_document_rule
  SET period_months = 3,
      condition = jsonb_set(condition, '{all,1,period_months}', '3'::jsonb)
  WHERE id = 'PAN-006' AND period_months = 4;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN
    RAISE EXCEPTION 'PAN-006 update touched % rows (expected 1) — ABORT', n;
  END IF;
END $$;

-- ── After-state assert + notices ────────────────────────────────────────────
DO $$
DECLARE
  r RECORD;
BEGIN
  SELECT period_months, condition INTO r
  FROM public.office_document_rule WHERE id = 'PAN-005';
  IF r.period_months IS DISTINCT FROM 3 OR (r.condition ->> 'period_months') IS DISTINCT FROM '3' THEN
    RAISE EXCEPTION 'PAN-005 after-state wrong: period_months=%, jsonb=% — ABORT', r.period_months, r.condition ->> 'period_months';
  END IF;
  RAISE NOTICE 'PAN-005 after: period_months=%, condition=%', r.period_months, r.condition;

  SELECT period_months, condition INTO r
  FROM public.office_document_rule WHERE id = 'PAN-006';
  IF r.period_months IS DISTINCT FROM 3 OR (r.condition #>> '{all,1,period_months}') IS DISTINCT FROM '3' THEN
    RAISE EXCEPTION 'PAN-006 after-state wrong: period_months=%, jsonb=% — ABORT', r.period_months, r.condition #>> '{all,1,period_months}';
  END IF;
  RAISE NOTICE 'PAN-006 after: period_months=%, condition=%', r.period_months, r.condition;

  -- Essen must be untouched (assert-only).
  IF EXISTS (
    SELECT 1 FROM public.office_document_rule
    WHERE id IN ('ESS-010', 'ESS-011') AND period_months IS DISTINCT FROM 4
  ) THEN
    RAISE EXCEPTION 'ESS-010/011 changed — this migration must not touch Essen, ABORT';
  END IF;
  RAISE NOTICE 'ESS-010/011 verified untouched (period_months=4)';
END $$;

COMMIT;
