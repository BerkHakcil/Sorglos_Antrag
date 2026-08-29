# Bank-statement durations + two questionnaire fixes — Phase 1 discovery

> **Status: awaiting GATE 1.** Written 2026-08-29 (read-only: repo reads +
> SELECT-only prod queries via the service key; zero writes, zero DDL, no
> migration files). Base: `main` = `65ff6e3` (desktop round 1 live).
> Roman's ruling (2026-08-29): **Pankow = 3 Monate, Essen = 4 Monate,
> default = 3 Monate** — the default covering mapped offices without a
> specific ruling AND unmapped-PLZ fallback cases. Sparkonto document rules
> stay out of scope (none exists today; the mechanism below extends to one
> trivially — a future rule row with its own `period_months`).

---

## P1-A1 · How Kontoauszüge rules and labels are stored and resolved

**There is no hardcoded "(letzte 4 Monate)" anywhere in code or catalog.**
The parenthetical is assembled at render time from three data pieces:

| Piece         | Where                                                                                                                                                                                                                                                                 | Live value                                                                                                                                                                                                                                                            |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Document name | `document_catalog` row `DOC-0003` (`bank_statements`)                                                                                                                                                                                                                 | `Kontoauszüge` — no parenthetical                                                                                                                                                                                                                                     |
| Duration      | `office_document_rule.period_months` (INTEGER, nullable) — plus a **redundant copy** inside the `condition` jsonb's repeat node (seed-time mirror of the office master; **runtime reads only the column** — [document-rules.ts:319,332](../../lib/document-rules.ts)) | exactly 4 rules carry a period, all `4`: **PAN-005** (applicant bank, Pankow), **PAN-006** (spouse bank, Pankow), **ESS-010** (applicant, Essen), **ESS-011** (spouse, Essen). ESS rows also carry `period_anchor: application_date` in the jsonb (inert at runtime). |
| Template      | `static_content` `docs.period_suffix`                                                                                                                                                                                                                                 | `(letzte {n} Monate)`                                                                                                                                                                                                                                                 |

`periodSuffix(periodMonths, template, fromFallbackRules)`
([document-rules.ts:252-260](../../lib/document-rules.ts)) fills `{n}`;
`n = 1` deliberately renders nothing (plural-grammar guard, R3). Two render
sites: the checklist ([document-area.tsx:252-255](../../app/case/document-area.tsx))
and the ops export ([case-export.mjs:316-318](../../scripts/case-export.mjs))
— checklist parity by design.

**Why the live UI shows the suffix in one context and not another:**
`fromFallbackRules=true` suppresses the suffix **wholesale** (founder
decision 2026-08-11: the period was an office-specific claim the generic
fallback list must not make). Mapped-office lists with own rules (Pankow,
Essen) show it; every fallback-served list — unmapped PLZs AND mapped
offices without own rules ([rules-source.ts:85-107](../../lib/rules-source.ts))
— hides it. Same rule rows, different render flag. **Roman's new ruling
supersedes that decision:** the default now _does_ state a period (3), so
the suppression must be lifted (P1-A3).

## P1-A2 · Office inventory

388 offices in `social_office`. Both target offices exist as mapped offices:

- **Sozialamt Berlin-Pankow** = `11000000-0000-0000-0000-000000000001`
- **Sozialamt Essen** = `10000000-0000-0000-0000-000000000162`

`app_config.default_document_office_id` → **Pankow**. The fallback branch
therefore serves Pankow's rule rows (minus exclusions) to every case whose
own office has no rules.

## P1-A3 · Design options + recommendation

**(i) Duration attribute on the office-rule mapping + label templating —
this is what is already built** (`period_months` per rule + `docs.period_suffix`
template). Implementing Roman's ruling needs **zero new mechanism**:

1. **Data migration (2 rows):** `PAN-005`, `PAN-006` → `period_months = 3`,
   and the mirror value inside each row's `condition` jsonb 4 → 3 (kept in
   lockstep so the stored master copy cannot mislead a future reader;
   runtime behavior comes from the column alone). ESS-010/011 stay 4 —
   Essen's ruling equals today's value.
2. **Code change (small):** lift the fallback suppression so fallback lists
   render the suffix from the rows they already serve (Pankow's → "(letzte
   3 Monate)"). Cleanest form: delete the `fromFallbackRules` parameter from
   `periodSuffix` and the pass-through props/args at both call sites
   (document-area.tsx, case-export.mjs, page.tsx prop) — a deliberate,
   founder-gated REVERSAL of the 2026-08-11 suppression.

