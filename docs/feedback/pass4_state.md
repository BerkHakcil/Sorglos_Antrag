# Content Pass 4 — session state

> Resume protocol: if a session restarts, read this file first, then the pass
> brief; do not redo completed phases. Full Phase-A findings:
> `pass4_phase_a.md`; German package: `roman_package_pass4.md`.
> Decisions D1–D16 are locked in the pass brief and are not re-litigated.

## Phase status

| Phase                                  | Status                                                                 | Notes                                                                                                                                                                                                                                                                                           |
| -------------------------------------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A — read-only report + Roman Package 2 | ✅ DONE 2026-08-01 — approved same day (all 7 decisions, below)        | `pass4_phase_a.md` (A1–A9 + appendix order table) + `roman_package_pass4.md`. §4 (new-German nod list) appended to the package per founder item 7 — **package ready to send**                                                                                                                   |
| Batch 1 (D1/D3/D4/D9/D10/D11/D2)       | 🔶 migrations written — **⏸ STOP: awaiting manual `supabase db push`** | `20260801000001_pass4_batch1_copy.sql` + `20260801000002_pass4_batch1_flags.sql`; R2 re-verified 2026-08-01 (zero drift since Phase A). ⚠ Docker daemon not running → local replay NOT performed pre-push; migrations carry loud aborting assertions. Code follows after prod verification (R8) |
| Batch 2 (pension, D15)                 | not started                                                            | blocked on A1 design approval (count-decrease semantics + backfill)                                                                                                                                                                                                                             |
| Batch 3 (D5/D6/D12)                    | not started                                                            | blocked on Roman's answers to Package 2                                                                                                                                                                                                                                                         |
| Close-out                              | not started                                                            |                                                                                                                                                                                                                                                                                                 |

## Decisions received from the founder (2026-08-01) — Phase-A STOP closed

1. Count-decrease = **Option A confirm-and-clear**; dialog text PLACEHOLDER_DE.
2. Backfill **approved as tabled** (instances where present, Ja→1/Nein→0;
   locked Keine-Rente case → 0 with history-row disappearance accepted;
   fixture → 1). Migration-time R2 re-verifies per case; **any drift since
   Phase A stops the migration**.
3. Berlin order **approved incl. all four judgment-call recommendations**
   (funeral trio → Versicherung block, Partner before Kinder, costly_diet
   before the family block, labels gate on Roman/Batch 3). Essen report-only.
4. Pankow suffix: **render wherever `period_months` is non-NULL** — no
   NULLing migration. Live verification must cover a Pankow checklist
   explicitly (PAN-005/006 show "(letzte 4 Monate)").
5. Next-steps: **locked state only**.
6. Contact card: **header-Hilfe sheet** per mockup; trigger + micro-labels
   PLACEHOLDER_DE.
7. All new German consolidated into `roman_package_pass4.md` **§4**
   (appended: confirm dialog, Hilfe/Ansprechpartner labels, Nächste-Schritte
   heading, netto hint) — founder sends the package.

## Original Phase-A STOP decision list (historical, all taken above)

1. **Count-decrease semantics** (A1.3): Option A confirm-and-clear
   (recommended) vs Option B preserve+hide.
2. **Backfill table** (A1.5): approve per-case `pension_count` values, incl.
   `298ac66b` → 0 (its "Keine Rente" history row disappears from the visible
   transcript; rows preserved) and the `88eede8b` fixture conflict
   (recommend 1).
3. **Berlin order** (A2 appendix) + four judgment calls: funeral trio →
   Versicherung block; Partner before Kinder; costly_diet position; the three
   new category labels (also asked of Roman in Package §3).
4. **⚠ D10 premise correction** (A7 / §0.1): PAN-005/PAN-006 carry
   `period_months = 4` on live prod. (a) render suffix on Pankow too
   (recommended, data-faithful) or (b) NULL the two PAN values by migration
   to match the brief's "Pankow shows no suffix" spot-check.
5. **Next-steps placement** (A8): locked-only (recommended) vs both terminal
   states; "Nächste Schritte" heading = PLACEHOLDER_DE pending confirmation.
6. **Contact card placement** (A8): P1 header-Hilfe sheet (recommended) / P2
   static blocks / P3 both.
7. Send `roman_package_pass4.md` to Roman (his answers gate Batch 3 only).

## Key Phase-A facts (so later phases need not re-derive)

