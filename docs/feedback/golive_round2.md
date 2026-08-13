# Go-live review round 2 — Phase 1 read-only triage (2026-08-13)

> Six items from Roman's go-live review. This is the READ-ONLY report — nothing
> has been changed, no migration written to `supabase/migrations`, no code
> touched. Migrations/code below are DRAFTS awaiting batch GOs.
>
> Method: fresh read-only prod dumps (2026-08-12, config + rules +
> static_content + cases + answers + uploads) analyzed with buildNav- and
> evaluator-faithful scripts; every code claim read at the cited line. Each
> item was investigated by an independent agent and then ADVERSARIALLY
> RE-VERIFIED by a second independent agent (citations re-read, censuses
> re-run, German re-diffed byte-for-byte). Verdicts: items 1/4/6 CONFIRMED;
> items 2/3/5 confirmed with corrections — every correction is folded into
> this document (marked "verify pass" where it changed a claim).

---

## 0. Prod reality first (it changes two items' premises)

Prod was cleaned around go-live. Today: **4 auth users, 3 cases, all on the
Berlin questionnaire**, 84 answer rows, 17 uploads.

| Case       | Who                                        | Status                  | Answers | Key facts                                                                                                                                                                                                                          |
| ---------- | ------------------------------------------ | ----------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `52e364f1` | rico.schinzel@yahoo.de — **REAL customer** | `under_review` (LOCKED) | 77      | `marital_status="verwitwet"`, `power_of_attorney="Bevollmächtigter Angehöriger"`, `disability_card="Ja"`, `disability_card_expiry="2027-08-11"`, `id_expiry_date="2027-08-11"`, 16 uploads incl. **Sterbeurkunde against PAN-025** |
| `adf1ad79` | roman.pfeiffer@sorglosantrag.de            | in_progress             | 2       | Created 2026-08-12. PLZ 66646 → Sozialamt St. Wendel (0 rules) → fallback. `marital_status` UNANSWERED                                                                                                                             |
| `c8542a35` | bhakcil@gmail.com (founder-dev)            | in_progress             | 5       | Berlin, PLZ 10245                                                                                                                                                                                                                  |

**Structural discovery (affects items 3 + 4, and worth its own follow-up):**
the Berlin questionnaire's routing office `10000000-…-0001` is **"Sozialamt
Berlin" and has ZERO document rules**. The 50 PAN rules hang on
`11000000-…-0001` "Sozialamt Berlin-Pankow", which is also
`app_config.default_document_office_id`. Consequently **every current prod
case — including the real locked one — is served `rulesSource='fallback'`**
(lib/dal.ts:308-324): they all see the fallback banner and suffix
suppression. Working as coded (the 2026-08-09/11 fallback work targeted
exactly this path), but if Berlin-proper cases are _meant_ to be own-office
Pankow cases, the PLZ routing target or the rules' office id deserves
reconciliation. **Non-blocking observation — separate decision, not part of
any batch below.**

---

## ITEM 1 — Betreuer question mandatory

**Root cause.** Berlin `power_of_attorney` (id `60000000-…-000013`, sort 20,
unconditional, options `Nein | Gesetzlicher Betreuer | Bevollmächtigter
Angehöriger | Beistandschaft`) is `is_required=false` — deliberately made
optional in Tier 7 (milestone-log.md:676). Essen's `legal_guardian_yes_no`
(same prompt char-for-char, options `Ja | Nein`, follow-up
`legal_guardian_name_address` gated on `"Ja"`) is **already required** — Essen
needs nothing. Both prompts: "Haben Sie eine gesetzliche Betreuung oder eine
bevollmächtigte Person?"

**How "required" + the `''` mechanism work.** `is_required` feeds
`totalRequired` (questionnaire-nav.ts:273) and the completion gate
(actions.ts:247-269). The `''` row does NOT come from the skip button
("Weiß ich gerade nicht" is client-only, writes nothing — chat-view.tsx:774-791);
it comes from clicking **Weiter with nothing selected**: the draft falls back
to `emptyValueFor()` = `''` (chat-view.tsx:60-77, 546-550) and the server
accepts empty on optional questions (actions.ts:334). `isAnsweredValue`
counts a saved `''` row as answered _for optional questions only_
(nav.ts:165). After the flip the same row counts unanswered → question
resurfaces and blocks completion; empty saves are then rejected
(actions.ts:333).

