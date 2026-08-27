# Mobile UI Pass — Round 3, Phase 1: read-only discovery

> Written 2026-08-27. Read-only: no code, no DB access, no migrations. The
> only write of this phase is this file. Gate 1 is below — nothing is
> implemented until the founder answers the GATE QUESTIONS and types
> "GATE 1 APPROVED".
>
> Sources: the embedded mockup description in the session brief
> (`docs/mockups/mobile-round3/` does not exist — no PNGs in the repo;
> `docs/session-context.md` does not exist either), the shipped code on
> `main` (28f953e), and the UI Round 2 record
> (`docs/feedback/ui_round2_phase1.md`, `clickup_ui_round2.md`,
> migration `20260814000001`).

---

## P1-1 · Inventory of the current mobile UI (below `lg` / 1024px)

The case screen is one `h-dvh` locked flex column ([page.tsx:93](../../app/case/page.tsx))
— no page scroll; all scrolling is internal. Top to bottom on mobile:

1. **Brand top bar** ([page.tsx:107-146](../../app/case/page.tsx)) —
   `lg:hidden`. Left: `logo.svg` lockup (icon + "Sorglos Antrag" wordmark,
   `data-testid=brand-logo`) + the DB tagline (`brand.tagline`) in 11px
   graphite-soft. Right: **Hilfe** (HelpSheet dialog trigger,
   [help-sheet.tsx](../../app/case/help-sheet.tsx)) and **Abmelden**
   (form posting to `logoutAction`, [actions.ts:14](../../app/case/actions.ts:14)),
   both as small ghost buttons. There is **no burger** and **no applicant
   name** in this bar.
2. **Mobile tab row** ([case-tabs.tsx:211-234](../../app/case/case-tabs.tsx:211)) —
   `lg:hidden`, pinned (`shrink-0`), `role=tablist`. Two text tabs
   **Angaben | Unterlagen** (`data-testid=tab-questions` / `tab-documents`)
   in the E-2 treatment: active = petrol text + short petrol underline;
   inactive = graphite-soft. NOT pills, no icons. The Unterlagen tab
   carries the "· n offen" badge (`docs-tab-badge`). Both panes stay
   mounted; CSS-hidden switching (client state in `CaseTabs`).
3. **Angaben pane** = `ChatView` ([chat-view.tsx](../../app/case/chat-view.tsx)):
   - pinned `case-header` strip containing only the **progress bar**
     (`{n} von {m} Fragen beantwortet` label + sage track, petrol fill,
     floating petrol %-chip and dot marker riding the fill edge —
     chat-view.tsx:103-159);
   - the scrollable **chat history wrapped in one white card**
     (`card` = `bg-card rounded-2xl shadow-card`, chat-view.tsx:1050-1102).
     Inside the scroller, top to bottom: the mobile copy of the shell
     header — **h1 title** (`Antrag für {Vorname} {Nachname}` via
     [case-header.ts](../../lib/case-header.ts), fallback
     `case.subheading` = "Mein Hilfe zur Pflege Antrag") and the **intro
     line** (`case.patient_banner_body`) — then the **autosave notice**
     (sage hint bubble, `case.autosave_notice`, currently static/always),
     then the bubble transcript;
   - the pinned, shrinkable **answer footer** (`answer-footer`) with the
     current question card / all-answered card / locked card. Its flex
     chain is the fix for the 2026-08-11 mobile field bug
     (chat-view.tsx:1109-1122) and is load-bearing.
