# Feedback Pass 3 — session state

> Resume protocol: if a session restarts, read this file first, then the pass
> brief; do not redo completed phases. Full findings:
> `feedback_pass3_triage.md`; German package: `roman_package_pass3.md`.

## Phase status

| Phase                           | Status                                                          | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ------------------------------- | --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A — read-only triage            | ✅ DONE 2026-07-30                                              | reports committed + pushed; Roman package extended per founder (item-1 pre-steps + product question, item-3 post-fix semantics, ss rows = confirm-only)                                                                                                                                                                                                                                                                                                                                      |
| B — quick fixes (items 3/7/8/1) | ✅ DONE 2026-07-30                                              | migrations `20260730000001` + `20260730000002` pushed by founder and verified: live drive 11/11 (umlauted checklist names + no leftovers; B1 empty-Weiter completes birth_name, survives reload, `''` row in DB; rentenbetrag renders with NO Brutto text at step 27); verify-baseline full replay all 12 tables identical; documents-m6 e2e regression PASS; unit 138/138. B4 no-op                                                                                                         |
| C — spouse Vollmacht (PAN-011)  | ✅ DONE 2026-07-30                                              | migration `20260730000003` pushed and verified. Data level: 105 rows, exactly PAN-011 inactive, Pankow active 49 / Essen 55, no upload references it. Live: married Pankow checklist 13 slots with partner section but NO Vollmacht (exactly 1 overall, person_1); Essen 7 slots with its own rules — both non-empty, proving the active-filter queries work against the new column in prod. unit 143/143, documents-m6 PASS, verify-baseline all 12 tables identical (incl. the new column) |
| D — storage restructure         | ✅ DONE 2026-07-30                                              | migration `20260730000004` (commit A `96ab5d8`) pushed + verified, then code (commit B `d1c9f92`) — rule #8 order honoured. New uploads land at `{case}/{Folder}/{Base}{n}.{ext}`; the 14 existing files are grandfathered and still download. Live verified 15/15 incl. Spouse override, hostile bank name, legacy-file download, export naming and counter cascade. unit 193/193, documents-m6 PASS, verify-baseline identical with `storage_category` in the guard                        |
| E — UI restyle                  | ✅ **COMPLETE at E-7** — all seven sub-phases merged 2026-07-31 | E-0 `72d7b0f` · E-1 `8a74f69` · E-2 `6d19dbe` · E-3 `eac7a65` · E-4 `36a765d` · E-5 `6f1de39` · E-6 `0249c44` · E-7 `b5e1a2f` — each preview-approved then prod-verified (E-7 prod checks: 44px buttons/selects at 375px, loading spinner seen, /404 serves the new page, phone country select has its own ring). **E-8 deferred entirely** — backlog below                                                                                                                                  |
| F — close-out                   | ✅ DONE 2026-07-31 — **PASS CLOSED**                            | milestone-log entry with the 12-item disposition table + four corrected false records; Roman package headed by `ui-gallery/INDEX.md` (14-item ledger); backlog carried below                                                                                                                                                                                                                                                                                                                 |

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
- **Mockup tokens** — live-site extraction **confirmed exact against the
  repo source** (`src/styles.css`), zero discrepancies: Lato; petrol
  #245B5A/#2f7371, copper #C44F15/#a34111, sage #A9BFAE/#cbd8ce, cream
  #F7F4ED/#efeadd, graphite #2C2F32/#5c6166, border+input #e6e0d0,
  radius .875rem. Only internal mismatch: `.lovable/plan.md` says copper
  #C9825A — **stale, code wins**. Light-only (no `.dark` block).
- **Mockup stack (A12 addendum):** TanStack Start + Vite 8 + Tailwind v4.2
  - shadcn on **Radix** (ours: Next 16 + `@base-ui/react`) → **no component
    file can be copied**; port bespoke Tailwind classes only. Only 2 of 46
    shadcn `ui/` files are even used (`input`, `sheet`). Both sides are
    Tailwind v4 CSS-first (no `tailwind.config.js`) → tokens port by editing
    `app/globals.css`; the 10 brand `--color-*` entries must be added to
    `@theme inline` or every ported class no-ops. Radius scale differs
    (mockup ±px offsets vs our multipliers — adopt theirs). **Load Lato via
    `next/font/google`, never the mockup's Google-Fonts `<link>` (GDPR).**
- **Not visible on the live site, found in code:** the questionnaire is a
  full **chat-bubble UI** (assistant/user bubbles, chips, "Ändern", skip
  marker, flash) — the live crawl only showed question 1; `/fertig`
  completion screen; auth screens; an **unused `AppHeader.tsx`** whose
  `· 4 offen` tab badge already models our missing-count; uploaded-state
  DocRow; petrol-tinted card shadow token; dead `simona-pfeiffer.png`.
  Assets are Lovable R2 URLs, **not files** — the logo SVG is not in the
  repo (keep our `logo.jpg` or ask Roman).
