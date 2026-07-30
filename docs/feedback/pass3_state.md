# Feedback Pass 3 — session state

> Resume protocol: if a session restarts, read this file first, then the pass
> brief; do not redo completed phases. Full findings:
> `feedback_pass3_triage.md`; German package: `roman_package_pass3.md`.

## Phase status

| Phase | Status | Notes |
| ----- | ------ | ----- |
| A — read-only triage | ✅ DONE 2026-07-30 | reports committed; STOP — awaiting "GO PHASE B" |
| B — quick fixes (items 3/7/8/1) | not started | designs approved-ready in triage §3/§7/§8; B4 = no-op (item 1 not regressed) |
| C — spouse Vollmacht (PAN-011) | not started | ⚠ needs `active` column on `office_document_rule` + dal.ts filter (no such column today); 0 uploads reference PAN-011 |
| D — storage restructure | not started | folders need zero RLS changes (first-segment policies); numbering source of truth = DB count (design in D-1) |
| E — UI restyle | not started | ⚠ BLOCKER: mockup repo `romanpfeiffer85/Sorglos-product-ui-mockup` not accessible to gh account BerkHakcil — need invite/URL. Live-site tokens already extracted (triage §12) |
| F — close-out | not started | |

## Key Phase-A facts (so later phases need not re-derive)

- **Item 3:** empty "Weiter" on optional questions SAVES `''` (server accepts);
  only `isAnswered` in `lib/questionnaire-nav.ts` refuses `''`. Fix = for
  `is_required=false`: `isAnswered = rawValue !== undefined`. Affected:
  Berlin `birth_name` + `power_of_attorney` only (Essen has zero optional
  questions; Essen's `birth_name` is REQUIRED — flagged to Roman).
- **Item 7:** Berlin `rentenbetrag` (id `60000000-0000-0000-0000-000000000005`)
  `help_de` = "Bitte geben Sie den Bruttobetrag aus dem aktuellen
  Rentenbescheid an." → SET NULL. Essen `*_amount_gross` prompts are NOT
  targets (dedicated gross questions from the master).
- **Item 8:** catalog fixes = DOC-0003 Kontoauszüge, DOC-0011
  Mobilitätsnachweis, DOC-0021 …Spätaussiedler…, DOC-0025
  Mietkündigungsnachweis. ss rows (DOC-0005/0017/0021) untouched → Roman.
  Question/option labels clean.
- **Item 5:** source = rule row **PAN-011** (DOC-0006, person_2, mandatory,
  4-value marital any). No uploads bind it. Essen = ESS-012 person_1 only.
- **Item 9 (Roman input only):** `hat_rente`/`rentenbetrag` Berlin-only; zero
  doc rules / zero other visibility rules / zero app-code readers; pension
  group NOT gated on it; per-entry amounts exist. Removal would put Berlin
  fresh denominator 53 → 51 and touch tests: `visibility.spec.ts` (V1 built on
  the pair!), `documents-m6` driver ("only yes_no"), fixtures,
  verify-baseline key list.
- **Uploads/storage (items 10/11):** now **14** metadata rows across 5 cases
  (was "6" when the brief was written; grew 07-29/07-30 — all real, all
  grandfathered). Storage 1:1, no orphans. Path scheme
  `{case_id}/{uuid}.{ext}`; original filename lives in
  `document_upload.original_filename`. Bucket private, 60s signed URLs,
  never persisted. Storage RLS keys on first path segment only → nested
  category folders need no policy change.
- **Mockup tokens** (from live site): Lato; petrol #245b5a primary, copper
  #c44f15 CTA (#a34111 hover), sage #a9bfae/#cbd8ce, cream #f7f4ed/#efeadd,
  graphite #2c2f32/#5c6166, border #e6e0d0, radius .875rem (cards 18px).
  Routes `/` (Angaben) + `/unterlagen`. No mockup counterpart for: auth
  screens, pre-steps, locked state, group prompts, patient banner.
- Throwaway test user created + deleted during A1/A3 verification (prod clean).

## Decisions received from the founder

- (none yet beyond the pass brief D1–D7)

## Next step

Wait for founder "GO PHASE B", then implement B1 (engine fix + unit tests),
B2/B3 (copy migrations + Real-Data reports), B4 no-op; STOP before push with
migration filenames.
