# Mobile UI Pass — Round 3, Phase 2: execution record

> GATE 1 APPROVED 2026-08-27 (all six gate answers + one amendment: exactly
> ONE data migration, the `docs.area_intro` UPDATE, impact-report-first,
> founder pushes manually). This file opens with that impact report — written
> BEFORE the migration file, per the amendment — and closes with the session
> report (files changed, ledger, e2e results, deferred items).

---

## R10 impact report (produced BEFORE the migration was written)

**Scope: exactly one row in one config table. No schema change. No user
data. No other DB writes of any kind** (gate answers 2 and 4: the
`case.patient_banner_body` row and the `contact.phone` row are explicitly
untouched).

|                            |                                                                                                                                                       |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Table                      | `public.static_content` (config table — key/value German copy)                                                                                        |
| Row identity               | `key = 'docs.area_intro'` (primary key `key`; 1 row)                                                                                                  |
| Seeded by                  | migration `20260711000005_m5r2_office_tables.sql:98`                                                                                                  |
| Current value (`value_de`) | `Bitte laden Sie die folgenden Unterlagen hoch. Erlaubt sind PDF, JPG, PNG und HEIC bis 15 MB pro Datei.`                                             |
| New value (`value_de`)     | `PDFs, Fotos und mehrere Dateien pro Unterlage sind möglich. Vor der Einreichung prüfen wir alle Ihre Unterlagen.` (founder's R10 sentence, verbatim) |
| Rows affected              | 1 (UPDATE by primary key)                                                                                                                             |
| Other tables/keys touched  | none                                                                                                                                                  |

**Where the removed information goes:** the old value's second sentence
(the file-type / 15-MB info) is **retained character-for-character** as a
smaller secondary line directly below the intro, per gate answer 3 — it now
lives in code (`lib/strings/de.ts` → `case.docs.typesLine`), because the
amendment forbids any other DB write (a second row was not an option).
Consequence, ledgered for Roman: that sentence is no longer editable via
the DB row.

**Migration file:** `supabase/migrations/20260827000001_mobile_round3_docs_intro.sql`.
Safety rails in the file: an aborting DO-block asserts the live before-value
still equals the value this report names (if content drifted since, the push
STOPS and this report must be re-reviewed against the live value — nothing
is overwritten blind); a second DO-block asserts the after-state and RAISEs
NOTICEs with before/after for the push log.

**Deploy-order note (benign-row class, CLAUDE.md #8):** the consuming code
renders whatever the row holds. If code deploys before the push, the docs
page shows the OLD intro plus the new secondary line — the type/size info
appears twice for that window, cosmetic only; the push closes it. Pushing
before or with the deploy avoids even that.

**The founder pushes this migration manually (`supabase db push` from the
repo root). Nothing in this session ran or will run any DB command.**

---

## What shipped (per the approved classification — DONE items R5/R9 untouched)

| Req    | What was built                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1     | Applicant-name title moved into the mobile top bar (h1, truncating), beside the burger. The in-scroller title copies (chat + docs pane) are gone. Fallback behavior unchanged (`caseHeaderTitle`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| R2     | New burger side menu (`app/case/mobile-menu.tsx`, base-ui Dialog left slide-over; content server-rendered in page.tsx): Hilfe (existing HelpSheet dialog, gate answer 1) · Roman-photo PLACEHOLDER (`public/roman-placeholder.svg`, neutral silhouette in brand colors — ledgered) · tap-to-call `tel:+491789125300` with visible number (gate answer 4: deliberately ≠ `contact.phone`; row untouched, queued for Roman) · logo lockup · Logout (existing `logoutAction`). Old top-bar members all re-homed; tagline dropped below `lg` (gate answer 5); legal bar kept (gate answer 5).                                                                                                                                                                                                                                                                                                                                                                       |
| R3     | Subheader pinned under the top bar on the Angaben tab — Roman's `case.patient_banner_body` row VERBATIM incl. "der" (gate answer 2; row untouched; wording question ledgered for Roman).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| R4     | Mobile pill nav (compact variant of the desktop pill treatment: copper fill active + white text + icons, outlined inactive, badge as one non-breaking unit), below the subheader, replacing the underline tab row. Testids/roles preserved (`tab-questions`/`tab-documents`/`docs-tab-badge`, `role=tab(list)`, `aria-selected`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| R7     | Autosave notice now dismisses on the user's first scroll of the chat history — once per login session (sessionStorage via `lib/autosave-notice.ts`, flag cleared on the login page; `useSyncExternalStore` read, hydration-safe). Programmatic scroll-on-mount is excluded via a flag consumed by the event it causes (the P1-7 trap). Verified: visible on login → gone on user scroll → stays gone across reload → returns after logout/login. No X button, no DB.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| R8/R11 | Global palette = the six brand colors + documented derivations (gate answer 6b), in `globals.css`: exact — Black `#2f2b2c`, Orange `#c44f15`, Dark green `#245b5a`, Light green `#dde8de` (sage-soft), Cream `#f8f3eb` (also cream-deep, per gate answer 6c), White `#fffdfa` (also overrides Tailwind's `white`/`black` utilities). Derived (recipes in-file): graphite-soft `#5d5959` (78B/22W), input `#868383` (58B/42W, 3.69:1/3.39:1), petrol-soft `#3a6b6a` (90G/10W), copper-hover `#ac4919` (84O/16B), sage `#afc5bd` (75LG/25G), border `#e8e3dc` (92C/8B). `--semantic-error` = the ONE red exception (gate answer 6a), aliased by `--destructive`. Deleted: the `.dark` token block and the unused shadcn chart/sidebar token sets. `global-error.tsx` inline literals updated (six plain values only). Every previously documented contrast claim re-measured 2026-08-27 and updated in place (styles.ts, case-tabs, chat-view, page, help-sheet). |
| R10    | `docs.area_intro` renders the founder's sentence once the migration is pushed; Roman's type/size sentence retained verbatim as a smaller secondary line (`de.ts case.docs.typesLine`). Plus the docs progress bar (gate answer 3): % = uploaded ÷ required slots from the SAME `countMissingSlots` source as the M6 counter, `lg:hidden` (mobile-only scope), labelled via `aria-labelledby` on the counter (zero new German).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |

**Height budget:** the new pinned chrome (top bar + subheader + pills) costs
~70px more than the old top-bar + tab-row at 375×667, so the multiselect
option-list cap in `question-renderer.tsx` was re-derived 35dvh → 24dvh
below `sm` (options scroll internally a little sooner; button reachability
is the requirement and mobile-footer.spec verifies it — see e2e results).

## Files changed

Modified: `app/globals.css`, `app/global-error.tsx`,
`app/(auth)/login/form.tsx`, `app/case/page.tsx`, `app/case/case-tabs.tsx`,
`app/case/chat-view.tsx`, `app/case/document-area.tsx`,
`app/case/help-sheet.tsx` (comment re-measure only),
`components/ui/styles.ts` (comment re-measure only),
`components/ui/questionnaire/question-renderer.tsx`, `lib/strings/de.ts`,
`docs/document-rules/german_copy_for_roman.md` (ledger).

New: `app/case/mobile-menu.tsx`, `lib/autosave-notice.ts`,
`public/roman-placeholder.svg`,
`supabase/migrations/20260827000001_mobile_round3_docs_intro.sql`,
`docs/feedback/mobile_round3_phase1.md`, this file.

Desktop (`lg`+) layout untouched except palette-token values; verified in
the visual pass (sidebar renders, burger hidden).

## Ledger entries added (german_copy_for_roman.md, section "Mobile-Runde 3")

1. PLACEHOLDER_DE ×3 — burger-menu screen-reader labels (`case.menu.title`
   "Menü", `.openLabel` "Menü öffnen", `.closeLabel` "Schließen").
2. R10 split provenance — founder sentence in the DB row; Roman's type/size
   sentence relocated verbatim to `de.ts` (no longer DB-editable).
3. Roman-photo placeholder asset (`public/roman-placeholder.svg`), swap
   path documented.
4. Queued for Roman (not copy): the two-phone-numbers conflict (gate
   answer 4) and the "sie ist (der) Antragsteller" wording question (gate
   answer 2).

## Visual verification (local dev server, 375×667 + 1280×800)

Screenshots (session scratchpad): pre-steps with burger bar · open burger
menu (all five items in mockup order; Hilfe opens the HelpSheet over the
menu; call link `tel:+491789125300`) · Angaben with title "Antrag für Maria
Schneider", R3 subheader, pills, white chat card, reachable save button
(bottom 590px ≤ 667) · Unterlagen with R9 subheader, 0% progress bar,
counter, intro + secondary type line, grouped checklist · desktop sanity
(sidebar unchanged, no burger). R7 full cycle verified as above. The badge
mid-wrap defect found in the first pass ("· 7 / offen") was fixed
(whitespace-nowrap unit wrap) and re-verified.

## e2e results (2026-08-27, full suite vs local dev server at localhost:3000)

**22 of 22 runnable tests green; 13 pre-existing KNOWN SKIPs.**

- Full parallel run: **21 passed, 1 failed, 13 skipped (7.3m)**. The skips
  are auth.spec's signup-flow tests, gated on `E2E_ALLOW_SIGNUP` since prod
  enables email confirmation — pre-existing, untouched by this round.
- The one failure was `completion.spec` criterion **C4** ("Bearbeiten
  buttons must disappear after lock"): at count time the transcript still
  showed the PRE-refresh state (47 edit buttons, all-answered card) while
  the DB had already flipped to `under_review` — i.e. the in-place
  `router.refresh()` after the final save had not settled within the spec's
  fixed 2-second window under 6 parallel workers on the DEV server. The
  same test's C6/C7 blocks — which `page.reload()` first — passed in that
  very run (locked variant card, docs button, tab switch, uploads,
  zero-missing card all green), so the locked rendering itself is correct.
- Verification: fresh fixture + **solo re-run of completion.spec → PASSED
  (1.5m)** with `[C4] Bearbeiten buttons=0` and the locked banner up.
  Classified as local-dev load timing (the known local-drive weakness that
  motivated the preview-gate pattern), not a round-3 regression — the spec
  file itself is untouched since UI round 2 (git log).
- **Load-bearing for this round:** `mobile-footer.spec` M1 (Essen 45326 at
  375×667, every multiselect/group-prompt action reachable, locked card +
  docs tab) **passed (3.1m)** against the NEW pinned chrome and the
  re-derived 24dvh multiselect cap — the 2026-08-11 reachability guarantee
  holds. `feedback-pass` T1 (mobile badge at 375px), `legal-footer`,
  `documents-m6`, `fallback-notice`, `m7-regression`, `visibility`,
  `transitive-visibility-fix`, `date-bounds`, `disability-gate` all green.
- The suite ran with the migration NOT yet pushed (docs.area_intro still
  the old value) — no spec asserts that copy, and the docs pane renders the
  benign pre-push state.

## Deferred / open

1. **Founder action — the one migration:**
   `supabase/migrations/20260827000001_mobile_round3_docs_intro.sql`
   (impact report above). Until pushed, the docs intro shows the old
   sentence plus the new type/size line (brief duplication, cosmetic).
2. **Roman queue (ledger):** real photo for the burger menu; the
   two-phone-numbers conflict; the "sie ist (der) Antragsteller" wording;
   the three PLACEHOLDER_DE menu labels.
3. **Desktop pass (out of scope by brief):** the docs upload-progress bar
   is `lg:hidden`; the desktop round decides its treatment. Desktop layout
   otherwise untouched.
4. **Preview-gated re-run:** this suite ran against the local dev server
   (the preview-gate pattern needs a pushed branch). Recommend one preview
   suite pass on the round's branch before merge, per the established
   pattern.
5. Nothing was committed or pushed in this session; the working tree holds
   the round for the founder's review.
