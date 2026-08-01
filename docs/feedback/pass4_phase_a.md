# Content Pass 4 — Phase A (read-only report)

> Produced 2026-08-01 against live prod (all figures from direct DB queries on
> that date; service-role read-only) and repo `main` @ `6d08dce`. No code, no
> migrations — this phase delivers designs and diffs only. Decisions D1–D16
> are Roman's locked decisions from the pass brief; nothing here re-litigates
> them. German package for Roman: `roman_package_pass4.md`.
> Resume file: `pass4_state.md`.

## 0. State verification — where live data corrects the brief or the docs

Everything the brief assumes was re-verified live. Four deltas matter:

1. **⚠ D10's premise is wrong on live data: Pankow's bank rules also carry
   `period_months = 4`.** The brief expects "the two Essen Kontoauszüge rules
   at 4" and "Pankow shows no suffix". Live: **ESS-010, ESS-011, PAN-005,
   PAN-006 all have `period_months = 4`** (the Pankow master's README policy
   was also 4 months — recorded at M5 kickoff). A render-wherever-non-NULL
   suffix WILL show on Pankow. Decision needed at this STOP — see §7.
2. **A third folder flip surfaced.** D9 names two known flips; verification
   found **DOC-0042 (Übertragungsvertrag mit Grundbuchauszug) is live
   `Housing`, Roman's assignment is `Financial`** → three UPDATEs, not two.
   See §5.
3. **Upload count moved:** 11 `document_upload` rows across 4 cases (docs say
   14 — three were deleted by their owners since 2026-07-30). All 11 are
   **legacy UUID paths**; zero files exist under the new
   `{Folder}/{Base}{n}` scheme in prod, so the D9 flips strand nothing at all.
4. **The D1 copy pair is confirmed byte-identical in the DB** (read, not
   inferred): `case.all_answered_heading` == `case.locked_heading` and
   `case.all_answered_message` == `case.locked_body`. D1's migration targets
   exactly these four `static_content` rows.

Everything else matches the record: 413 questions / 1016 options / 17
categories / 17 groups, catalog 43 (`storage_category` present), rules 105
(50 PAN with exactly PAN-011 inactive, 55 ESS), `app_config` default office =
Pankow, static_content 23 rows, Berlin flow = the pass-3 appendix table
verbatim (168 questions), Essen 245.

---

## A1. Pension impact design (D15) — the core deliverable

### A1.1 Current Berlin pension structure vs Roman's D15c spec

A repeatable pension group **already exists and already carries Roman's D15c
German verbatim** — all four prompts match his spec character-for-character:

| key              | live prompt (Berlin, prod)                             | D15c spec   | required | answer_type   |
| ---------------- | ------------------------------------------------------ | ----------- | -------- | ------------- |
| `pension_type`   | Welche Rente oder Pension bekommen Sie?                | identical ✓ | REQ      | single_select |
| `pension_amount` | Wie hoch ist diese Rente oder Pension pro Monat?       | identical ✓ | REQ      | amount        |
| `pension_id`     | Welche Abrechnungsnummer hat diese Rente oder Pension? | identical ✓ | REQ      | short_text    |
| `pension_issuer` | Von wem bekommen Sie diese Rente oder Pension?         | identical ✓ | REQ      | short_text    |

Group row: `50000000-…-0002`, key `pension`, category `income`, repeatable,
`min_count 0`, `max_count NULL`, `custom_prompt_de` "Möchten Sie weitere
Renten hinzufügen?". **Zero prompt migrations are needed for the four detail
questions.** What actually changes:

| item                                                                 | today                                                       | under D15                                                                                                                                      | note                                                                                                                                   |
| -------------------------------------------------------------------- | ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `hat_rente` (`60000000-…-0004`, yes_no REQ, unconditional)           | asked                                                       | **retired**                                                                                                                                    | §A1.2                                                                                                                                  |
| `rentenbetrag` (`60000000-…-0005`, amount REQ, vis `hat_rente = Ja`) | asked after Ja                                              | **retired**                                                                                                                                    | §A1.2                                                                                                                                  |
| `pension_count`                                                      | —                                                           | **NEW** single_select REQ, options 0–8, prompt verbatim "Wie viele Renten oder Pensionen bekommen Sie?", placed before the group (§A2 block 3) | new key + nine new permanent option values `"0"`…`"8"` (R4: additions only; no existing value is touched)                              |
| instance creation                                                    | add-another loop ("Möchten Sie weitere Renten hinzufügen?") | **count-driven ×N**, loop prompt suppressed                                                                                                    | §A1.3                                                                                                                                  |
| `pension_type` option "Keine Rente"                                  | exists (Tier-7)                                             | **obsolete → remove/deactivate** (count 0 replaces it)                                                                                         | see R4 note below                                                                                                                      |
| vis rules on amount/id/issuer (`in_values` of the 8 real types)      | gate on type                                                | **proposal: set NULL** (all four always asked per instance, matching "all required")                                                           | alternative: keep as a de-facto not_empty gate — but with "Keine Rente" gone they only delay the denominator; NULL is the honest count |
| netto clarification                                                  | none                                                        | **help_de on `pension_amount`**, e.g. "Bitte geben Sie den Nettobetrag an." — **PLACEHOLDER_DE**                                               | Roman permits a netto label; help_de is the existing mechanism, keeps his prompt untouched. NO gross question (D15e)                   |

**R4 check.** No existing option **value** changes. "Keine Rente" would be
_removed_ (an option-row deletion, as CP3 did for Hausrat), not re-valued;
the one real answer storing `"Keine Rente"` (case `298ac66b`, locked)
survives — `formatAnswerForDisplay` falls back to the raw stored string if no
option row matches, and §A1.5 backfills that case to `pension_count = 0` so
the instance is not rendered anyway. The 8 real type values stay byte-
identical, which keeps PAN-003's `repeat_for_each` labels and the E2
`match_values` machinery untouched.

`spouse_pension` is **out of scope** — the spouse group keeps its add-another
loop and its prompts (D15 is applicant-only; Essen untouched entirely).

### A1.2 Retirement mechanism for `hat_rente` / `rentenbetrag`

**The constraint that decides the design: the stale-answer sweep.** On every
save, `saveAnswerAction` deletes any answer row whose (question, instance) is
not in `buildNav().flatVisible`
([actions.ts:217](../../app/case/actions.ts)). So _any_ mechanism that merely
hides the pair — a never-match visibility rule, or dropping them from the
loader — makes the **next save on an in_progress case delete the preserved
answers**. Case `d345b0f9` is a real in_progress case holding real pair
answers; D15a says preserve. Hiding alone is therefore not enough.

**Recommended mechanism: `question.active boolean NOT NULL DEFAULT true`,
flip the pair to `false`** (the exact pattern Phase C used for
`office_document_rule.active`), with the filter applied at **both** read
sites:

1. `loadQuestionnaire` ([lib/questionnaire-engine.ts:61](../../lib/questionnaire-engine.ts))
   — retired questions never enter the loaded questionnaire: not rendered,
   not in the denominator, not a resume target.
2. `getCaseAnswers`'s keyMap query ([lib/dal.ts:98](../../lib/dal.ts)) — this
   is the load-bearing one. Rows whose question is missing from the keyMap
   are skipped when building `answersRaw` (dal.ts:106), and the sweep can
   only delete refs that appear in `answersRaw`
   ([questionnaire-nav.ts:87](../../lib/questionnaire-nav.ts)). Filtering
   here makes the preserved rows **invisible to the sweep** — they stay in
   the DB indefinitely.

Effects, verified against the engine:

- **Progress/denominator:** fresh Berlin today = 53, including `hat_rente`
  (unconditional) and `pension_type` (via the auto-created first instance).
  `rentenbetrag` is **not** in the fresh 53 (vis `hat_rente = Ja`). After
  D15: −1 `hat_rente`, −1 `pension_type` (no instances until
  `pension_count` is answered, §A1.3), +1 `pension_count` → **fresh 52**.
  ⚠ This corrects pass-3 A9's "53 → 51" note, which counted both pair
  members as fresh-visible; the live rule says only `hat_rente` is.