**Real data.** Exactly ONE `power_of_attorney` answer exists in prod: rico's,
non-empty. **Zero `''` rows for it anywhere** (the only `''` answer in prod is
Roman's optional `birth_name`). The two in_progress cases haven't reached it.

**Effect of the flip.** In_progress: denominator 52→53, question loses the
"Optional" badge — desired. Locked rico: 75/75 → **76/76, stays 100%** (his
answer is non-empty). Nothing functional recomputes for locked cases (saves
refused at actions.ts:155; status never flips downward); worst hypothetical is
a cosmetic <100% progress bar — no such case exists today.

**Dependencies.** No visibility rule references `power_of_attorney` (0/414);
no doc rule references either key (0/105 — DOC-0006 "Vertretungsvollmacht /
Betreuungsnachweis" is served unconditionally by PAN-010/ESS-012). The flip
changes no visibility and no documents.

**Fix (draft).** One migration: (1) execution-time guard — ABORT if any locked
Berlin case lacks a non-empty answer (re-verifies the real-data claim at push
time; today passes via rico); (2) value-guarded `UPDATE … SET
is_required=true` asserted to exactly 1 row; (3) Essen assert-only block.
Full SQL draft in the triage record. **No backfill shipped** — the abort-guard
covers the race window; auto-inserting an answer into a locked real case would
need Roman's per-case approval (pass-4 precedent).

**Migration vs code.** Migration + e2e-assert edits only, zero app code. The
coupling is test-side: after push, prod renders "von 53 Fragen", so the
denominator asserts must change in the same batch — push first, then gate.
Anchors: feedback-pass.spec.ts:333, :337 (52→53) + header comment :4;
m7-regression.spec.ts:307, :338 ('von 52 Fragen'→53) + comments :12,
:304-306 (the :12 header's stated cause is stale — rewrite per the
verified-reason rule); **docs/uat-m7.md:19 and :46** also still tell the UAT
tester "0 von 53 Fragen" — stale today, only coincidentally right again after
the flip — same cause-rewrite treatment, docs-only (verify pass). Essen 49
anchors untouched (m7:233, mobile-footer:154). Completion/feedback drivers
answer "Nein" by preference (completion.spec.ts:156-170) — they complete
unchanged. Fixtures need nothing. Post-flip skip mechanics (for Roman's
awareness): the "Weiß ich gerade nicht" button stays available on the
now-required question — it writes no row, the question re-asks, and
completion stays blocked until a non-empty answer is saved. Desired.

**Open decisions.**

1. Ratify abort-not-backfill for the locked-case guard.
2. Confirm scope: `spouse_power_of_attorney` (Berlin, already required;
   options are the old pair `Betreuung | Beistandschaft` — no "Nein"; the M4
   backlog already flags this spouse-parity gap) stays out of scope.
3. Cosmetic: rename the synthetic unit test named after this question's
   optional state (questionnaire-engine.test.ts:651).

---

## ITEM 2 — "Duplicate" Behörde question — VERDICT B, no duplicate, no deletion

**Root cause / verdict.** The two Berlin questions concern **different
documents**:

|                  | `issuer_of_id` (…00000d)                                                              | `special_origin_rights_issued_by` (…000016)                                                                                                        |
| ---------------- | ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Prompt           | "Welche Behörde hat Ihr Personaldokument ausgestellt?"                                | "Welche Behörde hat den Ausweis ausgestellt?"                                                                                                      |
| Position         | sort 11, unconditional                                                                | sort 15, gated `{"not_value":"Nein","question_key":"special_origin_rights"}`                                                                       |
| Block            | Personaldokument (citizenship → issuer → "Bis wann ist Ihr Personaldokument gültig?") | Vertriebenen-/Spätaussiedlerausweis ("Haben Sie einen Vertriebenen- oder Spätaussiedlerausweis?" → "Wann wurde der Ausweis ausgestellt?" → issuer) |
| Related document | DOC-0001 "Personaldokument" (PAN-001 — always-mandatory, keyed on no answer)          | DOC-0021 "Heimatvertriebener/Spätaussiedler Nachweis" (PAN-034/035 — keyed on the CONTROLLER `special_origin_rights`, not on this question)        |
| Placeholder      | —                                                                                     | `"Bundesverwaltungsamt"` (the Spätaussiedler authority — the tell)                                                                                 |

The hypothesis in the brief guessed the Schwerbehindertenausweis block; it is
actually the **special-origin-rights block** (disability starts later, at sort
16, and has no issuer question) — same verdict B either way. Spouse mirrors
(`spouse_special_origin_rights_issued_by`, identical prompt) carry the same
ambiguity. **No deletion** — precise reasoning (verify pass corrected the
causal chain): retiring Row B would NOT touch the document checklist (the
DOC-0021 slots key on the controller question, and no rule references the
issuer question); what it would lose is the **case-file datum itself** — the
issuing authority of the Vertriebenen-/Spätaussiedlerausweis, a distinct
required answer that is simply not a duplicate of Row A's. Essen has neither
subject (no issuer question, no Vertriebenen topic in its bulk options) —
ambiguity is Berlin-only.

**Real data.** rico answered `issuer_of_id="BA Lichtenberg BÜA 1"` and
`special_origin_rights="Nein"` → he never saw the second question. No prod
answers exist for any special-origin follow-up.

**Fix.** Escalation only: ClickUp reply explaining the two blocks + a
**proposal** for Roman (his word final; current text is his own cp3 copy —
he authored it in flow context and re-met it out of context):

> „Welche Behörde hat den Ausweis ausgestellt?" → **Vorschlag:** „Welche
> Behörde hat den Vertriebenen- oder Spätaussiedlerausweis ausgestellt?"
> (Partner-Variante: „… Ihres Partners …"). Optional für Symmetrie auch die
> beiden „Wann wurde der Ausweis ausgestellt?"-Fragen.

Full German draft (incl. the explanation paragraphs) in the triage record.
Lighter alternative for Roman: keep prompts, add a `help_de` line (both
currently NULL). If he approves: one value-guarded prompt-UPDATE migration
(precedent 20260723000002); prompt_de is display-only — no visibility, count,
sweep, or doc-slot effect; grep confirms zero tests assert these prompts.

**Migration vs code.** Nothing ships now. After approval: migration-only,
benign row-update class.

**Real-data impact.** None (text-only; rico's gated question was never
visible to him).

**Open decisions.** (1) Roman: approve/reword/keep. (2) Include the two
"Wann…"-questions for symmetry? (3) help_de alternative instead? (4) Passing
observations for Roman, not proposed by us: option label "Sowjetzonenflüchtlich
Ausweis C" looks like a typo (→ "…flüchtling"); Essen's lack of the
Vertriebenen subject + DOC-0021 rule — intentional?

---

## ITEM 3 — Completion card misleads while documents are missing (PRIORITY)

**Root cause (confirmed).** The completion gate flips `in_progress →
under_review` purely on `nav.allRequiredAnswered` (actions.ts:247-269, update
at :253) — documents are never consulted. The locked card then shows
`case.locked_body` = **"Wir prüfen Ihre Angaben und Unterlagen. Sie müssen
nichts weiter tun — wir melden uns bei Ihnen."** unconditionally
(EditLockedCard, chat-view.tsx:373-436, rendered :937-945, testid
`locked-banner`). The card is right about the status and wrong about the
user's remaining work. Note: the transient in-session card
(`all-answered`, chat-view.tsx:347-371) already says "Bitte laden Sie noch
fehlende Unterlagen hoch…" — the misleading copy is specifically the locked
card's.

**Real data.** rico (locked) has **missing = 3** (PAN-016 "Nachweis
Bedarfsanzeige", PAN-017 "Polizeiliche Anmeldung im Heim", PAN-018
"Mobilitätsnachweis" — all always-mandatory, zero uploads), computed with an
evaluator-faithful port over the dumps (16 uploads cover 14 of his 17 slots;
0 orphan uploads = port matches app). Today he is told to do nothing while 3
mandatory slots sit empty — the exact real-world instance of Roman's
complaint. Uploads remain possible while locked (document-actions.ts has no
status gate; e2e documents-m6 asserts it), so the badge/count stays live.

**Fix design (copy + UI conditionality ONLY, no status/flow change).**

- **Data threading:** page.tsx already computes `countMissingSlots(slots,
uploads)` (page.tsx:247) in the same server function that renders ChatView —
  hoist it and pass as a new `missingDocs` prop. Freshness free via the
  existing `router.refresh()` on upload/delete (document-area.tsx:154,
  322-324). No new query.
- **Tab switch:** CaseTabs keeps its tab in local `useState`
  (case-tabs.tsx:28) and the locked card renders inside the `chat` node built
  by a Server Component — a callback prop can't reach it. Mechanism: tiny
  client context (`components/case-tab-context.tsx`, provider around the two
  pane divs in CaseTabs exposing `setTab`; `useCaseTabSwitch()` returns null
  without a provider → button hidden, which also covers the no-docs-pane
  safety branch case-tabs.tsx:29). Standard pattern, no navigation, panes stay
  mounted.
- **Variant:** `missingDocs > 0 && heading && body` → same card shell + SAME
  `data-testid="locked-banner"` (+ `data-docs-missing` attr), heading/body
  from new keys, petrol button (`btnPetrol`, styles.ts:73 — the sanctioned
  secondary-affirmative style, currently unused; copper stays the
  one-per-screen primary) switching to the Dokumente tab, and the
  Nächste-Schritte list prefixed with an upload step (renders as step 1 of 4
  automatically, chat-view.tsx:420-431). `missingDocs == 0` **or content rows
  not yet seeded** → today's card **byte-identical** (the ''-degradation is
  the rollout guard, mirroring docs-pane.ts:43).
- **Keep the neutral clock medallion** in both variants (under review is not a
  warning — semantic palette rule, styles.ts:32-40).

**New German — ALL PLACEHOLDER_DE (proposals for Roman via ledger + ClickUp;
tone modeled on the existing cards' Sie-form and em-dash cadence):**

| Key                        | Proposed text                                                                                                                                |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `case.locked_docs_heading` | „Es fehlen noch Unterlagen"                                                                                                                  |
| `case.locked_docs_body`    | „Sie haben alle Fragen beantwortet — vielen Dank. Damit wir Ihren Antrag prüfen können, laden Sie bitte noch die fehlenden Unterlagen hoch." |
| `case.locked_docs_button`  | „Zu den Dokumenten"                                                                                                                          |
| `case.next_steps_upload`   | „Sie laden die noch fehlenden Unterlagen hoch."                                                                                              |

Seeded via `INSERT … ON CONFLICT DO NOTHING` (pattern 20260801000001).

**Migration vs code.** Row-add migration (benign class) + code
(dal.ts keymap+type, page.tsx prop, chat-view variant + button, case-tabs
provider, new context file). Order: migration pushed and verified first, then
code — though the ''-guard makes either order safe.

**e2e anchors touched (Batch B):** completion.spec.ts:118/:130/:334-338
(testid detection — stays green; completion's driver uploads nothing →
variant; documents-m6 DOES upload some files but still locks with missing>0 →
variant too, and asserts only docs-pane state), :361-363 (C4 no-Bearbeiten —
unaffected); visibility.spec.ts:155-163 and
transitive-visibility-fix.spec.ts:138-146 (testid pair — green);
m7-regression.spec.ts:129-133 (locked via "In Prüfung" chip — unaffected);
four MORE chip-text lock-detection sites, all variant-immune, on record for
Batch B (verify pass): feedback-pass.spec.ts:158, mobile-footer.spec.ts:165,
documents-m6.spec.ts:270-278, m7-regression.spec.ts:257.
**mobile-footer.spec.ts:285-297 is the key regression** (last next-steps `<li>`
in-viewport; the variant adds one `<li>` + a button — the footer scroll fix
must absorb it); feedback-pass.spec.ts:361-365/:392-399 (badge markup
untouched). New Batch-B specs: locked with missing>0 → variant + button
switches tab; locked with 0 missing → today's card verbatim (drive one:
upload-everything fixture needed — the current completion fixture locks with
missing>0). Implementation guards from the verify pass: the button's render
condition must ALSO require `lockedDocsButton !== ''` (else a missing button
row renders an empty petrol button); and if the all-answered-card button is
adopted, note its `missingDocs` is the previous server render's value for the
seconds before `router.refresh()` lands — transient, self-healing, by design.

**Open decisions.**

1. **Also add the petrol button to the transient all-answered card when
   missing>0?** Recommended yes (additive-only, reuses
   `case.locked_docs_button`, no other copy change).
2. Pre-existing reverse wrinkle: `case.all_answered_message` asks for uploads
   even at 0 missing — flag to Roman, out of scope here.
3. Show the concrete count on the card? Recommended no (badge + docs pane
   already show it; avoids the singular/plural fork).
4. Medallion icon variant — cosmetic, founder's call.
5. The four German texts themselves (Roman).

---

## ITEM 4 — Verwitwet → Sterbeurkunde: PREMISE CORRECTED — Pankow rule exists and works; the gap is Essen-only and may be intentional

**Root cause / correction.** The expected "Pankow gap" does not exist:
**PAN-025** (DOC-0016 "Sterbeurkunde Partner", conditional
`{"field":"marital_status","value":"verwitwet","operator":"equals"}`, subject
person_1, active) is live — and **provably working on the real locked case**:
rico (verwitwet, fallback-served → Pankow rules) has the slot and **uploaded
`SterbeurkundePartner1.jpg` against PAN-025 on 2026-08-11**. The sole gap in
all 105 rules: **Essen has no DOC-0016 rule** — while the divorce sibling
exists in both offices (PAN-036 / ESS-046 → DOC-0022 Scheidungsurkunde,
`equals "geschieden"`).

**Roman's failed repro explained.** His only existing case (`adf1ad79`, PLZ
66646 → St. Wendel → Pankow fallback) has **`marital_status` unanswered** —
the evaluator fails closed on absent keys (document-rules.ts:61), so no slot
can render yet. Had he answered "verwitwet", PAN-025 would fire. If his
earlier test was an Essen-questionnaire case (deleted in the go-live
cleanup), he hit the real Essen gap.

**⚠ Blocking caveat before any INSERT.** The canonical Essen master
(docs/document-rules/essen_document_rules.json, from
`essen_document_rules_cto_master.xlsx`) lists DOC-0016 with
`"used_for_offices": "Pankow"` and no widowed rule — possibly a deliberate
statement that the **Essen Sozialamt does not request this document**. Roman
must confirm against the Essen master before ESS-056 ships. Nuance for the
question to him (verify pass): the master carries an explicit
`excluded_mapping` ledger (13 deliberately excluded documents) plus a
`question_changes` list, and DOC-0016/verwitwet appears in NEITHER — the
master is silent rather than affirmatively excluding, which tilts the prior
toward "omission". Still his call.

**Exact widowed values (char-for-char, byte-identical in both):**
`"verwitwet"` (hex `766572776974776574`, 9 chars, no whitespace). Berlin
options: `ledig | eheähnliche Gemeinschaft | eingetragene Lebenspartnerschaft
| verheiratet | dauernd getrennt lebend | geschieden | verwitwet`. Essen:
`ledig | verheiratet | Lebenspartnerschaft | eheähnliche Gemeinschaft |
verwitwet | getrennt lebend | geschieden`. rico's stored answer: exactly
`"verwitwet"`. No visibility rule anywhere references the value (partner
gates use the married-triple only); PAN-025 is the only doc rule testing it.

**Rule ids.** PAN-001…050 contiguous (next free PAN-051 — not needed);
ESS-001…055 contiguous → **next free ESS-056**.

**Fix (draft, IF Roman confirms).** INSERT-only migration
`ESS-056`: office `10000000-…-0162`, DOC-0016, conditional, person_1,
`instance_note 'one slot for applicant'`, period_months NULL, condition
`{"field": "marital_status", "operator": "equals", "value": "verwitwet"}` —
mirroring ESS-046's shape; preconditions (DOC-0016 active, no existing
ESS-056/Essen-DOC-0016 rule) + post-assert (56 active Essen rules). House
style per 20260730000003. Full SQL in the triage record. Master JSON +
`tests/fixtures/essen-rules.normalized.json` updated in the same PR so
master/fixture/prod stay consistent (mechanism — regenerate vs documented
hand-edit — is an open decision).

