# UI Round 2 — Phase 1: read-only delta report (FULL mockup adoption)

> **READ-ONLY. Nothing implemented.** Produced 2026-08-14 against the founder
> decisions D1–D7 (locked 2026-08-14). Product code untouched; the only
> artifacts of this phase are this report, the reference gallery
> (`ui-gallery/R2-mockup-reference/` + its capture script
> `scripts/r2-mockup-gallery.mjs`), and no prod writes of any kind (no
> throwaway accounts were created — the current-app side of the delta table
> is drawn from code, the shipped pass-3 galleries, and the standing specs).
>
> **⏸ STOP after this report. Implementation begins per sub-phase GOs.**
>
> Decision recap: **D1** adopt the full desktop sidebar (reverses pass-3 E-1
> "no sidebar" — reversal recorded in §2.1); **D2** sidebar is desktop-only,
> Phase 1 proposes the breakpoint (§2.2); **D3** header "Antrag für {Vorname}
> {Nachname}" from the care recipient's name answers (§2.3); **D4** copy
> waiver for all mockup-adopted German, provenance "approved by Erman
> 2026-08-14, Roman review waived" (§6); **D5** one full round, E-8 items
> LAST, each its own STOP, droppable individually (§4, §5.8); **D6** legal
> footer / fallback banner / contact sheet / locked states / 404 survive,
> extrapolations proposed (§2.5); **D7** the "· n offen" badge relocates to
> the sidebar's Unterlagen item, numeric testid contract preserved (§3.2).

---

## 1. Fresh mockup pull — delta vs the A12 baseline

**Result: zero delta.** A fresh clone of
`github.com/romanpfeiffer85/Sorglos-product-ui-mockup` (2026-08-14, access as
`BerkHakcil` working) has HEAD = **`8ea545f`** ("Tab-Icon mit Logo ersetzt",
2026-07-30, gpt-engineer-app bot) — **the exact A12 baseline commit**. Single
branch `main`, no tags, no commits since. Roman has not touched the mockup
since the A12 addendum was written, so the A12 inventory
(`feedback_pass3_triage.md`) remains the authoritative component/token
census; everything below was nonetheless re-verified from the fresh clone,
not inherited (verified-reason rule).

**Reference gallery: `docs/feedback/ui-gallery/R2-mockup-reference/`** — 34
screenshots (17 states × desktop 1280×800 / mobile 375×812) captured from the
live mockup with `scripts/r2-mockup-gallery.mjs`, including every state the
A12 first pass could not see (chips, edit mode, the "Antwort geändert" flash,
uploaded DocRows, the all-uploaded banner, `/fertig`, auth, 404, the Hilfe
sheet and the mobile hamburger sheet). German index in the gallery README.

Three findings from driving the live demo, all recorded in the gallery README:

1. **The demo's "Später beantworten" is broken.** `index.tsx`'s `activeId`
   returns the first history entry whose status is not `"answered"`, and a
   skipped entry stays `"skipped"` — so a skipped question remains the active
   input forever and the italic skipped-marker (`index.tsx:198–202`) is
   **unreachable on the live site**. Consequence for E-8: the marker is
   implemented from the mockup's *code intent*, not from observable live
   behaviour, and there is no live reference for how it coexists with re-ask.
   (Our own skip → re-ask flow is unaffected; it works and stays.)
2. The "Edit with Lovable" badge in every shot is Lovable hosting chrome, not
   design.
3. The auto-navigate to `/fertig` 800 ms after the last upload fired exactly
   as A12 described — still not adopted (our completion is server-derived).

Privacy note: the Hilfe-sheet shots contain Roman's business contact data
(name, phone, kundendienst@ address) — the same data already committed in
`feedback_pass3_triage.md` and served by prod's own contact sheet, so no new
exposure. All form data in the shots is synthetic.

---

## 2. Screen-by-screen delta: current app vs mockup (desktop)

### 2.1 App shell — the sidebar (D1)

**Decision of record: D1 reverses the pass-3 E-1 decision** ("Keep our
centered column … No desktop sidebar", `pass3_phase_e_plan.md` §0, chosen
2026-07-30 as the low-risk path). The founder now adopts the mockup's full
`AppShell` layout with the left sidebar. The pass-3 record stays as written;
this round's ledger is this report.

