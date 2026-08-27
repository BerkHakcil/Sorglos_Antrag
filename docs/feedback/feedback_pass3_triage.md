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
| `2c8a5ca2` (E-Mail redigiert)                         | PAN-001 / DOC-0001 Personaldokument         | default  | gisma_logo.jpeg                                   | `cdf9a394….jpeg` | 07-21 |
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

# A12 ADDENDUM — mockup repo inventory (access granted 2026-07-30)

> Read-only side task, run after Phase C. Repo cloned shallow at commit
> `8ea545f` ("Tab-Icon mit Logo ersetzt"). **Access confirmed working** for
> `BerkHakcil` — the earlier 404 is resolved. Nothing from this addendum is
> implemented; it is input for E-1 planning after Phase D closes.
> **Scope reminder: tokens and visual patterns only — no Lovable logic,
> routing or state comes across** (see "Do not port" below).

## A12.1 Actual stack + versions

|                 | Mockup                                                               | Our app                                    |
| --------------- | -------------------------------------------------------------------- | ------------------------------------------ |
| Framework       | **TanStack Start 1.168** + TanStack Router 1.170 (file-based routes) | **Next.js 16** App Router                  |
| Bundler         | **Vite 8** (`@lovable.dev/vite-tanstack-config` 2.7.7)               | Turbopack                                  |
| React           | 19.2                                                                 | 19.2.4                                     |
| CSS             | **Tailwind v4.2.1** via `@tailwindcss/vite`                          | **Tailwind v4** via `@tailwindcss/postcss` |
| UI kit          | shadcn "new-york" on **Radix primitives** (`@radix-ui/*`, 26 pkgs)   | shadcn on **`@base-ui/react`**             |
| Icons           | `lucide-react` **^0.575.0**                                          | `lucide-react` **^1.17.0**                 |
| Forms           | react-hook-form 7.71 + zod **3.24**                                  | react-hook-form 7.78 + zod **4.4**         |
| Server          | Nitro 3 beta / `src/server.ts`                                       | Vercel serverless (fra1)                   |
| Package manager | **bun** (`bun.lock`, `bunfig.toml`)                                  | npm                                        |

It is **not** a plain Vite/React SPA as assumed — it is a TanStack Start SSR
app. Irrelevant for token porting, decisive for why **no component file can
be copied verbatim**: different router, different primitives library.

## A12.2 Real design tokens (from `src/styles.css`) vs the live-site extraction

**Result: the live-site extraction was exactly right — zero discrepancies.**
Every value re-confirmed from source:

```
--radius: 0.875rem
--petrol #245B5A   --petrol-soft #2f7371
--sage   #A9BFAE   --sage-soft   #cbd8ce
--copper #C44F15   --copper-hover #a34111
--graphite #2C2F32 --graphite-soft #5c6166
--cream  #F7F4ED   --cream-deep  #efeadd
--background #F7F4ED  --foreground #2C2F32  --card #ffffff
--primary #245B5A / --primary-foreground #F7F4ED
--secondary #efeadd   --muted #efeadd   --muted-foreground #5c6166
--accent #A9BFAE      --accent-foreground #2C2F32
--border #e6e0d0      --input #e6e0d0    --ring #245B5A
--destructive oklch(0.577 0.245 27.325)
--font-sans "Lato", ui-sans-serif, system-ui, sans-serif
```

**The one discrepancy found is internal to the repo:** `.lovable/plan.md`
(the original brief) specifies copper as **`#C9825A`**, but the shipped
`styles.css` uses **`#C44F15`** — a far more saturated burnt orange.
**Code wins** (per instruction, and it is what the live site renders).
`plan.md` is stale in three further ways: it describes a two-column desktop
with a contact card (shipped: left sidebar), a progress bar _without_ a
number (shipped: % pill + dot marker), grouped form cards for "Angaben"
(shipped: a chat UI), and names the contact "Sabine Müller" (shipped: Roman
Pfeiffer). Treat `plan.md` as historical intent, not spec.

Other token facts: **no `.dark` block at all** — the mockup is light-only
(it declares `@custom-variant dark` but never defines the palette).
Base layer sets `letter-spacing: -0.01em` on `h1–h4`, antialiasing, and
`font-feature-settings: "kern"`.

## A12.3 Tailwind config format — how tokens port (matters for E-1)

Both sides are **Tailwind v4 CSS-first** — there is no `tailwind.config.js`
in either project, so porting is editing `app/globals.css`, not a JS config.
Three concrete differences:

1. **Radius scale formula.** Mockup uses ± px offsets
   (`--radius-sm: calc(var(--radius) - 4px)` … `3xl: +12px`); ours uses
   multipliers (`calc(var(--radius) * 0.6)` … `* 2.6`). With
   `--radius: 0.875rem` the two only agree at `lg`. **E-1 decision:** adopt
   the mockup's offset formula, since every mockup class was drawn against
   it (`rounded-2xl` = 22px there vs 25.2px here).