**Evaluator regression plan.** A widowed fixture does NOT exist today. Plan:
new Essen unit block (verwitwet → exactly one ESS-056 slot
`{DOC-0016, person_1, instanceKey 'default', periodMonths null}`; all six
other marital values + unanswered → zero); the existing exact-set and golden
tests stay byte-identical (ledig fixtures never fire it; no PAN change ⇒
Pankow goldens F1-F3 untouched). Recommended additive: Pankow fixture F4
(verwitwet) + golden, since the value is load-bearing for a real customer and
has zero golden coverage.

**Migration vs code.** Migration-only (row-add, benign class; evaluator
already handles the shape; no new German — DOC-0016's name_de is existing
Roman content). Tests/fixtures ride as a normal code commit.

**Real-data impact.** rico: **no change** (his slot exists and is satisfied;
the hypothesized "locked case gains a missing slot" does not occur — nothing
is inserted for Pankow). Roman/Berk: no change until they answer
marital_status. Essen insert affects zero live cases (no Essen-questionnaire
cases exist); it is retroactively effective for future Essen widowed cases by
derivation.

**Open decisions.**

1. **Roman (blocking):** does Essen require the Sterbeurkunde des Partners?
   (Master says Pankow-only today.)
2. Master/fixture consistency mechanism (regenerate vs hand-edit with note).
3. Add Pankow F4 widowed golden (recommended yes).
4. Ask Roman where his failed widowed test ran (Essen case? or checked before
   saving marital_status?) — closes the loop on his report.

