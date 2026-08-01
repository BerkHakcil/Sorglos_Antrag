# Content Pass 4 — session state

> Resume protocol: if a session restarts, read this file first, then the pass
> brief; do not redo completed phases. Full Phase-A findings:
> `pass4_phase_a.md`; German package: `roman_package_pass4.md`.
> Decisions D1–D16 are locked in the pass brief and are not re-litigated.

## Phase status

| Phase                                  | Status                                            | Notes                                                                                                                                       |
| -------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| A — read-only report + Roman Package 2 | ✅ DONE 2026-08-01 — **⏸ STOP, awaiting founder** | `pass4_phase_a.md` (A1–A9 + appendix order table) + `roman_package_pass4.md` committed. No code, no migrations. Open decisions listed below |
| Batch 1 (D1/D3/D4/D9/D10/D11/D2)       | not started                                       | blocked on Phase-A go + the D10 Pankow-suffix decision + D2/D11 placement decisions                                                         |
| Batch 2 (pension, D15)                 | not started                                       | blocked on A1 design approval (count-decrease semantics + backfill)                                                                         |
| Batch 3 (D5/D6/D12)                    | not started                                       | blocked on Roman's answers to Package 2                                                                                                     |
| Close-out                              | not started                                       |                                                                                                                                             |

## Decisions the founder owes at the Phase-A STOP

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

## Next step

**⏸ STOP.** Founder reviews `pass4_phase_a.md`, takes the seven decisions
above, sends `roman_package_pass4.md`, gives batch go-aheads. Batch 1 has no
Roman dependency and can start on "go" once decisions 4–6 are taken.