- **Live-state deltas vs brief/docs (verified 2026-08-01):** PAN-005/006
  `period_months = 4` (not NULL — D10's premise wrong); **third** folder flip
  DOC-0042 Housing→Financial (with DOC-0005 Insurance→Financial, DOC-0030
  Housing→Financial; new partition assertion Personal 11 / Housing 5 /
  Financial 19 / Insurance 8); uploads now **11** rows / 4 cases, all legacy
  UUID paths (zero new-scheme files → D9 flips strand nothing); D1 copy pair
  byte-identical confirmed in DB (4 static_content rows).
- **A1 headline:** the Berlin pension group already carries Roman's D15c
  German **verbatim** (all four prompts) — no prompt migrations. Changes:
  retire pair, add `pension_count` (options "0"…"8" — new permanent values),
  remove "Keine Rente" option, NULL the three `in_values` member vis rules,
  optional netto `help_de` (PLACEHOLDER_DE).
- **Retirement mechanism:** `question.active` column (Phase-C pattern).
  ⚠ Load-bearing detail: the stale-answer sweep (actions.ts:217) deletes any
  answer row visible in `answersRaw`; the pair's rows are protected by
  filtering the keyMap query in `getCaseAnswers` (dal.ts:98) so they never
  enter `answersRaw`. Loader filter alone would get the answers deleted on
  the next save. `case-export` stays unfiltered on purpose (retired answers
  keep appearing in answers.md).
- **Count-driven design:** `question_group.count_source_key` (nullable,
  data-driven); ONE shared derivation helper — four sites currently derive
  instances independently (page.tsx `deriveGroupData`, actions.ts
  `deriveGroupDataForCompletion` — its zero-UUID placeholder must NOT apply
  to count-driven groups or count=0 blocks completion forever —
  chat-view.tsx state, case-export.mjs). Instance order fixed to earliest
  `created_at`. Doc rules need **zero** migration (PAN-003/004 read the
  capped derivation; count 0 → no slots).
- **Denominators after D15 + D4:** Berlin fresh 53 → **52**
  (−hat_rente −fresh pension_type +pension_count; corrects pass-3 A9's
  "→51" which miscounted rentenbetrag as fresh-visible); Essen fresh 50 →
  **49** (birth_name optional). Asserts to touch: m7-regression :222 (50),
  :292/:323 (53); feedback-pass L1/L2 (53), L3/L4 (50).
- **D1 breaks three text anchors:** `'Sie haben alle Fragen beantwortet'` in
  completion.spec (:105/:320), visibility.spec (:139),
  transitive-visibility-fix.spec (:129) — repoint in Batch 1.
- **A7:** `DocumentSlot.periodMonths` already threaded by the evaluator;
  render sites are exactly document-area.tsx:210 and case-export.mjs:210;
  suffix `(letzte {n} Monate)` display-only (storage-path untouched, no
  counter fork; goldens unchanged).
- **A6:** pre-steps get wrapped in `CaseTabs`; placeholder = new
  static_content row `docs.placeholder_needs_plz` (Roman verbatim, D3);
  badge is already structurally hidden at 0 (case-tabs.tsx:69); safety
  branch (no rules anywhere) keeps chat-alone.
- **A9:** Essen birth_name = question `61000000-0000-0000-0000-000000000005`
  → `is_required = false`; B1 mechanics engine-level, no code change; zero
  Essen cases in prod (R2 trivial).
- **A3:** exactly 5 Berlin violations (2 retire with D15; 3 proposals to
  Roman); Essen clean. **A4:** three Essen spouse bulk intros don't name the
  partner → harmonized proposals to Roman; option labels already "Der
  Partner …". D13 = no change (resolved).
- **Real-data snapshot (2026-08-01):** 12 cases / 21 auth users; pension
  data only on d345b0f9 (REAL in_progress, 2 instances), fc446257 (REAL
  locked, 1), 298ac66b (REAL locked, Keine-Rente instance), 88eede8b (TEST
  fixture, inconsistent hat_rente=Nein + filled instance). Re-run R2 at
  every migration execution time.

## Ledger updates queued (Batch 1, per the brief)

D7 (umlauts/ss) resolved · D8 (13 Essen names) resolved · D13 (Berlin
partner insurance) resolved-no-change · D14 (emails) owner-handled · D10's
old PLACEHOLDER (german_copy_for_roman.md §1, the never-wired 4-month hint)
**removed** · D16 logo stays open (originals pending; WhatsApp thumbnails
unusable, not integrated).

## Batch 1 record

**Migrations (written 2026-08-01, pre-push):**

- `20260801000001_pass4_batch1_copy.sql` — D1 four value-guarded UPDATEs
  (pre-state guard asserts the byte-identical pair, post-check asserts the
  new distinct values) + 11 new `static_content` rows (D3
  `docs.placeholder_needs_plz`, D2 `case.next_steps_heading/_1/_2/_3`, D11
  `contact.name/phone/email/card_label/help_button`, D10 template
  `docs.period_suffix` = "(letzte {n} Monate)"), `ON CONFLICT DO NOTHING`
  per the Essen-seed precedent.
- `20260801000002_pass4_batch1_flags.sql` — D4 Essen `birth_name`
  `is_required=false` (guarded, asserted 1 row) + D9 three
  `storage_category` flips (DOC-0005 Insurance→Financial, DOC-0030 and
  DOC-0042 Housing→Financial, each guarded+asserted) + full partition
  assertion **Personal 11 / Housing 5 / Financial 19 / Insurance 8** (43).

**R2 execution-time re-verification (2026-08-01, read-only, zero drift):**
D1 four rows byte-identical as known; no key collisions for the 11 new rows;
Essen `birth_name` still required with **0 answers / 0 Essen cases**; the
three D9 rows carry exactly the expected old values, partition 11/7/16/9;
**11 uploads, all legacy UUID paths, 0 new-scheme** (flips strand nothing);
period_months confirmed on exactly PAN-005/006/ESS-010/011 = 4.

**Batch-1 code (written 2026-08-01, on branch `pass4-batch1`):** D3
pre-steps wrapped in CaseTabs + `DocsPlaceholder` pane (gating pure helper
`lib/docs-pane.ts`, unit-tested); D10 `periodSuffix` in
`lib/document-rules.ts` (template `docs.period_suffix`, n≥2 only — a
1-month rule would need Roman singular wording first) rendered in
`document-area.tsx` + `case-export.mjs`; D11 `app/case/help-sheet.tsx`
(base-ui Dialog, RP-initials avatar with `photoSrc` drop-in slot,
`contact.*` content; close aria-label "Schließen" = new PLACEHOLDER_DE in
de.ts, ledgered); D2 next-steps on `EditLockedCard` only; e2e: the three
old text anchors → testids (completion/visibility/transitive), Essen
denominators 50→49 (m7-regression, feedback-pass L3/L4); unit 205/205
(195 + 7 periodSuffix + 3 docsPaneMode). Migration-history note: both `20260801…` files applied+tracked
by the founder's push, verified on prod data-level (15/15 rows, partition
11/5/19/8, birth_name optional).

