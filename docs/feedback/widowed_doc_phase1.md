# Widowed → death certificate — Phase 1 (read-only discovery)

> 2026-08-29. Business rule under review (founder-provided): "when the
> applicant's marital status is widowed, the document checklist must require
> the deceased spouse's death certificate — universal: Pankow, Essen, and
> the default/fallback list alike. Currently nothing is asked."
>
> Discovery was read-only: repo sources + a GET-only REST probe against prod
> (scratchpad `widowed-discovery.mjs`, modeled on
> `scripts/verify-fallback-doclist.mjs`; zero writes, zero migration files).

## Classification: **DONE** (live-verified) — with one optional PARTIAL (test coverage)

The requested rule **already exists in production, in exactly the requested
universal shape, and is live-proven**: all three widowed cases in prod show
the Sterbeurkunde slot today, and two of them have already uploaded the
document against it.

The premise "currently nothing is asked" is the same observation Roman made
in go-live round 2 (2026-08-13) and it was root-caused then:
`docs/feedback/roman_package_round2.md` item 1 — his test case had **not yet
answered the Familienstand question**, and an unanswered condition shows no
slot by design ("keine Antwort, keine Vermutung", fail-closed leaf semantics
in `lib/document-rules.ts` `leafHolds`). The only real gap found then was
Essen, and Roman's "JA" closed it as ESS-056 the same day (migration
`20260813000007`). Nothing has been deactivated or excluded since.

## P1-1 — The question, the option, the live cases

**Question + option (prod, verified by SELECT):**

| Questionnaire | Question | id | active | Widowed option value |
|---|---|---|---|---|
| Berlin `30000000-…-0001` | `marital_status`, sort 7, "Was ist Ihr Familienstand?" | `60000000-0000-0000-0000-00000000000a` | true | `verwitwet` (label "verwitwet", sort 6) |
| Essen `30000000-…-0003` | `marital_status`, sort 8, same prompt | `61000000-0000-0000-0000-00000000000b` | true | `verwitwet` (label "verwitwet", sort 4) |

The option value is byte-equal `verwitwet` in both questionnaires (ESS-056's
migration guard re-verified this char-for-char at push time). The only other
marital-shaped questions in prod are `child_marital_status` (both
questionnaires; irrelevant to the rule) and `marital_status_since`. A legacy
`familienstand` question exists only in old migration files — **no such row
exists in prod**. The fallback questionnaire `30000000-…-0002` has no
marital-status question, and no live case uses it.

**Live cases carrying `verwitwet` (8 cases total in prod):**

| Case | Status | Questionnaire | Rules source | DOC-0016 slot | Upload |
|---|---|---|---|---|---|
| `52e364f1` | under_review | Berlin | fallback | PAN-025/default — shown | **yes** (missing 0) |
| `78293a6c` | under_review | Berlin | fallback | PAN-025/default — shown | **yes** (missing 5, other docs) |
| `e29041c5` | in_progress | Berlin | fallback | PAN-025/default — shown | not yet |

Breakdown: widowed 3 (1 in_progress, 2 under_review). `case_status` has only
those two values — there is no further locked state. Non-widowed: 5 (3
in_progress, 2 under_review); none shows a DOC-0016 slot — correct absence
confirmed for verheiratet/ledig/unanswered alike.

## P1-2 — How conditional document rules work today

- **Rule shape:** `office_document_rule.condition` JSONB; leaf operators
  `equals` / `not_equals` / `includes`, nesting via `any`/`all`, slot
  multiplication via `repeat_for_each`. Evaluated by the pure engine
  [document-rules.ts](../../lib/document-rules.ts) (`conditionHolds` →
  `evaluateDocumentRules`); unanswered fields never match (fail-closed).
  Disability gate (`20260813000003`) and the marital `any`-gates are the
  established conditional precedents; PAN-025/ESS-056 are the simplest form
  (single `equals` leaf).
- **Source ladder:** [rules-source.ts](../../lib/rules-source.ts)
  `resolveEffectiveRules` — own office's active rules unfiltered; else the
  default office's active rules minus `fallback_excluded_rule_ids`; else
  none. Exactly two offices own rule sets (Pankow = default office, Essen).
- **Checklist:** [dal.ts:304](../../lib/dal.ts) `getDocumentData` fetches
  active rules + catalog + uploads per render; slots are **recomputed
  display-time on every request** — nothing is materialized
  (`case_document_requirement` exists in the schema but has zero app/script
  references).
- **Counter / completion:** missing = `countMissingSlots`
  ([document-rules.ts:263](../../lib/document-rules.ts)) — every emitted
  slot is required by construction; conditional rules are required-when-
  triggered. The case completion gate
  ([actions.ts:249](../../app/case/actions.ts)) flips `under_review` on
  `nav.allRequiredAnswered` — **answers only; document slots never gate
  case status**.
- **Export parity:** [case-export.mjs](../../scripts/case-export.mjs)
  imports the *same* modules (`evaluateDocumentRules`,
  `resolveEffectiveRules`, `classifyUploads` — lines 24–37, used at 280,
  291, 336). Parity is by construction since the fallback-docs fix
  (2026-08-26), not by hand-sync. Confirmed: conditions are honored
  identically; hidden uploads export as `not_required`.

## P1-3 — Design vs. actual state

The expected shape ("one catalog row + per-office conditioned rules") is
**exactly what prod already holds**:

| Row | State (prod, live SELECT) |
|---|---|
| `document_catalog` `DOC-0016` | `spouse_death_certificate`, name_de **"Sterbeurkunde Partner"**, category person, storage Personal, **active** |
| `PAN-025` (Sozialamt Berlin-Pankow) | conditional, person_1, period NULL, `{"field":"marital_status","operator":"equals","value":"verwitwet"}`, **active** — shipped with M5R2 (`20260711000006`) |
| `ESS-056` (Sozialamt Essen) | identical condition/shape, **active** — Roman-approved 2026-08-13 (`20260813000007`) |

