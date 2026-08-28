# Desktop UI Round 1 — Phase 1 discovery (READ-ONLY)

> **Status: GATE 1 APPROVED 2026-08-28** (founder, in-session, with gate
> answers and screenshot facts — execution record in
> `desktop_round1_phase2.md`). Written 2026-08-28 as read-only discovery.
> Scope: desktop breakpoints (`lg` = 1024px and up) only; the Mobile Round 3
> experience (merged `59b98b6`, live on prod, R10 migration applied) must
> not change.
>
> **Reference screenshot MISSING:** `docs/mockups/desktop-round1/` does not
> exist in the repo. Every "order/placement per screenshot" item below is
> therefore classified on the requirement text alone and flagged in GATE
> QUESTIONS where a placement call is needed.
>
> **D7 is PERMANENTLY WITHDRAWN** (founder decision, twice). It is not
> analyzed, not classified, and will not be implemented. Questionnaire flow,
> question order, and step structure are untouched by this pass.

---

## P1-1 · Inventory — the current desktop UI

The case screen is one viewport-locked `h-dvh` column
([page.tsx:160](../../app/case/page.tsx), `bg-background` = Cream). From `lg`
the shell is a row: sage sidebar + pane column
([case-tabs.tsx:135-170, 257-278](../../app/case/case-tabs.tsx)).