- **Resume:** retired questions can't be a resume target (not in
  `flatVisible`). Locked cases have no save path, so nothing fires there.
- **Ops export:** `scripts/case-export.mjs` queries the question table
  directly and unfiltered — **retired-question answers keep appearing in
  answers.md**. That is desirable (the team still sees the historical
  Rentenbetrag) and costs nothing; noted so it isn't "fixed" later.
- **verify-baseline:** the question SELECT + compared-column list gain
  `active` (Phase-C precedent), and the `criticalKeys` spot-check list
  ([verify-baseline.mjs:134](../../scripts/verify-baseline.mjs)) swaps
  `hat_rente`/`rentenbetrag` for `pension_count`.

Rejected alternatives: hard DELETE (cascades the real answers — violates
D15a and R6); never-match visibility rule (no schema change, but the sweep
deletes the answers on the next save, and the retired rows keep confusing
every future census).

R8 order: the migration (column + flips + `pension_count` insert + backfill)
is pushed and verified first; the dependent code (loader filter, keyMap
filter, count-driven engine) deploys after.

### A1.3 Count-driven rendering design

**Data:** new nullable column `question_group.count_source_key text` — set to
`'pension_count'` for the Berlin pension group only. Data-driven (rule #1):
no group key is hardcoded; any future group can adopt the mechanism.

**Derivation rule** (one pure helper, used everywhere): for a group with
`count_source_key`, N = integer value of `answers[count_source_key]`
(unanswered → 0). Instance list = existing instances that hold answers,
ordered by earliest `created_at`, truncated to N, topped up with fresh UUIDs
to reach N. Add-another (`groupPrompt`) is suppressed for such groups —
which, as a side effect, kills the long-flagged "Keine Rente quirk" (loop
prompt firing after "Keine Rente").

⚠ **Four sites currently derive group instances independently, and all four
must share the new helper** or slots/progress/export will disagree:

| site                                                                                  | today                                              | change                                                                                                                                                                                                                                                                                     |
| ------------------------------------------------------------------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `deriveGroupData` ([app/case/page.tsx:199](../../app/case/page.tsx))                  | auto-creates 1 instance per empty repeatable group | count cap; **no auto-instance** for count-driven groups                                                                                                                                                                                                                                    |
| `deriveGroupDataForCompletion` ([app/case/actions.ts:428](../../app/case/actions.ts)) | zero-UUID placeholder per empty group              | ⚠ the placeholder must NOT apply to count-driven groups — with `pension_count = 0` a placeholder instance would hold an unanswerable required `pension_type` and block completion forever. Count unanswered blocks completion via `pension_count` itself, so `[]` is correct in both cases |
| ChatView client state ([app/case/chat-view.tsx:375](../../app/case/chat-view.tsx))    | `useState` seeded from server                      | count-driven lists derived (memo) from `answersMap[count_source_key]`; non-count groups keep the useState path                                                                                                                                                                             |
| `scripts/case-export.mjs:95`                                                          | own copy, ordered by created_at                    | same helper/cap                                                                                                                                                                                                                                                                            |

Note the ordering fix that rides along: `getCaseAnswers` loads answers with
no ORDER BY, so instance order is currently whatever PostgREST returns;
the helper orders deterministically by first `created_at` (case-export
already does).

**Count decrease with data in higher instances — the open decision:**

- **Option A — confirm-and-clear (recommended).** Decreasing
  `pension_count` below the number of filled instances asks a German
  confirm (PLACEHOLDER*DE) before saving; on save, the instances beyond N
  leave `flatVisible` and the **existing stale-answer sweep deletes their
  rows** — which is exactly the engine's native semantics for hidden
  dependents today. Consistent with the invariant that hidden questions
  hold no answers — an invariant `lib/document-rules.ts` explicitly relies
  on (its header: no transitive visibility \_because* the sweep guarantees
  hidden questions have no answers). Re-increase re-asks fresh. Risk: a
  deliberate confirm still deletes data; mitigated by the dialog.
- **Option B — preserve + hide.** Instances beyond N stay in the DB,
  excluded from progress/docs/export. Requires a new sweep exemption for
  over-count instances (engine exception), leaves invisible personal data
  in the DB (data-minimization smell), silently breaks the sweep invariant
  the doc-rules evaluator documents, and needs its own exclusion logic in
  export. More code, more risk, worse GDPR posture.

Without any new UI, Option A minus the dialog is what the engine already
does; the dialog is the only addition. **Human decides at this STOP.**

**Progress math:** `pension_count` +1 required; each instance contributes 4
required members (vis NULLed per §A1.1). count 0 → group contributes 0;
count 3 → 12. **Skip/resume:** unchanged (compound `id:instance` keys; the
resume target is the first unanswered member of the first incomplete
instance). **Edit:** editing `pension_count` runs the normal edit-save path;
dependency re-eval is the same `buildNav` recompute + client derivation +
`router.refresh()` for the slots.

### A1.4 Document rules

**No rule migration is needed for the pension redesign.** PAN-003
(`{"repeat_for_each":"pension_type"}`, person_1) and PAN-004 (spouse) read
`groupInstances`/`groupAnswers` supplied by the caller — once the derivation
is count-capped, slots follow automatically: count 0 → zero instances → zero
slots (binding not inside `any`, so no E3 default slot); count N → one slot
per filled instance, labels `Rente n: <Typ>` as today. The evaluator's
`skipValues: ['Keine Rente']` stays as dead-but-harmless defence. Zero rules
reference `hat_rente`/`rentenbetrag` (re-verified live). ESS rules untouched.

### A1.5 Real-data report + backfill proposal

12 cases, 21 auth users on prod (2026-08-01). Cases with any pension-area
data (all Berlin questionnaire):

| case                                    | owner class            | status                    | pair answers                   | pension instances                                                                                                                   | proposed `pension_count` backfill                                                                                                                                                                                            |
| --------------------------------------- | ---------------------- | ------------------------- | ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `d345b0f9` (info@sorglosantrag.de)      | REAL (founder account) | in_progress               | hat_rente=Ja, rentenbetrag=2   | **2** — Altersrente complete; Unfallrente missing `pension_issuer`                                                                  | **2** (from instance count). Resume will ask the missing issuer — correct                                                                                                                                                    |
| `fc446257` (iremkarabulutlu@…)          | REAL                   | **under_review (locked)** | hat_rente=Ja, rentenbetrag=600 | **1** complete (Waisen Rente 500 — note it contradicts the 600 single field: Roman's §7 point, live) + 1 spouse_pension (untouched) | **1**. Keeps the locked case at 100 %                                                                                                                                                                                        |
| `298ac66b` (familiarize_professorial@…) | REAL                   | **under_review (locked)** | hat_rente=Nein                 | 1 instance holding only `pension_type = "Keine Rente"`                                                                              | **0** (a Keine-Rente instance is not a pension). ⚠ Visible side effect: the "Rente / Pension 1 — Keine Rente" exchange disappears from this user's locked chat history (rows preserved in DB + export). Flagged for approval |
| `88eede8b` (pw-completion fixture)      | TEST                   | under_review              | hat_rente=**Nein**             | 1 **filled real-type** instance (Erwerbsminderungsrente 100)                                                                        | ⚠ **Inference conflict** — instance rule says 1, hat_rente rule says 0. Recommend **1** (keeps its answered instance consistent); it is the re-seedable completion fixture either way. Human decides                         |

The remaining 8 cases have **zero** pension-area answers (none has reached
the block) → no backfill; `pension_count` is simply asked when they get
there. No case exists that is past the einkommen block without pension data.

Backfill shape: guarded, idempotent INSERT..SELECT per the Additive-Backfill
precedent (2026-07-23), no-op on local replay; Real-Data report re-run at
execution time per R2 before the founder pushes. Both locked cases must end
the migration at 100 % progress with status untouched — the table above is
chosen to guarantee that.

### A1.6 Test impact

| artifact                                    | impact                                                                                                                                                                                                                                                                                                |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tests/e2e/visibility.spec.ts`              | **V1 is built on the pair end-to-end** (drive heuristic at :170, DB ground-truth asserts at :271–:341). Replace V1 with a count-driven check (e.g. `pension_count = 2` → exactly two `pension_type` instances render; DB asserts on `pension_count` options/required). V2 (spouse_wohngeld) untouched |
| `tests/e2e/documents-m6.spec.ts`            | yes_no driver branch (:290 — "hat_rente is Berlin's only yes_no") goes dead; the pension loop-add (`Ja, hinzufügen` ×1, :273–:288) is replaced by `selectOverrides['pension_count'] = '2'` via the existing DB-loaded promptMap; expected slots unchanged (2 pension slots, A1 criterion intact)      |
| `tests/e2e/completion.spec.ts`              | driver-compatible as-is: its select heuristic picks "Nein"-else-first → `pension_count = "0"` → completes with no pension group. Its dead yes_no branch is cosmetic                                                                                                                                   |
| `tests/e2e/m7-regression.spec.ts`           | fallback leg asserts `von 53 Fragen` (:292, :323) → **52**                                                                                                                                                                                                                                            |
| `tests/e2e/feedback-pass.spec.ts`           | L1/L2 call `leakDrive(…, 53, …)` (:323, :327) → **52**                                                                                                                                                                                                                                                |
| `tests/fixtures/pankow-answer-fixtures.mjs` | carries `hat_rente` keys (:15, :41) — inert for doc rules (no rule reads it); remove for hygiene, goldens must stay byte-identical (proof the removal changed nothing)                                                                                                                                |
| `scripts/verify-baseline.mjs`               | question SELECT + compared columns + criticalKeys (§A1.2); `question_group` SELECT gains `count_source_key`                                                                                                                                                                                           |
| unit                                        | new count-driven suite per the Batch-2 list (0 → no group/slots; 3 → exactly 3 instances + 3 slots; decrease per decided semantics; resume mid-group; required blocking; completion-placeholder exemption)                                                                                            |
| docs                                        | `docs/uat-m7.md` + known-limitations denominators; the "Keine Rente quirk" limitation closes                                                                                                                                                                                                          |

---

## A2. Question order (D6)

**PLZ first is already structurally satisfied:** the routing PLZ is the
pre-questionnaire `PlzForm` step (`cases.plz_before_move`); no PLZ question
exists in either questionnaire (deleted in FP2). It stays first by
construction.

### A2.1 Proposed Berlin order

Full two-column diff (new # ↔ current #, all 167 rows): **appendix at the end
of this file**. Shape: 7 blocks in D6's order; the only cross-block
controllers are `marital_status` (Block 1 → Block 7) and
`apartment_ownership` (within Block 2) — every other visibility chain is
block-internal and keeps its controller-before-dependent order (full
constraint list in §A2.2). Summary of what moves:

| move                                                                                                                                                                                                               | why                                                                                  |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| `in_facility_since`, `last_residence_street/_city` out of antragsteller → **Block 2 Wohnung und Heim**, joining `berlin_since`/`berlin_district_since`/`apartment_ownership` + the 6 rent questions from einkommen | heals Roman's complaint #1 — the "frühere Wohnung" theme was split three ways        |
| within Block 1: Ausweise (`special_origin_*`, `disability_*`) now precede `power_of_attorney`, and the Sozialhilfe-Historie (`prior_social_aid*` + `prior_social_service_applications`) closes the block           | heals complaint #3 — Betreuung/Vollmacht no longer sits between history and Ausweise |
| `hat_rente`/`rentenbetrag` gone; `pension_count` + pension group open **Block 3 Einkommen**, followed by Wohngeld and weiteres Einkommen                                                                           | heals complaint #2 (double capture, D15)                                             |
| `health_insurance`, `health_insurance_type`, `care_level` out of antragsteller; whole expenditure category; `funeral_insurance_*` trio out of wealth → **Block 5 Versicherung und Pflege**                         | D6's block exists today only scattered across three categories                       |
| kinder moves from position 3 to the end, after the spouse section → **Block 7 Partner, Familie, Unterhalt**                                                                                                        | D6: family block last; Berlin has no Unterhalt questions (Essen-only)                |

**Judgment calls the human should confirm before Batch 3** (all four also
flagged FYI to Roman):

1. **Funeral trio → Block 5** (document layer files Bestattungsvorsorge under
   Insurance) — alternative: stay in Vermögen (Essen keeps it in wealth).
2. **Partner before Kinder** inside Block 7 (reads the block name literally);
   alternative Kinder first — for unmarried users the block then opens with
   children either way, since the spouse section is hidden.
3. **`costly_diet` (Weitere Angaben)** kept as its own mini-block before
   Block 7, mirroring Essen's additional-before-spouse; alternative: very end.
4. **Category labels.** The reorder is a category restructure (9 → 7
   categories). Existing labels cover Persönliches ("Angaben zur
   pflegebedürftigen Person"), Vermögen, Kinder, Ehepartner/Lebenspartner,
   Weitere Angaben. **"Wohnung und Heim", "Einkommen", "Versicherung und
   Pflege" as _visible section labels_ come from Roman's D6 block names** —
   ship-as-labels needs his nod (they are quoted from his decision, but as
   block names, not explicitly as user-facing labels). Asked in the package.

Implementation notes for Batch 3 (no action now): pure content migration —
category rows + `sort_order` + `category_id` moves; ids of questions never
change, so answers/rules/uploads are untouched. The chat's section pills and
history grouping follow `category` automatically. e2e drives are
order-agnostic (adaptive loops), but the German-text-coupled heuristics
(`transitive-visibility-fix` T1's vertriebenen/spätaussiedler matcher,
documents-m6 promptMap overrides) must be re-run and re-verified; the
denominators are order-invariant.

### A2.2 Visibility dependencies that constrain placement (Berlin, complete)

`marital_status` → 37 spouse-gated questions (Block 1 → Block 7 ✓);
`german_citizenship_yes_no` → `citizenship`; `prior_social_aid` → 3;
`special_origin_rights` → 2; `disability_card` → 3 (incl. the Nein-gated
application question); `apartment_ownership` → 5 rent questions +
`rent_contract_termination_yes_no` → `rent_contract_terminated_by`;
`children_yes_no` → `child_first_name` → 7 chained members;
`pension_type` → 3 members (in-instance); `wohngeld_yes_no` → 2;
`other_income` → group; `govermental_employee` → 2;
`general_liablity_insurance_yes_no` → 2; `life_insurance` → 4;
`funeral_insurance_yes_no` → 2; `bank_savings_account_yes_no` → 2;
`bank_additional_account_yes_no` → group; `automobile_owner` → 4;
`property_yes_no` → 3; `additional_wealth_yes_no` → group; spouse-internal
chains mirror the applicant ones. Every controller precedes its dependents
in the proposed order; no rule crosses blocks except `marital_status`.

### A2.3 Essen block check (report only — no proposal)

Essen follows Roman's own master, but against D6's block rules it shows:

1. **Familie + Unterhalt sit at position 2** (kinder: children, then
   `maintenance_claims_status` + 8 `ex_partner_*`), before Einkommen and
   Vermögen — D6 puts Partner-Familie-Unterhalt last.
2. **The health/care insurance block (#56–67) opens the income category** —
   under D6 that is Versicherung-Pflege material, placed after Vermögen.
3. Insurance amounts live inside expenditure's bulk block (#87 Haftpflicht,
   #88 Kfz, #90 Sterbegeld) — inherent to the bulk design; splitting them
   out would break the bulk pattern.
4. Bestattungsvorsorge + Lebensversicherung sit in wealth (#101–105).
5. The Ausland block (#132–135, lived-abroad history) sits in wealth.

Spouse-last ✓, Wohnsituation directly after Persönliches ✓, personal data
first ✓. Reported to Roman as FYI only; his master is the source.

---

## A3. Perspective diff (D5): "Sie/Ihr = die pflegebedürftige Person"

Method: full prompt + help scan of both questionnaires (413 questions) for
third-person forms and non-question label prompts. **Essen: zero
violations** — it is uniformly second-person. **Berlin: exactly five rows**,
two of which retire under D15:

| pos | key            | current prompt                                              | proposal (NOT approved — Roman decides)    |
| --- | -------------- | ----------------------------------------------------------- | ------------------------------------------ |
| 1   | `first_name`   | Vorname der pflegebedürftigen Person                        | Wie lautet Ihr Vorname? _(Essen wording)_  |
| 3   | `last_name`    | Nachname der pflegebedürftigen Person                       | Wie lautet Ihr Nachname? _(Essen wording)_ |
| 4   | `geburtsdatum` | Geburtsdatum der pflegebedürftigen Person                   | Wann wurden Sie geboren? _(Essen wording)_ |
| 36  | `hat_rente`    | Erhält die pflegebedürftige Person Rente?                   | — retires with D15, no rewording needed    |
| 37  | `rentenbetrag` | Monatlicher Rentenbetrag (€) _(label style, no Sie at all)_ | — retires with D15                         |

Deliberately NOT flagged as violations: the category label "Angaben zur
pflegebedürftigen Person" and the patient banner (they _state_ the D5 rule
rather than break it), the signup consents (they address the caregiver — the
account holder — correctly), and all "Ihr Partner / Ihres Partners" phrasing
(consistent with D5: the partner of the care recipient).

Ships only after Roman approves the wordings (Batch 3). Note for Batch 3:
none of the three prompts is an e2e text anchor (checked against every
`getByText`/`includes` heuristic in `tests/e2e/`).

---

## A4. Partner section before/after (D12 — proposals for Roman)

The substance is Essen's four spouse bulk-block intros. The applicant and
spouse versions don't mirror: three of the four spouse intros never name the
partner, so mid-section they read as if they were about the applicant again
— exactly the ambiguity D5 is meant to kill.

| key                            | current (live)                                                                     | applicant counterpart                                                        | proposed harmonized version (NOT approved)                                                                      |
| ------------------------------ | ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `spouse_applicant_bulk_topics` | Trifft eine dieser seltenen Situationen auf Ihren Partner zu?                      | Trifft eine dieser seltenen Situationen auf Sie zu?                          | — already parallel, keep                                                                                        |
| `spouse_income_bulk_topics`    | Treffen eine oder mehrere dieser besonderen Einkommens- oder Rentensituationen zu? | Trifft eine dieser besonderen Einkommens- oder Rentensituationen auf Sie zu? | Trifft eine dieser besonderen Einkommens- oder Rentensituationen auf Ihren Partner zu?                          |
| `spouse_expense_bulk_topics`   | Gibt es eine oder mehrere dieser absetzbaren Ausgaben?                             | Haben Sie eine dieser Ausgaben?                                              | Hat Ihr Partner eine dieser Ausgaben? _(drops "absetzbaren", which the applicant version doesn't carry — flag)_ |
| `spouse_wealth_bulk_topics`    | Gibt es eine oder mehrere dieser besonderen Vermögensarten?                        | Haben Sie eine dieser besonderen Vermögensarten?                             | Hat Ihr Partner eine dieser besonderen Vermögensarten?                                                          |

The **option labels** under these blocks are already consistently "Der
Partner …" (values stay the shared "Es …" strings — R4 protected; labels are
free to edit). No label change proposed.

Also listed for Roman's complete picture (recommend **no change** — they read
correctly in chain context and mirror the applicant phrasing): partner
follow-ups that drop the partner reference, e.g. Berlin
`spouse_prior_social_aid_issuer`/`_reference_id` ("Welche Behörde… / Welches
Aktenzeichen…"), `spouse_general_liability_amount`,
`spouse_automobile_numbers_plate/_type/_year` ("das Auto"),
`spouse_pension_amount`/`_id` ("diese Rente"). D13 (Berlin partner insurance
depth) is resolved: explicitly no change.

Nothing in A4 ships before Roman's approval (Batch 3).

---

## A5. Folder delta (D9) — exact UPDATE list

Live `storage_category` vs Roman's assignments — **three flips, not two**:

| DOC          | name                                    | live        | Roman         | action                                     |
| ------------ | --------------------------------------- | ----------- | ------------- | ------------------------------------------ |
| DOC-0005     | Leistungsbescheid Pflegekasse           | Insurance   | Financial     | UPDATE (known flip)                        |
| DOC-0030     | Nachweis Immobilienwert                 | Housing     | Financial     | UPDATE (known flip)                        |
| **DOC-0042** | Übertragungsvertrag mit Grundbuchauszug | **Housing** | **Financial** | **UPDATE — surfaced by this verification** |

Verified already matching (no action): DOC-0007 Heimvertrag=Housing,
DOC-0008 Heimrechnungen=Financial, DOC-0010 Polizeiliche Anmeldung=Housing,
DOC-0015 Bestattungsvorsorgevertrag=Insurance, DOC-0028/0029 KFZ=Financial,
DOC-0043 Unterhaltsurteil=Personal (plus §10-list candidates DOC-0020
Wohngeldbescheid=Financial, DOC-0034 Krankengeldbescheid=Financial).

Resulting partition for the migration's assertion: **Personal 11 / Housing 5
/ Financial 19 / Insurance 8** (= 43). Forward-only per the documented Phase-D
behavior; impact on stored files: **zero** — all 11 live uploads are legacy
UUID paths (§0.3), and even new-scheme files keep their paths by design.
Value-guarded UPDATEs (assert old value before set), Real-Data report per R2
is trivial (config table; no user rows touched).

---

## A6. Document-section timing design (D3)

**Current behavior:** the "Fragen | Dokumente" tabs exist only once
`cases.questionnaire_id` is set ([page.tsx:71](../../app/case/page.tsx) —
`hasQuestionnaire` branches to `CaseTabsSection`); the pre-steps stage
renders bare cards with no tabs. Inside the tabs, `documents` is `null` when
no slots exist and `CaseTabs` then renders the chat alone
([case-tabs.tsx:29](../../app/case/case-tabs.tsx)).

**Design:**

- The pre-steps stage renders inside `CaseTabs` too: "Fragen" pane = the
  existing pre-step cards (care home → PLZ), "Dokumente" pane = a placeholder
  card carrying D3's Roman-approved text verbatim.
- **Placeholder text home: a new `static_content` row** (proposed key
  `docs.placeholder_needs_plz`) — this follows the existing pattern (every
  docs-area string is static_content) and rule #2. Roman-approved German →
  seeded character-for-character. Row-add = the benign case of CLAUDE.md #8;
  the migration still goes first per R9 discipline.
- Once PLZ is set, today's behavior is already D3-compliant: the full list
  renders immediately (verified in pass 3, item 1). No change post-PLZ.
- **Badge:** no count before a list exists — already structural:
  `CaseTabs` renders the badge only when `missing > 0`
  ([case-tabs.tsx:69](../../app/case/case-tabs.tsx)); pre-PLZ we pass 0.
- The safety branch (questionnaire loaded but zero rules AND no default
  office) keeps rendering chat alone — D3's placeholder ("enter PLZ first")
  would be false there, since the PLZ already exists.

Test impact (Batch 1): `feedback-pass.spec` T1 ("tabs from first login")
gets a stronger pre-step assertion; `completion.spec` drives `#care_home_id`
inside the now-tabbed pre-step pane (both panes stay mounted, default tab =
Fragen — the selector keeps resolving). Unit: gating logic for the
placeholder pane.

---

## A7. Bank-statement period suffix design (D10)

**Render path already exists end-to-end:** the evaluator threads
`rule.period_months` into **every** slot as `DocumentSlot.periodMonths`
([document-rules.ts:44](../../lib/document-rules.ts), set at :264/:277/:293)
— no evaluator change. Exactly two render sites consume slot names:

1. Checklist: [document-area.tsx:210–213](../../app/case/document-area.tsx)
   — `{nameDe}{" – " + instanceLabel}` → append the suffix after the
   instance label: `Kontoauszüge – Girokonto (letzte 4 Monate)`.
2. Case export: [case-export.mjs:210](../../scripts/case-export.mjs)
   (documents.md table) — same suffix on the document name cell.

Display format: `(letzte {n} Monate)`, derived at render time from
`periodMonths`; NULL renders unchanged. **Not** in stored filenames:
`lib/storage-path.ts` builds bases from the catalog name only — filenames
and counters cannot fork (verified by reading the path builder; no change
there). Global catalog `name_de` untouched. Implementation: one pure helper
(`periodSuffix(n)`) + unit tests; note n=1 would need a singular form
("letzter Monat" — constructed German, PLACEHOLDER_DE) — today every non-NULL
value is 4, so the singular branch is defensive only.

**⚠ THE DECISION THIS STOP MUST MAKE (from §0.1):** PAN-005/PAN-006 carry
`period_months = 4` on live prod, so:

- **(a) Render wherever non-NULL** → Pankow checklists also show
  "(letzte 4 Monate)". Data-faithful (the Pankow master's README specified 4
  months too) and zero migration; but it contradicts the brief's Batch-1
  spot-check "Pankow shows no suffix", which would need rewording to
  "Pankow shows the suffix on exactly its two bank rules".
- **(b) NULL out PAN-005/006 `period_months` by migration** → matches the
  brief's spot-check as written; touches Pankow rule rows (config only,
  trivial R2); discards period information Roman's own Pankow master
  specified.

Recommendation: **(a)** — the data says 4 months for Pankow and the suffix is
true and helpful there; the spot-check line in the brief looks like it was
written on the wrong premise. Founder decides; if Roman never intended a
Pankow period, (b) is a two-line migration.

D10 cleanup rider (Batch 1): delete §1 of
`docs/document-rules/german_copy_for_roman.md` (the never-wired 4-month
instruction text placeholder) — rejected by Roman.

Test impact (Batch 1): unit tests for the suffix helper + one slot-name
assertion; documents-m6's golden slot names are matched via
`pankow-golden-slots.json` `nameDe` fields — the suffix is render-layer only
(slot data unchanged), so goldens stay identical; e2e spot-checks per the
Batch-1 list (Essen "(letzte 4 Monate)", Pankow per the (a)/(b) decision).

---

## A8. Contact card (D11) + next-steps placement (D2)

**Contact data home:** `static_content` rows (proposed keys `contact.name`,
`contact.phone`, `contact.email`) — D11's values are Roman-approved verbatim
data; storing them as content lets him edit later without a deploy. The
card: initials avatar ("RP", petrol circle — no photo asset exists yet, the
component takes an optional photo that simply isn't passed until his file
arrives), name, `tel:` link `0159 0469 5761`, `mailto:`
`roman.pfeiffer@sorglosantrag.de`. Micro-labels ("Ihr Ansprechpartner",
a "Hilfe" button word) = **PLACEHOLDER_DE**, logged in
`german_copy_for_roman.md`. The mockup's `kundendienst@…` address and the
unused `simona-pfeiffer.png` are superseded by D11 (single contact).

**Placement proposals (mockup: `ContactPanel` lives in the AppShell/AppHeader
"Hilfe" affordance + as a contact block on `/fertig`):**

- **P1 (recommended): "Hilfe" button in the brand header** (beside Abmelden)
  opening a slide-over/sheet with the card. Reachable from every state
  including the pre-steps — the phase where a confused relative most needs a
  phone number. Mobile: bottom sheet. Matches the mockup's AppHeader pattern
  our layout already adopted.
- **P2: static card** at the bottom of the Dokumente pane and beneath the
  terminal (all-answered/locked) cards — the mockup's `/fertig` contact
  block. No new chrome, but invisible during the questionnaire itself.
- **P3 = P1 + the terminal-state block** (fullest mockup fidelity, slightly
  more surface).

**Next steps (D2):** the three bullets verbatim as the mockup's numbered
list, on the terminal card(s). Recommendation: **locked state only** —
bullet 2 ("Sie erhalten den vorbereiteten Antrag zur Unterschrift")
over-promises while documents are still missing in the all-answered state,
and D1's new all-answered body already instructs "bitte laden Sie noch
fehlende Unterlagen hoch". Two flags for the human: (1) bullet 1 duplicates
the new locked body's first sentence word-for-word on the same card — Roman's
copy, shipped as approved, but worth his eyes once live; (2) the list heading
"**Nächste Schritte**" was in the §9.3 proposal block but D2 quotes only the
bullets — treated as PLACEHOLDER_DE pending confirmation. Strings live in
`static_content` (`case.next_steps_1/2/3` + heading key).

⚠ Batch-1 test note that D1 forces regardless of placement: three specs
anchor on the literal old heading text `'Sie haben alle Fragen beantwortet'`
(`completion.spec.ts:105/:320`, `visibility.spec.ts:139`,
`transitive-visibility-fix.spec.ts:129`). D1's new copy no longer contains
that substring → repoint those anchors to `data-testid="all-answered"` /
the new heading in the same Batch-1 change.

---

## A9. Essen `birth_name` → optional (D4)

**Exact row:** question id `61000000-0000-0000-0000-000000000005`, key
`birth_name`, Essen antragsteller (`41000000-…-0001`), sort 2, prompt "Wie
lautet Ihr Geburtsname?", currently `is_required = true`. Migration: one
value-guarded UPDATE → `is_required = false` (assert exactly 1 row).

**Optional-completion mechanics cover Essen without any code change** — the
B1 predicate is engine-level, not Berlin-specific: `isAnsweredValue`
([questionnaire-nav.ts:159](../../lib/questionnaire-nav.ts)) treats a saved
row (even `''`) as complete for `is_required = false`, and the server accepts
empty values for optional questions
([actions.ts:327](../../app/case/actions.ts) — only `isRequired && isEmpty`
blocks). Essen runs the identical `buildNav` path; the B1 unit suite tests
the predicate itself. Semantics after the flip match Berlin's `birth_name`:
empty "Weiter" = completed without answer, "Weiß ich gerade nicht" = deferred.

Side effects: Essen fresh denominator **50 → 49** → update
`m7-regression.spec.ts:222` (`von 50 Fragen`) and `feedback-pass.spec.ts`
L3/L4 (`leakDrive(…, 50, …)`, :331/:335) in the same Batch-1 change; docs
(uat/known-limitations) follow. Real data: **zero Essen cases exist in prod**
(all 12 are Berlin-questionnaire or pre-PLZ) → R2 report trivial, no
backfill.

---

## 10. Decisions needed at this STOP (consolidated)

1. **A1/D15 count-decrease semantics:** Option A confirm-and-clear
   (recommended) vs Option B preserve+hide (§A1.3).
2. **A1 backfill:** approve the per-case table (§A1.5), incl. `298ac66b` → 0
   (history-row disappearance flagged) and the `88eede8b` fixture conflict
   (recommend 1).
3. **A2:** approve the proposed Berlin order (appendix) + the four judgment
   calls (§A2.1) so it can go to Roman as FYI.
4. **A7/D10:** Pankow suffix — render (a, recommended) or NULL the two PAN
   period values (b).
5. **A8/D2:** next-steps placement — locked-only (recommended) or both
   states; confirm "Nächste Schritte" heading handling.
6. **A8/D11:** contact placement P1 (recommended) / P2 / P3.
7. Send `roman_package_pass4.md`; then batch go-aheads (Batch 1 has no Roman
   dependency).

---

## Appendix — proposed Berlin order (two-column diff, 167 rows)

Engine order = block (category) order, then row order. "was #" = position in
the current live flow (pass-3 appendix numbering, re-verified live today).

**Block 1 — Persönliches (Angaben zur pflegebedürftigen Person)**

| new # | was # | key                                 | prompt (current)                                                       |
| ----- | ----- | ----------------------------------- | ---------------------------------------------------------------------- |
| 1     | 1     | `first_name`                        | Vorname der pflegebedürftigen Person                                   |
| 2     | 2     | `birth_name`                        | Was ist Ihr Geburtsname?                                               |
| 3     | 3     | `last_name`                         | Nachname der pflegebedürftigen Person                                  |
| 4     | 4     | `geburtsdatum`                      | Geburtsdatum der pflegebedürftigen Person                              |
| 5     | 8     | `district_of_birth`                 | In welchem Kreis/Bezirk wurden Sie geboren?                            |
| 6     | 9     | `country_of_birth`                  | In welchem Land wurden Sie geboren?                                    |
| 7     | 10    | `gender`                            | Was ist Ihr Geschlecht?                                                |
| 8     | 11    | `marital_status`                    | Was ist Ihr Familienstand?                                             |
| 9     | 12    | `marital_status_since`              | Seit wann ist dies Ihr Familienstand?                                  |
| 10    | 13    | `german_citizenship_yes_no`         | Haben Sie die deutsche Staatsangehörigkeit?                            |
| 11    | 14    | `citizenship`                       | Was ist Ihre Staatsangehörigkeit?                                      |
| 12    | 15    | `issuer_of_id`                      | Welche Behörde hat Ihr Personaldokument ausgestellt?                   |
| 13    | 16    | `id_expiry_date`                    | Bis wann ist Ihr Personaldokument gültig?                              |
| 14    | 22    | `special_origin_rights`             | Haben Sie einen Vertriebenen- oder Spätaussiedlerausweis?              |
| 15    | 23    | `special_origin_rights_issued`      | Wann wurde der Ausweis ausgestellt?                                    |
| 16    | 24    | `special_origin_rights_issued_by`   | Welche Behörde hat den Ausweis ausgestellt?                            |
| 17    | 25    | `disability_card`                   | Haben Sie einen Schwerbehindertenausweis?                              |
| 18    | 26    | `disablity_card_application`        | Haben Sie einen Schwerbehindertenausweis beantragt?                    |
| 19    | 27    | `disability_card_expiry`            | Bis wann ist Ihr Schwerbehindertenausweis gültig?                      |
| 20    | 28    | `disability_card_markers`           | Welche Merkzeichen stehen in Ihrem Schwerbehindertenausweis?           |
| 21    | 21    | `power_of_attorney`                 | Haben Sie eine gesetzliche Betreuung oder eine bevollmächtigte Person? |
| 22    | 17    | `prior_social_aid`                  | Haben Sie schon einmal Hilfe-zur-Pflege bekommen?                      |
| 23    | 18    | `prior_social_aid_until`            | Bis wann haben Sie Hilfe-zur-Pflege bekommen?                          |
| 24    | 19    | `prior_social_aid_issuer`           | Welche Behörde hat die Hilfe-zur-Pflege bewilligt?                     |
| 25    | 20    | `prior_social_aid_reference_id`     | Welches Aktenzeichen steht auf dem Bescheid?                           |
| 26    | 32    | `prior_social_service_applications` | Haben Sie weitere Sozialleistungen beantragt?                          |

**Block 2 — Wohnung und Heim**

| new # | was # | key                                | prompt (current)                                                                                |
| ----- | ----- | ---------------------------------- | ----------------------------------------------------------------------------------------------- |
| 27    | 5     | `in_facility_since`                | Wann sind Sie in das Pflegeheim eingezogen?                                                     |
| 28    | 6     | `last_residence_street`            | Wie lautete die Straße und Hausnummer Ihrer letzten Wohnung?                                    |
| 29    | 7     | `last_residence_city`              | In welcher Stadt lag Ihre letzte Wohnung?                                                       |
| 30    | 33    | `berlin_since`                     | Seit wann haben Sie vor dem Einzug ins Pflegeheim in Ihrer letzten Stadt oder Gemeinde gewohnt? |
| 31    | 34    | `berlin_district_since`            | Seit wann haben Sie vor dem Einzug ins Pflegeheim in diesem Stadtbezirk oder Landkreis gewohnt? |
| 32    | 35    | `apartment_ownership`              | Wie haben Sie vor dem Einzug ins Pflegeheim gewohnt?                                            |
| 33    | 38    | `landlord_name_and_address`        | Wie heißen Ihr Vermieter und seine Adresse?                                                     |
| 34    | 39    | `rent_total`                       | Wie hoch war Ihre monatliche Miete?                                                             |
| 35    | 40    | `rent_paid_until`                  | Bis wann wurde die Miete schon bezahlt?                                                         |
| 36    | 41    | `rent_debt`                        | Wie hoch sind die Mietrückstände für Ihre letzte Wohnung?                                       |
| 37    | 42    | `rent_contract_termination_yes_no` | Haben Sie Ihre letzte Wohnung bereits gekündigt?                                                |
| 38    | 43    | `rent_contract_terminated_by`      | Zu welchem Datum wurde Ihre letzte Wohnung gekündigt?                                           |

**Block 3 — Einkommen**

| new # | was # | key                   | prompt (current)                                                     |
| ----- | ----- | --------------------- | -------------------------------------------------------------------- |
| 39    | —     | `pension_count`       | NEW (D15b): "Wie viele Renten oder Pensionen bekommen Sie?"          |
| 40    | 53    | `pension_type`        | Welche Rente oder Pension bekommen Sie? _(Gruppe ×N)_                |
| 41    | 54    | `pension_amount`      | Wie hoch ist diese Rente oder Pension pro Monat? _(Gruppe ×N)_       |
| 42    | 55    | `pension_id`          | Welche Abrechnungsnummer hat diese Rente oder Pension? _(Gruppe ×N)_ |
| 43    | 56    | `pension_issuer`      | Von wem bekommen Sie diese Rente oder Pension? _(Gruppe ×N)_         |
| 44    | 57    | `wohngeld_yes_no`     | Beziehen Sie Wohngeld?                                               |
| 45    | 58    | `wohngeld_amount`     | Wie viel Wohngeld bekommen Sie pro Monat?                            |
| 46    | 59    | `wohngeld_id`         | Welches Aktenzeichen steht auf Ihrem Wohngeldbescheid?               |
| 47    | 60    | `other_income`        | Haben Sie weiteres Einkommen?                                        |
| 48    | 61    | `other_income_type`   | Welche Art von weiterem Einkommen haben Sie? _(Gruppe ×N)_           |
| 49    | 62    | `other_income_amount` | Wie hoch ist dieses weitere Einkommen pro Monat? _(Gruppe ×N)_       |

**Block 4 — Vermögen**

| new # | was # | key                              | prompt (current)                                               |
| ----- | ----- | -------------------------------- | -------------------------------------------------------------- |
| 50    | 77    | `bank_giro`                      | Bei welcher Bank haben Sie Ihr Girokonto?                      |
| 51    | 78    | `bank_giro_blz`                  | Wie lautet die Bankleitzahl Ihrer Bank?                        |
| 52    | 79    | `bank_giro_iban`                 | Wie lautet die IBAN Ihres Girokontos?                          |
| 53    | 80    | `bank_giro_amount`               | Wie hoch ist der Betrag auf Ihrem Girokonto?                   |
| 54    | 81    | `bank_savings_account_yes_no`    | Haben Sie ein Sparkonto?                                       |
| 55    | 82    | `bank_savings_account_amount`    | Wie viel Geld ist auf Ihrem Sparkonto?                         |
| 56    | 83    | `bank_savings_iban`              | Wie lautet die IBAN Ihres Sparkontos?                          |
| 57    | 84    | `bank_additional_account_yes_no` | Haben Sie noch ein weiteres Konto?                             |
| 58    | 85    | `bank_additional_name`           | Bei welcher Bank ist dieses weitere Konto? _(Gruppe ×N)_       |
| 59    | 86    | `bank_additional_iban`           | Wie lautet die IBAN dieses Kontos? _(Gruppe ×N)_               |
| 60    | 87    | `bank_additional_amount`         | Wie viel Geld ist auf diesem Konto? _(Gruppe ×N)_              |
| 61    | 88    | `cash_savings`                   | Wie viel Bargeld haben Sie?                                    |
| 62    | 89    | `automobile_owner`               | Haben Sie ein Auto?                                            |
| 63    | 90    | `automobile_numbers_plate`       | Welches Kennzeichen hat Ihr Auto?                              |
| 64    | 91    | `automobile_type`                | Welches Modell ist Ihr Auto?                                   |
| 65    | 92    | `automobile_year`                | Aus welchem Baujahr ist Ihr Auto?                              |
| 66    | 93    | `automobile_holder`              | Wer ist als Fahrzeughalter eingetragen?                        |
| 67    | 94    | `property_yes_no`                | Haben Sie ein Haus, eine Wohnung oder ein Grundstück?          |
| 68    | 95    | `property_address`               | Wie lautet die Adresse der Immobilie?                          |
| 69    | 96    | `property_usage`                 | Wie nutzen Sie die Immobilie?                                  |
| 70    | 97    | `property_size`                  | Wie groß ist die Immobilie in Quadratmetern?                   |
| 71    | 98    | `additional_wealth_yes_no`       | Haben Sie weitere Vermögenswerte?                              |
| 72    | 99    | `additional_wealth_type`         | Welche weiteren Vermögenswerte haben Sie? _(Gruppe ×N)_        |
| 73    | 100   | `additional_wealth_amount`       | Wie viel ist dieser Vermögenswert ungefähr wert? _(Gruppe ×N)_ |

**Block 5 — Versicherung und Pflege**

| new # | was # | key                                   | prompt (current)                                                  |
| ----- | ----- | ------------------------------------- | ----------------------------------------------------------------- |
| 74    | 29    | `health_insurance`                    | Bei welcher Krankenkasse sind Sie versichert?                     |
| 75    | 30    | `health_insurance_type`               | Wie sind Sie krankenversichert?                                   |
| 76    | 31    | `care_level`                          | Welchen Pflegegrad haben Sie?                                     |
| 77    | 63    | `govermental_employee`                | Waren Sie früher Beamter?                                         |
| 78    | 64    | `health_insurance_amount`             | Wie hoch ist Ihr monatlicher Beitrag zur Krankenversicherung?     |
| 79    | 65    | `care_insurance_amount`               | Wie hoch ist Ihr monatlicher Beitrag zur Pflegeversicherung?      |
| 80    | 66    | `general_liablity_insurance_yes_no`   | Haben Sie eine Haftpflichtversicherung?                           |
| 81    | 67    | `general_liablity_insurance_provider` | Bei welcher Versicherung haben Sie Ihre Haftpflichtversicherung?  |
| 82    | 68    | `general_liability_amount`            | Wie hoch ist Ihr monatlicher Beitrag zur Haftpflichtversicherung? |
| 83    | 69    | `life_insurance`                      | Haben Sie eine Lebens- oder Sterbeversicherung?                   |
| 84    | 70    | `life_insurance_monthly_amount`       | Wie hoch ist Ihr monatlicher Beitrag für diese Versicherung?      |
| 85    | 71    | `life_insurance_total_amount`         | Wie viel würde diese Versicherung auszahlen?                      |
| 86    | 72    | `life_insurance_name`                 | Bei welcher Versicherung haben Sie diese Versicherung?            |
| 87    | 73    | `life_insurance_number`               | Wie lautet die Versicherungsnummer?                               |
| 88    | 74    | `funeral_insurance_yes_no`            | Haben Sie einen Bestattungsvorsorgevertrag?                       |
| 89    | 75    | `funeral_insurance_amount`            | Wie viel würde der Bestattungsvorsorgevertrag auszahlen?          |
| 90    | 76    | `funeral_insurance_detail`            | Was trifft auf Ihren Bestattungsvorsorgevertrag zu?               |

**Block 6 — Weitere Angaben**

| new # | was # | key           | prompt (current)                                                                  |
| ----- | ----- | ------------- | --------------------------------------------------------------------------------- |
| 91    | 101   | `costly_diet` | Brauchen Sie aus medizinischen Gründen eine besondere Ernährung, die mehr kostet? |

**Block 7 — Partner, Familie, Unterhalt**

| new # | was # | key                                          | prompt (current)                                                             |
| ----- | ----- | -------------------------------------------- | ---------------------------------------------------------------------------- |
| 92    | 102   | `spouse_last_name`                           | Wie lautet der Nachname Ihres Ehepartners oder Partners?                     |
| 93    | 103   | `spouse_birth_name`                          | Wie lautet der Geburtsname Ihres Ehepartners oder Partners?                  |
| 94    | 104   | `spouse_first_name`                          | Wie lautet der Vorname Ihres Partners?                                       |
| 95    | 105   | `spouse_birthdate`                           | Wann wurde Ihr Partner geboren?                                              |
| 96    | 106   | `spouse_city_of_birth`                       | In welcher Stadt wurde Ihr Partner geboren?                                  |
| 97    | 107   | `spouse_district_of_birth`                   | In welchem Kreis oder Bezirk wurde Ihr Partner geboren?                      |
| 98    | 108   | `spouse_country_of_birth`                    | In welchem Land wurde Ihr Partner geboren?                                   |
| 99    | 109   | `spouse_gender`                              | Welches Geschlecht hat Ihr Partner?                                          |
| 100   | 110   | `spouse_german_citizenship_yes_no`           | Hat Ihr Partner die deutsche Staatsangehörigkeit?                            |
| 101   | 111   | `spouse_citizenship`                         | Welche Staatsangehörigkeit hat Ihr Partner?                                  |
| 102   | 112   | `spouse_issuer_of_id`                        | Welche Behörde hat das Personaldokument Ihres Partners ausgestellt?          |
| 103   | 113   | `spouse_id_expiry_date`                      | Bis wann ist das Personaldokument Ihres Partners gültig?                     |
| 104   | 114   | `spouse_prior_social_aid`                    | Hat Ihr Partner schon einmal Hilfe-zur-Pflege bekommen?                      |
| 105   | 115   | `spouse_prior_social_aid_until`              | Bis wann hat Ihr Partner Hilfe-zur-Pflege bekommen?                          |
| 106   | 116   | `spouse_prior_social_aid_issuer`             | Welche Behörde hat die Hilfe-zur-Pflege bewilligt?                           |
| 107   | 117   | `spouse_prior_social_aid_reference_id`       | Welches Aktenzeichen steht auf dem Bescheid?                                 |
| 108   | 118   | `spouse_power_of_attorney`                   | Hat Ihr Partner eine gesetzliche Betreuung oder eine bevollmächtigte Person? |
| 109   | 119   | `spouse_special_origin_rights`               | Hat Ihr Partner einen Vertriebenen- oder Spätaussiedlerausweis?              |
| 110   | 120   | `spouse_special_origin_rights_issued`        | Wann wurde der Ausweis ausgestellt?                                          |
| 111   | 121   | `spouse_special_origin_rights_issued_by`     | Welche Behörde hat den Ausweis ausgestellt?                                  |
| 112   | 122   | `spouse_disability_card`                     | Hat Ihr Partner einen Schwerbehindertenausweis?                              |
| 113   | 123   | `spouse_disability_card_application`         | Hat Ihr Partner einen Schwerbehindertenausweis beantragt?                    |
| 114   | 124   | `spouse_disability_card_expiry`              | Bis wann ist der Schwerbehindertenausweis Ihres Partners gültig?             |
| 115   | 125   | `spouse_disability_card_markers`             | Welche Merkzeichen stehen im Schwerbehindertenausweis Ihres Partners?        |
| 116   | 126   | `spouse_health_insurance`                    | Bei welcher Krankenkasse ist Ihr Partner versichert?                         |
| 117   | 127   | `spouse_health_insurance_type`               | Wie ist Ihr Partner krankenversichert?                                       |
| 118   | 128   | `spouse_care_level`                          | Welchen Pflegegrad hat Ihr Partner?                                          |
| 119   | 129   | `spouse_in_facility_yes_no`                  | Wohnt Ihr Partner in einem Pflegeheim?                                       |
| 120   | 130   | `spouse_in_facility_since`                   | Wann ist Ihr Partner in das Pflegeheim eingezogen?                           |
| 121   | 131   | `spouse_prior_social_service_applications`   | Hat Ihr Partner weitere Sozialleistungen beantragt?                          |
| 122   | 132   | `spouse_pension_type`                        | Welche Rente oder Pension bekommt Ihr Partner? _(Gruppe ×N)_                 |
| 123   | 133   | `spouse_pension_amount`                      | Wie hoch ist diese Rente oder Pension pro Monat? _(Gruppe ×N)_               |
| 124   | 134   | `spouse_pension_id`                          | Welche Abrechnungsnummer hat diese Rente oder Pension? _(Gruppe ×N)_         |
| 125   | 135   | `spouse_pension_issuer`                      | Von wem bekommt Ihr Partner diese Rente oder Pension? _(Gruppe ×N)_          |
| 126   | 136   | `spouse_wohngeld_yes_no`                     | Bekommt Ihr Partner Wohngeld?                                                |
| 127   | 137   | `spouse_wohngeld_amount`                     | Wie viel Wohngeld bekommt Ihr Partner pro Monat?                             |
| 128   | 138   | `spouse_wohngeld_id`                         | Welches Aktenzeichen steht auf dem Wohngeldbescheid?                         |
| 129   | 139   | `spouse_other_income`                        | Hat Ihr Partner weiteres Einkommen?                                          |
| 130   | 140   | `spouse_other_income_type`                   | Welche Art von weiterem Einkommen hat Ihr Partner? _(Gruppe ×N)_             |
| 131   | 141   | `spouse_other_income_amount`                 | Wie hoch ist dieses weitere Einkommen pro Monat? _(Gruppe ×N)_               |
| 132   | 142   | `spouse_health_insurance_amount`             | Wie hoch ist der monatliche Beitrag zur Krankenversicherung Ihres Partners?  |
| 133   | 143   | `spouse_care_insurance_amount`               | Wie hoch ist der monatliche Beitrag zur Pflegeversicherung Ihres Partners?   |
| 134   | 144   | `spouse_general_liablity_insurance_yes_no`   | Hat Ihr Partner eine Haftpflichtversicherung?                                |
| 135   | 145   | `spouse_general_liablity_insurance_provider` | Bei welcher Versicherung hat Ihr Partner die Haftpflichtversicherung?        |
| 136   | 146   | `spouse_general_liability_amount`            | Wie hoch ist der monatliche Beitrag zur Haftpflichtversicherung?             |
| 137   | 147   | `spouse_life_insurance`                      | Hat Ihr Partner eine Lebens- oder Sterbeversicherung?                        |
| 138   | 148   | `spouse_life_insurance_amount`               | Wie hoch ist der monatliche Beitrag für diese Versicherung?                  |
| 139   | 149   | `spouse_bank_giro`                           | Bei welcher Bank hat Ihr Partner ein Girokonto?                              |
| 140   | 150   | `spouse_bank_giro_blz`                       | Wie lautet die Bankleitzahl der Bank Ihres Partners?                         |
| 141   | 151   | `spouse_bank_giro_iban`                      | Wie lautet die IBAN des Girokontos Ihres Partners?                           |
| 142   | 152   | `spouse_bank_account_amount`                 | Wie viel Geld ist auf dem Girokonto Ihres Partners?                          |
| 143   | 153   | `spouse_bank_savings_account_yes_no`         | Hat Ihr Partner ein Sparkonto?                                               |
| 144   | 154   | `spouse_bank_savings_account_amount`         | Wie viel Geld ist auf dem Sparkonto Ihres Partners?                          |
| 145   | 155   | `spouse_bank_savings_iban`                   | Wie lautet die IBAN des Sparkontos Ihres Partners?                           |
| 146   | 156   | `spouse_bank_additional_account_yes_no`      | Hat Ihr Partner noch ein weiteres Konto?                                     |
| 147   | 157   | `spouse_bank_additional_name`                | Bei welcher Bank ist dieses weitere Konto? _(Gruppe ×N)_                     |
| 148   | 158   | `spouse_bank_additional_iban`                | Wie lautet die IBAN dieses Kontos? _(Gruppe ×N)_                             |
| 149   | 159   | `spouse_bank_additional_amount`              | Wie viel Geld ist auf diesem Konto? _(Gruppe ×N)_                            |
| 150   | 160   | `spouse_automobile_owner`                    | Hat Ihr Partner ein Auto?                                                    |
| 151   | 161   | `spouse_automobile_numbers_plate`            | Welches Kennzeichen hat das Auto?                                            |
| 152   | 162   | `spouse_automobile_type`                     | Welches Modell ist das Auto?                                                 |
| 153   | 163   | `spouse_automobile_year`                     | Aus welchem Baujahr ist das Auto?                                            |
| 154   | 164   | `spouse_automobile_holder`                   | Wer ist als Fahrzeughalter eingetragen?                                      |
| 155   | 165   | `spouse_property_yes_no`                     | Hat Ihr Partner ein Haus, eine Wohnung oder ein Grundstück?                  |
| 156   | 166   | `spouse_additional_wealth_yes_no`            | Hat Ihr Partner weitere Vermögenswerte?                                      |
| 157   | 167   | `spouse_additional_wealth_type`              | Welche weiteren Vermögenswerte hat Ihr Partner?                              |
| 158   | 168   | `spouse_additional_wealth_amount`            | Wie viel ist dieser Vermögenswert ungefähr wert?                             |
| 159   | 44    | `children_yes_no`                            | Haben Sie Kinder?                                                            |
| 160   | 45    | `child_first_name`                           | Wie lautet der Vorname Ihres Kindes? _(Gruppe ×N)_                           |
| 161   | 46    | `child_last_name`                            | Wie lautet der Nachname Ihres Kindes? _(Gruppe ×N)_                          |
| 162   | 47    | `child_birth_name`                           | Wie lautet der Geburtsname Ihres Kindes? _(Gruppe ×N)_                       |
| 163   | 48    | `child_birth_date`                           | Wann wurde Ihr Kind geboren? _(Gruppe ×N)_                                   |
| 164   | 49    | `child_marital_status`                       | Welchen Familienstand hat Ihr Kind? _(Gruppe ×N)_                            |
| 165   | 50    | `child_family_tie`                           | In welchem Verhältnis steht dieses Kind zu Ihnen? _(Gruppe ×N)_              |
| 166   | 51    | `child_profession`                           | Welchen Beruf hat Ihr Kind? _(Gruppe ×N)_                                    |
| 167   | 52    | `child_address`                              | Wie lautet die Wohnadresse Ihres Kindes? _(Gruppe ×N)_                       |