2. **Import shape.** Mockup: `@import "tailwindcss" source(none)` +
   `@source "../src"` (Vite plugin). Ours: `@import 'tailwindcss'` +
   `@import 'shadcn/tailwind.css'`. Keep ours; only the `:root` values and
   the `@theme inline` brand-token block port over.
3. **Brand tokens are additive.** The mockup registers 10 extra
   `--color-*` entries in `@theme inline` (petrol/sage/copper/graphite/cream
   ± soft variants) which is what makes `bg-petrol`, `text-graphite-soft`,
   `bg-sage-soft/40` work. Our `globals.css` has no equivalent → this block
   must be added or every ported class silently no-ops.

**Font — GDPR-relevant porting note.** The mockup loads Lato from
`fonts.googleapis.com` via `<link>` + preconnect. Copying that would send
every German caregiver's IP to Google on each page load. **Use
`next/font/google` instead** (self-hosts at build time, zero third-party
request) and wire it to `--font-sans`, which our `@theme inline` already
reads. Weights actually used: 300/400/700 (the `<link>`), but the code only
uses `font-medium` (500), `font-semibold` (600), `font-bold` (700) and
normal — request 400/500/600/700 and drop 300.

**Dark mode:** our `globals.css` carries a full `.dark` palette; the mockup
has none, and our app never toggles it. E-1 recommendation: leave the
`.dark` block untouched (dead but harmless) rather than invent brand darks.

## A12.4 Component inventory → our app

Bespoke components (the actual design; all hand-written Tailwind):

| Mockup file                                     | What it is                                                                                                                                                                                                                                                                                                                                                                                         | Our counterpart                                         | Note for E-1                                                                                                                                                           |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- | --------------------------------------------------------------------- | ------------------------------------- |
| `AppShell.tsx` (264 ln)                         | **Used by all 3 app screens.** Desktop: fixed left sidebar (`lg:w-72 xl:w-80`, sage-soft bg) with logo, tagline, tab nav (active = copper pill), Hilfe + Abmelden. Mobile: sage-tinted header block, hamburger → `Sheet`, title, tab row, progress.                                                                                                                                                | `app/case/page.tsx` shell + `case-tabs.tsx`             | ⚠ **Layout change, not just tokens** — we are a centered `max-w-2xl` column with a top header. Adopting the sidebar is a structural rewrite; see A12.6 recommendation. |
| `AppHeader.tsx` (111 ln)                        | **UNUSED** alternative: sticky top bar, logo + "Antrag für X", Hilfe/Abmelden, thin progress, underline tabs — **with a `· 4 offen` badge on "Unterlagen"**                                                                                                                                                                                                                                        | `case-tabs.tsx` + our missing-count badge               | **Closest to our current structure** and it already models our counter. Cheapest high-fidelity path.                                                                   |
| `AuthShell.tsx` + `AuthField` + `PrimaryButton` | cream page, centered logo, white card `rounded-2xl` + petrol-tinted shadow, copper full-width CTA                                                                                                                                                                                                                                                                                                  | `app/(auth)/login                                       | signup                                                                                                                                                                 | reset-password | update-password`                                                      | Direct 1:1 restyle, no logic touched. |
| `FormCard.tsx` + `Field`                        | white `rounded-2xl` card, title + description + `gap-5` field stack                                                                                                                                                                                                                                                                                                                                | pre-questionnaire cards (`CareHomeSelector`, `PlzForm`) | Direct 1:1.                                                                                                                                                            |
| `ContactPanel.tsx`                              | Ansprechpartner card: photo, name, role, phone `0159 0469 5761`, `kundendienst@sorglosantrag.de`                                                                                                                                                                                                                                                                                                   | **none**                                                | ⚠ Not styling — it introduces **content + a feature** (help sheet). Product/content decision for Roman before E adopts it.                                             |
| `routes/index.tsx` (388 ln)                     | **The questionnaire as a real chat**: `BubbleAssistant` (white, left, `rounded-bl-md`), `BubbleUser` (petrol, right, `rounded-br-md`, "Ändern" + check), `HintBubble` (sage-soft, Info icon), `ChipButton` (pill, petrol border → fills petrol on hover) for yes/no + choice, `ActiveAnswer` with "Später beantworten" link + copper "Antwort speichern", skipped marker, "Antwort geändert" flash | `app/case/chat-view.tsx`                                | **The biggest visual win.** Our chat is card-based; this is bubble-based. Pure presentation over our existing nav engine.                                              |
| `routes/unterlagen.tsx` (223 ln)                | `DocRow` list in one `rounded-2xl` card, `divide-y`: status circle (FileText → petrol Check when done), title, "Noch hochladen" / "Hochgeladen · file", done rows tinted `bg-sage-soft/30`, "Datei auswählen" / "Ersetzen" + "Entfernen"                                                                                                                                                           | `app/case/document-area.tsx`                            | Direct restyle; our per-slot multi-file list maps onto the `files[]` summary pattern.                                                                                  |
| `routes/fertig.tsx`                             | completion screen: petrol check medallion, thanks headline, **3-step "Nächste Schritte"** numbered list on cream, contact block, two outline buttons                                                                                                                                                                                                                                               | our `under_review` locked state (`EditLockedCard`)      | German copy here is Lovable-authored → **PLACEHOLDER_DE / Roman** if adopted.                                                                                          |
| `routes/login                                   | register                                                                                                                                                                                                                                                                                                                                                                                           | email-sent.tsx`                                         | auth screens incl. 4 consent checkboxes (`accent-petrol`) and an "E-Mail bestätigen" sage info panel                                                                   | our auth pages | Consent copy in the mockup ≈ our live copy; ours stays authoritative. |
| `__root.tsx` 404 + error components             | petrol `404`, "Seite nicht gefunden", retry/home buttons                                                                                                                                                                                                                                                                                                                                           | `app/global-error.tsx`                                  | Small win, low priority.                                                                                                                                               |