**⚠ Harness finding (2026-08-01) — local e2e gate not viable, cause
unattributed.** Full-suite drives against a LOCAL `next start` (prod
build, prod Supabase) hang mid-drive: a save transition never settles
("Speichern …" stuck `[disabled]`), `waitForIdle` burns 15-s timeouts, the
test dies at 600 s against a perfectly rendered page — the pass-3 L2
signature, now recurring. Evidence chain: first seen with default workers
(20-core machine → ~10 parallel drives), **recurred with `--workers=1`**,
and **recurred on a CLEAN-MAIN build (A/B with the Batch-1 diff stashed)**
— so it is NOT this batch's code. Single-drive probe on the same build:
6 saves, 0.8–1.1 s each. While one hung render was live, the same server
answered fresh requests in 60 ms and Supabase REST in 95–304 ms — the
wedge is per-session (one browser session's `/case` hung deterministically
until a fresh login; token-refresh suspected, NOT verified). Pass-3 local
full-suite runs were green (E-0, `--workers=1`), so this is
new-or-intermittent environment behavior on this machine. Recorded per the
"not reproduced ≠ explained" standard; no primitive changed. **Gate
re-routed to a Vercel preview** (the pass-3 measured-green path, bypass
secret already configured).

**Local verification that DID pass (Batch-1 build):** unit 205/205,
typecheck/lint/format/encoding, production build; browser walkthrough on
the local build — tabs + "Ihre Dokumente" placeholder pre-steps with NO
badge, Hilfe sheet opens with card label/name/tel/mailto and closes
cleanly, badge `· 11` appears after PLZ 13187, and the **Pankow checklist
renders "Kontoauszüge – Girokonto (letzte 4 Monate)"** with every other
slot suffix-free (decision 4 verified locally).

**⚠ Defect found and fixed during the walkthrough:** base-ui Dialog keeps
Backdrop+Popup mounted with `[data-closed]` after close — without styling
that state, the invisible full-screen backdrop swallowed every click on
the page (the closed sheet blocked the pre-step submit). Fix:
`data-closed:hidden` on both (comment in help-sheet.tsx marks it
load-bearing). Verified: closed state computes `display:none`, page
clickable.

**Prod hygiene:** killed-run sweep found only 2 leaked users (afterEach
survived most kills); both verified individually (0 objects, 0/3 answers,
synthetic) and deleted; the active completion fixture kept.

## Next step

**⏸ STOP — the founder pushes the branch for the preview gate:**

1. Migrations are pushed + verified (done). Package sent per item 7 status.
2. `git push origin pass4-batch1` → Vercel preview builds → I run the full
   suite against the real preview (bypass secret; the measured ~3-min
   serverless path, immune to the local-hang condition) + preview
   walkthrough of the locked-state next-steps.
3. On green: merge `pass4-batch1` → `main`, founder pushes `main` (prod
   deploy), then the LIVE spot-checks per the batch brief: placeholder
   before PLZ, list after PLZ, Essen "(letzte 4 Monate)", **Pankow
   "(letzte 4 Monate)"** (decision 4), distinct copy pair on both terminal
   states, contact sheet, next-steps absent from all-answered. Then STOP
   before the Batch-2 design.
