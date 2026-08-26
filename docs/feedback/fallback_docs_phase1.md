# Fallback document list — Phase 1 discovery + impact report

> Read-only pass. No source file, migration, test or scaffold was created — this
> report and `fallback_docs_state.md` are the only two repo files this phase
> wrote (plus one cross-note line in `m8_admin_state.md`, as the brief
> instructs). All SQL below is **quoted for review**, not written to
> `supabase/migrations/`.
>
> Method: 6 parallel read-only repo readers over the discovery checklist, then
> an adversarial verification pass, then a completeness critic. Every
> load-bearing claim was additionally read directly from the repo by me. The
> impact numbers come from a read-only prod scan (GET requests only) that
> imports the repo's own pure evaluator (`lib/document-rules.ts`) and mirrors
> the app's derivation exactly (`getCaseAnswers` active-filter →
> `deriveGroupData(mode 'render')` → `getDocumentData` ladder →
> `evaluateDocumentRules` → `countMissingSlots`); scan script + raw JSON live in
> the session scratchpad, never in the repo. Two independent corroborations of
> the scan against the documentary record: the real locked fallback case
> `52e364f1` at **17 slots / missing 0, PAN-016/017/018 among the uploads**
> (matches `docs/feedback/golive_round2_batch_c.md:530-534` and `:646-648`) and the
> fresh-case banner "above **11 default slots**" (matches
> `docs/feedback/golive_blockers_state.md:31-35`).

---

## 0. Headlines

### 0.1 The brief's premise, updated: 7 of 8 live cases are fallback-served

The M8 discovery (2026-08-16) counted 4 prod cases, all fallback-served. As of
this scan there are **8**: **7 fallback-served** (all on the Berlin
questionnaire) **plus one genuine Essen own-rules case** (`ecdf545d`, PLZ 45145,
43 uploads, `under_review`) that this fix must provably not touch. Three of the
seven fallback cases are `under_review` (locked), two of those with substantial
uploads. The migration-grade-care framing of the brief stands — it now covers
more real users than when it was written.

### 0.2 The load-bearing constraint the brief did not anticipate: the `rule_id` join

Every upload is bound to its checklist slot by the pair
**`(rule_id, instance_key)`** — in the UI
([document-area.tsx:99-100](../../app/case/document-area.tsx)), the counter
(`countMissingSlots`, [document-rules.ts:269-273](../../lib/document-rules.ts)),
and the export ([case-export.mjs:288-290](../../scripts/case-export.mjs)).
Fallback-case uploads therefore carry **Pankow's real rule ids** (`PAN-###`) in
`document_upload.rule_id`, because the fallback serves Pankow's actual rows
(§1.1), and `recordUploadAction` writes the slot identity the client saw
([document-actions.ts:200-211](../../app/case/document-actions.ts)).

**Consequence:** the brief's literal mechanism — "introduce a new default rule
set and point the fallback resolver at it" — implemented as a new office with a
purged *copy* of the rules under new ids would detach **every** existing
fallback upload from its slot, not just the dropped ones. The complete case
`52e364f1` (19 uploads, missing 0) would flip to *every slot missing*. Any
mechanism must preserve upload binding for the **kept** requirements. §3
presents three additive shapes that satisfy the brief's intent (Pankow/Essen
untouched, nothing deleted or edited in the served set) and recommends the one
that keeps all bindings with zero writes to user rows.

### 0.3 The evidence draws not one line but three — the founder picks at the gate

