-- Feedback pass 3, item 11 (Phase D, commit A) — storage restructure, SCHEMA ONLY.
--
-- Adds:
--   1. document_catalog.storage_category  — which of Roman's folders a document
--      type belongs to. FOUR values only: Personal | Housing | Financial |
--      Insurance. "Spouse" is deliberately NOT a catalog value — the same
--      Personaldokument is Personal for the applicant and Spouse for the
--      partner, so the Spouse folder is produced exclusively by the
--      person_2 override at upload time (design §4).
--   2. document_filename_seq — the transactional source of truth for the
--      per-file counter n in {case_id}/{Folder}/{Base}{n}.{ext}.
--
-- NO application code reads either object yet: per CLAUDE.md rule #8 the code
-- deploy (commit B) is held until this migration is applied and verified on
-- prod. Old code selects * and ignores unknown columns, so the window between
-- this push and commit B is behaviourally inert.
--
-- REAL-DATA REPORT (R2):
--   * document_catalog: 43 UPDATEs — config/content rows authored by us.
--   * ZERO user-owned rows read or written. document_upload (14 real rows) is
--     not touched; NO storage object is moved, renamed or deleted. The 14
--     existing files keep their {case_id}/{uuid}.{ext} keys forever
--     (grandfathered, pass-brief D5) because every consumer resolves the
--     STORED storage_path and nothing recomputes a path.
--   * document_filename_seq is created empty.
--   * No case:export snapshots required — nothing destructive to case data.
--
-- Category assignment is FORWARD-ONLY: changing a document's
-- storage_category later moves only FUTURE uploads; files already stored keep
-- their path (and their counter continues in the old folder's scope).
--
-- Founder-approved amendments applied here (2026-07-30):
--   * DOC-0008 Bisherige Heimrechnungen: Housing -> **Financial** (Roman's
--     definition lists invoices under Financial). Deliberate split: the
--     Heimvertrag (DOC-0007) stays Housing — contract vs invoice.
--     NOTE: the catalog holds exactly ONE Heimrechnungen row (DOC-0008);
--     there is no separate "Heimrechnung" document type to flip.
--   * DOC-0005 Leistungsbescheid Pflegekasse -> Insurance (as proposed).
--   * DOC-0030 Nachweis Immobilienwert -> Housing (as proposed, consistent
--     with DOC-0038 Eigentumsnachweis which Roman's own Essen file
--     categorised `housing`).
--   * DOC-0015 Bestattungsvorsorgevertrag stays Insurance.
--   * DOC-0016 Sterbeurkunde Partner stays Personal — its rule subject is
--     person_1, so it must never land in Spouse/.

BEGIN;

-- ── 1. catalog column (nullable first, so the backfill can run) ─────────────
ALTER TABLE public.document_catalog
  ADD COLUMN IF NOT EXISTS storage_category TEXT;

-- ── 2. backfill — all 43 rows, partitioned exactly once ────────────────────
UPDATE public.document_catalog SET storage_category = 'Personal'
 WHERE id IN ('DOC-0001','DOC-0004','DOC-0006','DOC-0009','DOC-0011','DOC-0016',
              'DOC-0017','DOC-0018','DOC-0021','DOC-0022','DOC-0043');

UPDATE public.document_catalog SET storage_category = 'Housing'
 WHERE id IN ('DOC-0007','DOC-0010','DOC-0024','DOC-0025','DOC-0030','DOC-0038',
              'DOC-0042');

UPDATE public.document_catalog SET storage_category = 'Financial'
 WHERE id IN ('DOC-0002','DOC-0003','DOC-0008','DOC-0020','DOC-0023','DOC-0026',
              'DOC-0028','DOC-0029','DOC-0031','DOC-0032','DOC-0033','DOC-0034',
              'DOC-0035','DOC-0037','DOC-0040','DOC-0041');

UPDATE public.document_catalog SET storage_category = 'Insurance'
 WHERE id IN ('DOC-0005','DOC-0012','DOC-0013','DOC-0014','DOC-0015','DOC-0019',
              'DOC-0027','DOC-0036','DOC-0039');

-- ── 3. verify the backfill BEFORE constraining the column ──────────────────
DO $$
DECLARE
  total     INTEGER;
  unmapped  INTEGER;
  n_personal  INTEGER;
  n_housing   INTEGER;
  n_financial INTEGER;
  n_insurance INTEGER;
BEGIN
  SELECT COUNT(*),
         COUNT(*) FILTER (WHERE storage_category IS NULL),
         COUNT(*) FILTER (WHERE storage_category = 'Personal'),
         COUNT(*) FILTER (WHERE storage_category = 'Housing'),
         COUNT(*) FILTER (WHERE storage_category = 'Financial'),
         COUNT(*) FILTER (WHERE storage_category = 'Insurance')
    INTO total, unmapped, n_personal, n_housing, n_financial, n_insurance
    FROM public.document_catalog;

  IF total <> 43 THEN
    RAISE EXCEPTION 'Unexpected catalog size %: expected 43', total;
  END IF;
  IF unmapped <> 0 THEN
    RAISE EXCEPTION '% catalog rows have no storage_category', unmapped;
  END IF;
  IF (n_personal, n_housing, n_financial, n_insurance) <> (11, 7, 16, 9) THEN
    RAISE EXCEPTION
      'Category distribution %/%/%/% does not match the approved 11/7/16/9',
      n_personal, n_housing, n_financial, n_insurance;
  END IF;

  RAISE NOTICE 'storage_category backfilled: Personal %, Housing %, Financial %, Insurance %',
    n_personal, n_housing, n_financial, n_insurance;
END $$;

-- ── 4. constrain ───────────────────────────────────────────────────────────
ALTER TABLE public.document_catalog
  ALTER COLUMN storage_category SET NOT NULL;

ALTER TABLE public.document_catalog
  DROP CONSTRAINT IF EXISTS document_catalog_storage_category_check;
ALTER TABLE public.document_catalog
  ADD CONSTRAINT document_catalog_storage_category_check
  CHECK (storage_category IN ('Personal','Housing','Financial','Insurance'));

-- ── 5. filename counter ────────────────────────────────────────────────────
-- Allocation (commit B) is ONE atomic statement, so two concurrent uploads to
-- the same scope get distinct numbers without a retry loop:
--   INSERT ... VALUES (case, folder, base, 1)
--   ON CONFLICT (case_id, folder, base)
--   DO UPDATE SET last_n = document_filename_seq.last_n + 1 RETURNING last_n;
-- The counter only ever INCREMENTS: deleting an upload deliberately does not
-- decrement it, so a number is never reused (n = max over everything ever
-- created for the scope). Scope includes the folder, so
-- Personal/Personaldokument1 and Spouse/Personaldokument1 coexist.
--
-- The case_id FK is ON DELETE CASCADE because counter rows are case-scoped
-- metadata and are GDPR-relevant: they must die with the case (runbook
-- docs/operations.md §4).
CREATE TABLE IF NOT EXISTS public.document_filename_seq (
  case_id UUID    NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  folder  TEXT    NOT NULL,
  base    TEXT    NOT NULL,
  last_n  INTEGER NOT NULL,
  PRIMARY KEY (case_id, folder, base)
);

-- Server-only table: RLS enabled with NO policies, so anon/authenticated get
-- nothing and only the service-role client (used after the ownCase() check,
-- the same pattern as status_event writes) can allocate.
ALTER TABLE public.document_filename_seq ENABLE ROW LEVEL SECURITY;

COMMIT;