4. **Unterlagen pane** ([case-tabs.tsx:238-260](../../app/case/case-tabs.tsx:238)):
   one scroller (`bg-muted/40`) containing the mobile header copy — same
   h1 + `case.header_intro_documents` intro — then `DocumentArea`
   ([document-area.tsx](../../app/case/document-area.tsx)): h2
   `docs.area_title`, missing-count line, `docs.area_intro` sentence,
   then per-subject groups, each a **white card** with hairline-divided
   rows (doc icon medallion, `name_de`, status line `docs.status_missing`
   ("Fehlt") / `docs.status_uploaded`, and the `docs.upload_button`
   ("Datei hochladen") outline button). **No progress bar in this pane** —
   deliberately (case-tabs.tsx:171-175: the mockup's bar folds uploads
   into a number we don't measure).
5. **Legal footer bar** ([page.tsx:231-233](../../app/case/page.tsx:231),
   [legal-footer.tsx](../../components/legal-footer.tsx)) — `lg:hidden`,
   pinned bottom row: Impressum · Datenschutz · AGB.

Desktop (`lg`+): sage sidebar (logo/tagline top; **pill nav** — copper
fill active with white text, outlined inactive, Pencil/FileText icons
right; Hilfe/Abmelden/legal foot) + pinned shell header (title + intro) +
panes. Untouched by this pass except the global palette rule.

---

## P1-2 · Requirement diff (R6 withdrawn — skipped)

| Req                                             | Classification                    | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ----------------------------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **R1** header shows applicant name              | **PARTIAL**                       | The name machinery is shipped and live: DB row `case.header_title_pattern` = `Antrag für {first_name} {last_name}` (migration 20260814000001), resolved in [case-header.ts](../../lib/case-header.ts), fallback `case.subheading`. But on mobile it renders as an h1 **inside each pane's scroller** (chat-view.tsx:1061-1070, case-tabs.tsx:243-256), not in the top bar. The mockup's top bar shows the name beside the burger; today's top bar shows logo + tagline instead. NEW: top-bar placement.                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| **R2** burger side menu                         | **NEW**                           | No burger, no side menu anywhere. All five ingredients exist to be reused: Hilfe = HelpSheet trigger (`contact.help_button`); Roman photo = HelpSheet's `photoSrc` drop-in slot is ready but **no photo asset exists** (ledger: "Roman will send later", german_copy_for_roman.md); tel machinery = HelpSheet builds `tel:` hrefs (help-sheet.tsx:114); logo = `public/logo.svg`; Logout = `logoutAction` (actions.ts:14). A slide-over/bottom-sheet pattern already exists via `@base-ui/react/dialog` (HelpSheet). Reverses UI-R2 decision D2 — founder-confirmed in the brief. See P1-3. ⚠ Phone-number conflict: see P1-6/GATE Q4.                                                                                                                                                                                                                                                                                                     |
| **R3** Angaben subheader (verbatim)             | **PARTIAL, with a copy conflict** | The subheader slot exists and renders exactly where R3 wants it (`introQuestions` = `case.patient_banner_body`). But the live DB string reads "…sie ist **der** Antragsteller." while the R3 target reads "…sie ist Antragsteller." — one word ("der") apart. UI Round 2 (F2) **deliberately kept Roman's row** over the mockup's near-identical sentence ("his grammar wins", migration 20260814000001 header, ledger §"Deliberately NOT changed"). R3 as given supersedes that — but it requires a `static_content` UPDATE (data change → P1-8 flag, GATE Q2).                                                                                                                                                                                                                                                                                                                                                                           |
| **R4** Angaben/Unterlagen pills                 | **PARTIAL**                       | The two-tab switcher is shipped with the right labels (`de.case.tabs` = Angaben/Unterlagen), correct testids, badge, and both-panes-mounted architecture. The **pill treatment exists only on desktop** (case-tabs.tsx:101-106 — copper fill active + white text + icons, exactly the mockup's). Mobile has the underline tab-row pinned above the panes, not pill buttons below the subheader. NEW: mobile pill styling + placement below the subheader.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| **R5** chat in white box                        | **DONE**                          | R2-3 shipped it: the transcript scroller is one white card (`card` = `bg-card` #ffffff, rounded-2xl, petrol-tinted shadow — chat-view.tsx:1050-1054). Note: under R8 the white becomes #FFFDFA (see P1-4).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| **R7** autosave infobox, scroll-dismiss         | **PARTIAL — behavior reversal**   | The string is live in DB **byte-identical** to the R7 target (`case.autosave_notice`, migration 20260814000001:42). The behavior differs: it renders **statically on every visit**, never dismissed — an explicit R2-3 decision ("the mockup hides it on scroll, which is demo behaviour we do not adopt", chat-view.tsx:1072-1077 + migration comment). R7 reverses that: founder-confirmed. Scroll-dismiss + per-login session state is NEW; feasibility confirmed in P1-7.                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| **R8/R11** brand palette, global                | **PARTIAL**                       | 2 of 6 brand colors are already exact: `--petrol` #245b5a = Dark green #245B5A; `--copper` #c44f15 = Orange #C44F15. The other four are near-misses: graphite #2c2f32 ≠ Black **#2F2B2C** (digits transposed), cream #f7f4ed ≠ **#F8F3EB**, card white #ffffff ≠ **#FFFDFA**, and neither sage #a9bfae nor sage-soft #cbd8ce equals Light green **#DDE8DE**. Beyond those, ~20 off-palette values exist (soft/hover variants, split border tokens, destructive red, scaffold tokens, a dead dark-mode block, Tailwind's `text-white`). Full audit + proposed mapping in P1-4.                                                                                                                                                                                                                                                                                                                                                              |
| **R9** docs subheader (verbatim)                | **DONE**                          | DB row `case.header_intro_documents` is byte-identical to the R9 target (migration 20260814000001:38) and renders as the docs-pane intro on mobile (case-tabs.tsx:250-254) and desktop (shell header).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| **R10** docs line below progress bar (verbatim) | **NEW — needs a data change**     | The target string exists nowhere in the repo (grep over code + migrations: no match for "mehrere Dateien" / "Vor der Einreichung prüfen wir"). The nearest current copy is `docs.area_intro` = "Bitte laden Sie die folgenden Unterlagen hoch. Erlaubt sind PDF, JPG, PNG und HEIC bis 15 MB pro Datei." Two open points: (a) German text is data (CLAUDE.md #2), so shipping R10 verbatim requires a `static_content` change — P1-8 flag; (b) R10 anchors "below the progress bar", but **the docs page has no progress bar today** (deliberate, case-tabs.tsx:171-175). The mockup shows one ("50%" dark green above a bar). Whether the docs pane gains its own bar — and what it measures — is GATE Q3. Note: this is the slot whose OLD mockup sentence ("…fragen wir Sie immer nach Ihrer Freigabe.") was rejected in UI R2 as F3 (over-promise); the R10 text has no such problem and the brief marks it as superseding the mockup. |

---

## P1-3 · Decision-reversal analysis for R2 (and neighbors)

**Current mobile nav in detail** — the shipped pattern is UI Round 2's D2
("Below `lg` nothing changes: today's shipped mobile/tablet UI stays
as-is … The mockup's sage mobile header block, hamburger sheet and mobile
pill tabs are **not adopted**", ui_round2_phase1.md §2.2):

- Top bar members: logo lockup + tagline (left), Hilfe + Abmelden (right).
- Nav: pinned underline tab-row (Angaben | Unterlagen + badge) directly
  under the top bar.
- Legal links: pinned bottom bar (Impressum · Datenschutz · AGB).

**What the burger side menu removes/relocates on mobile:**

| Element                   | Today                                        | After R2 (mockup order)                                                        |
| ------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------ |
| Logo + brand name         | top bar, always visible                      | inside the menu (item 4: "company logo + name") — hidden until opened          |
| Tagline (`brand.tagline`) | top bar, always visible                      | **no home in the menu spec** — presumably dropped on mobile (GATE Q5)          |
| Hilfe                     | top-bar ghost button                         | menu item 1 (target per GATE Q1)                                               |
| Abmelden / Logout         | top-bar ghost button (form → `logoutAction`) | menu item 5, same action reused                                                |
| Roman photo               | not shown (HelpSheet initials avatar)        | menu item 2 — placeholder image asset (ledger entry)                           |
| Phone tap-to-call         | inside HelpSheet only (`contact.phone`)      | menu item 3, `tel:+491789125300` pictogram link                                |
| Angaben/Unterlagen        | pinned underline tab-row                     | pill buttons below the subheader (R4) — no longer in a chrome bar of their own |
| Applicant name            | h1 inside pane scrollers                     | top-bar title beside the burger (R1)                                           |
| Legal footer bar          | pinned bottom                                | not in the menu spec — assume it stays (GATE Q5)                               |

**Decisions this pass contradicts** (all UI Round 2 unless noted):

1. **D2** (mobile = top-bar + tabs; hamburger explicitly not adopted) —
   reversed by R2/R4. Founder-confirmed in the brief; recorded here.
2. **R2-3's static autosave notice** ("demo behaviour we do not adopt") —
   reversed by R7. Founder-confirmed via R7's explicit dismiss spec.
3. **F2 / "Roman's grammar wins"** (Angaben intro reuses
   `case.patient_banner_body` verbatim, incl. "der") — contradicted by
   R3's verbatim target unless the founder keeps the row (GATE Q2).
4. **D7** (badge placement: mobile keeps it on the underline tab) —
   superseded mechanically: the badge moves onto the mobile Unterlagen
   pill. Desktop pill already renders it (`tone=onCopper`), so this is
   reuse, not new design.
5. **D3's mobile-header height rule** — not reversed, but constrained:
   R2-2 deliberately kept title/intro INSIDE the scrollers because every
   pinned pixel above the answer footer comes out of its height on a
   667px viewport (the 2026-08-11 field bug; pinned-copy comment in
   case-tabs.tsx:177-187). R1/R3/R4 move title, subheader and pills into
   (or toward) pinned chrome. Mitigation in Phase 2: the top bar swaps
   logo+tagline for the title at roughly equal height; the
   subheader+pills block should either stay inside the scrollers or its
   added pinned height must be re-verified against
   `mobile-footer.spec.ts` (375×667) before Gate 2.
6. **D6** (legal links: mobile bar / desktop sidebar-foot) — untouched
   unless GATE Q5 says otherwise.

**e2e blast radius** (Playwright is Desktop-Chrome-project only; mobile
coverage is explicit `setViewportSize` inside specs):

- `tab-questions` / `tab-documents` / `docs-tab-badge` are read `:visible`
  in completion, documents-m6, fallback-notice, feedback-pass,
  m7-regression, mobile-footer specs — the mobile pills must keep these
  testids and roles (same rule as the sidebar pills, case-tabs.tsx:28-31).
- `feedback-pass.spec.ts:428` asserts the badge at 375px — survives if
  the mobile pill renders `DocsBadge`.
- `auth.spec.ts:281` clicks the "Abmelden" button at the default desktop
  viewport → resolved by the sidebar instance; unaffected.
- `legal-footer.spec.ts:114` asserts `brand-logo:visible` at the default
  desktop viewport (before its viewport loop) → satisfied by the sidebar
  logo; the 375/320 loop only measures the footer box. If the founder
  keeps the mobile bottom bar (GATE Q5), no spec change expected.
- `mobile-footer.spec.ts` (375×667 reachability asserts) is the
  regression gate for any pinned-chrome height change — must pass in P2-6.

---

## P1-4 · Global palette audit (change nothing — table only)

Brand targets: Black `#2F2B2C` · Orange `#C44F15` · Dark green `#245B5A`
· Light green `#DDE8DE` · Cream `#F8F3EB` · White `#FFFDFA`.

All app color values live in [globals.css](../../app/globals.css) (tokens),
[global-error.tsx](../../app/global-error.tsx) (inline styles — this file
renders without the CSS pipeline by design), and Tailwind's own `white`
via `text-white` utilities. No other hex/oklch/rgb literals exist in
`app/`, `components/`, or `lib/` (grep verified). Tailwind v4 is CSS-first;
there is no tailwind.config with extra colors.

### Exact matches (keep)

| Token                             | Value                  | Brand                              |
| --------------------------------- | ---------------------- | ---------------------------------- |
| `--petrol`, `--primary`, `--ring` | #245b5a                | Dark green ✓                       |
| `--copper`                        | #c44f15                | Orange ✓                           |
| `--shadow-card`/`-lg`             | rgb(36 91 90 / .25/.3) | Dark green at alpha ✓ (see note A) |

### Off-palette values → proposed mapping (globals.css `:root` unless noted)

| #   | Token / site                                                                                                                          | Current                                  | Proposed                                      | Flag                                                                                                                                                                                                                     |
| --- | ------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | `--graphite`, `--foreground`, `--card-foreground`, `--popover-foreground`, `--secondary-foreground`, `--accent-foreground` (:100-113) | #2c2f32                                  | Black #2F2B2C                                 | near-identical; safe                                                                                                                                                                                                     |
| 2   | `--graphite-soft`, `--muted-foreground` (:96,111)                                                                                     | #5c6166                                  | Black #2F2B2C **or** Black at alpha (note A)  | ⚠ muted-text hierarchy: dozens of sites use graphite-soft as secondary text; full Black flattens the hierarchy. All documented contrast measurements (styles.ts, code comments) must be re-measured in Phase 2.          |
| 3   | `--cream`, `--background`, `--primary-foreground` (:97,100,107)                                                                       | #f7f4ed                                  | Cream #F8F3EB                                 | safe (page ground)                                                                                                                                                                                                       |
| 4   | `--cream-deep`, `--secondary`, `--muted` (:98,108,110)                                                                                | #efeadd                                  | Cream #F8F3EB or Light green #DDE8DE          | ⚠ cream-deep is the assistant chat bubble + neutral medallions + hover fills — mapping it to page-cream erases the bubble/page separation R2-3 was asked to fix; Light green re-tones it. Founder's call at gate (Q6c).  |
| 5   | `--card`, `--popover` (:102,104)                                                                                                      | #ffffff                                  | White #FFFDFA                                 | safe                                                                                                                                                                                                                     |
| 6   | `--sage`, `--accent` (:91,112)                                                                                                        | #a9bfae                                  | Light green #DDE8DE                           | desktop sidebar bg/borders (out of mobile scope but rule is global)                                                                                                                                                      |
| 7   | `--sage-soft` (:92)                                                                                                                   | #cbd8ce                                  | Light green #DDE8DE                           | hint bubbles, progress track, done-row tint                                                                                                                                                                              |
| 8   | `--petrol-soft` (:90)                                                                                                                 | #2f7371                                  | Dark green #245B5A (or alpha variant, note A) | ⚠ loses the `btnPetrol` hover distinction                                                                                                                                                                                |
| 9   | `--copper-hover` (:94)                                                                                                                | #a34111                                  | Orange #C44F15 (or alpha/darken, note A)      | ⚠ loses the primary-CTA hover distinction                                                                                                                                                                                |
| 10  | `--border` (:130)                                                                                                                     | #e6e0d0                                  | Light green #DDE8DE or Cream #F8F3EB          | decorative dividers; visual check needed                                                                                                                                                                                 |
| 11  | `--input` (:131)                                                                                                                      | #8c8272                                  | Black #2F2B2C (or Black at alpha, note A)     | ⚠ E-2's WCAG 1.4.11 token split: control edges need ≥3:1. Black passes everywhere but reads heavy; an alpha tint must be re-measured.                                                                                    |
| 12  | `--destructive` (:114)                                                                                                                | oklch(0.577 0.245 27.325) (red)          | **no brand equivalent**                       | 🚩 GATE Q6a. Error text/borders across auth + case forms (20 sites). Orange #C44F15 is the nearest brand hue but collides with the primary-CTA color (the semantic rule in styles.ts reserves red for genuine errors).   |
| 13  | `--chart-1…5` (:133-137)                                                                                                              | oklch grays                              | delete                                        | unused shadcn scaffold                                                                                                                                                                                                   |
| 14  | `--sidebar-*` (:139-146)                                                                                                              | oklch grays                              | delete                                        | unused shadcn scaffold (the real sidebar uses sage tokens)                                                                                                                                                               |
| 15  | `.dark` block (:149-181)                                                                                                              | all oklch                                | delete (or map)                               | dead: nothing ever sets the `dark` class (layout.tsx renders `<html>` without it). Deleting is the honest R8 outcome.                                                                                                    |
| 16  | Tailwind `text-white` / `#fff`                                                                                                        | #ffffff                                  | White #FFFDFA                                 | 8 utility sites (styles.ts:70, case-tabs.tsx:58,104, chat-view.tsx:148,272,481, document-area.tsx:227, help-sheet.tsx:103) + global-error.tsx:49. Phase-2 route: register a brand white token and migrate the utilities. |
| 17  | global-error.tsx inline styles (:27,36,41,48,49)                                                                                      | #f7f4ed, #2c2f32, #5c6166, #245b5a, #fff | corresponding brand values                    | keep inline (file must not depend on the CSS pipeline); update literals + its palette comment.                                                                                                                           |

**Note A — interpretation needed (GATE Q6b):** "No other color values
anywhere" taken literally forbids alpha/derived tints of the six brand
colors — but the app leans on them structurally: token opacity utilities
(`sage-soft/40`, `bg-background/95`, `border-border/60`, `bg-graphite/40`
backdrop…), the petrol-tinted card shadows, hover shades (#a34111,
#2f7371), and the muted-text tone. Recommendation: allow the six brand
colors **plus alpha variants of them**, and re-derive hovers as alpha or
brand-on-brand mixes; forbid only foreign hues. Contrast documented today
(styles.ts and component comments) is measured against the OLD values —
every claim touched by the remap gets re-measured in Phase 2, not
inherited (CLAUDE.md "stated reason must be a verified reason").

---

## P1-5 · German copy diff (R3, R7, R9, R10)

| Req | Target (founder, verbatim)                                                                                         | Current string                                                                                                                         | Where it lives                                                                | Verdict                                                                                                                                                                                                                                         |
| --- | ------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R3  | "Die folgenden Fragen beziehen sich ausschließlich auf die Person, die im Pflegeheim lebt, sie ist Antragsteller." | "Die folgenden Fragen beziehen sich ausschließlich auf die Person, die im Pflegeheim lebt, sie ist **der** Antragsteller."             | DB `static_content` key `case.patient_banner_body` (seeded 20260703000002:30) | **Differs by one word ("der")** → GATE Q2; if target wins, it's a one-line UPDATE data change (founder pushes).                                                                                                                                 |
| R7  | "Ihre Angaben werden automatisch gespeichert. Sie können jederzeit pausieren."                                     | identical                                                                                                                              | DB key `case.autosave_notice` (20260814000001:42)                             | **Byte-identical — no copy work.** Only behavior changes.                                                                                                                                                                                       |
| R9  | "Laden Sie die Unterlagen hoch, die Ihnen bereits vorliegen. Wir prüfen alles und melden uns, falls etwas fehlt."  | identical                                                                                                                              | DB key `case.header_intro_documents` (20260814000001:38)                      | **Byte-identical — done.**                                                                                                                                                                                                                      |
| R10 | "PDFs, Fotos und mehrere Dateien pro Unterlage sind möglich. Vor der Einreichung prüfen wir alle Ihre Unterlagen." | nearest: `docs.area_intro` = "Bitte laden Sie die folgenden Unterlagen hoch. Erlaubt sind PDF, JPG, PNG und HEIC bis 15 MB pro Datei." | DB key `docs.area_intro` (20260711000005:98)                                  | **Target exists nowhere in the repo** → new/updated `static_content` value needed → GATE Q3 + P1-8 flag. The old sentence carries real constraints (allowed types, 15 MB) that R10's text does not repeat — replace or keep both is part of Q3. |

Copy rules honored: targets are quoted character-for-character from the
brief, including "sie ist Antragsteller" (no grammar "fix"). Any
additional German Phase 2 needs (burger `aria-label`, menu close label —
though `de.case.help.closeLabel` "Schließen" may be reusable) will be
PLACEHOLDER_DE + ledger entries.

---

## P1-6 · Asset & link inventory

- **Company logo:** `public/logo.svg` — Roman's lockup (icon +
  "Sorglos Antrag" wordmark), used in the auth layout and twice in
  page.tsx. So the menu's "logo + name" is likely the lockup alone;
  `de.brand.name` exists if a separate text name is wanted. `public/logo.jpg`
  also exists but is referenced nowhere in code (source/original —
  unused). The other `public/` svgs are Next.js scaffold leftovers.
- **Logout:** `logoutAction` (app/case/actions.ts:14) — a Server Action;
  the menu must render it as a `<form action={logoutAction}>` exactly as
  the top bar and sidebar do today (which is why the shell receives
  server-rendered chrome as props — case-tabs.tsx:23-27; the burger menu
  will need the same pattern).
- **"Hilfe" targets available:** only the HelpSheet contact dialog
  (help-sheet.tsx — Ansprechpartner card: name, phone, email, initials
  avatar with a ready `photoSrc` slot). There is no FAQ/help page or
  component anywhere. → GATE Q1.
- **tel: link:** `tel:+491789125300` is the correct RFC-3966 form of
  +49 178 9125300 (spaces stripped, `+` kept). ⚠ **Conflict:** the live
  contact row `contact.phone` = `0159 0469 5761` (migration
  20260801000001:92) — a _different number_ — and HelpSheet renders it as
  `tel:015904695761`. The burger's call icon would dial a number the
  Hilfe card doesn't show. → GATE Q4.
- **Roman photo:** no photo asset in the repo; ledger records "Roman will
  send later" (german_copy_for_roman.md, Still-open table). Plan per R2:
  commit a **placeholder image asset** (neutral avatar graphic, clearly
  non-personal), wire it in the menu, add a ledger entry "placeholder
  pending Roman's real photo"; HelpSheet's `photoSrc` slot can take the
  real file later with zero code change.

---

## P1-7 · R7 feasibility (pure client state)

Confirmed feasible with no DB and no new persistence surface:

- The notice already renders at the head of the chat scroller from a DB
  row and ''-degrades (chat-view.tsx:1078-1083). ChatView is a Client
  Component; the scroller is `historyRef` — a scroll listener on it can
  flip local state to hide the box. The docs pane never shows it
  (unchanged).
- **"Per login session" detection:** login is a Server Action redirect to
  `/case`; nothing client-side marks "session start" today. Proposal:
  `sessionStorage` flag (e.g. `autosave-notice-dismissed`) — set on
  scroll-dismiss, checked on mount; cleared on the login page's mount so
  a fresh login re-shows it. sessionStorage is tab-scoped and dies with
  the browser session — "session-only, no persistence" in the sense the
  brief uses (nothing server-side, nothing that outlives the visit). A
  pure useState alternative (no storage at all) would re-show the box on
  every reload/tab-switch-refresh, which reads as noise; flagged as the
  fallback if the founder reads "no persistence" as "no storage of any
  kind".
- ⚠ **Implementation trap for Phase 2:** the scroller auto-scrolls to the
  bottom whenever `answeredCount` changes — including initial mount
  (chat-view.tsx:729-733). A naive scroll listener would insta-dismiss
  the notice for every returning user via that _programmatic_ scroll.
  The dismiss must ignore programmatic scrolls (e.g. suppress until
  first user gesture, or compare against the auto-scroll target).
- No X button, no timer — exactly as specified.

---

## P1-8 · DB / migration surface

**Schema surface: zero.** Confirmed — every requirement is
layout/behavior/theme except copy, and no new tables/columns are implied.
Palette, burger, pills, infobox: all pure code.

**Data surface: NOT zero as specified — STOP-flagged, no migration
drafted** (per the brief's instruction):

1. **R10 requires a `static_content` change** — the target sentence
   exists in no row; it either replaces `docs.area_intro`'s value or
   lands as a new row (GATE Q3 decides which, and what happens to the
   old type/size hint).
2. **R3 requires a `static_content` UPDATE** _if_ the founder confirms
   the target supersedes Roman's "der"-version (GATE Q2). If Roman's row
   stands, R3 is zero-surface.
3. **GATE Q4 may touch `contact.phone`** (data row) if the founder wants
   one number everywhere.

All three are row-value edits in the config table — the benign class
under CLAUDE.md #8 (missing/old rows degrade gracefully; ''-guards
everywhere), and the founder pushes any migration manually. Nothing in
this pass needs schema-before-code ordering.

---

## GATE QUESTIONS

1. **What should "Hilfe" in the burger menu open?** The only existing
   target is the HelpSheet contact dialog (Roman card: name, phone,
   email). Recommendation: reuse it unchanged. If instead it should open
   a page/FAQ, that page does not exist and its German is unauthored
   (would be PLACEHOLDER_DE).
2. **R3 vs Roman's live row:** the target drops the "der" from
   `case.patient_banner_body` ("…sie ist Antragsteller."). UI Round 2
   kept Roman's version on the record "his grammar wins". Does R3's text
   supersede it (→ one-line UPDATE you push), or does the live row stand?
3. **R10 placement and the docs progress bar:** (a) Should the mobile
   docs pane gain its own progress bar per the mockup — and if so, what
   does the percentage measure (uploaded/required documents? something
   else)? Today no docs bar exists, deliberately. (b) Does the R10
   sentence REPLACE `docs.area_intro`'s current value, or sit alongside
   it? The old sentence is the only place stating allowed file types and
   the 15-MB limit — drop that information or keep it somewhere?
4. **Phone number:** the burger's tap-to-call is specified as
   `tel:+491789125300` (+49 178 9125300), but the live Hilfe card shows
   and dials `contact.phone` = 0159 0469 5761. Two numbers on purpose
   (new number burger-only), or should `contact.phone` be updated to
   match (data change you push)?
5. **Mobile chrome leftovers:** with the top bar showing burger + title,
   (a) the tagline has no home on mobile — drop it below `lg`? (b) the
   legal-links bottom bar isn't in the menu spec — keep it pinned at the
   bottom as today, or move Impressum/Datenschutz/AGB into the burger
   menu?
6. **Palette strictness (R8):** (a) Errors/validation currently use an
   off-palette red (`--destructive`, ~20 sites) — map errors to Orange
   #C44F15 (colliding with the primary-CTA color), or keep red as a
   semantic exception to R8? (b) Are **alpha/tint variants of the six
   brand colors** allowed (hover shades, overlays, soft washes, tinted
   shadows)? Strictly-six-only removes all hover feedback and the
   muted-text tier. (c) `--cream-deep` (chat bubbles, medallions) maps to
   Cream (loses bubble/page separation) or Light green (re-tones the
   chat) — preference?

=== HARD STOP — GATE 1 — awaiting "GATE 1 APPROVED" + answers ===