The three suspected entries are **confirmed office-specific** by every source
the repo has (§1.3): `docs/known-limitations.md:39-40` names exactly
*Mobilitätsnachweis, Nachweis Bedarfsanzeige, polizeiliche Anmeldung im Heim*
as the accepted over-collection, and Roman's canonical master
(`docs/document-rules/essen_document_rules.json`) tags their catalog docs
`"used_for_offices": "Pankow"`. **But the same master tags five always-mandatory
docs Pankow-only, not three** — additionally `DOC-0004 Pflegegutachten MDK`
("Currently Pankow only.") and `DOC-0012 Krankenversicherungskarte` ("Not used
as upload slot for Essen at current decision stage.") — plus five conditional
Pankow-only docs. §2 therefore prices three candidate drop lines (A = the
documented trio, B = all five Pankow-only mandatories, C = every Pankow-only
doc), with per-entry rationale and my recommendation (A). The final list is the
founder's decision, per the brief.

### 0.4 Scope warning: the fallback list is not only for exotic PLZs

Since Batch C (`20260813000004`), **every Berlin case except Pankow-routed PLZs
is fallback-served** — the 11 Berlin district offices were created with zero
rules *by design*, and `docs/milestone-log.md:709` records the standing
rationale: the default deliberately stays Pankow because the default serves
Berlin-questionnaire cases and Pankow's rules are keyed on Berlin question keys.
Five of the seven live fallback cases are Berlin residents (Mitte,
Marzahn-Hellersdorf, Friedrichshain-Kreuzberg ×2, Charlottenburg-Wilmersdorf).
For them the trio may be *Berlin-wide* practice rather than Pankow-only — the
repo's evidence distinguishes Pankow vs Essen, not Pankow vs other Berlin
districts (the complete Marzahn case uploaded all three; its district office
presumably accepted them). The purge applies to these Berlin cases identically.
Whether that is intended, or whether Berlin-district fallback cases should keep
the fuller list, is a product call only the founder can make — §8 Q3.

---

## 1. Discovery findings

### 1.1 Resolution path — what the fallback serves today

**PLZ → office → questionnaire** (`resolvePlzAction`,
[actions.ts:52-128](../../app/case/actions.ts)): highest-priority
`postal_code_rule` range match → writes `social_office_id`, that office's
active questionnaire (else `DEFAULT_QUESTIONNAIRE_ID` = Berlin,
`30000000-…-0001`), `plz_before_move`, `plz_resolution_status: 'resolved'`.
No match → Berlin questionnaire, **`social_office_id` stays NULL**, status
`'unsupported'`. All 8 live cases are `'resolved'` — the generic priority-1 PLZ
rules cover nearly all of Germany, so in practice "unmapped PLZ" means
**"office without its own rule set"**, not "no office".

**Office → document rules** (`getDocumentData`,
[dal.ts:304-360](../../lib/dal.ts)): the ladder is

1. case's own office's `office_document_rule` rows where `active = true` →
   `rulesSource = 'own'` (today: Pankow 49 active of 50, PAN-011 retired;
   Essen 56);
2. else the `app_config.default_document_office_id` office's active rows —
   currently Pankow, `11000000-…-0001`, seeded by `20260722000002` —
   → `rulesSource = 'fallback'` (guard `defaultOffice !== socialOfficeId`);
3. else `rulesSource = 'none'` → no documents pane (safety branch).

**The fallback serves Pankow's actual rows — the same live rows a real Pankow
case would use, not a copy.** Both branches run the identical query; only the
office id differs. This is why fallback slots carry `PAN-###` rule ids (§0.2).

**Every consumer of `rulesSource`** (complete): the banner gate
`fallbackNoticeText` ([docs-pane.ts:38-45](../../lib/docs-pane.ts), called only
at [page.tsx:335](../../app/case/page.tsx)); the period-suffix suppression
`fromFallbackRules = rulesSource === 'fallback'`
([page.tsx:338](../../app/case/page.tsx) →
[document-rules.ts:251-259](../../lib/document-rules.ts), mirrored at
[case-export.mjs:293](../../scripts/case-export.mjs)); and the export's
duplicated ladder (`usedFallback`,
[case-export.mjs:237-263](../../scripts/case-export.mjs)) driving its
documents.md preamble. Nothing else. No runtime code assumes the default office
*is* Pankow, and office names render user-facing nowhere (recorded in
`20260813000004:17-19`).

### 1.2 Where requirement definitions live → Phase 2 contains a migration

Entirely in the database: `document_catalog` (43 rows, `DOC-####`) +
`office_document_rule` (106 rows: 50 PAN of which 49 active, 56 ESS; JSONB
conditions), evaluated live by the pure, zero-import
[lib/document-rules.ts](../../lib/document-rules.ts). Seeds are GENERATED
migrations from Roman's masters (`20260711000006` Pankow from
`docs/content/pankow_document_rules_cto_master.xlsx`; `20260724000001` Essen
from `docs/document-rules/essen_document_rules.json`, the canonical committed
master). The last migration to edit any PAN condition was `20260722000003`
(Essen-compat, Berlin-inert branches). Whatever mechanism is chosen in §3, the
change is data + a small code delta — and Phase 2 contains a migration.

### 1.3 The current fallback list, verbatim, with per-entry classification

**What a fresh fallback case sees — 11 slots** (verified live on three fresh
prod cases and corroborated by `golive_blockers_state.md:31-35`); conditional
rules add more as answers accumulate (§4 appendix has each real case's full
list):

| # | Rule | Doc | German name (live catalog) | Classification | Evidence |
|---|------|-----|---------------------------|----------------|----------|
| 1 | PAN-001 | DOC-0001 | Personaldokument | **generic** | `used_for_offices: "Pankow, Essen"`; ESS-001 |
| 2 | PAN-005 | DOC-0003 | Kontoauszüge (– Girokonto) | **generic** | "Pankow, Essen"; ESS-010 |
| 3 | PAN-007 | DOC-0004 | Pflegegutachten MDK | **Pankow-only per master** — but a nationwide-standard document | `"Pankow"`, note "Currently Pankow only."; no ESS rule |
| 4 | PAN-008 | DOC-0005 | Leistungsbescheid Pflegekasse | **generic** | "Pankow, Essen"; ESS-005 |
| 5 | PAN-010 | DOC-0006 | Vertretungsvollmacht / Betreuungsnachweis | **generic** | "Pankow, Essen"; ESS-012; master note: "Always mandatory due to product/application submission logic." |
| 6 | PAN-012 | DOC-0007 | Heimvertrag | **generic** | "Pankow, Essen"; ESS-006 |
| 7 | PAN-014 | DOC-0008 | Bisherige Heimrechnungen | **generic** | "Pankow, Essen"; ESS-007 |
| 8 | PAN-016 | DOC-0009 | **Nachweis Bedarfsanzeige** | **office-specific — confirmed** | `"Pankow"`; named in known-limitations.md:39-40; no ESS rule; a Berlin-administration process artifact |
| 9 | PAN-017 | DOC-0010 | **Polizeiliche Anmeldung im Heim** | **office-specific — confirmed** | same three sources |
| 10 | PAN-018 | DOC-0011 | **Mobilitätsnachweis** | **office-specific — confirmed** | same three sources + `milestone-log.md:703` ("Pankow-only mandatories (Mobilitätsnachweis etc.)") |
| 11 | PAN-019 | DOC-0012 | Krankenversicherungskarte | **Pankow-only per master** — but a universal document | `"Pankow"`, note "Not used as upload slot for Essen at current decision stage."; no ESS rule |

All three of the brief's hypotheses are **confirmed** — none turned out
generic. The conditional Pankow rules classify as follows (fire only on
matching answers):

- **Generic** (doc tagged "Pankow, Essen", ESS counterpart exists): PAN-002/004/006
  (spouse mirrors of 1-2), PAN-003 (Renten/Pensionsbescheid, per pension),
  PAN-009/013/015 (spouse Leistungsbescheid/Heimvertrag/Heimrechnungen),
  PAN-020/021 (Lebensversicherung), PAN-022/023 (Sterbeversicherung — PAN-022's
  Essen mapping deliberately excluded, but the doc itself is both-office),
  PAN-024 (Bestattungsvorsorgevertrag), PAN-028/029 (Schwerbehindertenausweis),
  PAN-030/031 (Haftpflicht), PAN-032/033 (Wohngeld), PAN-036
  (Scheidungsurkunde), PAN-039/040 (Mietvertrag/Mietkündigungsnachweis),
  PAN-043…048 (KFZ trio).