| | Current app | Mockup (`AppShell.tsx`) | Delta work |
| --- | --- | --- | --- |
| Shell | `h-dvh` flex **column**: brand header → tab row → panes (inner scroll) → legal footer | `lg:flex` **row**: fixed sidebar + main column; page scrolls normally | Restructure `app/case/page.tsx` at the new breakpoint only; below it the current column stays byte-identical. The h-dvh inner-scroll architecture is **kept** on both (see §5.4) |
| Sidebar | none | `lg:w-72 xl:w-80`, `bg-sage-soft/40`, `border-r border-sage/40`, `p-8`; logo + tagline top; nav; Hilfe/Abmelden pinned bottom | New desktop-only `aside`; content inventory below |
| Logo/tagline | brand header row (logo.svg h-9 + tagline text) | sidebar top, logo h-8 + petrol tagline "Heimkosten einfach geregelt." | Tagline is already our DB row `brand.tagline` with the identical value — zero new German. At `lg`+ the top brand header disappears entirely (all four of its members relocate: logo+tagline → sidebar top, Hilfe/Abmelden → sidebar bottom) |
| Nav | underline tabs `Fragen | Dokumente` (role=tablist, petrol text + inset underline) | vertical pills: active = **copper fill, white text**, icon right (Pencil/FileText); inactive = `border-sage/50 bg-background/60` | Sidebar items are the SAME logical controls (CaseTabs' client-side tab switch — no routing is adopted), so they keep `role=tab` / `aria-selected` / the `tab-questions`/`tab-documents` testids. Labels renamed per D4: **Angaben / Unterlagen** |
| Badge | `· n offen` on the Dokumente tab | mockup sidebar has no badge; its unused `AppHeader` models `· 4 offen` | **D7**: badge joins the sidebar's Unterlagen pill on desktop; mobile keeps it on the tab. Contrast + strict-mode consequences in §3.2 and §5.3 |
| Hilfe/Abmelden | header buttons (HelpSheet trigger + logout form) | plain text buttons pinned at sidebar bottom | Same components re-homed; HelpSheet dialog unchanged. Both labels already exist ("Hilfe" = `contact.help_button`, "Abmelden" = `de.case.logoutButton`) — zero new German |
| Legal footer | shrink-0 row under the whole column | no mockup counterpart | **D6 extrapolation (proposal):** at `lg`+ the `LegalFooter` renders at the sidebar bottom, beneath Hilfe/Abmelden, in its existing 11px style; the bottom row is hidden at `lg`+. Below `lg` and on auth screens: unchanged. Spec consequences §3.2 |

### 2.2 Breakpoint proposal (D2)

**Proposal: `lg` (1024 px).** Rationale: it is the mockup's own switch
(`lg:` ×7 is exactly the sidebar; `sm:` ×32 is everything else; no `md:`
anywhere), the sidebar (288 px) + `max-w-3xl` content fit comfortably from
1024, and 768–1023 tablets keep the proven top-bar+tabs rather than getting a
squeezed sidebar. Below `lg` **nothing changes**: today's shipped mobile/
tablet UI stays as-is (D2), including the answer-footer flex architecture the
mobile field bug taught us. The mockup's sage mobile header block, hamburger
sheet and mobile pill tabs are **not adopted** — D2 keeps our pattern; the
gallery shots of them are reference-only.

### 2.3 Case header + progress (D3)

| | Current app (`chat-view.tsx` case-header) | Mockup | Delta work |
| --- | --- | --- | --- |
| Title | h2 `case.subheading` ("Mein Hilfe zur Pflege Antrag") | centered h1 "Antrag für Maria Schneider" (2xl/3xl bold) | Title becomes **"Antrag für {Vorname} {Nachname}"** once both name answers exist, else the **existing** `case.subheading` value verbatim — which is already exactly D3's fallback string, so the fallback needs no new row. Only the "Antrag für " pattern is new German (§6 #3) |
| Name source (D3) | — | hardcoded prop | **Exact keys, verified in both questionnaires: `first_name` + `last_name`**, top-level (non-group) in the first category — Berlin `antragsteller` sort 0/1, Essen sort 1/0 (Essen asks Nachname first; irrelevant to the lookup). Both are `is_required`, `short_text`. Read as `answersMap['first_name']` / `['last_name']` (key→value, default instance — the group-scoped `child_first_name`/`spouse_*` keys cannot collide). Server-side in `CaseTabsSection`; the title refreshes via the existing `router.refresh()` on save, and can additionally update live from ChatView's client `answersMap` if we want it instant (sub-phase decision, zero extra fetch either way) |
| Intro line | — (patient banner carries this message) | subtitle under the title, per screen: Angaben "Die folgenden Fragen beziehen sich ausschließlich auf die Person, die im Pflegeheim lebt, sie ist Antragsteller." / Unterlagen "Laden Sie die Unterlagen hoch, die Ihnen bereits vorliegen. …" | **Finding:** the mockup's Angaben intro is near-verbatim our existing Roman-authored `case.patient_banner_body` ("… sie ist **der** Antragsteller.") — proposal: the header intro **reuses that existing row** (Roman's grammar wins; zero new German) and the sage patient banner is retired as redundant (**FLAG F2**, founder call). The Unterlagen intro is new (§6 #4) |
| Case meta | case-id snippet · PLZ · status label row | none | **FLAG F1 (proposal: drop from the header).** The status is carried by the locked/all-answered cards; the PLZ by the pre-step card; the id snippet serves ops, not users — ops has `case:export`. If the founder wants any kept, it fits under the progress bar in graphite-soft |
| Progress | left label "{n} von {m} Fragen beantwortet" + right %-chip (petrol/10 pill) + slim bar | centered `max-w-md` bar, floating petrol %-chip **above a dot marker riding the fill edge** | Adopt the floating chip + dot marker at `lg`+. **The visible "{n} von {m} Fragen beantwortet" label STAYS** (deliberate deviation): 4 spec sites anchor on `von 53/49 Fragen` (§3.3), and the denominator is real information the %-only treatment hides. Dot marker a11y: §5.1 |
| Patient banner | pinned sage hint (desktop) / top-of-scroll (mobile) | none (message lives in the intro) | See FLAG F2 above |

### 2.4 Chat card + answer row

| | Current app | Mockup (`index.tsx`) | Delta work |
| --- | --- | --- | --- |
| Chat surface | history scrolls on `bg-muted/40`; bubbles already E-3 (white assistant left / petrol user right) | ONE white `rounded-2xl` card with the signature shadow wraps hints + history + active input; `max-h-[calc(100vh-320px)] min-h-[520px] overflow-y-auto` | Adopt the **card look, not the card architecture**: the white rounded frame wraps our existing header/history/footer flex column; history keeps its own scroller and the active input stays in the pinned `answer-footer` — never inline in the scroll (§5.4). Mobile gets the same frame only if the mobile-footer spec stays green, else desktop-only |
| Bubble contrast | assistant bubbles white on muted surface — visible | assistant bubbles **white on the white card** — separation is shadow-only (measured 1.00:1, §5.5) | Do not copy. Two candidates for the sub-phase gallery: (a) inner chat surface stays `bg-muted/40` inside the white frame; (b) white surface + `bg-cream` assistant bubbles |
| Autosave notice | none | first hint bubble: "Ihre Angaben werden automatisch gespeichert. Sie können jederzeit pausieren." (hides once the user scrolls) | Adopt as a **static** sage hint bubble at the top of the history (new content row, §6 #5). The scroll-hide JS is not adopted (behaviourish, zero value at our history lengths). Placement collision check: §5.6 |
| Active answer row | full-width question card in the pinned footer: prompt copy, control, error row, copper **"Weiter"**, outline skip **"Weiß ich gerade nicht"** | right-aligned naked input + ghost link "Später beantworten" + copper **"Antwort speichern"** (disabled until non-empty) | Keep the footer card (it carries `help_de`, validation errors and tall multiselects the mockup never has). Restyle within it: CTA renamed **"Antwort speichern"** (D4; anchors §3.4), skip restyled from outline button to the mockup's underlined ghost link and renamed **"Später beantworten"** (D4), controls right-aligned where they fit. Controls stay NATIVE — chips are E-8 |
| Disabled CTA | `disabled:opacity-50` | `disabled:opacity-40 cursor-not-allowed` | Do not copy the mockup's 1.27:1 ghost (§5.2) — proposal there |
| Edit affordance | "Bearbeiten" underline link under the user bubble | pencil icon + "Ändern" + sent-check | **E-8** (unchanged scope) |
| Group prompt / count-decrease / re-ask cards | footer cards (no mockup counterpart) | — | **D6 extrapolation:** unchanged; they already use the card/button primitives |
| All-answered / locked cards | E-6 petrol-check / neutral-clock cards in the footer | `/fertig` (see §2.6) | Survive as-is (D6) |

### 2.5 Unterlagen view

| | Current app (`document-area.tsx`) | Mockup (`unterlagen.tsx`) | Delta work |
| --- | --- | --- | --- |
| Tab/nav label | "Dokumente" | "Unterlagen" | **Rename (D4).** Anchor list §3.5 — the label has zero spec anchors; one `de.ts` value + ledger row |
| List shape | 3 subject groups (Ihre Unterlagen / Partner / previous home), each ONE card with `divide-y` rows (E-4 done) | one flat card, `divide-y` | Keep groups — the grouped headings are load-bearing for 2-person cases; visual parity already exists |
| Row | medallion (FileText → petrol Check), title + status line, done rows `bg-sage-soft/30` (E-4 done) | same | Only nits remain (font sizes/paddings) |
| Counter + intro | "Es fehlen noch {n} Dokumente." + `docs.area_intro` | none / header intro sentence | Counter and intro STAY (testid contract + Roman's authored copy). The mockup's page intro sentence becomes the Unterlagen header intro (§2.3). Its second sentence ("Vor der Einreichung fragen wir Sie immer nach Ihrer Freigabe.") **promises an approval step our product does not have — FLAG F3, not adopted without founder confirmation** (§6 #4 adopts sentence 1 only by default) |
| Upload button | `docs.upload_button` = "Datei hochladen" (outline) | "Datei auswählen" / done rows "Ersetzen" + "Entfernen" | Keep "Datei hochladen" (accurate: choosing uploads immediately; also a Roman-authored DB row — **FLAG F4** if the founder prefers the mockup wording, it is a one-row content migration). "Ersetzen" (replace-all) is a behaviour we do not have — not adopted; our per-file list with download + delete links stays (the mockup has no download at all) |
| Fallback banner | sage info panel above the first group | none | **D6:** survives unchanged above the first card |
| All-uploaded | counter flips to `docs.all_uploaded` (petrol) | petrol/10 banner + auto-nav | Banner pattern optional nit; auto-nav never |

### 2.6 Auth, completion, 404 (alignment check)

Already aligned by pass-3 E-5/E-6 and later rounds; re-verified against the
fresh clone and the new gallery:

- **Auth:** AuthShell pattern shipped; headings match the mockup verbatim
  ("Willkommen zurück", "Konto erstellen", the email-sent sage panel).
  Remaining deltas are pixel nits (card padding 6/8, footer-link row layout,
  consent checkbox size) — one small sub-phase, **zero copy changes** (our
  auth German is authored and live; the mockup's consent texts are the
  pre-Sorglos-rename variants of ours).
- **Completion/locked:** the `/fertig` pattern (petrol medallion, Nächste
  Schritte with Roman's three steps, docs-variant) shipped in pass 4 /
  go-live rounds. The mockup's embedded Ansprechpartnerin block + "Angaben
  ansehen / Unterlagen ansehen" outline buttons are **not adopted** (HelpSheet
  covers contact; the buttons duplicate the nav) — recorded as the D6
  extrapolation.
- **404 / error / loading:** shipped and de-flagged in the waiver round;
  mockup parity holds. No work.
- **Pre-steps (no mockup counterpart, D6):** care-home + PLZ FormCards render
  unchanged inside the new shell; header shows the fallback title.

---

## 3. e2e blast radius + hardening pre-phase (R2-0, the E-0 move)

Census across the 12 spec files + 4 driver scripts (counts are occurrences,
not files; method: repo-wide grep on this commit, `6392444`).

### 3.1 Selector inventory touching this round's surfaces

| Selector | Uses | Risk | Action |
| --- | --- | --- | --- |
| `[data-testid=answer-footer]` | **45** across 10 specs | 🟢 element and its flex role are PRESERVED (§5.4) | none — the E-0 investment pays out |
| `[data-testid=tab-documents]` | 11 (7 specs) | 🟠 **duplicate-DOM strict-mode class** (§3.2) | R2-0 visible-filter |
| `[data-testid=tab-questions]` | 2 | 🟠 same | R2-0 visible-filter |
| `[data-testid=docs-tab-badge]` | 1 (feedback-pass T1, `Number(textContent)`) | 🟠 same + D7 relocation | R2-0 visible-filter; numeric contract per D7 (bare number in its own span) |
| `aria-selected` on tab-documents | 1 (completion C6) | 🟢 sidebar items KEEP `role=tab`/`aria-selected` (§2.1) | none |
| `[data-testid=legal-footer]` (+ `boundingBox`, `a` count = 3) | legal-footer.spec, 3 viewports incl. 1280 | 🟠 duplicate-DOM once the sidebar copy exists; bounding box moves | R2-0 visible-filter; the 1280 assertion re-targets the sidebar instance in R2-1 (listed in that commit) |
| `getByText('von 53 Fragen' / 'von 49 Fragen')` | 4 (m7 ×3, mobile-footer ×1) | 🟢 the visible label deliberately stays (§2.3) | none |
| `getByRole('button', { name: 'Weiter' })` | **10** (8 specs) + 3 scripts (`ui-gallery`, `ui-gallery-chat`, `a11y-keyboard-audit`) | 🔴 label renamed to "Antwort speichern" in R2-3 | **R2-0**: add `data-testid="save-answer"` to the CTA (zero visual change) and repoint all 13 sites — the rename then touches no test |
| `[data-testid=case-header]` | 0 spec uses (E-0 hook, unused) | 🟢 | keep the hook through the header rewrite |
| `[data-testid=chat-history]` | 1 | 🟢 wrapper survives inside the card frame | none |
| `[data-testid=answered-bubble]` | 3 | 🟢 untouched until E-8 | none |
| `locked-banner` 7 · `locked-docs-button` 2 · `all-answered` 5 · `next-steps` 3 | | 🟢 E-6 cards survive (D6) | none |
| `document-area` 9 · `doc-slot` 13 · `slot-status` 2 · `missing-docs-counter` 2 · `fallback-notice` 5 · `docs-placeholder` 1 | | 🟢 preserved verbatim through the Unterlagen restyle (as in E-4) | none |
| `input[type=radio][value=…]` | 10 | 🟢 until E-8 chips | re-counted for D5: §5.8 |
| `locator('select')` | 11 | 🟢 until E-8 chips | §5.8 |
| `#care_home_id`, `[name=…]`, auth ids | 30+ | 🟢 never change | none |
| mobile-footer.spec geometry (footer/button `boundingBox` vs viewport at 375×667) | whole spec | 🟠 any shell restructure can disturb the flex chain | the spec **re-runs green in every sub-phase** (standing rule), starting with R2-1 |

### 3.2 The duplicate-DOM strict-mode class (new this round)

D2 + D7 mean several controls exist **twice** in the DOM — a desktop
(sidebar) instance and a mobile (tab row / footer row) instance, one hidden
by CSS at any viewport. CaseTabs keeps both panes mounted by design, and the
same now applies to the nav. A bare `page.locator('[data-testid=tab-documents]')`
then matches 2 elements → Playwright strict-mode failure, before any visual
change is even perceptible.

**R2-0 fix (zero visual change): repoint every read/click of
`tab-questions`, `tab-documents`, `docs-tab-badge` and `legal-footer` onto
visible-filtered locators** (`.locator('visible=true')` /
`.filter({ visible: true })`) — correct today with one element, correct after
R2-1 with two, viewport-agnostic (mobile-footer keeps hitting the tab
instance, desktop specs the sidebar instance). This preserves D7's "numeric
testid contract": `Number(textContent)` still reads a bare number because
both badge instances keep the number alone inside the tagged span.

### 3.3 Structural testids to ADD in R2-0

- `data-testid="save-answer"` on the answer CTA (§3.1 — kills the label
  coupling before the rename).
- `data-testid="app-sidebar"` is NOT added in advance (nothing to tag yet);
  R2-1 introduces it with the element so later phases and galleries can
  target it.

### 3.4 "Weiter" → "Antwort speichern" anchor list (for the R2-3 commit)

Spec sites (10): completion ×1, date-bounds ×2, disability-gate ×1 of its 8
"Weiter" mentions is the role-selector (the rest are comments/`Nein, weiter`
matches), documents-m6 ×1, feedback-pass ×1, m7-regression ×1, mobile-footer
×2, transitive-visibility-fix ×1, visibility ×1. Scripts (3): ui-gallery.mjs,
ui-gallery-chat.mjs, a11y-keyboard-audit.mjs. All 13 become
`getByTestId('save-answer')` in R2-0, so R2-3's rename ships with **zero**
selector edits. `savingButton` ("Speichern …") and `editSaveButton`
("Änderung speichern") stay (no mockup counterpart; the edit-save label is
Roman-authored).

### 3.5 "Dokumente" → "Unterlagen" rename anchors (D4)

- **Specs: zero.** Every tab interaction goes through `tab-documents`
  testids; the only "Unterlagen" strings in specs
  (`'Ihre Unterlagen'`, `'Unterlagen Ihres Partners'`) are the DB group
  headings, which are DIFFERENT full strings — no strict-mode collision with
  the new tab label (getByText there is exact-string on longer text).
- **Code: one value** — `lib/strings/de.ts` `case.tabs.documents:
  'Dokumente' → 'Unterlagen'` (and `tabs.questions: 'Fragen' → 'Angaben'`).
- **Left deliberately unrenamed (FLAG F5):** the DB-authored `docs.*` rows
  keep the word "Dokumente" ("Es fehlen noch {n} Dokumente.", "Alle
  erforderlichen Dokumente sind hochgeladen.", `docs.area_title` "Ihre
  Dokumente", the locked-card docs strings, `case.locked_docs_*`). Renaming
  Roman's authored rows wholesale exceeds "mockup-adopted German"; the
  resulting mixed vocabulary (tab says Unterlagen, pane says Dokumente) is
  flagged for the founder — if unwanted, it is one content migration over
  ~8 `static_content` rows, waiver provenance, founder push.
- Docs/ledger: `german_copy_for_roman.md` gets the round-2 section (§6).

---

## 4. Sub-phase plan with gates

Branch **`ui-round2`**, one commit per sub-phase, preview deploy per push,
**STOP for founder review after every sub-phase**. Standing gates apply to
every sub-phase: full e2e suite vs the branch preview (bypass secret from
`.env.local`; ~3 min expectation, **15-min tripwire** with the infra-
signature check; **machine-stall convention**: documented signature → solo
re-run vs the SAME deployment, cumulative green; **content-readiness poll**
before the first run — a BUILDING deployment answers HTTP 200 with a
placeholder, so readiness = content probe, not status code); unit suite;
`npm run verify`; **mobile-footer.spec green at 375×667 in EVERY sub-phase**;
before/after gallery at 1280×800 + 375×812 into
`ui-gallery/R2-<phase>/`; explicit `git add <paths>`; R8 for any migration
(founder pushes first; this round's rows are the benign missing-row→'' case,
the ''-guards make either order safe, convention keeps migration-first).
E-8 sub-phases and the final pre-merge run are tripwire-exempt
(unconditional full preview suite).

| # | Scope | Migration? | Gallery states | Notes |
| --- | --- | --- | --- | --- |
| **R2-0** | **Hardening, zero visual change**: visible-filter repoints (§3.2), `save-answer` testid + 13 repoints (§3.4) | no | none (no visual diff) — suite green is the gate | prerequisite for everything |
| **R2-1** | **Shell/sidebar + breakpoint**: `lg` sidebar (logo/tagline, Angaben/Unterlagen pills incl. **tab rename D4** + **badge relocation D7**, Hilfe/Abmelden, legal links D6), top brand header hidden at `lg`, mobile byte-identical | no | pre-steps, Fragen, Unterlagen, locked — both viewports | highest-visibility commit of the round; legal-footer.spec 1280 assertion re-target listed in the commit; badge full-opacity fix (§5.3) |
| **R2-2** | **Header/progress (D3)**: name-derived title + fallback, per-tab intro lines, case-meta removal per F1 outcome, patient-banner disposition per F2 outcome, floating %-chip + dot marker, label kept | yes — new `static_content` rows (§6), founder push first | Fragen fresh + mid-flow + name answered, Unterlagen, both viewports | needs founder rulings on **F1, F2** at GO time |
| **R2-3** | **Chat card + answer row**: white card frame, bubble-surface candidate pair (§2.4), autosave hint bubble, CTA rename "Antwort speichern", skip → ghost link "Später beantworten" | yes — autosave row (§6 #5) | fresh, mid-history, edit mode, group prompt, re-ask, all-answered — both viewports | mobile-footer spec is THE gate here; bubble-surface decided from the gallery pair |
| **R2-4** | **Unterlagen**: row/spacing nits to mockup parity, header intro wiring, F3/F4 outcomes | only if F4 says adopt | empty, partial, all-uploaded, fallback-banner case — both viewports | testids preserved verbatim |
| **R2-5** | **Auth alignment**: pixel nits (§2.6), no copy | no | login, signup, reset, update-password, email-sent — both viewports | cheapest phase |
| **R2-6** | **Sweep**: a11y re-audit (sidebar focus order, touch targets, contrast re-verify on built pages), gallery README (German, for Roman), full-suite final pass | no | any touched screens | closes the core round; Roman package point |
| **R2-7** | E-8a: **"Antwort geändert" flash** | yes — flash string row | edit → flash (both viewports) | own STOP, droppable |
| **R2-8** | E-8b: **"Später beantworten" marker** in history | maybe (marker string = skip label, likely reuse) | history with skipped entry | own STOP, droppable; no live mockup reference (§1) — build from code intent |
| **R2-9** | E-8c: **Ändern affordance** (pencil + sent check, "Bearbeiten"→"Ändern") | no (de.ts label) | history bubbles | own STOP, droppable |
| **R2-10** | E-8d: **pill chips** for yes/no + small single-selects | no | chips idle/hover/focus, mobile | LAST deliberately — §5.8 risk re-count; own STOP, droppable |

Merge policy unchanged: nothing reaches `main` without an approved preview;
merge = prod deploy = live verification + state-file entry. A state file
`ui_round2_state.md` is created at R2-0 GO and carries the round.

---

## 5. Risk notes — where the mockup fights reality

1. **Progress dot marker reads as a slider handle** (gallery shot 01: a
   bordered dot riding the fill edge under a % chip). It is decorative in the
   mockup and stays decorative for us. Proposal: keep `role="progressbar"` +
   `aria-valuenow` on the track (shipped E-2 semantics), render chip + dot
   `aria-hidden` with no pointer affordance (`pointer-events-none`, default
   cursor). Explicitly NOT `role=slider` — that would advertise an
   interaction (drag to change progress?) that cannot exist. Residual risk:
   sighted users may still try to drag it once; accepted, monitored via
   Roman/pilot feedback.
2. **Disabled-CTA contrast.** The mockup's `disabled:opacity-40` measures
   **1.27:1** (white on copper-40-over-white) — functionally invisible
   (visible in gallery shots 01/04). WCAG 1.4.3 exempts disabled controls,
   but a caregiver still needs to find the button they must enable. Our
   shipped `disabled:opacity-50` (1.47:1) is barely better. Proposal for
   R2-3's gallery: explicit disabled recipe `bg-cream-deep
   text-graphite-soft` (**5.21:1**, clearly present, clearly inactive) vs
   keeping opacity-50 — decided visually at the STOP.
3. **Copper pill + relocated badge (D7), measured in-engine** (all ratios
   computed from the deployed token values this session):
   - white text on copper pill **4.69:1** ✅ AA; copper fill vs the sidebar
     surface (sage-soft/40 over cream = `#e5e9e1`) **3.81:1** ✅ ≥3:1
     (1.4.11) — the active pill is safe as designed.
   - the badge must NOT keep its current 80 % opacity in the sidebar:
     white/80 on copper = **3.57:1** ❌ and graphite-soft/80 on the inactive
     pill = **3.58:1** ❌ at text-sm. **Pre-existing finding:** today's
     shipped badge (`text-graphite-soft/80 text-sm` on cream) is itself
     **3.72:1** — an AA miss that predates this round. Fix in R2-1: badge at
     FULL opacity everywhere — white on copper 4.69:1, graphite-soft on the
     inactive pill ≈5.1:1, and the mobile tab badge to full graphite-soft
     (5.70:1) in the same commit.
   - inactive pill boundary (`bg-background/60` fill 1.07:1, `sage/50`
     border 1.25:1 vs the sidebar surface) is far under 3:1 — tolerable
     under 1.4.11 only because the AA-passing label identifies the item.
     R2-1's gallery renders a second candidate with the `--input` (#8c8272)
     border for the founder to choose.
4. **Viewport-locked chat shell vs the sidebar — the mobile-footer bug must
   not return.** The mockup's chat is one card with `max-h-[calc(100vh-320px)]`
   and the **active input inline in the scroll** — exactly the geometry class
   that clipped the save buttons on real phones (2026-08-11 field bug). We
   adopt the card's LOOK only: the shell stays our h-dvh flex column
   (case-header shrink-0 / history flex-1 scroll / answer-footer shrinkable
   with own overflow), wrapped in the white rounded frame at `lg`+. The
   sidebar is a flex-row sibling and never changes that vertical chain.
   Guard: mobile-footer.spec every sub-phase (§4) — it asserts exactly this
   geometry at every multiselect.
5. **White-on-white assistant bubbles.** In the mockup the assistant bubble
   is white ON the white chat card — **1.00:1**, separation by shadow only
   (confirmed in the gallery). Not copied; §2.4 carries the two candidate
   treatments for the R2-3 gallery.
6. **Autosave notice vs the fallback banner and the sage family.** No direct
   collision — the fallback banner lives on the Unterlagen pane, the autosave
   notice in the chat. The real risk is sage-hint inflation on the Fragen
   pane (patient banner + autosave + re-ask note all sage). Mitigation: F2
   retires the patient banner into the header intro, leaving at most one
   sage hint in the history (autosave) plus the transient re-ask note.
7. **Duplicate-DOM strict-mode breakage** — §3.2; neutralised in R2-0 before
   any structure moves.
8. **E-8 chips re-count (D5's re-assessment).** Today's anchors on native
   controls: `input[type=radio]` **10** + `locator('select')` **11** = **21**
   (the ticket's "~25" was close). But the honest scope statement: chips
   should replace yes/no radios and SMALL single-selects only (mockup
   maximum: 4 options). Our single-selects include 97-option year pickers
   and the 195-option country list — chips there would be absurd, so native
   selects survive for large option sets (proposed cutoff ≤5 options) and
   roughly half the `select` anchors keep working. Realistic breakage: 10
   radio anchors + ~5–6 select anchors, PLUS the non-selector costs that
   remain the dominant risk: one-click-submit replaces select-then-save
   (flow semantics), and native radio keyboard/AT behaviour must be rebuilt
   by hand (roving tabindex, arrow keys, `role=radiogroup`). Chip visual
   spec also fails our floor as-is: the petrol/30 border is 1.63:1 → ship
   with `--input`-grade or full-petrol border. Recommendation stands: R2-10
   last, own STOP, droppable if Roman's reaction to R2-1..6 doesn't demand
   it.
9. **The name-title edge cases (D3).** Skipped/unanswered names → fallback
   title (existing subheading row, verbatim). Names answered then edited →
   title follows on the next server render (`router.refresh()` after save —
   already wired). Whitespace-only answers are impossible (`short_text`
   required + server validation). A locked case always has both names
   (required questions) → locked screens show the personal title.

---

## 6. Adopted-German inventory (D4)

Provenance for every item: **"approved by Erman 2026-08-14, Roman review
waived."** All rows below go into `docs/document-rules/german_copy_for_roman.md`
(round-3 section) at R2-1 GO so the ledger and this report agree. New DB
strings ship as `static_content` rows (rule #2); `de.ts` is used only where
the string it replaces already lives there.

| # | German (verbatim) | Mockup source | Lands where | Replaces | Sub-phase |
| --- | --- | --- | --- | --- | --- |
| 1 | `Unterlagen` (nav/tab label) | AppShell tabs | `de.ts case.tabs.documents` | "Dokumente" | R2-1 |
| 2 | `Angaben` (nav/tab label) | AppShell tabs | `de.ts case.tabs.questions` | "Fragen" | R2-1 |
| 3 | `Antrag für {Vorname} {Nachname}` (title pattern — only "Antrag für " is new prose) | AppShell/AppHeader title | new `static_content` `case.header_title_pattern` | additive; fallback = existing `case.subheading` verbatim | R2-2 |
| 4 | `Laden Sie die Unterlagen hoch, die Ihnen bereits vorliegen. Wir prüfen alles und melden uns, falls etwas fehlt.` (Unterlagen intro) | unterlagen.tsx subtitle | new `static_content` `case.header_intro_documents` | additive | R2-2 |
| 5 | `Ihre Angaben werden automatisch gespeichert. Sie können jederzeit pausieren.` (autosave notice) | index.tsx HINTS | new `static_content` `case.autosave_notice` | additive | R2-3 |
| 6 | `Antwort speichern` (save CTA) | ActiveAnswer submit | `de.ts case.chat.nextButton` | "Weiter" | R2-3 |
| 7 | `Später beantworten` (skip control) | ActiveAnswer skip link | `de.ts case.chat.skipButton` | "Weiß ich gerade nicht" (old value recorded here) | R2-3 |
| 8 | `Antwort geändert` (flash) | index.tsx flash | new `static_content` (or de.ts) `case.answer_changed_flash` | additive | R2-7 (E-8a) |
| 9 | `Später beantworten` (history skip marker — same string as #7) | index.tsx skipped notice | reuse #7 | replaces de.ts `skippedBadge` "Übersprungen" if that path revives | R2-8 (E-8b) |
| 10 | `Ändern` (edit affordance) | BubbleUser | `de.ts case.chat.editButton` | "Bearbeiten" | R2-9 (E-8c) |

**Deliberately NOT adopted (each needs its own founder call — the waiver
covers adopted strings, not replacements of Roman's authored content):**

- Angaben header intro: **reuses the existing Roman row**
  `case.patient_banner_body` instead of the mockup's near-identical sentence
  (§2.3, FLAG F2 — the only decision is retiring the banner, not new text).
- The Unterlagen intro's second mockup sentence "Vor der Einreichung fragen
  wir Sie immer nach Ihrer Freigabe." — **product claim we cannot make**
  (FLAG F3).
- "Datei auswählen" / "Ersetzen" / "Entfernen" — §2.5 (FLAG F4; "Ersetzen"
  is also behaviour).
- The `docs.*` vocabulary ("… Dokumente.") — §3.5 (FLAG F5).
- Auth copy, consent texts, `/fertig` steps, 404 texts — already authored,
  live, and aligned; zero changes.
- Already-identical, zero-change confirmations: sidebar tagline
  (= `brand.tagline`), "Hilfe" (= `contact.help_button`), "Abmelden"
  (= `de.case.logoutButton`), fallback title (= `case.subheading`).

**Open founder flags collected: F1** (drop case-id/PLZ/status from the
header) · **F2** (header intro reuses banner body; banner retired) · **F3**
(Freigabe sentence not adopted) · **F4** (upload-button wording stays "Datei
hochladen") · **F5** (docs.\* keep "Dokumente" vocabulary for now). Each has
a stated default the sub-phases will follow unless overruled at the GO.

---

*Phase 1 ends here. No implementation has started; branch `ui-round2` does
not exist yet. Awaiting the R2-0 GO (and rulings on F1–F5 where the defaults
don't suit).*