- **E-1 open decisions:** desktop sidebar (`AppShell`) vs our centered
  column + `AppHeader`-style top bar; whether the Ansprechpartner/Hilfe
  panel is in scope (needs Roman's content); whether `/fertig` copy
  replaces our locked-state text (Roman). All mockup German is
  Lovable-authored → PLACEHOLDER_DE if adopted.
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
- 2026-07-30 **E-1 decisions (fixed now, applied when Phase E starts):**
  - **Layout: keep our centered column** and adopt the `AppHeader`-style
    top bar, with the `· n offen` badge wired to our existing
    missing-documents counter. **No desktop sidebar** (`AppShell` is not
    adopted).
  - **Ansprechpartner/Hilfe panel: OUT of Phase E scope** — it carries
    Roman's personal data (photo, phone, email), so it is a content
    decision for him, not a restyle. Package item.
  - **`/fertig`: adopt the visual pattern only.** The existing
    locked-state German copy stays **verbatim** (R3). Lovable's "Nächste
    Schritte" text goes to Roman as a PLACEHOLDER_DE proposal.
  - **The E-1 plan must classify every chat-UI pattern as pure-restyle vs
    behavior-adjacent.** Behavior-adjacent ones — the "Antwort geändert"
    flash, the "Später beantworten" skipped marker, the "Ändern"
    affordance — are **optional and scheduled last**.
- 2026-07-30 GO PHASE D with five extra design requirements (rollout order
  per CLAUDE.md #8, numbering durability + no-reuse + folder-relative
  scope, instance-label filenames + full sanitization spec, adjacent paths
  incl. case-export/GDPR/RLS, mapping to founder + R2 report, Roman FYI).
  → `pass3_phase_d_design.md`, awaiting approval.

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

## Phase C design (C-1, pre-migration) — rule deactivation semantics

**Upload-reference gate (re-run live 2026-07-30, at execution time):**
14 upload rows total — PAN-001 ×7, PAN-002 ×1, PAN-005 ×2, PAN-012 ×1,
PAN-014 ×2, PAN-017 ×1. **PAN-011 references: 0. DOC-0006 (Vollmacht)
uploads via ANY rule: 0.** Gate passed → proceed. `office_document_rule`
row count 105 (the migration's backfill assertion target).

**What happens to a `document_upload` row whose rule is deactivated AFTER
upload — it DISAPPEARS from the user-facing checklist.** Rendering path:

1. `getDocumentData` ([lib/dal.ts](../../lib/dal.ts)) loads rules → with the
   new filter, an inactive rule is never returned.
2. `evaluateDocumentRules` therefore emits **no slot** for it.
3. `DocumentArea` ([app/case/document-area.tsx](../../app/case/document-area.tsx))
   renders uploads **only nested inside a slot**: the file list comes from
   `filesFor(slot)` (`uploads.filter(u => u.rule_id === s.ruleId && u.instance_key
=== s.instanceKey)`, line 77) inside `groups.map → slots.filter → list.map`
   (lines 161–252). There is **no orphan-uploads branch** — no filename, no
   download button, no delete button for an upload without a live slot.

What is NOT lost: the `document_upload` row and the storage object both
remain (deactivation is an UPDATE on a different table; nothing cascades —
and `document_upload.rule_id` has an FK to `office_document_rule(id)` with
no ON DELETE, so a DELETE would be blocked anyway → R6's "prefer UPDATE" is
also the only mechanically possible option here). The missing-count is
unaffected (`countMissingSlots` iterates slots, so a removed slot is simply
not counted — no phantom "missing"). **The ops export still ships the
file:** `scripts/case-export.mjs` writes `files/` by iterating **all**
upload rows for the case (line 222), independent of slots — the file lands
as `PAN-011_default_<original>`; only the `documents.md` table (which
iterates slots, line 198) loses its row. GDPR deletion is unaffected (the
runbook works on the storage prefix per case).

**⚠ DOCUMENTED TRADE-OFF for future deactivations:** deactivating a rule
that already has uploads makes those files silently vanish from the user's
checklist (they can no longer view or self-service-delete them) while they
persist in storage and in the ops export. **Acceptable for PAN-011 now**
because the zero-reference check passed twice (Phase A and at execution
time). Before any future deactivation of a rule WITH uploads, choose
explicitly: (a) re-point the uploads to another rule/slot first, or (b) add
an orphaned-uploads section to `DocumentArea`. Also recorded in
`docs/milestone-log.md`.

**Migration order inside the single file** (per founder): add
`active boolean NOT NULL DEFAULT true` → assert all 105 rows backfilled
`true` → flip PAN-011 to `false` (asserting exactly 1 row). The existing
RLS SELECT policy is `USING (true)`, so the new column needs no policy
change.

**Rule-loading sites filtered on `active = true` (all cited):**
`lib/dal.ts:240` (own office), `lib/dal.ts:259` (default-office fallback),
`scripts/case-export.mjs:180` (ops export). `scripts/verify-baseline.mjs`
also reads the table — that is a drift-diff, not an evaluation path; it
gets the new column added to both SELECTs + the compared-column list so the
schema addition stays guarded.

## Phase C implementation record (pre-push)

- **Migration** `20260730000003_office_rule_active_deactivate_pan011.sql` —
  single transaction, founder-specified order: `ADD COLUMN active BOOLEAN NOT
NULL DEFAULT TRUE` → DO-block assert (every row active AND count = 105,
  else RAISE) → `UPDATE … PAN-011 SET active = false` with a ROW_COUNT = 1
  assert. **Pre-validated on a local replay**: both NOTICEs fired
  ("Backfill verified: all 105 rules active", "PAN-011 deactivated"); end
  state 105 rows, column `boolean NOT NULL DEFAULT true`, exactly one
  inactive row (PAN-011 / DOC-0006 / person_2).
- **Filters (`active = true`) — every loading site, cited:**
  `lib/dal.ts` own-office query, `lib/dal.ts` default-office fallback query,
  `scripts/case-export.mjs` ops export. `scripts/verify-baseline.mjs` got
  `active` in the prod SELECT, the local SELECT and the compared-column list
  (drift guard covers the new column). No RLS change (policy is `USING
(true)`).
- **Tests (5 new, 143/143):** snapshot mirrors prod (exactly PAN-011
  inactive); F1 married → PAN-011 slot gone and the remainder
  **byte-identical** to golden-minus-PAN-011 (length −1, removed slot proven
  to be person_2/DOC-0006); PAN-010 person_1 Vollmacht untouched; F2/F3
  outputs unchanged; Essen married still person_1-only via ESS-012 (and no
  person_2 Vollmacht rule exists at all). The historical regression gate
  still evaluates ALL snapshot rules → unchanged goldens.
- ⚠ `verify-baseline` cannot run until the push (its prod SELECT now names
  the not-yet-existing column) — it is part of the post-push verification.

## Phase C verification evidence (2026-07-30, post-push)

- **Data level (prod):** 105 rule rows; exactly `PAN-011` inactive; the
  app's own-office query returns **49** active Pankow rules (was 50) and
  **55** Essen (unchanged); `PAN-010` (person_1 Vollmacht) still active; no
  upload row references the retired rule (14 uploads).
- **Live UI (throwaway accounts, both deleted):**
  - Pankow/Berlin 13187, `marital_status = verheiratet` → checklist
    **13 slots, non-empty**; "UNTERLAGEN IHRES PARTNERS" section present
    (partner Personaldokument + Kontoauszüge) but carrying **no**
    Vertretungsvollmacht; exactly **one** Vollmacht slot in total, under
    "IHRE UNTERLAGEN" (PAN-010).
  - Essen 45127 → checklist **7 slots, non-empty**, Essen's own rules
    (Finanzstatus/Saldenübersicht present, Pankow-only Mobilitätsnachweis
    absent), one person_1 Vollmacht (ESS-012).
  - Both non-empty checks were added deliberately by the founder to prove
    the `active`-filtered queries work against the **new column in prod**.
- **Suites:** unit **143/143**; `documents-m6` e2e regression **PASS** (all
  six criteria; the married drive now uploads 17 files instead of 18 —
  exactly one fewer slot, consistent with the removal); **verify-baseline
  full replay: all 12 tables identical**, with `active` now among the
  compared Doc-rules columns.

## ⚠ Process lesson from this round (now CLAUDE.md rule #8)

**Code that references a new DB column or table must never deploy before the
migration that creates it.** Order: migration pushed and verified on prod
FIRST, then the dependent code deploy; a commit containing both waits until
the migration is applied.

This round the Phase C commit (containing the `.eq('active', true)` filters)
was pushed to `main` immediately, so Vercel deployed code referencing
`office_document_rule.active` while the migration was still waiting for the
founder — every checklist render in that window would have queried a
non-existent column. No user-visible damage occurred (the window fell
outside pilot usage, and the post-push checks proved both office checklists
render non-empty), but the ordering is now mandatory. Note the asymmetry
that made Phase B safe: adding a **row** to an existing table degrades
gracefully (missing `static_content` keys render `''` by design, the M6
precedent) — adding a **column** does not.

## Phase D record (commit B — shipped + verified 2026-07-30)

- **Commit B `d1c9f92`** deployed after the migration was verified on prod
  (rule #8 order honoured end to end: `96ab5d8` migration → founder push →
  verification → `d1c9f92` code).
- **New module** `lib/storage-path.ts` (pure): sanitizer, `folderFor`
  (person_2 → Spouse; `previous_home` deliberately not overridden),
  `buildBase`, `extensionFor`, `buildObjectKey`, `allocateNumber`,
  `listAllObjectPaths`.
- ⚠ **Deliberate deviation from the D-1 sketch, documented in code:**
  PostgREST cannot express `INSERT … ON CONFLICT DO UPDATE SET last_n =
last_n + 1` and the app has no direct SQL connection, so the allocation
  is the **"unique constraint + retry" variant** — insert-if-absent plus a
  compare-and-set bump, retried. Same guarantees (distinct under
  concurrency, never reused); the SQL upsert form was only ever used to
  validate the semantics locally.
- **Nested-path fixes shipped:** `recordUploadAction` splits at the LAST
  slash (the old first-slash split would have failed **every** upload —
  proven by a test asserting the old computation yields a base containing
  `/`); new `scripts/storage-sweep.mjs` gives the GDPR runbook a recursive
  orphan sweep; all three e2e suites purge recursively via
  `tests/e2e/storage-cleanup.ts`.
- **Tests: 193 total (+50).** Design matrix + the four founder additions
  (concurrent allocation 2→[1,2] and 8→[1..8] distinct, lost-insert race
  retried, pathological contention throws rather than duplicating; hostile
  bank names incl. traversal/NUL/CRLF/emoji/zero-width/200-char and
  pure-symbol → `technical_key` → DOC-id fallback; delete `Heimvertrag2` →
  next is 3; the nested-path trio each failing against a one-level listing).
- **LIVE VERIFIED on prod (15/15, throwaway account, deleted):** two files
  on one slot → `Personal/Personaldokument1.png` + `…2.png`; person_2 →
  `Spouse/Personaldokument1.png`; hostile bank name
  `../Sparkasse 🏦 "Test"/..` → `Financial/Kontoauszuege_SparkasseTest1.png`
  (no traversal, no emoji, no quotes); checklist renders all originals;
  **5/5 signed URLs download, including a legacy UUID file** seeded for the
  grandfathering proof; `case:export` produced
  `Personal_Personaldokument1.png`, `Spouse_Personaldokument1.png`,
  `Financial_Kontoauszuege_SparkasseTest1.png` and kept
  `PAN-012_default_AlterHeimvertrag.pdf` for the legacy file, with no
  double prefixing and no Personal/Spouse collision; counters
  (`Personal/Personaldokument=2`, `Spouse/Personaldokument=1`,
  `Financial/Kontoauszuege_SparkasseTest=1`) existed during the case and
  **cascade-deleted with it**.
- **Regression:** `documents-m6` PASS (all six criteria, 17 objects
  uploaded/purged recursively), verify-baseline full replay **all 12 tables
  identical** with `storage_category` now in the drift guard, unit 193/193,
  typecheck/lint/format/build green. Prod back to 14 real uploads, bucket
  clean.

## Phase D record (commit A, pre-push)

- **Approved amendments folded in:** `document_filename_seq.case_id` FK
  `ON DELETE CASCADE` (+ GDPR runbook line); DOC-0008 Bisherige
  Heimrechnungen Housing → **Financial** while DOC-0007 Heimvertrag stays
  Housing (deliberate contract/invoice split — noted in Roman's FYI);
  DOC-0005 Insurance, DOC-0030 Housing, DOC-0015 Insurance, DOC-0016
  Personal as proposed; categories are **forward-only** (re-categorising
  moves future uploads only — stored files keep their paths).
- ⚠ **Correction owned:** the design's first published totals
  (13/7/16/7) were miscounted and did not sum to 43. Verified partition:
  **Personal 11 · Housing 7 · Financial 16 · Insurance 9**, every DOC id
  present exactly once. The migration asserts this distribution and aborts
  otherwise.
- ⚠ Only **one** Heimrechnungen catalog row exists (DOC-0008); there is no
  separate "Heimrechnung" type, so the instruction is fully satisfied by
  that single flip.
- **Local replay validation:** distribution assertion fired
  ("Personal 11, Housing 7, Financial 16, Insurance 9"); column
  `text NOT NULL` + CHECK on the four values; `document_filename_seq` with
  PK `(case_id, folder, base)`, FK `ON DELETE CASCADE`, RLS enabled and
  **0 policies**. Allocation semantics proven at SQL level: sequential
  1→2, `Spouse/Personaldokument` = 1 while `Personal/Personaldokument` = 2
  (folder-scoped), `_Girokonto`/`_Sparkonto` each 1 (instance-scoped),
  **8 parallel upserts → exactly 1–8 distinct**, and after deleting rows
  the next allocation returned **9** (numbers never reused).
- **Commit B additions recorded** in the design (§6.3 no-extension
  fallback: filename ext → MIME-derived → omit, never invent; §6.4
  accepted quirks: burned numbers on abandoned uploads, double-number
  instance labels; §10 items 14–17: concurrent allocation, hostile bank
  names incl. pure-symbol fallback, deleted-file numbering, and the three
  nested-path fixes each with a test that fails on a one-level listing).

## Next step

**Phase E-1 plan delivered — STOP, awaiting founder approval.**
`pass3_phase_e_plan.md` covers all eight required points. Findings worth
carrying forward even if the plan is revised:

- **e2e blast radius is one selector.** `.shrink-0.border-t` — a structural
  CSS-class selector on the chat answer footer (`chat-view.tsx:723`) — is
  used **9 times** and is exactly the wrapper the restyle rewrites.
  Everything else is `data-testid`, id/name, ARIA role or German text, all
  of which survive. Hence the proposed **E-0**: a zero-visual-change commit
  adding testids and repointing those 9 uses.
- **Native controls stay native in E-3.** ~25 selectors target `select` /
  `input[type=…]`; the mockup's chip buttons would remove the radios, so
  chips are classified **behaviour-adjacent** and deferred to E-8 with
  their own STOP.
- **Contrast measured, not assumed.** Copper is a **fill** colour: white on
  copper 4.69:1 ✅, but copper _text_ on cream 4.27:1 and on cream-deep
  3.91:1 **fail AA at normal size** — copper text only on white cards or at
  large sizes; petrol (7.03:1 on cream) is the link colour.
- **Two accessibility defects inherited from the mockup, to fix not copy:**
  `--input: #e6e0d0` is **1.32:1** vs white (WCAG 1.4.11 needs ≥3:1 for
  form-control borders; `#8c8272` = 3.78:1 is the lightest passing
  candidate, `graphite-soft` = 6.26:1 the safe one), and
  `focus:ring-petrol/20` at 20 % opacity is far below 3:1 → full-opacity
  petrol ring with offset.
- **E-1 (tokens) is the highest-visibility merge** — every screen changes
  colour and typeface at once while markup keeps our shapes. A **Roman
  heads-up is required before that merge**, not after.
- **Gallery privacy:** `docs/feedback/ui-gallery/` lands in a public repo →
  screenshots only from throwaway accounts with synthetic answers, never a
  real pilot case.

Plan approved 2026-07-30 with all four answers: order stands with a hard
gate per sub-phase; E-0 confirmed with a strict zero-visual bar; the Roman
heads-up is drafted (`roman_ui_ankuendigung.md`) and **Berk sends it — the
E-1 STOP must carry the reminder**; form-control border deferred to the
E-2 gallery with both candidates side by side (`#8c8272` first choice,
`graphite-soft` fallback), focus ring full-opacity petrol with offset,
copper fills only on cream, petrol links.

## Phase D leftover — audited before branching (main, `f9b3126`)

Requested check: is the counter CAS retry loop bounded, and does exhaustion
surface a clean user-facing error? **Both already true** — a plain `for`
loop capped at `maxAttempts` (default 8), and `createUploadUrlAction`
catches the throw and returns the DB-authored German upload error. The
audit found two adjacent defects that were fixed in that standalone commit:

- **PRIVACY:** the thrown message embedded `key.base`, which for an
  additional bank account contains the user's **own typed bank name** —
  and that message is logged server-side. A customer's bank would have
  reached Vercel logs, against the M7 no-PII-in-logs rule. The message now
  names only the folder (one of five fixed constants).
- **OPACITY:** the `catch` swallowed the cause and `insertFirst` mapped
  _any_ insert error to `'conflict'`, so a permanent fault (RLS, network)
  was indistinguishable from a race and left no trace. Now only 23505 is
  treated as the race; everything else is logged with code + message.

Tests +2 (195 total): the failure message must not contain the bank name
or case id, and a bounded-ness test counting store reads.

## E-0 result (branch `feedback-pass3-ui`, commit `52cee76`)

**Zero visual change, verified by diff:** the product diff is six
`data-testid` attributes (`case-header`, `chat-history`, `answer-footer`,
`question-card`, `group-prompt`, `all-answered`, `locked-banner`) and
**not one className, element or ordering change**. Nine structural
selectors repointed; zero structural CSS selectors remain in any spec.

⚠ **Preview is not machine-reachable.** The Vercel project has
**Vercel Authentication enabled** (`ssoProtection: all_except_custom_domains`),
so `…-git-feedback-pass3-ui-…vercel.app` 302s to Vercel SSO. A logged-in
human can open it; Playwright cannot. The suite therefore ran against the
**identical production build served locally** (`next build` + `next start`,
same prod Supabase). Enabling a Protection-Bypass-for-Automation token is a
project-settings change and needs a founder decision — see the STOP report.

**Suite: 11 passed, 3 failed — all three proven PRE-EXISTING:**

1. `auth.spec` signup → `/case`: prod Supabase rejects `@hzp-test.invalid`
   UI signups (the `.invalid` TLD). Documented since the M5/M7 notes; does
   not touch any restyled DOM.
2. `completion.spec`: its fixture user (`.playwright-test-user.json`,
   created **2026-07-01**) still exists in auth but its **case row is
   gone**, so `/case` throws "Kein Fall gefunden" and `#care_home_id` never
   renders. Remedy is the spec's own documented setup step,
   `node scripts/create-test-user.mjs`.
3. `transitive-visibility-fix` **T1**: the drive reveals the spouse
   Sonderstatus block by matching `text.includes('sonderstatus')`, but
   **CP3 renamed that prompt** to "Hat Ihr Partner einen Vertriebenen-
   oder Spätaussiedlerausweis?" — the word no longer exists, so "Nein" is
   chosen and the dependents never appear. **Proven pre-existing by A/B:
   the PRE-E-0 spec fails identically on the same build.** T2 and T3 in the
   same file pass, and T2 completes a full drive through the repointed
   footer selector — independent evidence E-0's selectors work.

## Test maintenance (main: `98a2edc` + `67dd0f0`) — all three resolved

- **T1 heuristic repointed** to `vertriebenen` / `spätaussiedler`. The spec
  now carries a ⚠ comment saying this matcher is **copy-coupled by design**
  (accepted trade-off — the DOM has no question key, so the driver must
  recognise the question from its German prompt; reword it and the reveal
  silently stops, failing as "Received: 0" rather than an obvious selector
  error).
- **completion fixture refreshed** via `scripts/create-test-user.mjs`
  (`.playwright-test-user.json` is gitignored). The spec header now
  documents how a stale fixture presents — login succeeds, `/case` throws
  "Kein Fall gefunden", and it surfaces as a 10-minute timeout on
  `#care_home_id` that reads like a selector bug.
- **auth.spec annotated known-skip**, gated on `E2E_ALLOW_SIGNUP` so the
  switch _is_ the follow-up ticket.
  ⚠ **CORRECTION on the record:** the previously documented reason —
  "prod rejects the `.invalid` TLD" — is **false**. Verified by POSTing
  `/auth/v1/signup` directly: **HTTP 200**, an unconfirmed user is created
  (probe user deleted immediately). The real blocker is that **email
  confirmation is enabled**, so the UI signup renders the check-your-inbox
  notice instead of redirecting to `/case`; every later test in that serial
  group depends on the user test 1 was meant to create. The spec's own
  inline comment had predicted exactly this.

## PII defect closure — verified no real-customer exposure (2026-07-31)

Requested: confirm from prod runtime logs that the counter-allocation
failure path never fired while the PII-leaking message was live.

⚠ **The log-based check cannot answer it, and saying otherwise would be
false comfort.** Vercel runtime-log retention on this project is far
shorter than the window: a query for `filename-seq` over 24 h returns
nothing, but so does _any_ query scoped to commit B's deployment
(`dpl_E29CSmBFfx2r3yMiypXNX2VjdqxF`) — zero lines survive for it, even
though that deployment demonstrably served the Phase D live verification.
Ingestion itself works (30 production requests are logged for the current
deployment), so the tooling is fine; the window is simply gone. **Absence
of a log line here is not evidence of absence.**

**Closed instead on database evidence, which is decisive:**

|                               |                                                                                                                                                                 |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Exposure window               | `2026-07-30T20:01:51Z` (commit B ready) → `2026-07-30T20:32:56Z` (fix `f9b3126` deployed) = **31 minutes**                                                      |
| Uploads created in the window | **0 surviving rows** (newest upload overall is `2026-07-30T07:29Z`, ~12 h earlier)                                                                              |
| Cases touched in the window   | **0** — no real user interacted with the app at all                                                                                                             |
| Only actor in the window      | my own throwaway verification account, whose bank name was the **synthetic** `../Sparkasse 🏦 "Test"/..` I invented — its rows cascade-deleted with the account |
| Reachability                  | the leak needs `allocateNumber` to lose **8 consecutive CAS races**, i.e. concurrent uploads to the _same_ slot; the verification uploaded sequentially         |

**Conclusion: no real customer's bank name could have been logged** — not
because no log line was found, but because no real customer's upload
existed to produce one. Defect closed as _verified-no-exposure_.

## PASS CLOSED 2026-07-31 — backlog carried forward

The four items below survive the pass. Everything else in this file is
historical record.

### 1. E-8 ticket — behaviour-adjacent restyle extras (DEFERRED ENTIRELY)

The restyle is **complete at E-7** by founder decision. E-8's scope, if it
ever revives: **pill chips** replacing the yes/no radios and
single-selects, the **"Antwort geändert" flash**, the **"Später
beantworten" marker** in history, and **Ändern-affordance changes**
(pencil icon, sent check).

**Risk notes, attached so nobody underestimates it later:** chips are a
**native-control swap** — `input[type=radio]` and `select` disappear, one
click submits instead of select-then-Weiter, and native radio keyboard/AT
semantics are lost and must be rebuilt by hand. **~25 e2e selectors**
target those native controls (`input[type=radio][value="Nein"]`,
`locator('select')`, …) and break with them. The skip marker surfaces
session-only state in the transcript; the flash and pencil change the
edit affordance itself.

**Condition:** revives only after Roman's reaction to the shipped restyle,
and then per-item with individual STOPs — never as one batch.

### 2. Purge the seven historical test users in prod auth

(`pw-vis+…` ×2, `pw-completion+…` ×4 from 2026-06-30/07-01, `verif+…` from
06-28.) They predate this pass. Treat as any prod deletion: verify each is
synthetic **individually**, confirm no case/upload/storage data hangs off
it, then remove one at a time. **Never bulk-delete by email pattern** — a
real user who happened to match would be unrecoverable. Excludes the
current `completion.spec` fixture, which is in active use.

### 3. auth.spec e2e vs. a local Supabase

The 13 auth tests remain an annotated skip (`E2E_ALLOW_SIGNUP` gate):
prod has email confirmation enabled, so UI signup never redirects to
`/case`. The ticket: point the auth suite at a local Supabase (or a
confirmation-disabled test project) so those paths run in CI instead of
being covered manually + by `npm run smoke:signup`.

### 4. `waitForIdle` family note

`waitForIdle` in the e2e helpers waits on a **global**
disabled-button count — the same family of primitive as the removed
networkidle. It caused one 10-minute burn this pass (L2, a `Speichern …`
button stuck disabled at question 33/56 — a hung save action,
snapshot-evidenced, did not recur). If it recurs, replace it with waits on
the specific control each step needs, exactly as was done for networkidle
in `53fdf73`.

## E-1 (tokens) — implemented on the branch, ⏸ STOP for founder review

Commits `d63aaa8` (tokens) + `814b4be` (gallery). **Not merged.**

- **`app/globals.css`:** ten brand `--color-*` entries in `@theme inline`
  (mandatory — Tailwind v4 generates utilities from `@theme`, so without them
  `bg-petrol` etc. silently no-op); `:root` switched to the mockup palette;
  radius scale switched from multipliers to the mockup's px offsets with
  `--radius` 0.625rem → **0.875rem**; `--shadow-card` / `--shadow-card-lg`;
  base-layer antialiasing, `kern`, −0.01em heading tracking. `.dark` left
  untouched.
- **`app/layout.tsx`:** Lato via `next/font/google`, **self-hosted** — never
  the mockup's Google-Fonts `<link>` (no caregiver IP goes to Google).
- ⚠ **Correction to the approved plan:** it specified Lato weights
  400/500/600/700. **Lato ships 100/300/400/700/900 — no 500 or 600**, and
  requesting them fails the build. Loading **400 + 700**; `font-medium` and
  `font-semibold` resolve via CSS font matching, exactly as in the mockup
  (whose link requests only 300;400;700).
- ⚠ **Latent bug found and fixed in passing:** production has been rendering
  in **Times New Roman**. `app/globals.css` mapped `--font-sans:
var(--font-sans)` (self-referential) while `layout.tsx` defined
  `--font-geist-sans`, so `--font-sans` was never defined, the
  `font-family` declaration was invalid, and the loaded webfont was never
  applied. Measured: prod `body` computed font = `"Times New Roman"`; E-1
  build = `Lato, "Lato Fallback", …`. This is the largest visible change in
  the before/after pair, alongside the palette.
- ⚠ **E-2 input, found while building the comparison:** our form controls
  bind to **`border-border`, not `border-input`**, so `--input` is
  effectively unused and **`--border` is the token E-2 must decide** — and
  it also colours decorative dividers, so E-2 must choose one value for both
  or split the token. Candidates rendered on two real screens in
  `ui-gallery/E-1-border-candidates/`.
- **Gallery:** `ui-gallery/E-1-tokens-BEFORE|AFTER/` — 12 shots each
  (login, signup, both pre-steps, questionnaire fresh + with history,
  documents) at 1280×800 and 375×812, plus the German `README.md` for
  Roman. Captured by the new `scripts/ui-gallery.mjs` /
  `scripts/ui-border-candidates.mjs` on throwaway accounts with synthetic
  data only (public repo).
- **Suite: 13 passed · 13 skipped · 0 failed** against the E-1 build.
- **Preview access solved (2026-07-31).** `VERCEL_AUTOMATION_BYPASS_SECRET`
  supplied; bypass verified (302 → 307 + `_vercel_jwt` cookie → 200 with a
  cookie jar; Playwright contexts persist cookies so it just works).
- **Preview render verified:** on the real preview URL, `body` computes to
  `Lato, "Lato Fallback", …` with background `rgb(247, 244, 237)`. The
  AFTER gallery and the border candidates were **re-shot against the
  preview** (not the local build).
- ⚠ **UNRESOLVED: the full suite against the preview took 2 h and returned
  12 failed / 1 passed / 13 skipped** — every failure the same
  `page.waitForLoadState('networkidle')` timeout, with page snapshots
  showing the app correctly rendered and logged in. The 2 h _was_ the
  failure: 12 tests each burning a 600–900 s timeout.
  **The same build is 13/13 green locally**, so this is a harness/preview
  interaction, not a product regression.
  **Root cause NOT identified.** A hypothesis that Vercel's preview-only
  Live-feedback script (`vercel.live/_next-live/feedback/feedback.js`,
  confirmed present) held the network open was **disproved by A/B**:
  networkidle settles in ~500 ms with the host blocked _and_ unblocked. A
  faithful replay of the exact `setupCase` sequence (login → care home →
  PLZ → reload → networkidle) against the preview now **passes in 488 ms**.
  So the failure is currently **not reproducible** — transient (cold
  functions / a Vercel hiccup) or load-related when 13 drives run
  back-to-back. Do not claim a cause without new evidence.
  **Consequence for the gate:** a 2 h preview suite per sub-phase is not
  viable (~16 h across E-2…E-8). → **Split gate adopted by the founder
  2026-07-31, see below.**

### Process slip worth recording

A `git add -A` on **main** swept E-1's gallery assets (AFTER shots, border
candidates, README, capture script) into the main-branch test-maintenance
commit `388e368`. On main those would advertise a design that has not
shipped, while their matching BEFORE shots sat on the branch. Reverted in
`c934a4e` and re-committed on the branch. **Lesson: on a gated branch
workflow, stage paths explicitly (`git add <paths>`) rather than `-A`,
because the two branches now carry deliberately different content.**

## Verification gate for E-2…E-8 — PREVIEW-FIRST WITH A TRIPWIRE

**Founder decision 2026-07-31 (second), supersedes the split gate below.**
The binding rule for the rest of Phase E. Mirrored in
`pass3_phase_e_plan.md` §6a.

| Scope                              | Per sub-phase (E-2…E-7)                                                                      | E-8 + final pre-merge |
| ---------------------------------- | -------------------------------------------------------------------------------------------- | --------------------- |
| Full Playwright suite, **preview** | **required** — the real preview URL, now ~3 min                                              | **unconditional**     |
| Gallery                            | **required**, per the plan: before/after per touched component, real screens, both viewports | required              |
| Unit (Vitest)                      | required                                                                                     | required              |

### Tripwire (mandatory, not discretionary) — AMENDED 2026-07-31 after E-3

⚠ **The signature limb is not sufficient on its own.** E-3 proved it: a
locator broken by the restyle (`div.space-y-1` → `flex flex-col gap-2`)
produced a 420 s timeout against a page that rendered perfectly and was
logged in — **indistinguishable** from the infra signature by that test
alone. Invoking the fallback on signature would have routed around a real
regression in the sub-phase's own code.

**Amended rule.** Before invoking the fallback for a signature match:

1. **Read the failing locator.** Open the error context and identify what
   the test was waiting for.
2. The fallback is permitted **only if that locator is provably OUTSIDE
   the DOM this sub-phase touched.** If it targets markup the sub-phase
   changed — or targets it by layout class rather than testid — it is a
   regression to fix, not infra to route around.
3. The 15-minute limb is unchanged and still fires on its own.

If a preview suite run **exceeds 15 min**, _or_ fails with the **infra
signature** _and_ clears the locator check above, then:

1. **Kill the run.** Do not let it burn to completion.
2. Fall back to **full suite against the local identical build + the
   gallery smoke** for that sub-phase.
3. **Record the fallback in this file** — which sub-phase, what the run
   looked like when killed, what the fallback returned.
4. **Continue.** A tripwire hit does not block the sub-phase.

The tripwire exists because the failure mode is known and unattributed:
15 min is roughly 5× the current cost, so it fires long before another 2 h
is lost, and the signature check keeps it from firing on a genuine product
regression (a real break shows a broken page in the snapshot, not a
rendered one).

**E-8 and the final pre-merge check are exempt from the fallback** — they
run the full preview suite unconditionally, tripwire or not. If it trips
there, it is investigated, not routed around.

### Superseded: the split gate (first decision, same day)

Kept for the record because the reasoning still explains the shape. It
made the preview suite optional per sub-phase (local suite + gallery
smoke instead), on the assumption a preview run cost 2 h. The re-baseline
measured **3.1 min**, which removed the reason. The gallery-as-smoke
definition survives into the fallback path above.

**E-1's verification bar was MET** under the split gate and remains met
under this one: full suite **13 passed / 13 skipped / 0 failed against the
real preview in 3.1 min**, plus the gallery re-shot from the preview with
`body` computing to `Lato…` on `rgb(247,244,237)`.

## E-7 (polish + a11y sweep) — on the branch, ⏸ STOP for founder review

Commits `fa05879` (reduced motion, h1, first touch targets, error palette)

- `1e45821` on main (mojibake CI guard) + `4d4cbc6`/`0f...` (audit harness
  saga, below) + `3c98930` (audit-driven fixes, loading/404, Roman index)
- `f7975d4` (audit refinements). **Not merged.** Preview the gate ran
  against: `sorglos-antrag-1kz7kvu6b-berk-solutions.vercel.app` (tip
  `f7975d4`; later commits are docs/output-format only).

**Gate:** full suite against the real preview — **13 passed / 13 skipped /
0 failed, 3.2 min**. Unit 195/195. `npm run verify` (typecheck + lint +
format + encoding) clean.

One earlier run failed **L2 at 10.1 min**: the snapshot shows a
`Speichern …` button stuck `[disabled]` at question 33/56 — a save action
that never resolved. Locator inspected per the amended tripwire: the wait
is on a global disabled-button count, the page was healthy, and E-7
touches no save path. **Did not recur on the re-run.** Recorded as a
one-off hung server action with snapshot evidence; if it recurs, the
`waitForIdle` primitive (a global condition, same family as networkidle)
is the thing to revisit.

### The audit harness saga — worth its own paragraphs

1. First version reported **"0 tab stops / no findings" on every screen**
   and I committed a diagnosis of "Tab does not move focus in headless".
   **That was false and unverified.** The real bug: the probe was passed to
   `page.evaluate` as a **string**, which Playwright evaluates as an
   expression; an arrow-function expression is an unserializable function
   object → `undefined` → the probe never ran. A three-way direct test
   proved headless Chromium moves focus on Tab perfectly. Record corrected
   in the fix commit.
2. The first real run then exposed three measurement gaps, each fixed:
   label-only wrap keys truncated the documents walk (11 identical "Datei
   hochladen" buttons) → position-qualified keys; checkboxes measured bare
   at 16×16 though the wrapping label is the target → label box measured;
   post-save re-render made Tab land on an unmounting element → one
   settled retry.
3. Probe refined to credit rings on a child (popover) or composite parent
   (phone wrapper), and to classify links inside sentences under WCAG
   2.5.8's inline exception rather than as failures.

### Keyboard/touch findings → fixes (all verified by the re-audit)

| Finding (first real run)                                          | Fix                                                                       |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------- |
| every button 32–40px high (Anmelden, Weiter, Abmelden, …)         | `min-h-11` in `buttonBase` — no per-site override can undercut it again   |
| selects 36–37px (care home, phone country)                        | `min-h-11` in the `control` base                                          |
| standalone links 17–20px (login footer, reset back, signup)       | new `linkStandalone` (min-h-11 inline-flex) at those sites                |
| auth logo link 40px                                               | `min-h-11` on the link                                                    |
| consent info buttons 18×18                                        | 44×44 hit area, small visible circle nested, ring via group-focus-visible |
| phone country select: no distinguishable focus                    | own inset focus-visible ring (wrapper ring lights for either child)       |
| `Bearbeiten` / remove-instance / upload / delete (from `fa05879`) | `min-h-11`                                                                |

**Final audit: 8 screens — login, signup, both pre-steps, questionnaire
fresh + with history, documents, completion/locked — 0 findings.**
Keyboard-only drives verified: care-home step, PLZ step, answering a
question via Enter. The two consent-sentence links are listed as
2.5.8-inline-exempt, deliberately not enlarged.

### Also in E-7

- `prefers-reduced-motion: reduce` collapses every transition/animation to
  0.01ms (not 0, so `transitionend` still fires).
- The case screen's **missing `h1`** added as `sr-only`, reusing the
  authored `de.case.pageTitle` — no new German.
- `global-error.tsx` onto the brand palette; styles stay inline because
  global-error replaces the root layout and `globals.css` never loads.
  Petrol action, not copper, not `--destructive`.
- **`app/loading.tsx`** (petrol spinner, `role=status`) and
  **`app/not-found.tsx`** (404 + heading + line + petrol link to `/case`)
  — both previously missing entirely. ⚠ Both carry **PLACEHOLDER_DE**
  strings in `lib/strings/de.ts`, logged for Roman in
  `german_copy_for_roman.md` §E-7.
- Upload-error rendering **verified, not changed**: `role=alert` +
  `--destructive` is correct semantic use for a genuine failure.
- **networkidle grep-zero repo-wide** re-confirmed (only the two docs
  files narrating the incident mention the word).
- **Mojibake CI guard** (`npm run check:encoding`, in `verify` and CI) —
  caught a third cp1252 artifact on its first run, already fixed.
- **Roman sign-off index:** `docs/feedback/ui-gallery/INDEX.md` — every
  BEFORE/AFTER set E-1…E-6 plus all 13 open items in priority order,
  the identical-copy pair first. This is the page the founder forwards.

## E-6 (completion + locked state) — ✅ MERGED to main 2026-07-31 (`0249c44`)

Commits `a10af8e` + `b259fa4` + gallery. **Not merged.** Preview:
`sorglos-antrag-iqwq5oxgy-berk-solutions.vercel.app`.

**Gate:** full suite against the real preview — **13 passed / 13 skipped /
0 failed, 3.2 min**. Unit 195/195. Typecheck, lint, prettier, build clean.

Both terminal states take the mockup's `/fertig` layout — medallion,
heading, body, centred — so they read as one family. **Their tones
deliberately differ.**

| State            | Register           | Medallion                     | Heading  | Why                                                                                                    |
| ---------------- | ------------------ | ----------------------------- | -------- | ------------------------------------------------------------------------------------------------------ |
| **all-answered** | achievement        | petrol + white `Check`        | petrol   | petrol is the palette's positive/confirmed tone, and this is the moment that earns it                  |
| **locked**       | pending, not a win | cream-deep + graphite `Clock` | graphite | a petrol tick would say the application was **approved** — a claim we cannot make and no copy supports |

Amber and red stay out of both: being under review is not a warning.
Neutral is the honest register for "you are done; someone else must act".

**The mockup's "Nächste Schritte" numbered list is NOT built.** Its copy is
Lovable-authored German with no Roman version, and scaffolding structure
for absent text would leave an empty frame on a real screen (R3).

### The last off-palette colour, found in passing

The header status label still used Tailwind `green-600` / `blue-600`. The
green actively contradicted this sub-phase: the locked _card_ avoided a
success tone while the _label_ above it shouted one. Now petrol for
"vollständig", graphite-soft for "in Prüfung". **Sweep afterwards: zero
`text-`/`bg-` green|blue|amber|red|yellow utilities remain anywhere under
`app/`.**

### ⚠ Finding for Roman: the two states show IDENTICAL German

Read from the DB, not inferred:

- `case.all_answered_heading` == `case.locked_heading` == "Sie haben alle
  Fragen beantwortet!"
- `case.all_answered_message` == `case.locked_body` == "Wir prüfen nun alle
  Ihre Angaben und übertragen diese in das Antragsformular. …"

So after E-6 the **only** thing distinguishing "everything answered" from
"locked, under review" is the medallion and its tone. That makes the tone
work far more load-bearing than it should be, and a user who does not
notice a small icon change cannot tell the two states apart at all.
Not fixed here — the copy is Roman's (R3). Logged in the ledger as a
question for him.

### Contrast — in-engine

| Pair                                          | Ratio       |
| --------------------------------------------- | ----------- |
| graphite on white — both headings/bodies      | **13.46:1** |
| petrol on white — all-answered heading        | **7.72:1**  |
| petrol on page — status "vollständig"         | **7.03:1**  |
| graphite-soft on white — locked body          | **6.26:1**  |
| graphite-soft on page — status "in Prüfung"   | **5.70:1**  |
| graphite-soft on docs pane — locked checklist | **5.50:1**  |

Non-text: white Check on petrol **7.72:1**; graphite-soft Clock on
cream-deep **5.21:1**. ⚠ The cream-deep medallion's own fill is **1.20:1**
against the white card — deliberate and compliant for the same reason as
E-5's notice panel: the circle conveys nothing, the glyph inside it does,
at 5.21:1.

### Scope held

`completion.spec`'s five criteria are untouched and it passes in the
suite; `all-answered` and `locked-banner` keep their testids and still
render the same `content.*` strings. The single-use fixture was re-seeded
for each run and is live afterwards. Zero German changes — the only German
in the diff is inside explanatory comments.

### Gallery

`E-6-completion-BEFORE/` (prod = E-5 state) and `E-6-completion-AFTER/`
(preview): fresh, history, **locked**, **all-answered**, and
**`05-docs-locked`** — the documents checklist while the case is frozen —
each at both viewports.

## Harness rule: preview readiness is NEVER an HTTP status (2026-07-31)

**A Vercel preview serves its "Deployment is building" holding page with
HTTP 200.** Any poll that waits for 200 therefore returns immediately, and
everything downstream runs against a page with none of the app on it.
This cost the first E-5 suite 15.1 min and 10 false failures.

**Gate on CONTENT** (an element only the real app renders, plus the
absence of the building marker) **or on the deployment's `readyState`
from the Vercel API.** Never the status code.

Implemented as `scripts/lib/preview-ready.mjs` → `gotoWhenReady()`, used
by **all five** capture scripts (`ui-gallery`, `-chat`, `-docs`, `-auth`,
`ui-border-candidates`). It names the holding page in its error rather
than letting a later selector time out and look like a product failure.

Also cleared while in those files: the last four
`waitForLoadState('networkidle')` calls (in `ui-gallery.mjs`). **Grep
across `scripts/` now returns zero** — this was the E-7 sweep item, done
early.

### ⚠ Encoding defect I introduced, found and fixed (`af64a3c`)

A PowerShell `Get-Content`/`Set-Content` round-trip on
`ui-gallery-chat.mjs` decoded UTF-8 as Windows-1252 and re-encoded it,
corrupting every non-ASCII character — **including three German button
labels the script clicks** (`Weiß ich gerade nicht`,
`Pflegeheim bestätigen`, `Postleitzahl bestätigen`). The script could no
longer find them. It landed _after_ the runs that produced the E-3
gallery, which is why nothing failed at the time.

Repaired by explicit sequence mapping with assertions. A blind Latin-1
round-trip does **not** work here: cp1252 maps `0x9F` to `U+0178`, which
is outside Latin-1 and is lost. **Lesson: never round-trip a source file
through PowerShell's `Get-Content`/`Set-Content`** — use the editing tools
or Node's `fs` with an explicit `utf8` encoding.

## E-5 (auth + pre-steps) — ✅ MERGED to main 2026-07-31 (`6f1de39`)

Prod verified after deploy: page background `rgb(247,244,237)` cream, logo
present and centred with `alt="Sorglos Antrag"`, `href="/login"`, column
`max-width: 512px`. Sage confirmation panels confirmed in the prod capture
run.

Commit `b878597` + gallery. **Not merged.** Preview:
`sorglos-antrag-5iyws30ph-berk-solutions.vercel.app`.

**Gate:** full suite against the real preview — **13 passed / 13 skipped /
0 failed, 3.3 min**. Unit 195/195. Typecheck, lint, prettier, build clean.

Auth pages get the mockup's `AuthShell`: cream page, logo centred above
the card, `max-w-lg` column (was `max-w-md` — signup's two-column name row
was cramped at 28rem), larger headings, relaxed subtitles, responsive card
padding. Pre-steps got matching heading scale and rhythm.

**Both "we emailed you" confirmations** — signup's and password-reset's —
moved off a muted grey box onto the sage info panel, signup's with a
`MailCheck` icon. These are the auth screens a user actually sits and
reads and both are positive expected outcomes; grey read as neither good
nor bad. `role="status"` preserved on both; the icon is `aria-hidden`.

### Contrast — computed in-engine

Notice panel = `sage-soft/40` on the white card = `rgb(234,239,235)`.

| Pair                                   | Ratio       |
| -------------------------------------- | ----------- |
| graphite on white — auth heading       | **13.46:1** |
| graphite on notice panel — notice body | **11.57:1** |
| petrol on white — links                | **7.72:1**  |
| graphite-soft on white — auth subtitle | **6.26:1**  |
| petrol MailCheck icon on notice panel  | **6.64:1**  |

⚠ One figure that looks like a failure and is not: the notice panel's own
fill is **1.16:1** against the white card. 1.4.11 governs boundaries that
_convey information_; this panel conveys nothing by itself — the German
text inside does, at 11.57:1 — and it additionally carries a
`sage-soft/70` border and an icon. Recorded so nobody "fixes" it into a
heavy grey box later.

### ⚠ The failed first run was MY HARNESS, not the app

The first preview suite returned **10 failed / 3 passed in 15.1 min** —
tripping the 15-minute limb. The failure snapshots showed Vercel's
**"Deployment is building"** holding page.

**Cause: my readiness poll was wrong.** It waited for HTTP **200**, and
Vercel serves 200 for the build placeholder. So the whole suite ran
against a page with no login form. Re-run against the actually-ready
deployment: **13/13 green in 3.3 min.**

**Lesson for every future sub-phase:** an HTTP 200 from a preview URL does
**not** mean ready. Gate on real content (`name="email"` present _and_
"Deployment is building" absent) or on the deployment's `readyState`
from the API. This is now a third distinct cause behind the same
"timeouts against a rendered page" presentation — after the E-3 broken
selector and the original unexplained run. The tripwire's signature limb
keeps earning its amendment.

### Scope held

`auth.spec` **untouched** — `git status` clean for `tests/`; its
`E2E_ALLOW_SIGNUP` gate and skip reason are byte-identical. `#care_home_id`
and `#plz_input` keep their ids; every `[name=…]` unchanged, so
`completion.spec` drives the pre-steps as before. Zero German changes —
the single German-bearing diff line is a className wrapper around the same
literal.

### Judgement calls to flag

1. **Logo links to `/login`, not `/`.** `/` redirects to `/case`, which
   bounces a signed-out visitor straight back to `/login` — a link that
   appears to do nothing.
2. **Column widened** `max-w-md` → `max-w-lg`, for the signup name row.
3. **`MailCheck` icon added** to the signup confirmation only; the reset
   confirmation is text-only because its markup is a bare `<p>` and adding
   an icon would have meant restructuring it.

### Gallery

`E-5-auth-BEFORE/` (prod = E-4 state) and `E-5-auth-AFTER/` (preview),
five states each at both viewports: login, signup, **signup confirmation**,
reset request, **reset confirmation**. New `scripts/ui-gallery-auth.mjs`
performs a **real** signup so the confirmation is the genuine state; the
account is deleted in `finally`.

## E-4 (Dokumente screen) — ✅ MERGED to main 2026-07-31 (`36a765d`)

Commit `35584a3` + gallery. **Not merged.** Preview:
`sorglos-antrag-m0u0bt2u8-berk-solutions.vercel.app`.

**Gate:** full suite against the real preview — **13 passed / 13 skipped /
0 failed, 3.3 min**, no tripwire. Unit 195/195. Typecheck, lint, prettier,
build clean.

Each subject group is now **one card with hairline-separated rows**
instead of a stack of bordered boxes. Every row gains a status medallion
(FileText on cream-deep while outstanding → white Check on petrol once
filled), completed rows are tinted `sage-soft/30`, the upload control is
the outline button, filenames are petrol links, and attached files are
indented under the medallion so a row reads as one unit.

### Semantic colour rule applied

- **"Fehlt" stays neutral** — graphite-soft text, neutral medallion. An
  un-uploaded document is a step not yet reached, not a warning. No amber,
  no red.
- The all-uploaded counter moved off an **off-palette `text-green-700`**
  onto the palette's petrol.
- `--destructive` remains only where it belongs: upload errors and the
  delete hover.

### Contrast — computed in-engine from the deployed tokens

Blends resolved: uploaded row `sage-soft/30` on white = `rgb(239,243,240)`;
documents pane `muted/40` on cream = `rgb(244,240,231)`.

| Pair                                          | Ratio       |
| --------------------------------------------- | ----------- |
| graphite on white — doc name, outstanding row | **13.46:1** |
| graphite-soft on white — "Fehlt"              | **6.26:1**  |
| graphite on uploaded row — doc name           | **12.02:1** |
| petrol on uploaded row — status + filename    | **6.90:1**  |
| graphite-soft on uploaded row — "Entfernen"   | **5.59:1**  |
| petrol on docs pane — all-uploaded counter    | **6.79:1**  |
| graphite-soft on docs pane — group heading    | **5.50:1**  |

Non-text (1.4.11, needs ≥3:1): white Check on petrol **7.72:1**;
graphite-soft icon on cream-deep **5.21:1**; petrol medallion against the
white card **7.72:1**. All clear.

### Scope held

`documents-m6` drives this screen end to end and every anchor it uses is
unchanged: `document-area`, `doc-slot`, `slot-status`,
`missing-docs-counter` (including its `data-missing` attribute), the
hidden file input and its `accept` list. Upload behaviour untouched;
Phase D's path/naming layer is server-side and stays invisible here. Zero
German changes — every string is still `content.docs*`.

### Judgement calls to flag

1. **Medallions are `aria-hidden`.** The `slot-status` text beside them
   already states the state in German; the icon would only repeat it.
2. **Group headings shrank** from `text-sm` to `text-xs` uppercase, to sit
   as quiet labels above a card rather than compete with the card's own
   rows.
3. **Icons introduced** (`lucide-react`, already a dependency): `Check`
   and `FileText`, exactly the two the mockup's DocRow uses.

### Gallery

`E-4-docs-BEFORE/` (prod = E-3 state) and `E-4-docs-AFTER/` (preview),
three states each at both viewports: empty, mixed (2 of 11 filled), full
(11 of 11). New `scripts/ui-gallery-docs.mjs` — the uploads are **real**,
pushed through the actual signed-URL flow with a tiny synthetic PDF, so
the shots show the true uploaded-row rendering rather than a mock.

## E-3 (Fragen screen / chat UI) — ✅ MERGED to main 2026-07-31 (`eac7a65`)

Commits `b72c856` (restyle) + `dbacc14` (selector fix) + gallery. **Not
merged.** Preview:
`sorglos-antrag-k6y5h62xr-berk-solutions.vercel.app`.

**Gate:** full suite against the real preview — **13 passed / 13 skipped /
0 failed, 4.1 min**. Unit 195/195. Typecheck, lint, prettier, build clean.

The answered history is now a conversation: question = assistant bubble
left (white, squared bottom-left), answer = user bubble right (petrol,
squared bottom-right). Section labels became the centred sage pill. The
active-question / group-prompt / all-answered / locked cards moved onto
the shared `card` token, the answer footer onto the translucent
page-background treatment, and the re-ask note + patient banner off the
**amber alert palette** onto the sage hint bubble — amber reads as a
warning and neither of those is one.

### Contrast — computed by the browser from the DEPLOYED tokens

Not hand arithmetic: the values below were produced in-page by reading
`:root`, alpha-compositing the translucent backdrops, and applying the
WCAG relative-luminance formula.

| Pair                                      | Ratio       |
| ----------------------------------------- | ----------- |
| white on petrol — user bubble             | **7.72:1**  |
| graphite on white — assistant bubble      | **13.46:1** |
| graphite-soft on sage-soft/40 — hint body | **5.09:1**  |
| graphite on sage-soft/40 — hint title     | **10.95:1** |
| petrol on sage-soft/70 — section pill     | **5.72:1**  |
| graphite-soft on cream — "Bearbeiten"     | **5.70:1**  |

Blends resolved: `sage-soft/40` over cream = `rgb(229,233,225)`;
`sage-soft/70` over cream = `rgb(216,224,215)`. All pass AA; the two
bubble pairs pass AAA. (`b72c856`'s message states 7.73 / 13.47 for the
first two — hand-computed before this check, off by 0.01. No conclusion
changes; these are the authoritative figures.)

### ⚠ The failure that matters more than the restyle

The first preview run failed T3 in `transitive-visibility-fix` on a 420 s
timeout. **It was my change, not infra.** The spec located an answered
Q&A pair as `page.locator('div.space-y-1', …)`; E-3 changed that wrapper
to `flex flex-col gap-2`, so the locator matched nothing and the click sat
there until the test died — against a page that rendered perfectly.

**This is a hole in the tripwire's second limb.** The recorded infra
signature is "timeouts while snapshots show rendered pages", and that is
_precisely_ how a broken structural selector presents. The 15-minute limb
is still sound; the signature limb **cannot** be read as "not our code".
Every occurrence needs the failing locator inspected before the fallback
is invoked. Recorded here so a future run does not route around a real
regression.

Fixed with E-0's own remedy at a site E-0's census missed (it caught
`.shrink-0.border-t`, 9 uses): the wrapper now carries
`data-testid="answered-bubble"` and the spec anchors on it. **Swept the
whole suite for class-based locators afterwards — that was the only one,
and there are now zero.**

### Scope guards held

- `question-renderer.tsx` **was not edited at all**, so every native
  control keeps its element and attributes and the ~25 selectors targeting
  them are untouched.
- All E-0 testids survive verbatim: `answer-footer`, `question-card`,
  `chat-history`, `group-prompt`, `all-answered` (+ `case-header`,
  `locked-banner`). One **added**: `answered-bubble`.
- Behaviour-adjacent patterns stayed out: no chips replacing radios, no
  "Antwort geändert" flash, no "Später beantworten" marker, no change to
  the Bearbeiten affordance. The mockup's pencil icon and sent-check were
  available and deliberately not taken.
- **Zero text changes**, verified by diff: every German-bearing line is a
  className wrapper around the same `{s.*}` / `{content.*}` expression;
  the only German characters added anywhere are inside code comments.

### Gallery note — how `all-answered` was reached

`E-3-chat-states/` covers fresh, history, locked, all-answered at both
viewports, via the new `scripts/ui-gallery-chat.mjs`.

`all-answered` must be shot **in-session**, at the moment the drive
completes. It is **not** reachable by reloading a completed case, and the
first attempt to do so failed: replies to repeatable-group prompts
("Nein, weiter") are session state rather than answers, so a fresh load
re-asks them and the group-prompt card takes the footer. Rewinding
`cases.status` was tried for the same purpose and fails for that reason.
The script now captures it live and, if the server's lock re-render wins
the race, says so instead of producing a substitute.

## E-2 (shared primitives) — ✅ MERGED to main 2026-07-31 (`6d19dbe`)

Commits `fcfaea7` (code) + `1b3491b` (gallery) + `0300dfd` (comment fix);
branch tip `0300dfd`. Preview it was approved from:
`sorglos-antrag-m58b3edk9-berk-solutions.vercel.app`.

**Border pick CONFIRMED by the founder from the real-screen gallery:**
`--input: #8c8272` ships; `--border` stays the mockup's soft `#e6e0d0`.
The split is settled — later sub-phases inherit it and should not
re-litigate it.

### Dead-code decision taken alongside E-2 (main `c33a718`)

`components/ui/button.tsx` (shadcn scaffold, `Button` + `buttonVariants`)
**deleted**. Imported by zero files, therefore covered by zero tests,
therefore nothing would have reported that its `cva` variants had missed
both the E-1 token port and E-2. Rewriting it to delegate to `styles.ts`
was rejected: still an untested component with no consumers, drifting
off-brand again at the next token change. `components.json` is present,
so `npx shadcn add button` regenerates one against current tokens.

⚠ **`class-variance-authority` is now used by nothing and is DELIBERATELY
RETAINED.** Do not "clean it up": with `components.json` in the repo, the
next `shadcn add` generates a component that expects it, so removing it
only buys a reinstall. Verified at the time of writing that it has exactly
one former consumer (the deleted file) and that `@base-ui/react` is still
required — `consent-info-popover.tsx` imports its popover — and that
`cn()` in `lib/utils` is still used by `signup/form.tsx`.

**Gate met under the new rule:** full suite **against the real preview** —
**13 passed / 13 skipped / 0 failed, 3.2 min**, no tripwire. Unit
**195/195**. Typecheck, lint, prettier, build clean.

### What E-2 found, which changed its shape

`components/ui/button.tsx` is imported by **nothing**, and the app renders
raw `<button>` / `<input>` / `<select>` with inline Tailwind everywhere —
the control class string appears **10× verbatim** in
`question-renderer.tsx` alone. There was no shared layer to restyle, so
E-2 created one: `components/ui/styles.ts`, a module of **class strings,
not components**. Wrapping native elements would insert a rendering layer
between the e2e suite and the tags/attributes it asserts on
(`#care_home_id`, `[name=email]`, `input[type=radio][value="Nein"]`,
`locator('select')`) for zero visual gain, since the restyle is purely a
class-name change.

### The border token is SPLIT (the recorded steer, implemented)

| Token      | Value     | Job                                    | Measured                                            |
| ---------- | --------- | -------------------------------------- | --------------------------------------------------- |
| `--border` | `#e6e0d0` | decorative only — dividers, card edges | 1.32:1 — fine, 1.4.11 does not apply                |
| `--input`  | `#8c8272` | form-control boundaries                | **3.78:1** white / 3.44:1 cream / 3.15:1 cream-deep |

One value could not do both: the mockup's `#e6e0d0` is correct for a
divider and a real 1.4.11 failure for an input. Fallback graphite-soft
`#5c6166` (6.26:1) is rendered beside it in `E-2-border-candidates/`,
which now varies **only** `--input` with `--border` pinned — the earlier
E-1 candidate set varied both and is superseded.

**Founder's call outstanding at this STOP.** `#8c8272` is what ships today.

### Also in E-2

- Focus ring = **full-opacity petrol + offset**, per plan — not the
  mockup's `ring-petrol/20`, which is ~1.2:1 on a white card and
  effectively invisible (2.4.7).
- Copper is a **fill only** (white on copper 4.69:1). Never text: copper on
  cream 4.27:1, on cream-deep 3.91:1, both fail AA. Links are petrol.
- Header and tab row moved off white slabs onto the page background with a
  soft rule, per the mockup's `AppHeader`.
- Two **pre-existing** a11y gaps closed in passing: the progress bar had no
  `role=progressbar` / `aria-valuenow` (progress was visual-only), and the
  active tab was marked by colour alone (1.4.1) — it now carries a petrol
  underline too.

### Trap avoided, worth recording

The mockup renders the tab badge as `· 4 offen`. Writing that into the
badge element would have broken `feedback-pass.spec.ts:354`, which does
`Number(await badge.textContent())` and would have read **NaN**. The `·`
is therefore its own `aria-hidden` span **outside**
`data-testid=docs-tab-badge`, which still contains only the number. I had
initially written the combined form with a comment claiming the assertion
still worked — caught before commit; that comment would have been exactly
the kind of unverified stated reason CLAUDE.md forbids.

The mockup's trailing word **"offen" is new German copy** and is
deliberately NOT added (R3) — flagged to Roman in the gallery README.

### Scope held

No German copy changed. No id / name / testid changed. No native control
swapped for a custom widget. No behaviour touched. From `chat-view.tsx`
only `ProgressBar` and the case header were taken — bubbles, history and
the answer footer are E-3's.

## Fragile-primitive fix (main, `53fdf73`) — networkidle removed

All **11** `waitForLoadState('networkidle')` sites across six specs
replaced with an assertion on the state the test actually needs: six
setup helpers now assert `[data-testid=answer-footer]` is visible; three
`documents-m6` sites dropped it because the following `openDocumentsTab()`
already waits for `[data-testid=tab-documents]`; two `m7-regression`
sites dropped it because the next line is already an explicit
`expect(...).toBeVisible()`. Grep for `networkidle` now returns nothing.

**The 12-timeout run is the precedent, not an attributed cause.** No
cause was established; the Vercel-Live hypothesis was disproved by A/B
and the exact sequence replayed green in 488 ms. What is established is
that networkidle waits on a global condition no assertion depends on and
converts any stray keep-alive into a multi-minute timeout. The honest
record is **"not reproduced, primitive replaced."** If the failure
recurs after this change, that is new evidence and the investigation
reopens — with the timeout removed, a recurrence will now surface as a
fast, specific assertion failure instead of a 900 s hang.

### Post-migration suite result (branch, after merging main)

**13 passed · 13 skipped · 0 failed.** Every previously-networkidle site
now settles in normal time; no wait-related failure anywhere.

One test did fail on the first attempt and it was **not** the waits:
`completion.spec` timed out 10 min on `#care_home_id`. Cause found and
fixed — see below. On a re-seeded fixture it passes **all five criteria in
1.0 min**.

### `completion.spec` fixture precondition was checking the wrong invariant

The precondition added earlier this pass asserted `status = 'in_progress'`.
That is necessary but **not sufficient**: step 1 needs the care-home
pre-step, which stops rendering the instant `cases.care_home_id` is set.
The fixture was sitting at `care_home_id` + `plz_before_move` set,
`status` still `in_progress`, `0` answers — left there by the 2 h preview
run, which got through the pre-steps before dying. So the precondition
waved it through and the spec burned its full 600 s timeout on a selector
that could never appear.

Fixed: the precondition now also asserts `care_home_id IS NULL`, and the
header records the real invariant — **any** prior run that got past login
consumes the fixture, not only a successful one. This is a test-harness
defect, not an app regression, and it is unrelated to the networkidle
change (the same spec failed the same way before it).

### Preview re-baseline (one run, as instructed) — 3.1 min, all green

Against the branch deployment of `48b8c02`
(`sorglos-antrag-fgg4et4mr-berk-solutions.vercel.app`, bypass verified
HTTP 200), default workers:

**13 passed · 13 skipped · 0 failed · exit 0 · wall time 3.1 min.**
Slowest specs: `visibility` 2.4 min, `documents-m6` 2.5 min. Nothing
approached a timeout. The comparable earlier run on the same preview:
**2 h, 12 failed / 1 passed.**

⚠ **Read this as a baseline, not as proof of a fix.** The old failure was
already non-reproducible _before_ the change — the exact sequence replayed
green in 488 ms. A green run now therefore cannot distinguish "the
primitive was the problem" from "the transient is simply gone". What it
does establish is the number the split gate is priced against: a full
preview suite currently costs **~3 min**, not 2 h.

Consequence worth noting: at 3 min, the E-8 / pre-merge full preview run is
cheap. If it stays at this cost through E-2, running it per sub-phase
becomes affordable again and the gate can be tightened — that is the
founder's call, not a change I will make unilaterally.

## Prod debris sweep from the 2 h run window — 0 deletions (2026-07-31)

Read-only audit of all **20** auth users, then per-user verification —
never a pattern delete. Result: **nothing to delete.**

- 12 real users — untouched, not candidates.
- 7 historical synthetic leftovers (06-28 → 07-01) — **explicitly out of
  scope**, they remain the backlog item above, unchanged and unfolded.
- 1 candidate from the window, `pw-completion+1785486311150@…`
  (08:25:15Z): **kept** — it is the current `completion.spec` fixture
  (1 case, 0 answers, 0 uploads), in active use.
- All 5 storage prefixes belong to **real** users. `document_filename_seq`
  rows: 0; orphaned counter rows: 0.

Why zero: the specs' `afterEach` cleanup survives failures, so the 12
failed drives cleaned up after themselves. The failure mode did not leak
prod data.

## E-0 final tally (branch, after merging main)

**13 passed · 13 skipped (all annotated) · 0 failed · exit 0**, full suite,
`--workers=1`, against the merged branch build. The 13 skips are the single
annotated `Auth flow` group. Prod left clean: 12 real users untouched, the
only test user is the current fixture (the stale one was garbage-collected
by the setup script); no leaked users from the run.

## Roman ledger (open items for the non-technical co-founder)

| Item                                                               | Status                                                                                                                                                                                                                                                                           |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Logo as SVG                                                        | open — upgrade when it arrives, not a dependency                                                                                                                                                                                                                                 |
| Ansprechpartner decision + assets                                  | open — his personal data, out of Phase E scope                                                                                                                                                                                                                                   |
| `/fertig` "Nächste Schritte" copy                                  | open — PLACEHOLDER_DE proposal, not shipped                                                                                                                                                                                                                                      |
| §10 folder-mapping FYI (flippable rows)                            | open                                                                                                                                                                                                                                                                             |
| Older sign-offs                                                    | in `german_copy_for_roman.md`                                                                                                                                                                                                                                                    |
| **Tab badge — the word "offen" (E-2)**                             | **open.** The mockup reads `· 4 offen`; we ship `· 4`. "offen" is NEW German copy and is his to author (R3). Asked in the gallery README.                                                                                                                                        |
| **Form-control border colour (E-2)**                               | ✅ **CLOSED 2026-07-31** — founder confirmed `#8c8272` from the real-screen gallery; dividers keep `#e6e0d0`. No longer a question for Roman.                                                                                                                                    |
| **Amber → sage on the two hint boxes (E-3)**                       | **open** — flagged in the gallery README with the reason and an explicit offer to revert.                                                                                                                                                                                        |
| **"Alles beantwortet" and "In Prüfung" have IDENTICAL copy (E-6)** | **open, and the most substantive.** `case.all_answered_heading`/`_message` are byte-identical to `case.locked_heading`/`_body` in the DB. After E-6 the only difference a user sees is the medallion icon and its colour. Does he want distinct copy for the under-review state? |