- **Special case — PAN-025 (DOC-0016 Sterbeurkunde Partner): generic by
  override.** The master tags it Pankow-only, but ESS-056 is an approved
  override ("APPROVED OVERRIDE (Roman, 2026-08-13; round-2 item 4): … Essen now
  requires it too", `essen_document_rules.json` cto_notes). It stays in every
  candidate line.
- **Pankow-only per master (conditional):** PAN-026/027 (DOC-0017
  Aufenthaltsstatus), PAN-034/035 (DOC-0021 Heimatvertriebener/Spätaussiedler
  Nachweis), PAN-037/038 (DOC-0023 Leistungsnachweis Sozialhilfe), PAN-041/042
  (DOC-0026 Nachweis anderes Einkommen — the generic catch-all Essen replaced
  with typed docs DOC-0032/0034/0035), PAN-049/050 (DOC-0030 Nachweis
  Immobilienwert).

Origin note: all 50 PAN rules come from the Pankow office's own list (Roman's
workbook, seed header `20260711000006:1-5`). **No repo source distinguishes
"required by SGB XII generally" from "Pankow house rule"** — the only
machine-readable office-applicability record is the Essen master's
`used_for_offices` tag (file-only metadata; the DB deliberately has no such
column, `phase1_essen_docs_verification.md` A7). Where the master's tag and
common-sense genericity diverge (MDK-Gutachten, KV-Karte — universal documents
any office may plausibly want), the call is the founder's, not derivable from
evidence. Also on record: the accepted-over-collection stance, in Roman's own
words — "lieber ein Dokument zu viel einsammeln als eines zu wenig"
(`roman_package_pass3.md:41-47`) — which cuts *against* aggressive purging.

### 1.4 The infobox

- **Render site (only one):** `data-testid="fallback-notice"` at
  [document-area.tsx:193-206](../../app/case/document-area.tsx), a sage info
  panel above the first document group. Text arrives via the pure gate
  `fallbackNoticeText(rulesSource, paneMode, content.docsFallbackNotice)`
  ([docs-pane.ts:38-45](../../lib/docs-pane.ts)), called exactly once
  ([page.tsx:335](../../app/case/page.tsx)).
- **Trigger:** `rulesSource === 'fallback' && paneMode === 'list' && text ≠ ''`.
  **Confirmed fallback-only:** own-office (Pankow/Essen) yields `'own'` → null;
  the pre-PLZ branch never mounts `DocumentArea`; no other emitter of the
  testid exists (repo-wide grep). 5 unit tests pin the gate
  (`tests/unit/docs-pane.test.ts:35-59`).
- **The German, verbatim** (single `static_content` row `docs.fallback_notice`,
  seeded by `20260809000001` — the only migration that ever wrote it; verified
  byte-identical on prod during this scan):

  > Hinweis: Für Ihre Postleitzahl liegt uns noch keine spezifische
  > Dokumentenliste vor. Diese Übersicht zeigt die üblicherweise benötigten
  > Unterlagen — Ihr zuständiges Sozialamt kann zusätzliche oder abweichende
  > Dokumente verlangen.

  Precision for Roman's record: this is two sentences; the hedge the brief
  quotes is the second **half** of sentence 2, after the em dash. Provenance:
  shipped as PLACEHOLDER_DE, then finalized under the 2026-08-13 blanket waiver
  ("approved by Erman 2026-08-13, Roman review waived",
  `german_copy_for_roman.md:49-60`).
- **Removal touches:** the JSX block + `fallbackNotice` prop + now-unused
  `Info` import (document-area.tsx); the `fallbackNoticeText` call (page.tsx:335)
  and the gate function + its 5 unit tests; optionally the `docsFallbackNotice`
  plumbing ([dal.ts:172](../../lib/dal.ts), :221). The e2e
  `fallback-notice.spec.ts` F1 positive asserts (banner visible, DOM-order
  above first slot, mobile-visible) **flip to count-0**; F2/F3 (own-office
  absence) stay green and become the permanent never-returns guards. The
  `static_content` row **stays** (no row deletions; an unread row is inert —
  `getStaticContent` only surfaces mapped keys, and the seeding migration's
  ON CONFLICT DO NOTHING replays clean).
- **Independent of the banner:** period-suffix suppression on fallback lists
  (`fromFallbackRules`, deliberately decoupled at document-area.tsx:76-82).
  Removing the banner does **not** remove the suppression — see §8 Q5.
