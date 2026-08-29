# Bank docs pass — Phase 2 execution record

> **GATE 1 APPROVED 2026-08-29** (founder, in-session). Net surface per the
> gate: ONE data migration (2-row PAN duration UPDATE), code = suppression
> lift + C-1 counter injection + approved spec edits, ledger = C-2 drafts
> AWAITING ROMAN. Item B confirmed DONE at the gate (mandatory since
> migration `20260813000001`; zero locked cases lack the answer — verified
> live 2026-08-29 in `bank_docs_phase1.md` §P1-B1/B2) — closed, no work.

## IMPACT REPORT — migration `20260829000001_pankow_bank_period_3_months.sql`

Written BEFORE the migration file (Real-Data Rule). Before-states are LIVE
prod values, verified by SELECT on 2026-08-29 in this session (Phase 1
discovery, re-asserted by the migration's execution-time guards).

**Table touched: `public.office_document_rule` — exactly 2 rows, 2 columns
worth of change (`period_months`, `condition` jsonb mirror). No other table,
no schema DDL, no case data.**

| Row identity (PK)                                                                  | Field                                                                 | Current value (live, verified 2026-08-29)                                                             | New value                            |
| ---------------------------------------------------------------------------------- | --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------ |
| `id = 'PAN-005'` (Pankow `11000000-…-0001`, DOC-0003, mandatory, person_1, active) | `period_months`                                                       | `4`                                                                                                   | `3`                                  |
| `id = 'PAN-005'`                                                                   | `condition` (jsonb, seed-time mirror — runtime reads only the column) | `{"period_months": 4, "repeat_for_each": "applicant_bank_account"}`                                   | same with `"period_months": 3`       |
| `id = 'PAN-006'` (Pankow, DOC-0003, mandatory, person_2, active)                   | `period_months`                                                       | `4`                                                                                                   | `3`                                  |
| `id = 'PAN-006'`                                                                   | `condition` jsonb — the repeat node at path `all[1]`                  | `{"all": [{"any": [marital gates]}, {"period_months": 4, "repeat_for_each": "spouse_bank_account"}]}` | same with `all[1].period_months = 3` |

**Why:** Roman's ruling 2026-08-29 — Pankow = 3 Monate; the default (= the
fallback list, which serves these same Pankow rows) = 3 Monate. Essen = 4
Monate → **ESS-010 / ESS-011 are deliberately untouched** (current value
already correct).

**Blast radius** (Phase 1 §P1-A4): display-time label only. 3 uploads
exist on PAN-005 (2 fallback-served cases) — attached by
`(rule_id, instance_key)`, unaffected; no re-upload mechanism exists, and
nothing is expected of those files. Live viewers: 0 Pankow cases, 1 Essen
case (unchanged), 7 fallback cases (gain "(letzte 3 Monate)" once the
paired code change deploys).

**GOVERNANCE re-review outcome (standing rule: any migration touching PAN
rules re-reviews `fallback_excluded_rule_ids`):**
`app_config.fallback_excluded_rule_ids` = `["PAN-016","PAN-017","PAN-018"]`
— all three verified live: existing, `active = true`, and in the default
office's (Pankow's) set. This migration edits an attribute of PAN-005/006
only; it changes no rule's membership, id, active flag, or
requirement_type, and neither edited rule is excluded. **No update to the
exclusion list is required.** The migration re-proves this at push time:
it ABORTS if any exclusion id is missing/inactive in the default office's
set, or if PAN-005/006 ever appear in the exclusion list.

**Ordering note (for the push):** the paired code (suppression lift + spec
asserts on "(letzte 3 Monate)") assumes the new data. This is the benign
row-UPDATE class — old code renders new data fine ("(letzte 3 Monate)" on
own-office Pankow lists, still-suppressed fallback) and new code renders
old data fine ("(letzte 4 Monate)" everywhere incl. fallback) — but the
**e2e suite asserts the end state, so: push the migration first, then run
the gate** (same sequence as the 2026-08-13 precedent).

---

## Files changed