| Region                                                                   | What renders today (lg+)                                                                                                                                                                                                                                                                                                                                                                                 | Files                                                                                                                                                   |
| ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Sidebar** (`hidden … lg:flex`, w-72/xl:w-80, `bg-sage-soft/40`)        | Top: logo + petrol tagline (`brand.tagline`). Middle: Angaben / Unterlagen nav **pills** (copper active fill, badge "· n offen"; rendered whenever a documents pane exists — i.e. always outside the zero-rules safety branch). Foot: **Hilfe** (HelpSheet trigger) and **Abmelden** as two small side-by-side text links, then the legal links (`LegalFooter variant="sidebar"`).                       | [case-tabs.tsx:135-170](../../app/case/case-tabs.tsx), [page.tsx:51-92](../../app/case/page.tsx), [legal-footer.tsx](../../components/legal-footer.tsx) |
| **Header area** (`hidden lg:block`, in the pane column above both panes) | h1 title `caseHeaderTitle(...)` = "Antrag für {Vorname} {Nachname}" (`case.header_title_pattern`), fallback `case.subheading`; below it the per-tab intro line — Angaben: `case.patient_banner_body` (Roman's "…der Antragsteller." row), Unterlagen: `case.header_intro_documents`. Centred, max-w-2xl.                                                                                                 | [case-tabs.tsx:186, 193-208](../../app/case/case-tabs.tsx), [case-header.ts](../../lib/case-header.ts), [page.tsx:340-344](../../app/case/page.tsx)     |
| **Chat pane** (Angaben)                                                  | Pinned top band (cream, `bg-background/95`): questions progress bar ("{n} von {m} Fragen beantwortet" + floating petrol %-chip). Middle: the transcript in a **white card** (`card` = `bg-card` #FFFDFA) with its own scroller; autosave notice as sage hint bubble at its head. Pinned bottom (cream band): the active question / group prompt / all-answered / locked card — each itself a white card. | [chat-view.tsx:118-175, 1082-1226](../../app/case/chat-view.tsx)                                                                                        |
| **Docs pane** (Unterlagen)                                               | `DocumentArea`: h2 `docs.area_title`, missing counter, **mobile-only progress bar (`lg:hidden`)**, `docs.area_intro` sentence, `de.case.docs.typesLine` secondary line, then grouped white cards of doc-slot rows. Pre-questionnaire: `DocsPlaceholder` card instead.                                                                                                                                    | [document-area.tsx:174-226](../../app/case/document-area.tsx), [page.tsx:278-285](../../app/case/page.tsx)                                              |
| **Pre-questionnaire chat** (Steps 1–2)                                   | "Case meta" card (subheading + **Status** row + conditional **PLZ** row), then Step 1 care-home card / Step 2 PLZ-form card. Viewport-shared markup.                                                                                                                                                                                                                                                     | [page.tsx:214-254](../../app/case/page.tsx)                                                                                                             |
| **HelpSheet**                                                            | base-ui Dialog; trigger = sidebar foot link. Popup at `sm`+ is a **right slide-over** (w-80, `sm:rounded-l-2xl`); below `sm` a bottom sheet. Backdrop dims (`bg-graphite/40`). Content: card label, initials circle (no `photoSrc` passed), name, `contact.phone` link, `contact.email` link.                                                                                                            | [help-sheet.tsx:66-131](../../app/case/help-sheet.tsx)                                                                                                  |
| **Legal footer**                                                         | lg+: sidebar-foot variant (links inline in the sidebar). Below lg: full-width bar (`lg:hidden`).                                                                                                                                                                                                                                                                                                         | [legal-footer.tsx](../../components/legal-footer.tsx), [page.tsx:261-263](../../app/case/page.tsx)                                                      |
| **Mobile chrome** (below lg — out of scope, listed for the boundary)     | Burger menu (left slide-over: Hilfe → HelpSheet, Roman photo placeholder, `tel:+491789125300`, logo, Abmelden), applicant-name top bar, per-tab subheader, pill nav row.                                                                                                                                                                                                                                 | [case-tabs.tsx:215-255](../../app/case/case-tabs.tsx), [mobile-menu.tsx](../../app/case/mobile-menu.tsx), [page.tsx:100-157](../../app/case/page.tsx)   |

---

## P1-2 · Classification D1–D11

| Req                                                          | Classification          | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ------------------------------------------------------------ | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **D1** sidebar: logo, Angaben, Unterlagen, Hilfe, Logout     | **PARTIAL**             | All five elements exist in the sidebar, but Hilfe + Abmelden are small **side-by-side foot links**, not items in the nav stack ([page.tsx:70-92](../../app/case/page.tsx)); the sidebar also carries the tagline and legal links, which D1's list does not mention. Order unverifiable — screenshot absent. → Gate Q2.                                                                                                                                                                                                                   |
| **D2** header: "Antrag für {Vorname} {Nachname}"             | **DONE**                | Desktop header renders `headerTitle` from `caseHeaderTitle()` — same `case.header_title_pattern` row and same answers source as mobile ([case-tabs.tsx:193-199](../../app/case/case-tabs.tsx), [page.tsx:340-344](../../app/case/page.tsx)). Fallback `case.subheading` until both name answers exist (unchanged contract).                                                                                                                                                                                                              |
| **D3** subheader: Roman's "…der Antragsteller." row verbatim | **DONE**                | `introQuestions = content.patientBannerBody` (`case.patient_banner_body`) renders directly under the title on the Angaben tab at lg+ ([case-tabs.tsx:186, 201-206](../../app/case/case-tabs.tsx), [page.tsx:388](../../app/case/page.tsx)). Row untouched; display only.                                                                                                                                                                                                                                                                 |
| **D4** progress bar below the subheader (Angaben)            | **DONE**                | ChatView's pinned top band sits directly beneath the shell header and renders the questions ProgressBar ([chat-view.tsx:1082-1101](../../app/case/chat-view.tsx)). Order at lg+: title → subheader → progress bar.                                                                                                                                                                                                                                                                                                                       |
| **D5** question/chat section in a white #FFFDFA central box  | **PARTIAL**             | The transcript already lives in a white `card` box ([chat-view.tsx:1116](../../app/case/chat-view.tsx); `--card` = #FFFDFA) and the active-question card is white — but the pinned progress band and the answer band are full-bleed **cream** (`bg-background/95`), so the section reads as three regions, not one white central box. Wrapping is a visual-only change; the reachability flex chain (separate history scroller + shrinkable answer footer, 2026-08-11 field bug) must not change. → Gate Q3.                             |
| **D6** remove Case ID / PLZ / status from applicant UI       | **PARTIAL**             | Case ID: already gone (UI round 2, R2-2 F1 — [chat-view.tsx:1089-1097](../../app/case/chat-view.tsx) comment records the removal; no applicant-facing render found by sweep). Status + PLZ display rows survive in the pre-questionnaire meta card. Full enumeration in P1-3.                                                                                                                                                                                                                                                            |
| **D7**                                                       | **WITHDRAWN**           | Not implemented, not analyzed.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| **D8** autosave infobox, scroll-dismiss, per login session   | **DONE**                | The Round 3 implementation is viewport-independent — see P1-5. Nothing to build.                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| **D9** Hilfe as desktop bottom sheet                         | **NEW**                 | Current desktop popup is a right slide-over ([help-sheet.tsx:77](../../app/case/help-sheet.tsx)); no photo passed (initials circle), no `tel:+491789125300`, no call pictogram. Design note in P1-4.                                                                                                                                                                                                                                                                                                                                     |
| **D10** docs copy + desktop progress bar                     | **copy DONE / bar NEW** | Both strings verified live (P1-6). The docs progress bar is `lg:hidden` by deliberate Round 3 deferral ([document-area.tsx:198](../../app/case/document-area.tsx)) — extension spec in P1-6.                                                                                                                                                                                                                                                                                                                                             |
| **D11** palette                                              | **DONE (verified)**     | Sweep of `app/` + `components/` for raw hex / rgb / oklch / off-palette Tailwind hues: only hits are comments, and [global-error.tsx](../../app/global-error.tsx) inline styles whose values are the exact brand hexes (#f8f3eb / #2f2b2c / #245b5a / #fffdfa — on-palette; inline because global-error replaces the root layout). Desktop-only components (sidebar, HelpSheet dialog, sidebar legal footer) use only R8 tokens. `--semantic-error` remains the one documented exception ([globals.css:125-134](../../app/globals.css)). |

---

## P1-3 · D6 enumeration — every applicant-facing occurrence

Sweep method: grep for `statusLabel|plzLabel|caseData.id|case_id|caseId|.id.slice` and
`PLZ|plz` across `app/` and `components/`; every hit inspected. Admin/debug/e2e
surfaces, testids, and non-rendered attributes excluded per the brief.

### Removal table (for gate approval — nothing removed yet)

| #   | Item                                                                                  | File : line                                 | Rendered location                                                                 | Viewports                        | Render condition                                                                                                                                                                                                                   | Proposed action |
| --- | ------------------------------------------------------------------------------------- | ------------------------------------------- | --------------------------------------------------------------------------------- | -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| 1   | **Status row** — "Status: In Bearbeitung" (`s.statusLabel` + `s.statusLabels[...]`)   | [page.tsx:220-224](../../app/case/page.tsx) | "Case meta" card at the top of the chat pane, pre-questionnaire state (Steps 1–2) | **all** (viewport-shared markup) | every pre-questionnaire render                                                                                                                                                                                                     | remove          |
| 2   | **PLZ row** — "PLZ vor Heimeinzug: {plz}" (`s.plzLabel` + `caseData.plz_before_move`) | [page.tsx:225-230](../../app/case/page.tsx) | same card                                                                         | **all**                          | only if `plz_before_move` is set while `questionnaire_id` is still null — an edge/transient state: both PLZ-resolution paths set `questionnaire_id` in the same UPDATE as the PLZ ([actions.ts:87-118](../../app/case/actions.ts)) | remove          |
| 3   | **Case ID**                                                                           | —                                           | none found                                                                        | —                                | already removed app-wide in UI round 2 (R2-2 F1)                                                                                                                                                                                   | nothing to do   |

**Recommended shape of the removal:** removing rows 1+2 leaves the meta card
holding only the `content.caseSubheading` heading — which the pinned chrome
already shows as the header title on every viewport in this state (mobile top
bar and desktop header both receive `headerTitle={content.caseSubheading}`,
[page.tsx:205](../../app/case/page.tsx)). I therefore propose removing the
**entire meta card** ([page.tsx:217-236](../../app/case/page.tsx), including
the suppressed unsupported-PLZ comment block, which is preserved in git
history), not just the two `dl` rows — otherwise the same string renders twice
stacked. Dead-code follow-up in the same change: `plzLabel`, `statusLabel`,
`statusLabels` in [de.ts:165-166, 207-211](../../lib/strings/de.ts) become
unreferenced and would be deleted (code-only; no DB rows involved).

### Enumerated and explicitly OUT of removal scope

| Item                                                                 | Where                                                           | Why it stays                                                                                                                      |
| -------------------------------------------------------------------- | --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| PLZ **input** form (Step 2)                                          | [plz-form.tsx](../../app/case/plz-form.tsx), `#plz_input`       | Flow-critical data entry, not a meta display. 9 e2e specs drive it.                                                               |
| `docs.placeholder_needs_plz` text                                    | docs pane pre-PLZ ([page.tsx:206-213](../../app/case/page.tsx)) | Roman's DB-authored sentence _about_ the PLZ step, not a display of case data. D6 is UI-only; touching it would be a data change. |
| PLZ fields inside `address` answers                                  | questionnaire engine                                            | The user's own questionnaire answers, not case meta.                                                                              |
| Status-derived UI states (locked card, all-answered card, tab badge) | chat-view                                                       | These _react_ to status; none of them prints the status word. D6 targets the meta display.                                        |
| `status_event` inserts, `case_id` FKs, ops scripts                   | server code, `scripts/`                                         | Not applicant-facing.                                                                                                             |

**e2e impact: none.** No spec reads the Status/PLZ rows or the meta card
(grep across `tests/e2e/` for `Status`, `PLZ vor`, related testids — zero
hits; the specs' PLZ usage is the `#plz_input` form, which stays).

**⚠ Viewport conflict to resolve at the gate:** the meta card is
viewport-shared, so this removal also changes the **mobile** pre-step screens
— the one place where "D6 wherever it appears" and "mobile must not change"
collide. → Gate Q1.

---

## P1-4 · D9 design note — desktop bottom sheet for Hilfe

**Current invocation (desktop):** exactly one Hilfe surface exists at lg+ —
the HelpSheet trigger in the sidebar foot ([page.tsx:73-80](../../app/case/page.tsx)).
No other desktop occurrence (auth/legal pages have none; the burger menu is
below lg). `HelpSheet` is instantiated twice in page.tsx; the second instance
(burger menu, line 106) is mobile-only and stays byte-identical.

**What a bottom-sheet variant needs — and what already exists:**

| Need                                 | Status                                                                                                                                                                                                                                                                                                |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Slide-up panel pinned to the bottom  | The component's own `<sm` treatment already is `fixed inset-x-0 bottom-0 rounded-t-2xl` ([help-sheet.tsx:77](../../app/case/help-sheet.tsx)); the variant keeps these classes instead of switching to the slide-over at `sm+`.                                                                        |
| Page dim behind                      | Already there: `Dialog.Backdrop bg-graphite/40` (help-sheet.tsx:76).                                                                                                                                                                                                                                  |
| Focus trap, Esc, outside-click close | Already there: `@base-ui/react/dialog` provides all three — the **same primitives the mobile burger menu uses** ([mobile-menu.tsx](../../app/case/mobile-menu.tsx)); reuse confirmed, no new dependency. The load-bearing `data-closed:hidden` pattern carries over.                                  |
| Roman's photo                        | Existing `photoSrc` drop-in slot (help-sheet.tsx:34, 90-97) + existing asset `public/roman-placeholder.svg`; pass it on the **desktop instance only** (real photo still on the Roman queue). Alt: `alt=""`/`aria-hidden` — the name is adjacent text (burger + initials precedent), no German needed. |
| Call pictogram + `tel:+491789125300` | Reuse the burger menu's row pattern ([page.tsx:136-139](../../app/case/page.tsx)): `Phone` icon (aria-hidden) + visible number `+49 178 9125300` as the accessible name → **no German label needed**.                                                                                                 |
| Existing help contact content        | Card label, name, `contact.phone`, `contact.email` rows stay (see Gate Q4b on the two-numbers question).                                                                                                                                                                                              |

**Mechanics:** add a `variant?: 'panel' | 'bottomSheet'` prop to HelpSheet
(default `'panel'` = today's classes, used by the burger instance untouched).
The sidebar instance passes `variant="bottomSheet"` + `photoSrc` + the tel
row. Because the sidebar is `hidden` below `lg`, the variant can never appear
on mobile viewports; conversely the burger trigger only exists below `lg`, so
sm–lg tablets keep the shipped Round 3 behavior exactly.

**New German strings needed: none expected.** Close label exists
(`de.case.help.closeLabel`, approved). Only if the founder prefers an
icon-only call button (no visible number) would one aria-label be needed →
PLACEHOLDER_DE + ledger, per standing rule.

**Placement call (→ Gate Q4a):** a full-bleed `inset-x-0` sheet is very wide
at desktop. Recommendation: centre it (`mx-auto w-full max-w-xl rounded-t-2xl`)
so it reads as a sheet, not a wall.

---

## P1-5 · D8 verification — autosave infobox at desktop breakpoints

**Verdict: DONE — the Round 3 implementation already covers desktop.**
Nothing is missing; no work item.

Evidence (all in code shared by every viewport):

- The notice renders at the head of the chat transcript with **no responsive
  classes** ([chat-view.tsx:1128-1133](../../app/case/chat-view.tsx)); the
  transcript card renders identically at lg+.
- The dismissal handler is `onScroll` on the same history scroller that
  exists at every breakpoint ([chat-view.tsx:682-694, 1115](../../app/case/chat-view.tsx)),
  including the programmatic-scroll guard.
- "Every login, session-only" comes from the `sessionStorage` flag
  ([lib/autosave-notice.ts](../../lib/autosave-notice.ts)), cleared on the
  login form — browser-session state, viewport-independent.
- The hydration-safe read (`useSyncExternalStore`,
  [chat-view.tsx:100-114, 666-672](../../app/case/chat-view.tsx)) has no
  breakpoint dependency.

Behavior at lg+ is therefore already **identical** to mobile R7: shows on
every login, first user scroll of the history dismisses it for the session.

---

## P1-6 · D10 verification + desktop progress-bar spec

**String 1 — docs subheader (expected DONE): VERIFIED.**
`case.header_intro_documents` = `Laden Sie die Unterlagen hoch, die Ihnen
bereits vorliegen. Wir prüfen alles und melden uns, falls etwas fehlt.` —
seeded verbatim by migration [20260814000001](../../supabase/migrations/20260814000001_ui_round2_header_content.sql)
(line 38; character-identical to the brief). Renders on desktop as the header
intro line whenever the Unterlagen tab is active
([case-tabs.tsx:186, 201-206](../../app/case/case-tabs.tsx)).

**String 2 — below the progress bar (expected DONE): VERIFIED at the data
layer.** `docs.area_intro` = `PDFs, Fotos und mehrere Dateien pro Unterlage
sind möglich. Vor der Einreichung prüfen wir alle Ihre Unterlagen.` — UPDATE
in migration [20260827000001](../../supabase/migrations/20260827000001_mobile_round3_docs_intro.sql)
(character-identical to the brief; applied on prod per this session's brief).
Renders on all viewports at [document-area.tsx:224](../../app/case/document-area.tsx).
Roman's relocated type/size line (`de.case.docs.typesLine`) stays below it —
untouched by this pass.

**Progress-bar extension (NEW):** the bar
([document-area.tsx:197-216](../../app/case/document-area.tsx)) is complete —
same source of truth as the counter (`uploaded ÷ required` from the identical
`slots`/`uploads`), `aria-labelledby` wired, R8 tokens — and hidden at lg+
only by the `lg:hidden` on its wrapper (line 198), a deliberate Round 3
deferral. **Spec: delete `lg:hidden` (and update the MOBILE-ONLY comment).**
No new logic, no new German, no layout work: on desktop it appears exactly
where it sits on mobile — between the missing-counter line and the
`docs.area_intro` sentence — which also lands String 2 "below the progress
bar" as the requirement words it. No screenshot exists to contradict this
placement (→ Gate Q5).

---

## P1-7 · DB surface — confirmed ZERO

- **Schema:** no requirement touches a table or column. D6 is explicitly
  UI-only (rows 1–2 are pure display removals; `plz_before_move`, `status`
  data untouched).
- **Data:** every string D1–D11 needs already exists and is live —
  `contact.*` rows (D9 content), `case.header_title_pattern` /
  `case.patient_banner_body` / `case.header_intro_documents` (D2/D3/D10),
  `docs.area_intro` (D10, R10 migration applied), `brand.tagline`. The
  possible new strings are at most **a11y labels**, which live in
  `lib/strings/de.ts` (code, PLACEHOLDER_DE + ledger) — and P1-4's expected
  count is zero.
- No migration drafts were written; nothing unexpected surfaced. The one
  pending-migration item from session-context (R10) is recorded as applied in
  this session's brief.

---

## GATE QUESTIONS

1. **D6 removal table (P1-3) — approve?** Two sub-decisions:
   (a) remove the **entire** pre-step meta card (recommended — after the two
   rows go, only a duplicated heading remains) or only the Status + PLZ rows;
   (b) the card is viewport-shared, so the removal also changes the **mobile**
   pre-step screens — confirm that "D6 wherever it appears" wins over "mobile
   must not change" here (it is the only collision found).
2. **D1 sidebar layout:** the screenshot directory is missing. Should Hilfe
   and Logout move from the small foot links into the **nav stack** as
   full-size items under Angaben/Unterlagen (matching D1's list order:
   logo, Angaben, Unterlagen, Hilfe, Logout)? And do the tagline (under the
   logo) and the legal links (sidebar foot) stay although D1's list doesn't
   name them? My default if you approve without the screenshot: nav-stack
   items in list order, tagline and legal links stay.
3. **D5 white central box:** is the current treatment (white transcript card +
   white question card on cream bands) sufficient, or should the whole
   question/chat section read as ONE white #FFFDFA box at lg+? My default:
   one wrapping white box on lg+, visual only — the reachability flex chain
   stays exactly as is.
4. **D9 calls:** (a) sheet width — full-bleed or centred `max-w-xl`
   (recommended)? (b) the brief keeps "the existing help contact content",
   which includes `contact.phone` ("0159 0469 5761") — so the desktop sheet
   would show **two** phone numbers (that conflict is already on Roman's
   queue). Keep both, or show only `tel:+491789125300`? (c) confirm the
   placeholder silhouette replaces the initials circle on the desktop sheet
   only (mobile HelpSheet keeps initials, exactly as shipped).
5. **D10 bar placement:** confirm the desktop bar keeps the mobile position
   (between the counter line and the intro sentence, inside the docs pane
   header) — there is no screenshot to verify against.

=== HARD STOP — Phase 2 begins only after "GATE 1 APPROVED" + answers. ===