- **The export's fallback note is not this German** — `case-export.mjs:274-280`
  is its own English ops prose ("_Default-office FALLBACK list — … this mirrors
  the checklist the app shows. …_"); it must be updated in lockstep in Phase 2
  (its "mirrors the checklist" claim must stay true).

### 1.5 Count surfaces — one logical source of truth, three surfaces + one duplicate ladder

The **only counting logic** is pure `countMissingSlots(slots, uploads)`
([document-rules.ts:269-273](../../lib/document-rules.ts)) — slots with zero
`(rule_id, instance_key)`-matching uploads. Surfaces:

| Surface | Where | Derivation |
|---|---|---|
| "Es fehlen noch X Dokumente." / "Es fehlt noch 1 Dokument." / "Alle erforderlichen Dokumente sind hochgeladen." header + `data-missing` | [document-area.tsx:168-190](../../app/case/document-area.tsx) | client recompute over the **server's own props** — cannot diverge |
| Tab badge "Unterlagen · N offen" (two mounted instances, desktop pill + mobile row) | [case-tabs.tsx:54-65](../../app/case/case-tabs.tsx), fed from [page.tsx:306](../../app/case/page.tsx) | the same server `countMissingSlots` result |
| Locked-card docs variant + `data-docs-missing` + AllAnsweredCard button | [chat-view.tsx:532](../../app/case/chat-view.tsx), :548-549, :487 | same server value, boolean/attribute only |
| Export summary + per-slot `**FEHLT**` | [case-export.mjs:272-296](../../scripts/case-export.mjs) | **its own duplicated ladder** — the genuinely separate derivation |

**Progress % and completion are questions-only** — `buildNav` has no document
input ([questionnaire-nav.ts:273-276](../../lib/questionnaire-nav.ts));
`cases.status` flips solely on `nav.allRequiredAnswered`
([actions.ts:249-255](../../app/case/actions.ts)); upload/delete never touch
status (e2e-pinned). So the rule-set change moves *only* the document counters,
and all in-app surfaces move together automatically because nothing is cached —
`getDocumentData` re-queries on every server render, and upload/delete/save all
`router.refresh()`. **The one surface that can drift is the export's duplicated
ladder — it must change in the same commit** (M8 flagged this ladder as having
drifted once already; this fix makes it change a second time, and M8's
`buildCaseView` will be its third consumer — §1.7).

### 1.6 Upload ↔ requirement binding, hide-but-retain, and the sweep

- **Schema** (`20260711000005:70-93`): `document_upload(id, case_id, rule_id →
  office_document_rule(id) with NO cascade, document_id, subject, instance_key
  DEFAULT 'default', storage_path UNIQUE, original_filename, mime_type,
  size_bytes, created_at)`. The no-cascade FK is why rules are retired via
  `active=false`, never deleted (PAN-011 precedent, `20260730000003`).
- **Hide-but-retain already exists structurally.** The UI renders uploads only
  inside their matching slot (`filesFor`, document-area.tsx:99-100); an upload
  whose rule emits no slot renders nowhere and counts nowhere (unit-pinned:
  "an orphaned upload (slot no longer evaluated) does not reduce the count",
  `tests/unit/document-rules.test.ts:253`). The
  PAN-011 retirement recorded exactly this trade-off. **So the "hidden from the
  end-user list, rows fully retained" half of the brief's decision §1.3 is the
  engine's existing behavior — Phase 2 must verify it, not build it.**
- **The user-agency consequence of hiding (critic finding):** the download and
  delete affordances exist only inside slot rows
  (`createDownloadUrlAction` / `deleteUploadAction` are reachable only from
  [document-area.tsx:302-334](../../app/case/document-area.tsx)), so a
  hidden upload is not merely invisible — it is **unviewable and undeletable
  by its owner**. After the purge, Klaus's 3 files and Roland's 1 file stay in
  storage but leave the users' reach entirely; only the ops export and the
  GDPR deletion runbook can touch them. The brief's decision §1.3 mandates the
  hiding; whether affected users should be told, and whether hidden uploads
  ever need a user surface, is §8 Q9.
- **What is genuinely new: the export flag.** Today `documents.md` lists only
  slot-matched files; an unmatched upload appears **only** in `files/` (every
  upload row is always downloaded — case-export.mjs:333-341 — so nothing is
  ever lost to the team). There is no `not_required` anywhere in the repo yet.
  Phase 2 adds an unmatched-uploads section to `documents.md`, flagged
  `not_required`, derived as the exact complement of the slot join
  (`uploads.filter(u => !slots.some(s => s.ruleId === u.rule_id &&
  s.instanceKey === u.instance_key))`) — as a pure, unit-testable function.
- **`storage-sweep.mjs` is safe** — read in full: it is the manual GDPR per-case
  wipe; it lists/deletes **all** objects under one case prefix on an explicit
  `--delete`, has no concept of rules or orphans-by-rule, and cannot
  selectively target dropped-requirement files.
- **Stale-client edge:** `recordUploadAction` records whatever
  `(rule_id, instance_key)` the client sends without re-checking the slot still
  fires — an open tab from before the deploy could still upload against a
  dropped rule (FK stays valid; the row simply lands hidden). Harmless under
  hide-but-retain; noted for completeness.

### 1.7 M8 interaction

M8 Phase 4 (case-view equivalence: determinism → baseline the two locked cases
`52e364f1` + `461038b0` → refactor → empty diff) baselines **exactly the output
this fix changes** — both its locked cases are fallback-served.
**Whichever lands second re-baselines the equivalence fixtures**: if this fix
lands first (cleanest), Phase 4 captures post-purge baselines; if Phase 4 lands
first, its baselines and any committed CaseView fixtures for fallback cases go
stale on the purge push (fewer slot rows, changed summary line, changed
preamble, new `not_required` section) and must be recaptured. Cross-noted in
`m8_admin_state.md`. Both efforts edit the same two ladder copies
(`dal.ts` + `case-export.mjs`); whichever goes first should extract the shared
pure ladder so the other consumes it. **M8's `document_upload` admin-RLS
finding is out of scope here — nothing in this fix touches RLS, `is_admin()`,
or any policy.**

### 1.8 Test constraints

Confirmed: e2e is preview-gated (`VERCEL_AUTOMATION_BYPASS_SECRET` +
`x-vercel-set-bypass-cookie`, playwright.config.ts:24-29) and **previews, local
dev and every e2e run hit the production Supabase project** (M8 finding,
re-confirmed). Existing doc-related e2e specs create/delete throwaway prod
users — the accepted pre-existing protocol. The test plan (§6) therefore puts
all new coverage in the **unit/fixture layer** (pure functions, zero DB) and
limits e2e to updating the assertions of four existing specs at the usual
preview gate — no new prod-writing tests, no e2e writes beyond the established
throwaway-user drill. Open infrastructure question: whether the regenerated
bypass secret still works (M8 §9 Q11) — without it no preview gate runs at all.

---

## 2. Proposed default list — three candidate lines, priced

**Recommendation: Line A.** It is the exact set the repo already documents as
the accepted over-collection, confirmed by Roman's master tags and by the
brief's own suspicions; it removes the entries a non-Pankow user may be unable
to obtain (a Bedarfsanzeige is a Berlin process artifact) while keeping
universal documents (MDK-Gutachten, KV-Karte) that any office may plausibly
want — consistent with the standing "lieber ein Dokument zu viel" stance. Lines
B and C are priced so the founder can draw the line elsewhere in one decision.

> **GATE 1 DECISION (founder, 2026-08-26): Line A approved.** Lines B/C
> rejected pending Roman — the Pankow-only tag on the two extra
> always-mandatory docs (DOC-0004 Pflegegutachten MDK, DOC-0012
> Krankenversicherungskarte) is treated as a seeding artifact until he
> confirms otherwise. Under the approved shape (a) mechanism, **B or C remain
> one config-row UPDATE migration away** if Roman confirms the tags — no code
> change, only the `fallback_excluded_rule_ids` list changes (via UPDATE, not
> the seeding INSERT — see §3a).

| Line | Drops (rules) | Fresh-case list | Rationale boundary |
|---|---|---|---|
| **A (recommended)** | PAN-016, PAN-017, PAN-018 | 11 → **8** | the documented over-collection trio; process artifacts a non-Pankow user may not be able to produce |
| B | A + PAN-007, PAN-019 | 11 → **6** | all five always-mandatory docs the master tags Pankow-only (adds MDK-Gutachten, KV-Karte — universal documents) |
| C | B + PAN-026/027, PAN-034/035, PAN-037/038, PAN-041/042, PAN-049/050 | 11 → **6** (conditionals also gone) | every doc the master tags Pankow-only (except DOC-0016, generic by ESS-056 override) |

Per-entry rationale for A (each: mandatory, `person_1`, fires for every
fallback case today):

- **PAN-016 Nachweis Bedarfsanzeige** — the "Bedarfsanzeige" is a Berlin
  Sozialamt process step; the document proves a notification a non-Berlin user
  never made. Master: Pankow-only. Named in known-limitations.
- **PAN-017 Polizeiliche Anmeldung im Heim** — registration certificate at the
  care-home address; obtainable anywhere (both real fallback uploaders provided
  one) but required as a listed item only by Pankow per every repo source.
- **PAN-018 Mobilitätsnachweis** — the milestone log's canonical example of a
  Pankow-only mandatory.

Not dropped in A, with reasons the founder may override: **PAN-007
Pflegegutachten MDK** (the MD assessment exists for every person with a
Pflegegrad nationwide; case handlers plausibly want it regardless of office)
and **PAN-019 Krankenversicherungskarte** (universal). Both are, per Roman's
master, Pankow-only requirements — if the founder wants the master's line
applied strictly to mandatories, that is Line B.

---

## 3. Proposed mechanism — additive, binding-preserving

Three additive shapes satisfy "Pankow's and Essen's rule sets stay
byte-identical; nothing deleted". They differ in how they treat the upload
binding (§0.2) and in governance:

### Shape (a) — recommended: fallback exclusion list in `app_config`

One new row; the fallback branch (both copies: `dal.ts` + `case-export.mjs`)
filters the default office's rules by id **only when `rulesSource` would be
`'fallback'`**:

```sql
-- Migration: fallback_excluded_rule_ids (additive row; list = founder's Line decision)
INSERT INTO public.app_config (key, value)
VALUES ('fallback_excluded_rule_ids', '["PAN-016","PAN-017","PAN-018"]'::jsonb)
ON CONFLICT (key) DO NOTHING;
```

- **Upload bindings for kept requirements: untouched** — slots keep their
  `PAN-###` ids, so `52e364f1` stays at missing 0 with zero writes to any user
  row. Dropped-rule uploads become unmatched → hidden-but-retained
  automatically (§1.6), and the export's `not_required` derivation is simply
  the slot-join complement.
- **Pankow/Essen byte-identical by construction** — the filter runs only on the
  fallback branch; the own-office branch never sees it.
- **Deploy ordering is the benign case** (CLAUDE.md #8): code reads the new
  key; a missing row degrades to "no exclusions" = today's behavior. Code may
  deploy first, then the founder pushes the row; no outage window either order.
- **Failure semantics must be pinned fail-open (critic finding):** a PRESENT
  but malformed value (non-array, non-string members, typo'd id) must degrade
  to the empty list — i.e. today's behavior — mirroring the existing
  `typeof cfg?.value === 'string'` guard pattern (dal.ts:336). Phase 2 pins
  this with a unit test, and the live verification asserts every listed id
  exists in the default office's active rule set (a typo would otherwise
  silently revert the purge — invisible, because over-collection was the old
  normal). An excluded id later going `active=false` is a harmless no-op.
- **Later list changes are UPDATE migrations** — the quoted
  `ON CONFLICT (key) DO NOTHING` is first-insert-only; a future migration that
  copies the pattern to change the list silently no-ops against the existing
  row. Line moves or per-entry overrides after this one go through
  `UPDATE` (or `ON CONFLICT … DO UPDATE`).
- **`verify-baseline.mjs` already diffs `app_config`** — zero script changes.
  (Expected transient: between committing the migration and the founder's
  `db push`, a local replay has the row and prod does not — the diff reports
  "extra in local", the normal pending-migration state, not drift.)
- **Client visibility note:** `app_config` is readable by every authenticated
  user (`authenticated read USING (true)`, `20260722000002:17-20`), so the
  exclusion list is client-visible. Harmless — rule ids only — but the
  mechanism is not purely server-side and should not be described as such.
- **Governance trade-off (the honest cost):** the default list stays *derived*
  from Pankow's live set. A future Pankow rule edit propagates to the fallback
  unless the exclusion list is updated in the same migration — and a future
  repoint of `default_document_office_id` (which the code explicitly
  anticipates, dal.ts:327-329) would leave the PAN-keyed exclusion list
  matching nothing, serving the new office's FULL list unfiltered. The
  standing rule in the docs pass must cover both triggers: "any migration
  touching PAN rules **or** `default_document_office_id` re-reviews
  `fallback_excluded_rule_ids`".

### Shape (b) — new column `office_document_rule.include_in_fallback BOOLEAN NOT NULL DEFAULT true`

Additive DDL + `UPDATE … SET include_in_fallback = false` on the dropped PAN
rows; fallback branch adds one `.eq()`. Same binding-preserving property as
(a). Costs: it **edits Pankow's rows** (against the brief's §1.4 letter, even
though own-office behavior is provably unchanged — the own branch doesn't read
the column), and `verify-baseline.mjs`'s `office_document_rule` field list must
gain the column or the flags escape the drift guard.

### Shape (c) — the brief's literal shape: new never-routed office + purged copy + repoint

```sql
-- sketch only; ids/names illustrative
INSERT INTO public.social_office (id, name, is_active) VALUES ('…', 'Standard-Dokumentenliste (systemintern)', true);
INSERT INTO public.office_document_rule (id, social_office_id, document_id, requirement_type, subject, instance_note, period_months, condition, active)
  SELECT 'DEF-' || substr(id, 5), '<new office id>', document_id, requirement_type, subject, instance_note, period_months, condition, active
  FROM public.office_document_rule
  WHERE social_office_id = '11000000-0000-0000-0000-000000000001'
    AND active AND id NOT IN ('PAN-016','PAN-017','PAN-018');
UPDATE public.app_config SET value = to_jsonb('<new office id>'::text) WHERE key = 'default_document_office_id';
```

`rulesSource` stays `'fallback'` (verified: no postal rule ever routes to the
new office, and the sole writer of `cases.social_office_id` is the PLZ match).
**But the new ids detach every existing fallback upload (§0.2), so (c) is only
viable plus one of:** (c1) a data migration remapping `document_upload.rule_id
PAN-→DEF-` for cases not routed to a rule-owning office — an UPDATE on live
user rows, exactly the class of edit this fix is trying to avoid (and with a
side effect the verification pass surfaced: `exportFileName` uses `rule_id` in
the exported filename for legacy flat-key uploads, `case-export.mjs:315-321`,
so a remap silently renames those files in future exports); or (c2)
switching the slot↔upload join to `(document_id, subject, instance_key)` —
unique within each office set today (verified over all 106 rules: every
shared-doc pair is a person_1/person_2 mirror), but a today-only property with
no DB constraint enforcing it, and a semantic change to a load-bearing join in
three places. Governance upside: the default set becomes an
independent, frozen copy with its own audit trail (and could later grow its own
master file per the Pankow/Essen precedent). If the founder wants the fallback
list governed as its own first-class rule set going forward, (c)+(c1) is the
honest price; for this fix's stated goal, (a) achieves the user-visible result
with an order of magnitude less risk.

**Common to every shape (Phase 2 code deltas):** banner removal per §1.4;
export ladder updated in lockstep + `not_required` section; period-suffix
suppression decision (§8 Q5); the empty-set guard is trivially satisfied (the
purged fresh list is 8/6/6 slots — `docsPaneMode` never sees zero).

---

## 4. Impact table — every live production case (the gate artifact)

Numbers = the app's own derivation, computed read-only (see header note);
**Line A** primary. "Hidden uploads" = files that leave the end-user list but
stay in DB + storage + `files/`, flagged `not_required` in documents.md.

| Case | Recipient | Status | Rules | Slots now → A | "Es fehlen noch X" now → A | Hidden uploads under A |
|---|---|---|---|---|---|---|
| `c8542a35` | ttt ttt (test-shaped) | in_progress | fallback | 13 → 10 | 13 → 10 | — |
| `52e364f1` | Klaus Schinzel | **under_review** | fallback | 17 → 14 | **0 → 0** | 3 — `…Bedarfsanzeige…pdf` (PAN-016), `…Meldebescheinigung…pdf` (PAN-017), `…Mobilitätsbescheinigu…pdf` (PAN-018) |
| `3b201f7f` | Müller Müller | **under_review** | fallback | 12 → 9 | 12 → 9 | — |
| `ecdf545d` | Josef Rockert | **under_review** | **own (Essen)** | **13 → 13** | **7 → 7** | — (must be provably untouched) |
| `e29041c5` | Ebru Cilingir | in_progress | fallback | 12 → 9 | 12 → 9 | — |
| `656568d4` | Herrmann Bosch | in_progress | fallback | 12 → 9 | 12 → 9 | — |
| `78293a6c` | Roland Hütges | **under_review** | fallback | 21 → 18 | 7 → 5 | 1 — `Ummeldung Hütges.png` (PAN-017) |
| `480c2e44` | Roman Busch | in_progress | fallback | 11 → 8 | 10 → 7 | — |

Delta note: under A every fallback case loses exactly the same three
always-fire `person_1` slots (PAN-016/017/018); no conditional slot moves.
Roland's missing drops by 2 (not 3) because his PAN-017 slot already had an
upload; Klaus's stays 0 (all three dropped slots were filled — those files
become the hidden-retained set). **No case's missing count increases; no
completed case becomes incomplete; the "Alle erforderlichen Dokumente sind
hochgeladen." state of `52e364f1` is preserved.** Every number in this table
becomes an assertion in the Phase-2 live verification.