---

## ITEM 5 — Date range cap

**Root cause.** Deliberate feedback-pass-2 design, now too tight: ONE
app-wide bound `1900-01-01 … (currentYear+1)-12-31` (today 2027-12-31) in the
client (question-renderer.tsx:127-128, applied :134-135; month variant
:152-153) and year-granular in the server gate (actions.ts:366-367 date,
:381 month_year; error "Ungültiges Datum."). **No per-question override
exists**: all 45 date questions (Berlin 16, Essen 29) and all 4 Essen
`month_year` questions have `validation: null`. A 10-year Personalausweis
valid until 2031+ cannot be entered.

**Inventory.** 45 `date` + 4 `month_year` questions (the month_year enum
migration added only the type; the 4 users are the past-oriented
prior-SGB-benefit periods). Year-selects `berlin_since`/`berlin_district_since`
(options 2026→1930) are selects, not date inputs — out of scope (side note:
the 2026 top option will someday need a new row). **Pre-steps and auth pages
have zero date inputs** (verified file-by-file). The questionnaire renderer is
the app's single date-input surface.

**Classification (core deliverable).** **FUTURE-ORIENTED → max = today+10y:
16 question rows / 14 unique keys:**

- Berlin: `id_expiry_date`, `spouse_id_expiry_date` (ID expiry exists ONLY in
  Berlin — Essen never asks it), `disability_card_expiry`,
  `spouse_disability_card_expiry`, `rent_paid_until`,
  `rent_contract_terminated_by`