| File                                                                                                                                                                  | Change                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [supabase/migrations/20260829000001_pankow_bank_period_3_months.sql](../../supabase/migrations/20260829000001_pankow_bank_period_3_months.sql)                        | **NEW — PUSHED by the founder 2026-08-29** (NOTICE output matched the impact report; end state re-verified read-only). The 2-row UPDATE per the impact report above, with before-state guards, governance re-assert (exclusion trio exists + active in the default office set; PAN-005/006 not excluded), row-count asserts, after-state asserts, Essen assert-only, RAISE NOTICEs throughout.                                                       |
| [lib/document-rules.ts](../../lib/document-rules.ts)                                                                                                                  | Item A: `periodSuffix` loses the `fromFallbackRules` parameter — the 2026-08-11 suppression is lifted (founder-confirmed reversal, gate answer 1). Docblock records the decision chain.                                                                                                                                                                                                                                                              |
| [app/case/document-area.tsx](../../app/case/document-area.tsx)                                                                                                        | `fromFallbackRules` prop removed; suffix renders from the rows on every list.                                                                                                                                                                                                                                                                                                                                                                        |
| [app/case/page.tsx](../../app/case/page.tsx)                                                                                                                          | Prop passing + now-unused `rulesSource` destructure removed (the rules ladder itself is untouched — only the render flag is gone).                                                                                                                                                                                                                                                                                                                   |
| [scripts/case-export.mjs](../../scripts/case-export.mjs)                                                                                                              | Export keeps checklist parity: suffix renders on fallback exports too; the fallback banner line drops its now-false "period suffixes omitted" sentence.                                                                                                                                                                                                                                                                                              |
| [app/case/chat-view.tsx](../../app/case/chat-view.tsx)                                                                                                                | **C-1:** completion cards show the docs pane's approved missing-count line (`docs.missing_count` / `_one`, same derivation as DocumentArea) — AllAnsweredCard always at `missing > 0`, EditLockedCard in its docs-variant only (the plain locked card says "nichts weiter tun" and must not carry a count). New testid `completion-docs-counter` (deliberately NOT reusing `missing-docs-counter` — specs select that one uniquely). `''`-degrading. |
| [tests/unit/period-suffix.test.ts](../../tests/unit/period-suffix.test.ts)                                                                                            | Rewritten for the 2-arg signature: suppression describe-block removed, live cases now 3 (Pankow/default) + 4 (Essen).                                                                                                                                                                                                                                                                                                                                |
| [tests/e2e/fallback-notice.spec.ts](../../tests/e2e/fallback-notice.spec.ts)                                                                                          | **P2-5 as approved:** F1's no-suffix assertion flipped to assert "(letzte 3 Monate)" **unconditionally** (closing the old migration-state-aware F1 assert loose end from the 2026-08-27 handoff — the suite now runs only after the push); F2 4→3; F3 unchanged (pins Essen = 4). Header + titles updated. The Line-A trio conditional stays (not in scope).                                                                                         |
| [tests/fixtures/pankow-rules.snapshot.json](../../tests/fixtures/pankow-rules.snapshot.json)                                                                          | PAN-005/006 `period_months` 4→3, column + jsonb mirror (4 occurrences — counted before editing, exactly the 2 rows × 2 fields).                                                                                                                                                                                                                                                                                                                      |
| [tests/fixtures/pankow-golden-slots.json](../../tests/fixtures/pankow-golden-slots.json), [default-golden-slots.json](../../tests/fixtures/default-golden-slots.json) | `periodMonths` 4→3 (7 occurrences each — the bank slots across the F1/F2/F3 answer fixtures). Essen fixtures untouched.                                                                                                                                                                                                                                                                                                                              |
| [docs/document-rules/german_copy_for_roman.md](../../docs/document-rules/german_copy_for_roman.md)                                                                    | New section: the three C-2 rows as **AWAITING ROMAN** with the exact proposed German + today's live values — explicitly NOT live (gate answer 3).                                                                                                                                                                                                                                                                                                    |
| [docs/session-context.md](../../docs/session-context.md)                                                                                                              | Suppression-lift recorded; new ⚠ duration-coupling governance note (gate answer 1): if Pankow ever diverges from the intended default, decoupling becomes its own governance item.                                                                                                                                                                                                                                                                   |
| [docs/feedback/bank_docs_phase1.md](bank_docs_phase1.md) / this file                                                                                                  | Phase records.                                                                                                                                                                                                                                                                                                                                                                                                                                       |

**Item B: CLOSED at the gate** — mandatory since `20260813000001` (2026-08-13);
verified live 2026-08-29: zero locked cases lack the answer, the three
unanswered cases are all `in_progress` and get asked naturally. No code, no
migration, no defer-button change.

## Ledger

No new German shipped anywhere in this pass. The three C-2 drafts are in the
ledger as **AWAITING ROMAN** (nothing live); his ruling ships later as its
own one-row content migration.

## Verification

- `npm run verify` (typecheck + ESLint + Prettier + encoding): **green**.
- `npm test`: **276/276 passed** (was 279: the four suppression tests
  became one Essen-value test — net −3, intended).
- **e2e: PENDING the migration push.** F1/F2 now assert "(letzte 3
  Monate)", which exists only after `20260829000001` is applied — running
  the suite first would fail by design. Sequence (same as the 2026-08-13
  precedent): founder reviews + pushes the migration (please paste the
  NOTICE output), agent verifies end state read-only, then the full suite
  runs and its results are appended here.

## Deferred

- C-2 completion copy → Roman (ledger); ships as a one-row migration later.
- Duration decoupling → governance item, only if Pankow ever diverges from
  the intended default (session-context note).
- Sparkonto document rule → out of scope by the brief; the mechanism
  (per-rule `period_months`) covers it whenever such a rule row is added.

## E2E results (after the founder's push, 2026-08-29)

- **Migration pushed by the founder** (`supabase db push`); every NOTICE
  matched the impact report (before 4/4, after 3/3, governance re-proven,
  ESS untouched). End state re-verified read-only: PAN-005/006
  column=3 + jsonb mirror=3, ESS-010/011 = 4, all active.
- **Full suite, local** (warm dev server, `--workers=2`, fresh fixture,
  explicit `E2E_BASE_URL`): **21 passed, 1 failed, 13 skipped** (the
  standing known skips). All three fallback-notice guards — this pass's
  core asserts: F1 fallback "(letzte 3 Monate)", F2 Pankow "(letzte 3
  Monate)", F3 Essen "(letzte 4 Monate)" — **passed**.
- The 1 failure was `completion.spec` at C7's upload-drain poll
  (missing-slot count stuck one refresh too long) — a path this pass does
  not touch, and `documents-m6` (same upload mechanism) passed in the same
  run. **Re-run in isolation with a fresh fixture: PASSED (1.7m), C1–C7
  all green** — including C6, which exercises the locked docs-variant WITH
  the new C-1 counter rendered, and C7 itself. Classified as the known
  local-stall flake (same class as the desktop-round T2 instance,
  2026-08-28); no spec modified.
- Net: **all 22 non-skipped specs green** against the post-migration data
  - new code.