Coverage caveat (critic finding): **no live case exercises the
own-office-is-the-default branch** — zero cases are routed to Pankow itself,
so the `defaultOffice !== socialOfficeId` guard (the line that keeps a real
Pankow case unfiltered under shape (a)) is provable only in the unit layer
today, unlike Essen's live `ecdf545d`. The Phase-2 verification must re-check
at deploy time whether a Pankow-routed case has appeared, and assert it
unfiltered if so. This table is also a snapshot (2026-08-25): new cases or new
answers before the gate closes change the numbers — re-run the scan then.

Lines B and C, same cases (slots/missing):

| Case | B slots/missing | B hidden uploads | C slots/missing | C hidden uploads |
|---|---|---|---|---|
| `c8542a35` | 8 / 8 | — | 8 / 8 | — |
| `52e364f1` | 12 / 0 | 5 (+ `Pflege Gutachten.pdf`, `KV Bescheinigung.pdf`) | 12 / 0 | 5 (same) |
| `3b201f7f` | 7 / 7 | — | 6 / 6 (also loses PAN-026 Aufenthaltsstatus) | — |
| `ecdf545d` | 13 / 7 | — | 13 / 7 | — |
| `e29041c5` | 7 / 7 | — | 7 / 7 | — |
| `656568d4` | 7 / 7 | — | 7 / 7 | — |
| `78293a6c` | 16 / 5 | 3 (+ `Gutachten.png`, `Krankenkarte Hütges.png`) | 15 / 4 (also loses the open PAN-041 "Einkommen 1: Pflegegeld" slot) | 3 (same) |
| `480c2e44` | 6 / 5 | — | 6 / 5 | — |

