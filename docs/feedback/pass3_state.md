# Feedback Pass 3 — session state

> Resume protocol: if a session restarts, read this file first, then the pass
> brief; do not redo completed phases. Full findings:
> `feedback_pass3_triage.md`; German package: `roman_package_pass3.md`.

## Phase status

| Phase                           | Status             | Notes                                                                                                                                                                                                                                                                                                                                                                                |
| ------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A — read-only triage            | ✅ DONE 2026-07-30 | reports committed + pushed; Roman package extended per founder (item-1 pre-steps + product question, item-3 post-fix semantics, ss rows = confirm-only)                                                                                                                                                                                                                              |
| B — quick fixes (items 3/7/8/1) | ✅ DONE 2026-07-30 | migrations `20260730000001` + `20260730000002` pushed by founder and verified: live drive 11/11 (umlauted checklist names + no leftovers; B1 empty-Weiter completes birth_name, survives reload, `''` row in DB; rentenbetrag renders with NO Brutto text at step 27); verify-baseline full replay all 12 tables identical; documents-m6 e2e regression PASS; unit 138/138. B4 no-op |
| C — spouse Vollmacht (PAN-011)  | not started        | ⚠ needs `active` column on `office_document_rule` + dal.ts filter (no such column today); 0 uploads reference PAN-011                                                                                                                                                                                                                                                                |
| D — storage restructure         | not started        | folders need zero RLS changes (first-segment policies); numbering source of truth = DB count (design in D-1)                                                                                                                                                                                                                                                                         |
| E — UI restyle                  | not started        | ⚠ BLOCKER: mockup repo `romanpfeiffer85/Sorglos-product-ui-mockup` not accessible to gh account BerkHakcil — need invite/URL. Live-site tokens already extracted (triage §12)                                                                                                                                                                                                        |
| F — close-out                   | not started        |                                                                                                                                                                                                                                                                                                                                                                                      |

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

- 2026-07-30 GO PHASE B with adjustments: B3 = only the 4 mechanical rows (ss
  rows get NO migration, confirm-only to Roman); B1 = exactly the
  one-predicate design, skip semantics unchanged, tests must cover both
  Berlin optional questions; B4 confirmed no-op.
- 2026-07-30 Phase C amendments (apply after separate go): additive `active`
  column on `office_document_rule` (boolean NOT NULL DEFAULT true, backfill
  all 105, THEN flip PAN-011 false — order inside one migration is fine);
  filter `active = true` in every rule-loading site and cite each;
  re-run the PAN-011 upload-reference check against the THEN-current upload
  set before the migration (STOP if any real upload references it);
  regression unchanged (married Pankow fixture minus person_2 Vollmacht slot,
  rest byte-identical; Essen unchanged); verify-baseline must stay green.
- Roman package: item-1 explanation must state tabs appear once care home +
  PLZ are chosen and ASK whether he wants document visibility before the
  pre-steps (done, §3); item-3 post-fix semantics on record (done, §4).

## Phase B implementation record (pre-push)

- **B1 code:** `lib/questionnaire-nav.ts` — new `isAnsweredValue(isRequired,
rawValue)` used by both the group and regular branches: non-empty OR
  (optional AND row exists). 10 new unit tests in
  `tests/unit/questionnaire-engine.test.ts` ("optional completed-without-
  answer (B1)"): empty-Weiter completes, no re-surface on reload, progress
  consistency, skip-defers-unchanged, not_empty dependency unaffected,
  answered-then-cleared, required still blocks, power_of_attorney
  single_select shape, multi_select `[]`, group-member branch. Suite 138/138;
  typecheck/lint/format green.
- **B3 side effect:** `tests/fixtures/pankow-rules.snapshot.json` +
  `pankow-golden-slots.json` name_de/nameDe updated to the umlauted names so
  the committed live-mirror stays true post-push (e2e specs don't match on
  these names; `tests/unit/document-rules.test.ts`'s synthetic catalog
  deliberately untouched).

## Phase B verification evidence (2026-07-30, post-push)

- Migration-history note: during the push round, prod's
  `schema_migrations` was confirmed via `supabase migration list --linked` —
  `20260724000001` tracked (07-25), the two `20260730…` files applied in one
  round. An apparent "re-apply" of the Essen seed in the founder's terminal
  was old scrollback: Essen rows still carry 07-25 `created_at`, counts
  43/105, zero duplicate ids, ESS-031/047 subjects intact.
- Live drive (headless Playwright vs prod, throwaway user, deleted): 11/11 —
  B3 names umlauted + no transliterated leftovers on the checklist; B1
  empty-Weiter on `birth_name` advances to Nachname, survives reload, `''`
  answer row present; B2 `rentenbetrag` rendered (hat_rente=Ja path, step 27) with no "Brutto" text.
- verify-baseline FULL replay (docker + `supabase db reset`): **all 12 tables
  identical** to prod, including question 413 rows + catalog 43 with the new
  names.
- documents-m6 e2e (Pankow married regression): PASS all six criteria,
  cleanup complete (bucket prefix empty, test user deleted).
- Unit suite 138/138. All browser-drive throwaway users deleted (verified).

## Next step

Wait for founder "GO PHASE C" (spouse Vollmacht PAN-011 deactivation — see
the Phase C amendments above). Before writing the migration: re-run the
PAN-011 upload-reference check against the then-current upload set.
