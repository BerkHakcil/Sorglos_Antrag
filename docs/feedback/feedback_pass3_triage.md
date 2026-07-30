# Feedback Pass 3 — Phase A triage (read-only)

> Produced 2026-07-30 against live prod (fresh data pulls + a live drive with a
> throwaway `@hzp-test.invalid` account, deleted afterwards). No writes to prod,
> no repo code changes. Companion doc (German, for Roman):
> `roman_package_pass3.md` — it contains the full question-order tables (A6)
> and the rename table (A8) addressed to him.
>
> Decisions D1–D7 from the pass brief are taken as given and not re-litigated.

## Data snapshot used

- Catalog **43** docs / rules **105** (50 PAN + 55 ESS) — matches the close-out.
- Questions: Berlin **168** rows / Essen **245** rows (413 total). Berlin fresh
  denominator verified live today: **53**.
- Cases: **10**; uploads: **14** metadata rows across **5 cases**, storage 1:1
  (no orphans in either direction). ⚠ The brief said "6 real uploaded
  documents" — that was true when written; **8 more files arrived 07-29/07-30**
  (Roman's account, `info@sorglosantrag.de`, and a simplelogin address). All
  current 14 are on non-test-pattern accounts → treated as REAL under the
  Real-Data Rule, and all are grandfathered under D5.

---

## Item 1 — document section from first login (A1)

- **Status: WORKING, no regression.** Live-verified today with a brand-new
  account: immediately after the two pre-steps (care home + PLZ 13187) the
  "Fragen | Dokumente" tabs render with the missing-count badge (**11**) and
  the full Pankow mandatory checklist — **zero questions answered**, case
  `in_progress`. Upload controls present.
- **Code path:** [app/case/page.tsx](../../app/case/page.tsx) `CasePage` →
  (`questionnaire_id` set) → `CaseTabsSection` → `getDocumentData` +
  `evaluateDocumentRules` on every server render → `CaseTabs` (both panes
  mounted, badge = `countMissingSlots`). Implementing commit: **`14c66b3`**
  ("feedback pass 3 — document tabs from first login, default rules, leak
  fix", 2026-07-22), verified live 8/8 in that pass.
- **What Roman likely saw:** the tabs only exist once a questionnaire is
  assigned. A brand-new account **before** confirming care home + PLZ shows the
  pre-questionnaire card layout with **no Dokumente tab at all**. That stage is
  the only "first login without documents" state in the product.
- **Fix type: none** (B4 = no-op unless Roman's report meant something else).

## Item 3 — optional question: dead "Weiter", skip re-surfaces (A3)

**Live-reproduced today on prod** (Berlin, `birth_name`):

1. Empty "Weiter" → the server **accepts and saves** `birth_name = ""` (row
   verified in the `answer` table) → UI re-renders the same question. Looks
   dead; actually saves and re-asks forever.
2. "Weiß ich gerade nicht" (skip) → question bypassed **for this browser
   session only** → after reload/login it is the active question again
   (verified).

**Root cause (two halves, both engine-level):**

- Server validation ([app/case/actions.ts](../../app/case/actions.ts)
  `validateAnswerValue`): `if (isRequired && isEmpty) error; if (isEmpty) return
valid` — empty is a **legal** answer for optional questions and is upserted.
- Engine ([lib/questionnaire-nav.ts](../../lib/questionnaire-nav.ts)
  `buildNav`): `isAnswered` treats `''` / `[]` / `null` as **unanswered**
  regardless of `is_required`, so the saved empty row never completes the
  question; `nextQuestion` stays put.
- Skip state (`skippedIds` in
  [app/case/chat-view.tsx](../../app/case/chat-view.tsx)) is React state —
  deliberately session-scoped for required questions ("come back later"), but
  for optional questions there is no way to ever get past permanently.

**All optional questions sharing the bug** (`is_required = false`, whole DB):

| Questionnaire | Key                 | Prompt                                                      | Note                                                                                            |
| ------------- | ------------------- | ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Berlin        | `birth_name`        | Was ist Ihr Geburtsname?                                    | Roman's repro case                                                                              |
| Berlin        | `power_of_attorney` | Haben Sie eine gesetzliche Betreuung oder eine bevollmächt… | mitigated by the explicit "Nein" option (FP2), but an empty "Weiter" is still dead the same way |

Essen has **zero** optional questions — its `birth_name` (position 3) is
**required**, so an empty "Weiter" there correctly shows the German
required-field error. (Whether Essen's Geburtsname should also be optional is a
content question for Roman — flagged in the package.)

**Proposed mechanism (B1): "completed without answer" via row presence.** In
`buildNav`, for `is_required = false` questions only:
`isAnswered = rawValue !== undefined` (a saved row — even `''`/`[]` — counts as
answered; `answersMap`/`groupAnswers` only contain keys that have rows). One
predicate change; the save path already works end-to-end.

- **Progress bar:** denominator counts only required questions → unchanged and
  consistent (tests assert this).
- **Dependency re-evaluation:** untouched — stored values don't change;
  `not_empty`/`value` rules on `''` behave exactly as today; the stale-answer
  sweep is unaffected.
- **Resume logic:** `resumeQuestion` filters required-only → unchanged. Skip
  stays session-scoped (that behavior is correct for required questions; for
  optional ones "Weiter" now completes, so the trap disappears).
- **Answered-then-cleared:** editing an optional answer down to `''` saves and
  shows "–" in the history with Bearbeiten available — sane.
- **Required questions:** block exactly as before (server error path).

**Fix type:** code-only (engine + unit tests), no migration.
**Risk notes:** low; the e2e adaptive drivers answer questions with real values
so they are unaffected; add the five B1 unit tests from the brief.

## Item 5 — spouse Vollmacht on the Pankow checklist (A5)

- **Exact source: rule row `PAN-011`** — not an evaluator expansion. Full row:

  ```json
  {
    "id": "PAN-011",
    "social_office_id": "11000000-0000-0000-0000-000000000001",
    "document_id": "DOC-0006", // Vertretungsvollmacht / Betreuungsnachweis
    "requirement_type": "mandatory",
    "subject": "person_2",
    "instance_note": "one slot for Person 2",
    "period_months": null,
    "condition": {
      "any": [
        { "field": "marital_status", "operator": "equals", "value": "verheiratet" },
        {
          "field": "marital_status",
          "operator": "equals",
          "value": "eingetragene Lebenspartnerschaft"
        },
        { "field": "marital_status", "operator": "equals", "value": "eheähnliche Gemeinschaft" },
        { "field": "marital_status", "operator": "equals", "value": "Lebenspartnerschaft" }
      ]
    }
  }
  ```

  (The 4th branch is the Berlin-inert Essen value added by `20260722000003`.)
  `PAN-010` is the person_1 twin (`always`, mandatory) and stays.

- **Uploads referencing it: none.** The 14 real upload rows bind to PAN-001
  (×7), PAN-002 (×1, person_2 Personaldokument — a different doc), PAN-005
  (×2), PAN-012, PAN-014 (×2), PAN-017. Nothing binds PAN-011 → deactivation
  strands nothing.
- **Essen confirmed:** Vollmacht (DOC-0006) appears only in **ESS-012**,
  `subject person_1`, `always` — no person_2 Vollmacht rule exists. Expected
  shape confirmed.
- **Fix type (Phase C): ⚠ schema note** — `office_document_rule` has **no
  `active` column** (only `document_catalog` does), and
  `getDocumentData` ([lib/dal.ts](../../lib/dal.ts)) loads rules unfiltered.
  The R6-compliant deactivation therefore needs: migration adding
  `active boolean NOT NULL DEFAULT true` + `UPDATE … SET active = false WHERE
id = 'PAN-011'`, plus a one-line `.eq('active', true)` filter in the two rule
  queries in `dal.ts`. (Alternative — DELETE — rejected per R6.)
- **Risk notes:** regression gate = married Pankow fixture loses exactly the
  PAN-011 slot, all others byte-identical; Essen married fixture unchanged.
  Real married Pankow case `fc446257…` (iremkarabulutlu@…) currently sees that
  slot with no upload → it simply disappears; nothing else changes.

## Item 6 — question order (A6)

Full per-question tables (position | key | label | section | group | required |
visibility gate) for **both** questionnaires are in
[roman_package_pass3.md](roman_package_pass3.md) §6 — they are Roman's input,
in German. Berlin currently runs 168 rows / 9 categories, Essen 245 rows / 8
categories. Category flow:

- Berlin: `antragsteller(32) → wohnsituation(3) → einkommen(8) → kinder(9) →
income(10) → expenditure(11) → wealth(27) → additional(1) → spouse(67)`
- Essen: `antragsteller → wohnsituation → kinder → income → expenditure →
wealth → additional → spouse`

**Interleaving flags (Berlin — the ones Roman's "#28 previous address"
complaint points at):**

1. The previous-apartment topic is split across **three** sections: street/city
   at positions 6–7 (`antragsteller`), `berlin_since`/`apartment_ownership` at
   33–35 (`wohnsituation`), rent/landlord details at 38–43 (**inside
   `einkommen` "Einnahmen und Rente"**, gated on `apartment_ownership` from the
   previous section).
2. Pensions are captured **twice in two different categories**: the legacy flat
   pair `hat_rente`/`rentenbetrag` at 36–37 (`einkommen`) and the repeatable
   `pension` group at 53–56 (`income` "Einkünfte") — two nearly synonymous
   German section labels with rent questions sandwiched between them. (= item
   9's subject.)
3. `power_of_attorney` (21) sits mid-`antragsteller` between the
   Hilfe-zur-Pflege history block and the Ausweis block.

Essen has no comparable interleaving (its sections follow the master file);
its one oddity is `additional` containing a single question (`costly_diet`
equivalent) before the spouse block — same as Berlin.

**Fix type: none this pass** (D7 — tables go to Roman; reorder is a follow-up
migration once he answers).

## Item 7 — gross-pension info text (A7)

- **Target (Roman ordered deletion):** Berlin, question **`rentenbetrag`**
  (id `60000000-0000-0000-0000-000000000005`), column **`help_de`**:

  > „Bitte geben Sie den Bruttobetrag aus dem aktuellen Rentenbescheid an."

  Shown as helper text under "Monatlicher Rentenbetrag (€)". Berlin only.

- **Explicitly NOT in scope:** Essen `pension_amount_gross` /
  `spouse_pension_amount_gross` — their **prompts** ("Wie hoch ist der
  Bruttobetrag dieser Rente oder Pension pro Monat?") mention Brutto because
  they ARE dedicated gross-amount questions from Roman's Essen master, paired
  with net-amount questions. No other prompt/help/option in either
  questionnaire contains "brutto".
- **Fix type (B2):** one-line copy UPDATE migration
  (`SET help_de = NULL WHERE id = …0005`). Touches a config row, not user
  data; R2 report will state: 0 real answer rows affected (the help text is
  display-only).

## Item 8 — broken umlauts in the document catalog (A8)

Audited all **43** `document_catalog` rows. The only user-facing text column is
`name_de` (`technical_key`/`category`/`instance_basis` are internal). The 13
Essen-era docs (DOC-0031…0043) seeded with correct umlauts; the damage is in
the legacy Pankow-era rows:

**Mechanical restoration table (B3 migration input — ae/oe/ue only):**

| DOC-ID   | current `name_de`                           | proposed                                   | live exposure                                                                   |
| -------- | ------------------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------- |
| DOC-0003 | Kontoauszuege                               | Kontoauszüge                               | **every checklist** (PAN-005/006, ESS-010/011, all mandatory) — seen live today |
| DOC-0011 | Mobilitaetsnachweis                         | Mobilitätsnachweis                         | every Pankow/default checklist (PAN-018 mandatory) — seen live today            |
| DOC-0021 | Heimatvertriebener/Spaetaussiedler Nachweis | Heimatvertriebener/Spätaussiedler Nachweis | conditional (PAN-034/035, `special_origin_rights` ≠ Nein)                       |
| DOC-0025 | Mietkuendigungsnachweis                     | Mietkündigungsnachweis                     | conditional (PAN-040 Berlin-keyed; ESS-030 Essen)                               |

**`ss`-containing values — assessed as correct German, no change planned;
listed to Roman for confirmation only (per R3 we never auto-ß):**

| DOC-ID   | value                             | note (for Roman's call)                               |
| -------- | --------------------------------- | ----------------------------------------------------- |
| DOC-0005 | Leistungsbescheid Pflege**kass**e | "Kasse" — standard spelling, almost certainly keep ss |
| DOC-0017 | Aufenthalt**ss**tatus             | morpheme boundary (Aufenthalts-Status) — keep ss      |
| DOC-0021 | …Spaetau**ss**iedler…             | morpheme boundary (Aus-Siedler) — keep ss             |

**Question/option label spot-check (both questionnaires): CLEAN post-CP3.**
The scan flagged only false positives: option labels "Einkommensteuern"
(correct compound), country options "Israel"/"Venezuela". Multi-select option
**values** deliberately keep the transliterated form (they are stored answer
values that rules/visibility reference — D4; e.g. `auslaendische Rente/Pension`
as a stored value, displayed via its correctly-umlauted label).

**Fix type (B3):** copy UPDATE migration on `document_catalog.name_de`, 4 rows,
mechanical only. **Risk notes:** name_de is display-only (slots key on
DOC/PAN ids), so no joins/uploads are affected; R2 report: 0 user rows. The 3
ss rows stay untouched pending Roman.

## Item 9 — pension yes/no + amount dependency report (A9)

**Existence:** `hat_rente` ("Erhält die pflegebedürftige Person Rente?",
yes*no, required, unconditional) and `rentenbetrag` ("Monatlicher Rentenbetrag
(€)", amount, required) exist **only in Berlin** (`einkommen`, positions
36–37). Essen never had them — its pension data lives exclusively in the
repeatable `pension` group (type + **gross** + **net** per entry) plus the
`pension_application*\*` block.

**Complete dependency census:**

- **Visibility rules:** `rentenbetrag` is gated `hat_rente = "Ja"`. That is the
  **only** rule referencing either key (no other question is gated on them;
  they reference nothing else).
- **Document rules:** **zero** of the 105 rules reference `hat_rente` or
  `rentenbetrag`. Pension document slots come from `repeat_for_each:
pension_type` (PAN-003/004, ESS-003/004) — i.e. from the **group**, not the
  flat pair. (A dropped M1-era `document_rule` on `hat_rente` existed in
  `supabase/setup.sql` history; that table was deleted in M5.)
- **Code paths reading the answers:** none in app code — the engine, export
  (`case:export` renders all answers generically in questionnaire order), and
  evaluator are key-agnostic. Key-specific references exist only in:
  `tests/e2e/visibility.spec.ts` (V1 is built on this pair),
  `tests/e2e/documents-m6.spec.ts` (driver comment: "hat_rente is Berlin's
  only yes_no"), `tests/fixtures/pankow-answer-fixtures.mjs`, and the
  `verify-baseline.mjs` critical-keys spot-check list.
- **Group gating:** the `pension` group is **NOT** gated on `hat_rente`
  (`pension_type` has `visibility_rule = null`) — every Berlin user answers
  the flat pair AND the group; "Keine Rente" is the group's opt-out.
- **Per-entry amount:** yes — Berlin `pension_amount` (net) per instance;
  Essen `pension_amount_gross` + `pension_amount` per instance.

**What breaks on deactivating the pair (Berlin):**

| Dependency                    | Effect                                                                                                                                                                                                                                                                        |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `rentenbetrag` visibility     | dies with its controller — the pair leaves together                                                                                                                                                                                                                           |
| Berlin fresh denominator      | 53 → **51** (both required; e2e asserts need the new number)                                                                                                                                                                                                                  |
| Document slots                | **unchanged** (no rule references the pair)                                                                                                                                                                                                                                   |
| Real answers                  | completed cases keep their rows only if the questions are deactivated rather than deleted — **the `question` table has no `active` flag**, so R6-style deactivation needs a mechanism decision (add flag vs. delete-with-`case:export`-snapshots per the Real-Data precedent) |
| Amount storage for the Antrag | preserved: per-entry `pension_amount` remains; `rentenbetrag` is the redundant single-amount duplicate                                                                                                                                                                        |
| Tests                         | `visibility.spec.ts` V1 needs a new subject; `documents-m6` driver note; fixtures; verify-baseline key list                                                                                                                                                                   |

**Recommendation to Roman (documented in the package, D4):** drop the
redundant flat pair, keep the group + per-entry amounts — amounts stay
available for the final Antrag (his hard requirement). **Not implemented this
pass.**

## Item 10 — "publicly visible" upload link (A10) — WORKING AS DESIGNED (D2)

Audit results, all confirmed today:

- **Bucket private:** `case-documents`, `public: false`, 15 MB limit, 5 mime
  types (live `getBucket` check). Public object URLs return 400 (M7 audit).
- **Signed-URL TTL: 60 seconds**, set in
  [app/case/document-actions.ts:133](../../app/case/document-actions.ts)
  (`createSignedUrl(path, 60)`) — the only download-URL mint site.
- **On-demand, owner-only:** `createDownloadUrlAction` verifies the session
  (`verifySession` → `getClaims`), resolves the caller's own case, and scopes
  the upload row `.eq('case_id', caseRow.id)` before signing. The URL is
  returned to the client transiently.
- **Never persisted:** `document_upload` stores `storage_path` only; no signed
  URL is written to DB anywhere; the M7 log-PII audit found no server logging
  of user data (4 console sites, none log URLs).
- **Storage RLS:** owner policies on `storage.objects` (SELECT/INSERT/DELETE
  via first path segment ∈ own case ids, migration `20260711000007`); M7
  behavioral audit 50/50 incl. foreign-path signed-URL minting failures.
- **Uploads:** browser PUTs via server-minted `createSignedUploadUrl` tokens
  (short-lived, path fixed server-side to the caller's case prefix).
- **Deviations: none found.**

Residual property (inherent to signed URLs, explained to Roman in German):
whoever possesses the link can fetch **within its 60-second window** — that is
what "signed URL" means; after 60s it is dead. Roman saw exactly that.

## Item 11 — storage layout current state (A11)

- **Path scheme:** `{case_id}/{uuid}.{ext}` — server-generated in
  `createUploadUrlAction` ([document-actions.ts:49](../../app/case/document-actions.ts)).
  **Reconciliation of Roman's claim vs the UUID URL:** the _original_ filename
  is preserved in **DB metadata** (`document_upload.original_filename`) and
  shown in the UI; the _storage object_ name is a UUID. Both observations were
  right.
- **`document_upload` columns:** `id, case_id, rule_id, document_id, subject,
instance_key, storage_path, original_filename, mime_type, size_bytes,
created_at`.
- **The real upload rows (now 14, not 6 — all grandfathered per D5):**

| case (owner)                                          | rule / doc                                  | instance | original_filename                                 | stored object    | date  |
| ----------------------------------------------------- | ------------------------------------------- | -------- | ------------------------------------------------- | ---------------- | ----- |
| `2c8a5ca2` (bhakcil@gmail.com)                        | PAN-001 / DOC-0001 Personaldokument         | default  | gisma_logo.jpeg                                   | `cdf9a394….jpeg` | 07-21 |
| `2c8a5ca2`                                            | PAN-005 / DOC-0003 Kontoauszuege            | giro     | admission letter.pdf                              | `e8ff0e5a….pdf`  | 07-21 |
| `2c8a5ca2`                                            | PAN-005 / DOC-0003 Kontoauszuege            | giro     | April 2025 M509_AB.pdf                            | `db57f137….pdf`  | 07-21 |
| `fc446257` (iremkarabulutlu@gmail.com)                | PAN-001 / DOC-0001                          | default  | sunexpress-boarding-pass-2.pdf                    | `26432e24….pdf`  | 07-21 |
| `fc446257`                                            | PAN-002 / DOC-0001 (person_2)               | default  | Copy of IMG_5380.heic                             | `6f88450b….heic` | 07-21 |
| `fc446257`                                            | PAN-017 / DOC-0010 Polizeiliche Anmeldung   | default  | image.jpg                                         | `e563699e….jpg`  | 07-21 |
| `de69f275` (roman.pfeiffer@sorglosantrag.de)          | PAN-001 / DOC-0001                          | default  | IMG_8449.jpeg                                     | `f008e4af….jpeg` | 07-29 |
| `de69f275`                                            | PAN-001 / DOC-0001                          | default  | IMG_8448.jpeg                                     | `d3d2c4ba….jpeg` | 07-29 |
| `de69f275`                                            | PAN-001 / DOC-0001                          | default  | 2F013DB0-03F3-4DBC-8C4C-C57E479644A9.jpeg         | `190fdf14….jpeg` | 07-29 |
| `de69f275`                                            | PAN-001 / DOC-0001                          | default  | Staatliche Förderung ohne Hürden – ….png          | `0c6e962d….png`  | 07-29 |
| `298ac66b` (familiarize_professorial@simplelogin.com) | PAN-001 / DOC-0001                          | default  | Generated image 1.png                             | `90d18198….png`  | 07-29 |
| `d345b0f9` (info@sorglosantrag.de)                    | PAN-014 / DOC-0008 Bisherige Heimrechnungen | default  | Screenshot 2026-07-02 at 15.37.50.png             | `222904e2….png`  | 07-30 |
| `d345b0f9`                                            | PAN-012 / DOC-0007 Heimvertrag              | default  | Screenshot 2026-07-02 at 17.08.21.png             | `13dd4022….png`  | 07-30 |
| `d345b0f9`                                            | PAN-014 / DOC-0008                          | default  | Screenshot 2026-07-02 at 15.37.50.png (re-upload) | `e5d0941b….png`  | 07-30 |

(`d345b0f9` is the founder account with **PLZ 10961** — the very case behind
item 2/D1.)

- **Nested paths (folders) feasible without plan limitations: YES.** The
  storage RLS policies key on `(storage.foldername(name))[1]` — only the
  **first** segment must be the case id; deeper segments are unconstrained.
  `createSignedUploadUrl` accepts arbitrary key paths; Supabase Storage
  prefixes are virtual (no folder objects needed). So
  `{case_id}/{Category}/{TypeName}{n}.{ext}` (D5) works with **zero policy
  changes**; only `createUploadUrlAction` composes the path differently, and
  the collision counter must come from a DB count (Phase D design).
- Old paths keep working structurally: checklist, downloads, delete, and
  `case:export` all resolve via the **stored** `storage_path` — nothing
  recomputes paths. (Proof to re-verify formally in Phase D-1.)

## Item 12 — Lovable mockup inventory (A12)

**⚠ BLOCKER for full repo review:** `github.com/romanpfeiffer85/Sorglos-product-ui-mockup`
returns _Repository not found_ for the authenticated `BerkHakcil` account
(private or renamed). → Need an invite/correct URL before E-phase starts.
Everything below comes from the **live mockup**
(https://sorglos-antrag-stellen.lovable.app/) — which is sufficient for the
token + screen inventory; the repo matters mainly for exact component variants.

**Stack (observed):** Lovable-generated React + Tailwind (v4-style CSS
variables, shadcn-compatible token names), Lato via webfont. Client-side
routes `/` and `/unterlagen`.

**Design tokens (extracted from `:root`):**

| Token                         | Value                                            | Maps to (our app)                 |
| ----------------------------- | ------------------------------------------------ | --------------------------------- |
| `--petrol` / `--primary`      | `#245b5a` (soft `#2f7371`)                       | primary / ring                    |
| `--copper`                    | `#c44f15` (hover `#a34111`)                      | CTA buttons ("Antwort speichern") |
| `--sage` / `--accent`         | `#a9bfae` (soft `#cbd8ce`)                       | accent, progress track            |
| `--cream` / `--background`    | `#f7f4ed` (deep `#efeadd`)                       | background / secondary / muted    |
| `--graphite` / `--foreground` | `#2c2f32` (soft `#5c6166`)                       | text / muted text                 |
| `--border` / `--input`        | `#e6e0d0`                                        | borders                           |
| `--destructive`               | `oklch(57.7% .245 27.325)`                       | errors                            |
| `--radius`                    | `.875rem` (buttons observed 14–18px, cards 18px) | radius                            |
| Font                          | `Lato, ui-sans-serif, system-ui` (400/500/700)   | replaces default sans             |

**Signature patterns:** cream page background with white cards; copper filled
CTA + ghost secondary ("Später beantworten"); slim sage progress track with a
petrol fill, a floating petrol %-chip and a dot marker; centered H1
"Antrag für {Name}" + intro sentence; top nav "Angaben | Unterlagen".

**Screen → app-screen mapping:**

| Mockup                         | Our app                                                                                                                | Notes                                                             |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `/` "Angaben" question flow    | `/case` Fragen tab (`chat-view.tsx`)                                                                                   | mockup shows one-card-at-a-time + "Später beantworten" = our skip |
| `/unterlagen` upload checklist | `/case` Dokumente tab (`document-area.tsx`)                                                                            | per-doc cards, "Datei auswählen", status chip "Noch hochladen"    |
| header nav Angaben/Unterlagen  | `CaseTabs` Fragen/Dokumente                                                                                            | same 2-tab shape, labels differ (Roman's copy call)               |
| — (none)                       | login/signup/reset, care-home + PLZ pre-steps, locked/under-review state, group "add another?" prompts, patient banner | **no mockup counterpart — need styling by extension**             |

**Proposed phased application (E-phase plan skeleton):**
(1) tokens — swap Tailwind/shadcn CSS variables + font in `app/globals.css`,
app-wide, zero markup changes; (2) shared components — Button/Card/Input/
Progress/Header/Tabs restyle; (3) screen-by-screen — auth screens, pre-steps,
questionnaire, documents, states without mockup counterpart; desktop + mobile
at each step. Zero logic changes; tests green after every step (constraint
E-1).

**Fix type:** Phase E only, after A–D. **Risk notes:** repo access; Lato
licensing is OFL (fine); contrast check needed for copper-on-white and
graphite-soft (accessibility constraint).

---

## Working-as-designed confirmations (D1/D2)

- **Item 2 (PLZ 10961 → Pankow checklist):** confirmed as designed — 10961 has
  no Pankow rule; the case resolves to Sozialamt Berlin (office without own
  document rules) and uses the `app_config` default (Pankow), whose rules are
  keyed on Berlin question keys — the same questionnaire this case runs.
  Essen's rules would reference Essen-only keys/values and mostly never fire.
  German explanation for Roman: package §1.
- **Item 10:** see A10 above; German explanation: package §2.

## Phase B–E readiness summary

| Phase | Item | Ready?                                        | Blockers                                           |
| ----- | ---- | --------------------------------------------- | -------------------------------------------------- |
| B1    | 3    | ✅ design proposed above                      | —                                                  |
| B2    | 7    | ✅ row identified                             | —                                                  |
| B3    | 8    | ✅ 4-row table                                | ss rows stay untouched (Roman)                     |
| B4    | 1    | ✅ no-op                                      | —                                                  |
| C     | 5    | ✅ PAN-011 identified, 0 uploads reference it | needs `active` column (schema note above)          |
| D     | 11   | ✅ facts gathered                             | category mapping proposal → my approval gate (D-1) |
| E     | 12   | ⚠ partially                                   | mockup repo access                                 |