### Appendix: current full slot lists per case (scan output, Line-A drops marked †)

- **c8542a35** (13): PAN-001, PAN-002 (p2), PAN-005 Giro, PAN-006 (p2 Giro),
  PAN-007, PAN-008, PAN-010, PAN-012, PAN-014, PAN-016†, PAN-017†, PAN-018†,
  PAN-019
- **52e364f1** (17, all uploaded): PAN-001, PAN-003 ×2 (Rente 1-2), PAN-005
  Giro, PAN-007, PAN-008, PAN-010, PAN-012, PAN-014, PAN-016†, PAN-017†,
  PAN-018†, PAN-019, PAN-025, PAN-028, PAN-039, PAN-040
- **3b201f7f** (12): the fresh 11 + PAN-026 (minus none; PAN-003 zero
  instances)
- **ecdf545d** (13, Essen — untouched): ESS-001, ESS-003 ×3, ESS-005, ESS-006,
  ESS-007, ESS-008, ESS-010, ESS-012, ESS-017, ESS-029, ESS-030
- **e29041c5** (12): fresh 11 + PAN-025
- **656568d4** (12): fresh 11 + PAN-028
- **78293a6c** (21): PAN-001, PAN-003 ×3 (Renten 1-3), PAN-005 Giro+Sparkonto,
  PAN-007, PAN-008, PAN-010, PAN-012, PAN-014, PAN-016†, PAN-017†, PAN-018†,
  PAN-019, PAN-025, PAN-028, PAN-030, PAN-039, PAN-040, PAN-041 (Einkommen 1)