- Essen: `disability_card_expiry`, `spouse_disability_card_expiry` (same keys
  as Berlin), `former_rent_paid_until`, `former_rent_contract_terminated_by`,
  `last_health_insurance_until`, `spouse_last_health_insurance_until`,
  `private_pension_due_date`, `spouse_private_pension_due_date`,
  `state_subsidized_private_pension_due_date`,
  `spouse_state_subsidized_private_pension_due_date`

Judgment calls, each reasoned in the triage record: rent-paid-until can be
prepaid; Kündigung "zum" dates end notice periods in the future;
`last_health_insurance_until` is past-phrased but coverage can end in the
future (weakest call — Roman to confirm). **PAST-ONLY → untouched: 29 date
questions** (all birthdates incl. `ex_partner_birthdate`,
`marital_status_since`, `in_facility_since` ×2, entry dates, application/
issued/transfer dates, `prior_social_aid_until` ×2) **+ all 4 month_year
fields** (month path completely untouched). Tally: 16+29+4 = all 49
classified.

**Interpretation note (goes verbatim into ClickUp):** Roman said "alle
Felder", but birth dates must not accept the future — read charitably, only
the 14 future-oriented keys widen. **„Geburtsdaten bleiben bewusst
vergangenheitsbeschränkt."** Nuance: past-only fields keep the EXISTING
`(currentYear+1)-12-31` cap (a 2027 birth date is accepted today and stays
accepted — tightening past-only fields to `max=today` would exceed this
item's scope; flagged as an open decision).

**Fix (recommended Option A — code, matching the batch plan and the pass-2
precedent of code-owned bounds):** new pure module `lib/date-bounds.ts`
(`DATE_MIN`, `FUTURE_ORIENTED_DATE_KEYS` set, `dateMaxFor(questionKey)`);
DateInput consumes `dateMaxFor(question.key)` (`question.key` is already on
InputProps); server: add `key` to the question select (actions.ts:159), pass
into `validateAnswerValue`, replace the year check with day-granular ISO
string comparison. `'use server'` forbids exporting the validator — the lib
module is the testable seam. **Option B (rule-1-pure, per-question
`validation` JSONB via migration) documented and not recommended**: its real
cons are contradicting the recorded pass-2 decision ("No per-question DB
validation — one consistent bound", milestone-log.md:588) and more moving
parts for a numeric bound Roman will never author. (Verify-pass correction:
Option B does NOT touch `seed.sql` — a deliberate no-op since the baseline
migration — and needs NO verify-baseline changes, since that script diffs
prod against a migration replay; the founder should weigh Option B without
those phantom costs.) Rule-1 tension flagged for ratification.

**Tests.** **No existing test pins the current bounds** (greps: zero hits;
all e2e fills use in-bounds dates) — Batch A only ADDS: unit
`date-bounds.test.ts` (+10y accept incl. 2031 for every future key,
past-only reject >cap, Feb-29 rollover, year-22000 stays dead) and e2e:
`id_expiry_date` accepts `2031-05-01`; `geburtsdatum` rejects `2031-01-01`
via the SERVER path (Playwright `.fill()` bypasses the native max — the
assert must target the server error "Ungültiges Datum.").

**Migration vs code.** Pure code (Option A), one deploy, no migration, no
seed/baseline change. Rollback = revert.

**Real-data impact.** **No existing answer becomes invalid** (all 11 date
answers checked; future keys only gain headroom). Evidence FOR the fix: rico's
`id_expiry_date` and `disability_card_expiry` are both exactly
**"2027-08-11"** — identical dates on two unrelated documents, exactly +1
year from his fill date, just under the cap; born 1941, his real ID expiry is
plausibly later (Personalausweise run 10 years). Unprovable, but it reads
like a user settling for a reachable date. **Ops follow-up: re-confirm both
dates with the customer** (case is locked — correction is ops-side).

**Open decisions.**

1. Ratify Option A (code) over Option B (DB validation) — rule-1 tension on
   record.
2. Tighten past-only fields to `max=today`? (Beyond scope; no prod answer
   would violate it.)
3. `+10y` semantics: rolling today+10y (recommended) vs `(currentYear+10)-12-31`.
4. `last_health_insurance_until` classification (weakest call).
5. Optional hardening: strict ISO regex on the server date path (natural
   by-product of the rewrite) — include or defer.

---

## ITEM 6 — Disability card without expiry — gate question

**Current state.** Four required `date` expiry questions, all gated
`{"value":"Ja"}` on their card question: Berlin `disability_card_expiry`
(sort 18; card sort 16 `Ja|Nein`; the `"Nein"`-branch
`disablity_card_application` at 17 — **pre-existing typo key, report-only**),
Berlin `spouse_disability_card_expiry` (sort 22; spouse card marital-gated),
Essen `disability_card_expiry` (sort 17; card options `Ja|Nein|Beantragt`,
"Beantragt" has its own application-date question — untouched), Essen
`spouse_disability_card_expiry` (sort 15). Full tables with ids/rules in the
triage record.

**Doc rules:** exactly 4 disability rules (PAN-028/029, ESS-023/024 →
DOC-0018 "Schwerbehindertenausweis"), all reading **only** the card
question. **Nothing — no rule, no lib/app code — reads the expiry answer**
(repo grep: zero disability hits in lib/ or app/). **Export:** fully generic;
post-change a gate="Ja" case shows the gate row and simply no expiry row
(ops reading: unbefristet ⇒ no date to copy); gate="Nein" shows both,
adjacent. No export change needed.

**Fix design (decided approach, spelled out).** Per questionnaire side, a new
required `single_select` gate (`Ja`/`Nein`, options seeded like the
children-gate precedent 20260723000001) that **takes over the expiry's
current visibility rule verbatim**, while the expiry is re-gated to
`{"value":"Nein","question_key":"<gate>"}`:

| Where                | Key                                | Sort | Gate rule (= expiry's today)                             |
| -------------------- | ---------------------------------- | ---- | -------------------------------------------------------- |
| Berlin antragsteller | `disability_card_unlimited`        | 18   | `{"value":"Ja","question_key":"disability_card"}`        |
| Berlin spouse        | `spouse_disability_card_unlimited` | 22   | `{"value":"Ja","question_key":"spouse_disability_card"}` |
| Essen antragsteller  | `disability_card_unlimited`        | 17   | same                                                     |
| Essen spouse         | `spouse_disability_card_unlimited` | 15   | same                                                     |

Transitive visibility (nav.ts:50-71) gives exactly the wanted semantics:
card ≠ "Ja" → gate and expiry hidden (stale answers inert); "Ja" + gate
unanswered → gate required, expiry hidden; "Ja"+"Nein" → expiry required;
"Ja"+"Ja" → expiry hidden. Essen's "Beantragt" branch untouched. Fresh
denominators UNCHANGED (gate hidden until "Ja") — m7's 49/52 anchors stay.
`sort_order` has no uniqueness constraint (plain index only) but house style
renumbers: one `sort_order+1` shift per category (assert exact shift counts;
Essen spouse has pre-existing holes at 41/54/87 — shift harmlessly).
Proposed ids `…0101/…0102` per prefix (current max `…0100`; re-verify at
execution).

**⚠ The one real hazard — rico's locked case (backfill REQUIRED).** He holds
`disability_card="Ja"` + expiry `"2027-08-11"`. Without backfill the gate is
visible-and-unanswered on his locked case: simulated **75/75 (100%) → 74/75
(99%)**, AND his answered expiry bubble **vanishes from the chat history**
(history renders only currently-visible questions, chat-view.tsx:555).
Nothing functional breaks (locked saves refused; status can't regress; export
still prints the row) — but a locked real case silently dropping below 100%
with a vanished answer is exactly the pass-4 additive-backfill class.
**Backfill in the same migration:** for every case holding an expiry answer,
insert gate=`"Nein"` (the uniquely consistent answer — they gave a date), as
generic idempotent `INSERT…SELECT … ON CONFLICT (case_id, question_id,
group_instance) DO NOTHING` (4 sibling INSERTs), PLUS the pass-4-strict named
assert on rico (pre-check his current state, drift → abort; post-check
gate="Nein" landed and no expiry-holder lacks a gate answer). With backfill:
**76/76 = 100%**, bubble stays, one backfilled gate bubble appears (same
accepted side effect as the children-gate backfill). The backfill also closes
a data-loss window for in_progress cases: expiry-holders without a gate would
otherwise have the expiry row DELETED by the stale-answer sweep on their next
save.

**Sweep consequence (explicit, correct-by-design):** an in_progress user who
answered expiry under the old rules and now answers gate="Ja" hides the
expiry → the sweep deletes the old expiry row on that save; flipping back to
"Nein" re-asks fresh. Exactly the sweep's intended semantics.

**New German — PLACEHOLDER_DE (ledger + ClickUp, Roman's word final):**
applicant „Ist der Ausweis unbefristet gültig?", spouse „Ist der Ausweis
Ihres Partners unbefristet gültig?". Flag for Roman: Essen siblings all say
"Schwerbehindertenausweis oder Feststellungsbescheid" — should the Essen
gates echo that? `help_de` proposed NULL (matches siblings) unless Roman
wants an „unbefristet"-explainer.

**Migration vs code.** **Data-only: one migration, ZERO app code** (engine is
fully data-driven; nothing references disability keys in code). Founder push;
no Vercel deploy needed. Batch-B tests ride as a normal commit and can only
go green after the push.

**Tests (Batch B).** Unit: extend the buildNav-denominator and
transitive-visibility describe blocks (gate required on "Ja"; expiry hidden
until gate="Nein"; gate="Ja" hides expiry + findStaleAnswerRefs catches a
lingering answer; card="Nein" hides both transitively). e2e: drive "Ja" →
gate appears; gate "Ja" → next is markers, flow completes; gate "Nein" →
expiry required; sweep leg (gate Nein+expiry → edit gate Ja → expiry row
cleared). Existing drives unaffected: completion prefers "Nein";
documents-m6 pins disability keys to "Nein" (its A5 DB-flip block on a locked
case asserts only slot presence — unaffected); m7 fresh denominators stand.
Verify pass extended the denominator census: mobile-footer.spec.ts:154
('von 49 Fragen') and feedback-pass.spec.ts:284 (template assert driven
52/52/49/49 at :333-:345) also verified stable — fresh cases, both drivers
prefer "Nein", the gate never appears. Cosmetic seed note: Berlin's existing
disability selects use option KEYS 'ja'/'nein' while the children-gate
precedent uses 'o0'/'o1' — keys are per-question cosmetic, values are "Ja"/
"Nein" everywhere; follow the o0/o1 precedent. Post-push live check: rico
recomputes to 100%.

**Open decisions.**

1. **Include spouse mirrors this round? Recommended YES** (identical
   real-world problem; zero spouse answers exist — backfills nothing; one
   Roman round-trip instead of two).
2. The four gate wordings (Roman) + the Feststellungsbescheid echo question.
3. Backfill shape: generic INSERT…SELECT + named rico assert (recommended
   middle ground) vs strict named-cases-only.
4. Berlin gate at sort 18 vs directly after the card (17.5-equivalent) —
   user-invisible either way (application question and gate are mutually
   exclusive); founder preference.
5. Typo key `disablity_card_application` stays untouched (report-only;
   documents-m6:264 references it verbatim).

---

## Cross-item interactions (read before the batch GOs)

1. **Denominators compose:** Item 1 moves Berlin fresh 52→53 (e2e asserts
   change in Batch A). Item 6 moves NO fresh denominator (gate hidden until
   "Ja"). After both: fresh Berlin 53, Essen 49. rico end-state: 75/75 →
   77/77 (item 1: +1/+1 via his non-empty answer; item 6: +1/+1 via
   backfill) — **stays 100% throughout**.
2. **Item 4 does NOT change rico's checklist** (no PAN insert) — item 3's
   variant math stands at missing = 3 for him.
3. **Sequencing note (items 5+6):** item 6's migration asserts rico's expiry
   = "2027-08-11" as a drift guard, while item 5 recommends ops re-confirm
   (and possibly correct) exactly that date with the customer. **Run item 6's
   migration BEFORE any ops correction**, or update the named assert.
4. **Item 3's variant is what rico will actually see** (locked, missing=3,
   fallback banner also visible on his Dokumente tab). The completion e2e
   fixture locks with missing>0 → existing specs will exercise the variant
   path; the byte-identical-at-0-missing leg needs a new upload-everything
   drive.
5. All three live cases are fallback-served (§0) — any e2e asserting
   own-office behavior for Berlin PLZs would be wrong today; F2's Pankow-own
   leg uses PLZ 13187 which resolves to the Pankow office directly (unchanged).

## Batch mapping (updated per findings)

- **Batch A (mechanical):** Item 5 (code, Option A + new tests) · Item 1
  (migration + e2e assert edits; founder-push STOP before the gate) · Item 4
  **only if Roman confirms Essen** (ESS-056 INSERT + fixture/master updates +
  widowed unit block; otherwise drops out of Batch A entirely — Pankow needs
  nothing).
- **Batch B (design-carrying):** Item 3 (row-add migration + card variant code
  - spec extensions) · Item 6 (data-only migration incl. backfill; unit + e2e
    additions) · Item 2 (escalation text only; optional post-approval copy
    migration).
- **Roman round-trip needed before/while batching:** item 4 blocking question;
  items 3+6 PLACEHOLDER texts; item 2 wording proposal; item 5 ClickUp
  interpretation note (all drafted above).

## Summary table

| #   | Item                            | Root cause                                                                                            | Fix                                                                                                     | Migration vs code                                   | Real-data impact                                                                     | Blocking decisions                        |
| --- | ------------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------ | ----------------------------------------- |
| 1   | Betreuer mandatory              | Berlin `power_of_attorney` optional by Tier-7 decision; Essen already required                        | `is_required=true` flip + locked-case abort-guard; e2e 52→53                                            | Migration + test edits                              | None today (rico answered non-empty; zero `''` rows)                                 | Ratify abort-not-backfill                 |
| 2   | Behörde "duplicate"             | Verdict B: Personaldokument vs Vertriebenen-/Spätaussiedlerausweis (feeds DOC-0021)                   | No deletion; ClickUp wording proposal to Roman                                                          | Nothing now; optional copy migration after approval | None (text-only)                                                                     | Roman wording                             |
| 3   | Completion card vs missing docs | Locked card says "nichts weiter tun" unconditionally; gate ignores docs by design                     | Docs-aware locked-card variant + petrol "Zu den Dokumenten" (context tab-switch); 4 PLACEHOLDER_DE rows | Row-add migration + code                            | rico (locked, missing=3) sees the corrected card                                     | 4 German texts; all-answered-card button? |
| 4   | Verwitwet → Sterbeurkunde       | Premise corrected: PAN-025 exists + works (rico uploaded); gap is Essen-only; master says Pankow-only | ESS-056 INSERT iff Roman confirms; widowed fixture/golden added                                         | Migration-only (conditional)                        | None today (zero Essen cases; rico satisfied)                                        | **Roman: does Essen require it?**         |
| 5   | Date cap                        | One app-wide bound (1900…+1y), no overrides; expiries unenterable past 2027                           | `lib/date-bounds.ts`: 14 future keys → today+10y; past-only untouched                                   | Code only (Option A)                                | No answer invalidated; rico's twin "2027-08-11" expiries suspicious → ops re-confirm | Ratify Option A; past-only tightening?    |
| 6   | Unbefristet disability card     | Expiry required whenever card="Ja"; unbefristet cards can't complete truthfully                       | 4 gate questions (incl. spouse) + expiry re-gate + **backfill gate="Nein" for expiry-holders (rico!)**  | Migration-only (data), zero code                    | Without backfill rico drops to 99% + answer bubble vanishes; with backfill 100%      | Spouse scope (rec: yes); gate wordings    |

**STOP.** Awaiting batch GOs (and the Roman round-trip items above). Nothing
has been changed in code, migrations, or prod.