**shadcn `ui/` directory: 46 files shipped, only 2 actually imported** —
`input` and `sheet`. The other 44 (accordion, carousel, chart, sidebar,
table, …) are untouched Lovable boilerplate. **Do not port the `ui/`
directory**; it is Radix-based and 96% dead. Take the bespoke classes only.

## A12.5 In the repo but NOT visible on the live site

1. **The entire chat-bubble questionnaire** — the live crawl only ever
   rendered question 1 and read as a plain form. The bubble/chip/edit/skip
   design is the mockup's core idea and was invisible to A12's first pass.
2. **`/fertig` completion screen** (not linked from the visible nav; it is
   auto-navigated to 800 ms after the last upload).
3. **`/login`, `/register`, `/email-sent`** auth screens.
4. **`AppHeader.tsx`** — the unused alternative header, incl. the
   **`· 4 offen`** tab badge (= our missing-documents counter).
5. **Uploaded-state `DocRow`** (Ersetzen/Entfernen, sage-tinted row, petrol
   check) — the live site showed only the empty state.
6. **Skipped/edited states**: italic "Später beantworten" marker,
   "Antwort geändert" flash pill, "Ändern" pencil affordance.
7. **`simona-pfeiffer.png`** asset — referenced by **zero** code (dead;
   possibly a second Ansprechpartnerin). Flag to Roman if the contact panel
   is adopted.
8. **Breakpoints:** `sm:` ×32, `lg:` ×7, `xl:` ×1 — mobile-first, `lg`
   (1024px) is the sidebar switch, `xl` only widens the sidebar. No `md:`
   usage at all.
9. **Icon set:** lucide — `Pencil, FileText, Menu, Check, Info, Phone,
Mail`. All exist in our lucide 1.x; verify names at use (major version
   gap 0.575 → 1.17).
10. **Signature shadow** (used on every card, not visible in the DOM dump):
    `shadow-[0_2px_20px_-14px_rgba(36,91,90,0.25)]` — a petrol-tinted lift;
    the auth card uses `-14px/0.3` at 24px blur. Worth a token.
11. **Assets are Lovable-hosted**, not files: `*.asset.json` holds an R2
    URL (`/__l5e/assets-v1/…`). Only `public/favicon.svg` is a real file.
    **The logo SVG is therefore not obtainable from this repo** — keep our
    `public/logo.jpg` or ask Roman for the source SVG.

## A12.6 Do not port (hard boundary)

`lib/lovable-error-reporting.ts` + `lib/error-capture.ts` (Lovable
telemetry — posts errors to a Lovable endpoint), `.lovable/`, the TanStack
router/`routeTree.gen.ts`, `server.ts`/`start.ts`, `QueryClientProvider`,
all `useState` question/upload state (our questionnaire is DB-driven and
server-validated), the hardcoded `QUESTIONS`/`initialDocs` arrays, the
auto-navigate-on-complete behaviour, and the 44 unused Radix components.
**Every German string in the mockup is Lovable-authored, not Roman's** —
anything adopted as new user-facing copy is PLACEHOLDER_DE and goes to
Roman (CLAUDE.md rule #2).

## A12.7 Revised phased order for E-1

1. **Tokens** — `globals.css`: brand tokens into `@theme inline`, `:root`
   values, radius formula, Lato via `next/font/google`, shadow token.
   Zero markup changes; whole app shifts to the palette at once.
2. **Shared primitives** — buttons (copper CTA / outline / ghost), inputs,
   cards, the petrol-tinted shadow, progress bar (track/fill/marker),
   tab row.
3. **Screens**, cheapest-first: auth (AuthShell 1:1) → pre-questionnaire
   cards (FormCard 1:1) → document checklist (DocRow) → **questionnaire
   chat bubbles** (biggest change) → completion/locked state.
4. **Open E-1 decisions to put to the founder:** (a) desktop **sidebar**
   (`AppShell`) vs keeping our centered column with the `AppHeader`-style
   top bar — the latter is far less risky and still lands the look;
   (b) whether the **Ansprechpartner/Hilfe panel** is in scope at all
   (needs Roman's content); (c) whether `/fertig`-style "Nächste Schritte"
   copy replaces our current locked-state text (Roman).

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