Fallback pickup is automatic: the fallback branch serves the default
office's (Pankow's) active rows, PAN-025 included — live-proven by all three
widowed cases above (all fallback-served). Required flag: covered by
`requirement_type='conditional'` semantics (P1-2).

**Rows a migration would insert: NONE.** There is no third mapped office
set; universality is complete: Pankow ✓ own, Essen ✓ own, fallback ✓ via
default office.

## P1-4 — GOVERNANCE re-review: `fallback_excluded_rule_ids`

Live value (SELECT 2026-08-29): `["PAN-016","PAN-017","PAN-018"]` — the
Line-A trio, unchanged. **PAN-025 is not excluded**, so the fallback list
carries the rule; confirmed both structurally and by the three live
fallback-served widowed cases. **Outcome: COMPLIANT, no change needed.**
Since this pass ships **no migration touching PAN rules** (P1-8: no
migration at all), there is nothing for a migration to re-assert; this
section is the required re-review record. Should the founder nonetheless
commission the optional test work (P1-7), it is pure test code and does not
touch the exclusion list either.

## P1-5 — Existing-case impact

**None — no data or code change occurs.** For the record, the mechanics the
founder asked about: checklists recompute display-time (P1-2), so a new
conditional slot *would* simply appear on the next render, including for
`under_review` cases (whose lock stops answer edits only —
[actions.ts:156](../../app/case/actions.ts) — not checklist recomputation
or uploads). Here even that is moot: the three widowed cases have carried
the slot since they answered the question; `52e364f1` completed it
(missing 0) — no status, completion-count, or ops-view movement of any
kind. No regression scenarios exist.

## P1-6 — German inventory

**Empty.** The checklist renders the catalog name only (plus period suffix
when `period_months` is set — PAN-025/ESS-056 carry NULL, so none). The
live name **"Sterbeurkunde Partner"** comes from Roman's Pankow rules
master (DOC-0016) and shipped with M5R2; `document_catalog` has no
description/hint column, so no additional string surface exists. **Nothing
is drafted and nothing goes AWAITING ROMAN** — no ledger entry needed.

## P1-7 — Test surface

Existing coverage of the widowed path:

- [essen-document-rules.test.ts:375-401](../../tests/unit/essen-document-rules.test.ts) —
  ESS-056: widowed → exactly one "Sterbeurkunde Partner" person_1 slot;
  non-widowed/unanswered → none ("PAN-025 semantics", fail-closed).
- [pankow-rules.snapshot.json](../../tests/fixtures/pankow-rules.snapshot.json) —
  carries PAN-025 + DOC-0016 (rule-set snapshot; no evaluation of it).
- e2e [feedback-pass.spec.ts](../../tests/e2e/feedback-pass.spec.ts) L2/L4 —
  Berlin + Essen `verwitwet` full questionnaire drives, but they assert
  question counts / zero Partner prompts, **not** the document checklist.

**Gaps (the only PARTIAL candidate in this pass):**

1. No unit test evaluates `verwitwet` against the **Pankow** rule set —
   [document-rules.test.ts](../../tests/unit/document-rules.test.ts) has
   zero PAN-025/verwitwet coverage; ESS-056's twin test is the only direct
   guard on this rule shape.
2. [pankow-answer-fixtures.mjs](../../tests/fixtures/pankow-answer-fixtures.mjs)
   stops at F1 verheiratet / F2 ledig / F3 dauernd getrennt lebend — no
   widowed fixture; neither golden-slots fixture includes a widowed
   scenario.
3. No e2e asserts the Sterbeurkunde slot **appears** in the docs pane for a
   widowed case and is **absent** otherwise. A widowed→slot assertion fits
   the existing structure (the L2 widowed drive already exists; a docs-pane
   assertion in the documents-spec style is a natural extension).

If commissioned, this is a self-contained Phase 2: an F4 widowed fixture +
unit assertions (PAN-025 slot present for `verwitwet`, absent for F1–F3),
optionally the e2e pair. Pure test code — no data change, no migration, no
German.

## P1-8 — Migration surface

**Zero migrations.** The expected "one data migration, no DDL" is **wrong
for this pass**: every row the design calls for already exists in prod
(verified live 2026-08-29, GET-only). No DDL, no data migration, no ledger
entry, no `de.ts` change. The only shippable work on offer is the optional
test coverage of P1-7.

---

## GATE QUESTIONS

1. **Design / classification approval:** Do you accept the **DONE**
   classification — the rule exists universally (PAN-025, ESS-056, fallback
   via default office) and is live-proven — so **no migration ships**? If
   your "nothing is asked" observation came from a current test: was
   Familienstand answered in that case at the time? (Round-2 root cause —
   an unanswered condition shows no slot by design.) If it came from a
   specific live case, give me the case id and I'll probe it read-only.
2. **P1-5 existing-case policy:** No case changes status, completion count,
   or ops view — there is nothing to migrate or recompute. Confirm no
   further action wanted on the three widowed cases.
3. **German sign-off:** The inventory is empty — the live catalog name
   "Sterbeurkunde Partner" (Roman's master, shipped M5R2) is the entire
   string surface; nothing is drafted, nothing goes AWAITING ROMAN. Confirm.
4. **Optional Phase 2 — test coverage (P1-7):** commission the widowed
   fixture + Pankow-side unit assertions (recommended: small,
   self-contained, closes the only guard gap on PAN-025), with or without
   the e2e widowed/non-widowed pair — or close this pass with no Phase 2?
