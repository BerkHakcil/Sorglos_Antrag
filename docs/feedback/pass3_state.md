# Feedback Pass 3 — session state

> Resume protocol: if a session restarts, read this file first, then the pass
> brief; do not redo completed phases. Full findings:
> `feedback_pass3_triage.md`; German package: `roman_package_pass3.md`.

## Phase status

| Phase                           | Status                                              | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ------------------------------- | --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A — read-only triage            | ✅ DONE 2026-07-30                                  | reports committed + pushed; Roman package extended per founder (item-1 pre-steps + product question, item-3 post-fix semantics, ss rows = confirm-only)                                                                                                                                                                                                                                                                                                                                                                                                                            |
| B — quick fixes (items 3/7/8/1) | ✅ DONE 2026-07-30                                  | migrations `20260730000001` + `20260730000002` pushed by founder and verified: live drive 11/11 (umlauted checklist names + no leftovers; B1 empty-Weiter completes birth_name, survives reload, `''` row in DB; rentenbetrag renders with NO Brutto text at step 27); verify-baseline full replay all 12 tables identical; documents-m6 e2e regression PASS; unit 138/138. B4 no-op                                                                                                                                                                                               |
| C — spouse Vollmacht (PAN-011)  | ✅ DONE 2026-07-30                                  | migration `20260730000003` pushed and verified. Data level: 105 rows, exactly PAN-011 inactive, Pankow active 49 / Essen 55, no upload references it. Live: married Pankow checklist 13 slots with partner section but NO Vollmacht (exactly 1 overall, person_1); Essen 7 slots with its own rules — both non-empty, proving the active-filter queries work against the new column in prod. unit 143/143, documents-m6 PASS, verify-baseline all 12 tables identical (incl. the new column)                                                                                       |
| D — storage restructure         | D-1 ✅ approved · commit A written, ⏸ STOP for push | design approved with amendments (FK CASCADE, DOC-0008→Financial, forward-only categories, filename format confirmed). **Commit A = migration ONLY** `20260730000004_document_storage_category_and_filename_seq.sql`, validated on a local replay: distribution 11/7/16/9 asserted, FK+RLS+CHECK correct, 8 parallel allocations → 1–8 distinct, no-reuse → 9. **Commit B (code) is NOT written and will not be pushed until the migration is verified on prod (CLAUDE.md #8).** Queued for B: `recordUploadAction` nested-key verify fix, GDPR orphan sweep, e2e cleanup recursion |
| E — UI restyle                  | not started, ✅ UNBLOCKED                           | mockup repo access granted + verified 2026-07-30 (shallow clone OK at `8ea545f`). Full code-level inventory = **A12 addendum** in the triage doc. E-1 planning happens after Phase D closes                                                                                                                                                                                                                                                                                                                                                                                        |
| F — close-out                   | not started                                         |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |

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

**STOP for founder `supabase db push` of
`20260730000004_document_storage_category_and_filename_seq.sql`.**
After "pushed": I verify on prod (43 rows non-null + 11/7/16/9, counter
table present/empty, verify-baseline green) and report — only then do I
write and push commit B (code + tests). Phase E is unblocked and
inventoried (A12 addendum), decisions fixed above, and runs last.
