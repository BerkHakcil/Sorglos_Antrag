# Feedback Pass 3 — session state

> Resume protocol: if a session restarts, read this file first, then the pass
> brief; do not redo completed phases. Full findings:
> `feedback_pass3_triage.md`; German package: `roman_package_pass3.md`.

## Phase status

| Phase                           | Status                                                                             | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ------------------------------- | ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A — read-only triage            | ✅ DONE 2026-07-30                                                                 | reports committed + pushed; Roman package extended per founder (item-1 pre-steps + product question, item-3 post-fix semantics, ss rows = confirm-only)                                                                                                                                                                                                                                                                                                                                      |
| B — quick fixes (items 3/7/8/1) | ✅ DONE 2026-07-30                                                                 | migrations `20260730000001` + `20260730000002` pushed by founder and verified: live drive 11/11 (umlauted checklist names + no leftovers; B1 empty-Weiter completes birth_name, survives reload, `''` row in DB; rentenbetrag renders with NO Brutto text at step 27); verify-baseline full replay all 12 tables identical; documents-m6 e2e regression PASS; unit 138/138. B4 no-op                                                                                                         |
| C — spouse Vollmacht (PAN-011)  | ✅ DONE 2026-07-30                                                                 | migration `20260730000003` pushed and verified. Data level: 105 rows, exactly PAN-011 inactive, Pankow active 49 / Essen 55, no upload references it. Live: married Pankow checklist 13 slots with partner section but NO Vollmacht (exactly 1 overall, person_1); Essen 7 slots with its own rules — both non-empty, proving the active-filter queries work against the new column in prod. unit 143/143, documents-m6 PASS, verify-baseline all 12 tables identical (incl. the new column) |
| D — storage restructure         | ✅ DONE 2026-07-30                                                                 | migration `20260730000004` (commit A `96ab5d8`) pushed + verified, then code (commit B `d1c9f92`) — rule #8 order honoured. New uploads land at `{case}/{Folder}/{Base}{n}.{ext}`; the 14 existing files are grandfathered and still download. Live verified 15/15 incl. Spouse override, hostile bank name, legacy-file download, export naming and counter cascade. unit 193/193, documents-m6 PASS, verify-baseline identical with `storage_category` in the guard                        |
| E — UI restyle                  | E-0 ✅ merged to main · **E-1 done on branch, bar MET, ⏸ STOP for the merge word** | branch `feedback-pass3-ui`, commit `52cee76`. E-0 = 6 data-testids + 9 repointed selectors, **zero visual change** (diff touches no className). Preview built READY but is **SSO-protected**, so the suite ran against the identical build served locally: **11 passed, 3 failed — all three proven PRE-EXISTING**, none caused by E-0                                                                                                                                                       |
| F — close-out                   | not started                                                                        |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |

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

## Backlog (deliberate, not now)

- **Purge the seven historical test users in prod auth** (`pw-vis+…` ×2,
  `pw-completion+…` ×4 from 2026-06-30/07-01, `verif+…` from 06-28). They
  predate this session and are unrelated to it. Treat as any prod deletion:
  verify each is synthetic **individually**, confirm no case/upload/storage
  data hangs off it, then remove one at a time. **Never bulk-delete by
  email pattern** — the pattern is a heuristic, not proof, and a real user
  who happened to match would be unrecoverable. Excludes the current
  `completion.spec` fixture, which is in active use.

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

### Tripwire (mandatory, not discretionary)

If a preview suite run **exceeds 15 min**, _or_ fails with the **infra
signature** — timeouts while the failure snapshots show correctly
rendered, logged-in pages — then:

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

Remaining Roman items: logo as SVG, Ansprechpartner decision + assets,
`/fertig` "Nächste Schritte" copy, the §10 folder-mapping FYI (flippable
rows), plus the older sign-offs in `german_copy_for_roman.md`.