**(ii) Per-office label overrides** (office-specific `name_de` variants or a
label-override table): rejected — duplicates the document name per office,
adds a new table/rows for something the existing column already encodes, and
un-DRYs the storage-path/name relationship.

**Coupling note (accept or defer):** "default = 3" is implemented as
"the fallback serves Pankow's rows, and Pankow is 3". Default duration and
Pankow's duration are the same physical value. If Roman ever rules them
apart, a decoupled default needs new storage (that WOULD be schema DDL) —
not built now (rule #10).

**GOVERNANCE re-review (required deliverable):**
`app_config.fallback_excluded_rule_ids` = `["PAN-016","PAN-017","PAN-018"]`
(Line-A trio: DOC-0009/0010/0011). All three verified live: they exist, are
`active`, and belong to Pankow's set. The period UPDATE changes **no rule's
membership, id, active flag, or requirement_type** — it edits an attribute
of PAN-005/006, which are not excluded and stay in the fallback set.
**Conclusion: `fallback_excluded_rule_ids` requires NO update.** The Phase-2
migration will still carry an execution-time assert (exclusion ids exist +
active) so the re-review is re-proven at push time, per the standing rule.

## P1-A4 · Blast radius

- **Display-time only, confirmed.** The suffix is computed on every render;
  no case data stores it. Stored filenames come from the catalog name via
  `lib/storage-path.ts` (never the suffix — pinned by
  [storage-path.test.ts](../../tests/unit/storage-path.test.ts)). No copy of
  "(letzte 4 Monate)" exists in `answer`, `document_upload`, or filenames.
- **Uploads on affected rules (live):** 3 uploads on PAN-005 across 2 cases
  (fallback-served cases), 0 on PAN-006/ESS-010/ESS-011. Uploads attach by
  `(rule_id, instance_key)` — unchanged by a period edit. **No re-upload
  logic exists anywhere; nothing is expected of these files** — they simply
  sit under a slot whose displayed suffix changes.
- **Who sees what today → after** (8 live cases): 0 Pankow cases (nobody
  currently sees Pankow's "4"); 1 Essen case — sees "(letzte 4 Monate)",
  **unchanged**; 7 other-mapped cases — fallback lists, **no suffix today →
  "(letzte 3 Monate)" after** (the intended new claim).
- **Spec/fixture inventory asserting Kontoauszüge/period text** (the P2-5
  edit list):
  | Surface | Today asserts | Needed change |
  | --- | --- | --- |
  | [fallback-notice.spec.ts:142](../../tests/e2e/fallback-notice.spec.ts) (F1, fallback 21682) | `(letzte` has count 0 | flip: expect "(letzte 3 Monate)" visible |
  | [fallback-notice.spec.ts:174](../../tests/e2e/fallback-notice.spec.ts) (F2, Pankow 13187) | "(letzte 4 Monate)" visible | → "(letzte 3 Monate)" |
  | [fallback-notice.spec.ts:190](../../tests/e2e/fallback-notice.spec.ts) (F3, Essen 45127) | "(letzte 4 Monate)" visible | unchanged (guard stays) |
  | [period-suffix.test.ts](../../tests/unit/period-suffix.test.ts) | suppression describe-block (`fromFallbackRules=true` → `''`) | rewrite to the new signature/behavior |
  | [pankow-rules.snapshot.json](../../tests/fixtures/pankow-rules.snapshot.json) | mirrors DB rows: `period_months: 4` | 4 → 3 (PAN-005/006, column + jsonb) |
  | [pankow-golden-slots.json](../../tests/fixtures/pankow-golden-slots.json), [default-golden-slots.json](../../tests/fixtures/default-golden-slots.json) | slots with `periodMonths: 4` | 4 → 3 |
  | essen fixtures ([essen-rules.normalized.json](../../tests/fixtures/essen-rules.normalized.json) etc.) | 4 | unchanged |
  | [verify-baseline.mjs](../../scripts/verify-baseline.mjs) | live ↔ migration-replay diff | self-heals once the migration is committed; no edit |
  | [verify-fallback-doclist.mjs](../../scripts/verify-fallback-doclist.mjs) | matches by rule id | unaffected (re-verified in P2) |

---

## P1-B1 · What makes the Betreuung question optional — **finding: nothing, anymore**

The question exists once per questionnaire (+ a spouse variant each):

| Questionnaire | Question                                                                                   | Key                            | `is_required` (LIVE) | Options (live)                                                               |
| ------------- | ------------------------------------------------------------------------------------------ | ------------------------------ | -------------------- | ---------------------------------------------------------------------------- |
| Berlin        | `60000000-…-0013` "Haben Sie eine gesetzliche Betreuung oder eine bevollmächtigte Person?" | `power_of_attorney`            | **true**             | Nein · Gesetzlicher Betreuer · Bevollmächtigter Angehöriger · Beistandschaft |
| Essen         | `61000000-…-0011` (same prompt verbatim)                                                   | `legal_guardian_yes_no`        | **true**             | Ja · Nein                                                                    |
| Berlin spouse | `60000000-…-0079`                                                                          | `spouse_power_of_attorney`     | **true**             | (marital-gated)                                                              |
| Essen spouse  | `61000000-…-009b`                                                                          | `spouse_legal_guardian_yes_no` | **true**             | (marital-gated)                                                              |

History: tier7 (2026-07-05) made Berlin's optional
([20260705000001:99](../../supabase/migrations/20260705000001_tier7_content_pass.sql));
**go-live round 2 item 1 flipped it back to required on 2026-08-13**
([20260813000001_berlin_power_of_attorney_required.sql](../../supabase/migrations/20260813000001_berlin_power_of_attorney_required.sql),
pushed — the live values above prove it). Essen's was always required.

**The residual "skippable" perception** is the universal "Später
beantworten" defer control, which every question carries. It cannot
permanently skip a required question: the deferred question is re-asked
once the queue empties, the re-ask hides the skip control
([chat-view.tsx:379](../../app/case/chat-view.tsx) `!isReask`,
[chat-view.tsx:1005-1006](../../app/case/chat-view.tsx) re-ask guard), and
the server-side completion gate recomputes `allRequiredAnswered` from
answers alone — no skip state — before flipping to `under_review`
([actions.ts:249-255](../../app/case/actions.ts)). A case can no longer
reach `under_review` without answering this question.

**Unanswered count (live, SELECT):** 3 of 8 cases lack the answer — all
Berlin, **all `in_progress`** (created 2026-07-31 / 08-16 / 08-25). The one
Essen `under_review` case has answered ("Ja"). **Zero locked cases lack the
answer.**

## P1-B2 · Effect of "flipping" on existing cases — **n/a, with one confirmation**

There is nothing left to flip, so: no completion-% change, no
`under_review` case regresses, no lost progress. The 3 in_progress cases
will simply be served the question as their next unanswered required
question on their next visit (it sits at sort 20 of category 1, so it comes
up before their newer unanswered questions) — the exact behavior the
2026-08-13 migration's impact report already accepted. **No backfill, no
migration, no policy decision required** — unless the founder wants the
defer control itself removed for this one question (→ Gate Q3; that would
be a NEW per-question mechanism, e.g. a `no_defer` flag in `validation`
jsonb + client support — data-only, no DDL, but new machinery for marginal
gain, since deferral already cannot survive to completion).

---

## P1-C1 · Completion message: copy + "done" logic (current state, verbatim)

**The status flip ignores documents by design** — `under_review` fires when
all required questions are answered ([actions.ts:249-255](../../app/case/actions.ts)),
documents pending or not. The **cards are docs-aware** since go-live
round 2 (2026-08-13): both read the live `missingDocs` count (same number
as the tab badge).

What the user actually sees after the last answer (live German, verbatim):

1. **Transient all-answered card** (seconds, until refresh swaps in the
   locked card; [chat-view.tsx AllAnsweredCard](../../app/case/chat-view.tsx)):
   - `case.all_answered_heading`: **„Alle Fragen beantwortet"**
   - `case.all_answered_message`: **„Sie haben alle Fragen beantwortet.
     Bitte laden Sie noch fehlende Unterlagen hoch — danach prüfen wir Ihre
     Angaben."**
   - plus (only if `missingDocs > 0`) button `case.locked_docs_button`:
     **„Zu den Dokumenten"**
2. **Locked card, documents missing** (`missingDocs > 0` — the docs-aware
   variant):
   - `case.locked_docs_heading`: **„Es fehlen noch Unterlagen"**
   - `case.locked_docs_body`: **„Sie haben alle Fragen beantwortet — vielen
     Dank. Damit wir Ihren Antrag prüfen können, laden Sie bitte noch die
     fehlenden Unterlagen hoch."**
   - button **„Zu den Dokumenten"**, and „Nächste Schritte" list prefixed
     with `case.next_steps_upload`: **„Sie laden die noch fehlenden
     Unterlagen hoch."**
3. **Locked card, nothing missing**:
   - `case.locked_heading`: **„Ihr Antrag wird geprüft"**
   - `case.locked_body`: **„Wir prüfen Ihre Angaben und Unterlagen. Sie
     müssen nichts weiter tun — wir melden uns bei Ihnen."**

**The genuine gaps** (vs. the founder's complaint):

- No card states a **count** of outstanding documents (the badge and docs
  pane do; the completion cards say only "fehlende Unterlagen").
- The transient card's copy is static: at `missingDocs = 0` it still says
  „Bitte laden Sie noch fehlende Unterlagen hoch" (wrong claim), and at
  `missingDocs > 0` its heading still reads as a completion celebration.
- No wording says explicitly that the **application** is not yet complete —
  "questions ≠ application" is implied, not stated.

## P1-C2 · Proposed structure

**C-1 — count injection, code-only, NO new German:** render the existing
Roman-approved counter line (`docs.missing_count` „Es fehlen noch {n}
Dokumente." / `docs.missing_count_one` / `docs.all_uploaded` — the same
rows the docs pane shows) inside the all-answered card and the locked
docs-variant, beneath the body. Both cards already receive `missingDocs`;
this reuses approved German and can ship without Roman.

**C-2 — copy sharpening, PLACEHOLDER_DE drafts (ledgered for Roman; ship
as interim only if the founder approves at the gate):**

| Row                                                                                                  | Proposal (PLACEHOLDER_DE draft — NOT Roman's voice)                                                                                                                          |
| ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `case.all_answered_docs_message` (NEW; shown at `missing > 0` instead of the current static message) | `Sie haben alle Fragen beantwortet. Ihr Antrag ist damit noch nicht vollständig: Es fehlen noch Unterlagen. Bitte laden Sie diese hoch — erst dann können wir alles prüfen.` |
| `case.all_answered_message` (UPDATED; then serves `missing = 0` only)                                | `Sie haben alle Fragen beantwortet und alle Unterlagen liegen vor. Wir prüfen jetzt Ihren Antrag und melden uns bei Ihnen.`                                                  |
| `case.locked_docs_heading` (UPDATED, optional sharpening)                                            | `Fragen beantwortet – Unterlagen fehlen noch`                                                                                                                                |

Mechanics: `''`-degradation stays the rollout contract (missing rows → the
current behavior), so code may deploy before the rows land (benign row-add
class, CLAUDE.md rule #8). All three strings go on the Roman ledger either
way; his final wording replaces the placeholders by one-line UPDATEs.

---

## P1-D · Migration surface summary

| #   | Migration                                                                                          | Type               | Scope                                                                                                                                                                                                   |
| --- | -------------------------------------------------------------------------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M1  | `office_document_rule`: PAN-005 + PAN-006 `period_months` 4→3 and the `condition` jsonb mirror 4→3 | **data** (2 rows)  | Pankow's own lists AND every fallback list (they serve these rows). Guards: before-state assert (=4), row-count assert, governance assert (exclusion ids exist + active). Impact report first, per row. |
| M2  | `static_content`: Item-C rows per gate decision (1 INSERT + up to 2 UPDATEs)                       | **data** (≤3 rows) | Completion cards only; `''`-degrading, benign-order class. Written only after copy approval.                                                                                                            |
| —   | Item B                                                                                             | **none**           | Already shipped 2026-08-13 (`20260813000001`).                                                                                                                                                          |

**No schema DDL anywhere.** Code changes ride alongside: suffix
un-suppression (A), counter injection + message-variant switch (C), plus
the P2-5 spec/fixture edits listed in P1-A4.

---

## GATE QUESTIONS

1. **A design (P1-A3):** approve (i)-as-built — PAN-005/006 → 3 (column +
   jsonb mirror), Essen untouched, and **lifting the 2026-08-11 fallback
   suffix suppression** so fallback lists show "(letzte 3 Monate)" (this
   explicitly reverses that earlier founder decision, superseded by Roman's
   default ruling — please confirm the reversal). Also confirm the coupling
   note: "default duration" stays physically Pankow's value; decoupling is
   deferred until Roman ever rules them apart.
2. **B (P1-B1/B2):** confirm classification **DONE** — mandatory since the
   2026-08-13 migration, zero locked cases affected, the 3 in_progress
   cases get asked naturally, no backfill. OR: should the "Später
   beantworten" defer control additionally disappear for this one question
   (new per-question mechanism — not recommended)?
3. **C (P1-C2):** C-1 (count injection, no new German) — approve? C-2
   drafts — approve as interim PLACEHOLDER_DE copy (ledgered for Roman),
   send to Roman first, or drop? Any wording adjustments are yours to make
   here.
4. **P2-5 edit list (P1-A4 table):** approve the enumerated spec/fixture
   changes, including flipping F1's no-suffix assertion into a
   suffix-present assertion.

=== HARD STOP — Phase 2 begins only after "GATE 1 APPROVED" + answers. ===