- **480c2e44** (11): the fresh 11

---

## 5. Removed German copy — verbatim, for Roman

Exactly one German string leaves the product (deletion only, zero new German
anywhere in this fix). `static_content` key `docs.fallback_notice`, live on
prod today, rendered on every fallback-served checklist since 2026-08-09:

> Hinweis: Für Ihre Postleitzahl liegt uns noch keine spezifische
> Dokumentenliste vor. Diese Übersicht zeigt die üblicherweise benötigten
> Unterlagen — Ihr zuständiges Sozialamt kann zusätzliche oder abweichende
> Dokumente verlangen.

Provenance: seeded as PLACEHOLDER_DE by `20260809000001`; finalized at live
value under the 2026-08-13 blanket waiver (approved by Erman, Roman review
waived — `german_copy_for_roman.md:49-60`). The DB row is retained (unread);
only the render path goes. Two adjacent strings Roman may want to know about,
unchanged by this fix: `docs.placeholder_needs_plz` ("… dann können wir Ihnen
anzeigen welche Dokumente benötigt werden.") now reads slightly stronger with
the qualifier gone, and suffix-suppressed Kontoauszüge rows lose their only
explanation (§8 Q5).

---

## 6. Test plan — writes nothing to prod

**Unit/fixture layer carries the weight** (pure, no DB, no network):

1. **Extract the fallback ladder into one pure function** (consumed by
   `dal.ts` + `case-export.mjs`) and unit-test its branches: own wins;
   rule-less office → default + `'fallback'`; office-less → default +
   `'fallback'`; exclusion applied on the fallback branch only;
   `defaultOffice === socialOfficeId` guard; empty default → `'none'`.
2. **Subtraction golden:** the effective fallback set equals Pankow's active
   set minus exactly the approved ids, field-by-field — proving simultaneously
   purge-is-a-strict-subset and no-Pankow-row-edited. Plus goldens of the
   purged set over the existing F1/F2/F3 answer fixtures
   (`pankow-answer-fixtures.mjs`), committed and byte-diffed thereafter
   (gate-style, per the Pankow precedent).
3. **Pankow/Essen unchanged:** the existing Pankow regression gate re-runs
   green untouched (evaluator + own-set behavior); recommended additive:
   commit `essen-golden-slots.json` so Essen's guarantee becomes golden-diffed
   like Pankow's.
4. **Hide-but-retain fixture:** an EvalInput + uploads containing a dropped
   `PAN-###` ref; assert no slot emitted, `countMissingSlots` ignores it
   (extends the existing orphaned-upload test), and the new pure
   `classifyUploads(slots, uploads)` puts it in `notRequired` — the same
   function `case-export.mjs` uses for the documents.md section.
5. **Banner:** gate/unit tests updated per the chosen removal shape; count
   surfaces asserted equal via the existing DOM-relative contracts.
6. **Config failure semantics (shape (a)):** unit tests pin the fail-open
   contract — missing row, non-array value, non-string members, unknown id
   each degrade to "no exclusions" (§3a).

**E2E (existing specs only, at the usual preview gate, established
throwaway-user protocol — no new prod-writing tests):**
`fallback-notice.spec.ts` F1 flips its positive banner asserts to count-0
(F2/F3 already assert absence and become the standing guards);
`m7-regression.spec.ts` R2 and `completion.spec.ts` C6/C7 stay green
structurally (counts are DOM-relative; C7's upload rounds shrink — note
`completion.spec`'s fixture PLZ 10115 has been fallback-served its entire life
— its office never had rules; Batch C only changed *which* rule-less office it
resolves to (Mitte) — so it exercises the purged list automatically); `documents-m6.spec.ts` /
`feedback-pass.spec.ts` / `mobile-footer.spec.ts` are own-office and stay
untouched. Prod verification after the founder's push = the Phase-2 live
verification script asserting every §4 number, plus the founder's existing
read-only browser drill. **The live verification script is pinned GET-only**
— like the Phase-1 scan, it issues REST selects exclusively and writes to no
database and no repo path (a "verify by creating a probe case" shortcut would
violate the brief's anti-goals); likewise the `essen-golden-slots.json`
capture in §6.3 is a read-only capture. It also asserts every excluded id
exists in the default office's active rule set (§3a) and re-checks the
no-live-Pankow-case coverage hole (§4).

---

## 7. Docs to update in Phase 2

- `docs/known-limitations.md:35-47` — the over-collection entry (its trio list
  under-counts the master's five Pankow-only mandatories; its under-collection
  half is partially superseded since Essen owns rules; the entry's premise
  changes entirely once the purge lands).
- `docs/milestone-log.md` — new entry + the snapshot block's default-checklist
  sentence (:16).
- `docs/architecture.md` §4 as-built note — only if the mechanism changes the
  resolution path shape (shape (a) adds the exclusion step to the ladder
  description).
- Comments going stale on banner removal: `lib/document-rules.ts:243-245`
  ("the same signal that shows the fallback-notice banner"),
  `m7-regression.spec.ts:242-246`, `docs/uat-m7.md:46`; the export's preamble
  prose (§1.4).
- `docs/operations.md` §2 (critic finding) — the export-bundle contract
  (:38-39 "person, document, slot label, uploaded files or **FEHLT**") changes
  with the `not_required` section, and the ops reader processing exports is
  the audience who must know what the flag means. In passing: :40's claim that
  `files/` uses `<rule>_<instance>_<original name>` naming is already stale
  for Phase-D nested keys (`exportFileName` uses folder_basename,
  case-export.mjs:315-322) — fix while in the section.
- `m8_admin_state.md` — re-baselining note (done in this phase, per the brief).
- Standing governance rule if shape (a) is chosen (§3a, both triggers): any
  migration touching PAN rules **or** `default_document_office_id` re-reviews
  the exclusion list.

---

## 8. Open questions for the founder — the gate

**Blocking (Phase 2 cannot start without 1-2):**

1. **The drop line: A, B, or C** (§2)? A is recommended; every line's per-case
   consequence is priced in §4. (Per-entry overrides are fine — each dropped
   mandatory rule is −1 slot for every fallback case; conditional drops move
   only the cases marked in §4.)
2. **The mechanism: shape (a), (b), or (c)+(c1|c2)** (§3)? (a) is recommended.
   If (c), additionally decide (c1) upload-row remap vs (c2) join change, and
   accept the respective risk.

**Non-blocking but needed before the phase that consumes them:**

3. **Berlin-district fallback cases** (§0.4): apply the purge to them
   identically (default; what this report prices), or keep the fuller list for
   Berlin-questionnaire cases resolved to a Berlin district office? The latter
   is a scope expansion (a second, Berlin-specific default) — not designed
   here; saying "identical" costs nothing now and can be revisited when a
   district office gets its own rule set.
4. **Roman sign-off path**: the purge changes which German document names
   users see (by removal only). Does the founder inform Roman via the §5
   verbatim record (recommended, matches the ledger precedent), or is a Roman
   review required pre-push?
5. **Period-suffix suppression on fallback lists** — keep (recommended: the
   rationale "the caregiver's actual Sozialamt never stated a period" survives
   the banner) or retire, letting fallback Kontoauszüge show "(letzte 4
   Monate)"? Retiring is a behavior change for all 7 fallback cases and would
   need its own justification.
6. **`fallbackNoticeText` fate**: delete outright (recommended — dead gates
   rot) or keep as an always-null stub? Either way F2/F3 stay as
   banner-absence guards.
7. **Landing order vs M8 Phase 4** (§1.7): this fix first (recommended —
   Phase 4 then baselines the new reality once) or Phase 4 first + recapture?
8. **Is `VERCEL_AUTOMATION_BYPASS_SECRET` currently valid** (regenerated
   2026-08-09; M8 Q11 re-asks)? Needed for the preview gate; not needed for
   the unit layer or the live verification script.
9. **Hidden uploads and their owners** (§1.6 critic finding): dropped-rule
   uploads become unviewable *and undeletable* by the user (the affordances
   live only in slot rows) while the files stay in storage. Should affected
   users (today: Klaus — 3 files, Roland — 1 file, both `under_review`) be
   told, e.g. by the team during processing? Should hidden uploads ever get a
   user surface, or is ops-only reach (export + GDPR runbook) acceptable?
   Recommendation: ops-only is consistent with the brief's decision §1.3 and
   the PAN-011 precedent; a one-line heads-up to the two affected users via
   the team costs nothing.

---

## 9. Risks

1. **Upload-binding detach** (§0.2) — the defining risk; shapes (a)/(b) avoid
   it by construction, (c) must buy it back. The Phase-2 verification asserts
   `52e364f1` missing = 0 explicitly.
2. **Export drift** — the ladder exists twice today; a fix that updates one
   copy re-creates the app-vs-export disagreement that already happened once
   (2026-08-11). The extraction in §6.1 is the cure; at minimum both copies
   change in one commit.
3. **Silent scope: Berlin-district cases** — the purge reaches five Berlin
   cases (§0.4; one of them, `c8542a35`, is test-shaped); if the founder
   assumed "exotic PLZs only", §8 Q3 is the correction point.
4. **Shape-(a) governance** — future Pankow edits propagate to the fallback
   list unless the exclusion list is co-reviewed (standing rule, §7).
5. **In-flight users** — a user mid-session at deploy keeps the old list until
   the next save/upload/refresh (`router.refresh()` on every mutation makes
   the window one interaction wide; nothing is cached server-side). A stale
   tab can still upload against a dropped rule — lands hidden-but-retained,
   harmless (§1.6).
6. **M8 Phase-4 baselines** (§1.7) — landing-order coordination, cross-noted
   in both state files.
7. **known-limitations drift** — the repo's own classification (three) and
   Roman's master (five mandatories) disagree today; whichever line the
   founder picks, the docs pass must reconcile the record (§7).
8. **The scan is not the app** — impact numbers were computed by a mirror of
   the derivation, not by rendering the app. Mitigated by the two documentary
   corroborations (header note) and by Phase 2's live verification asserting
   the same numbers through the real path after deploy.
