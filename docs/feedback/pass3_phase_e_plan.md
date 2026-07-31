# Feedback Pass 3 — Phase E-1 plan (UI restyle to the Lovable mockup)

> **PLAN ONLY. Nothing implemented.** No branch created, no code, no
> screenshots yet. Awaiting founder approval of this plan before E-2 starts.
>
> Basis: the A12 addendum (`feedback_pass3_triage.md`) and the E-1 decisions
> recorded in `pass3_state.md`. **Tokens and visual patterns only — no
> Lovable logic, routing or state comes across.**

## 0. Standing constraints (from the recorded decisions)

|                               |                                                                                                                                                                                    |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Layout                        | **Keep our centered column.** Adopt the `AppHeader`-style top bar with the `· n offen` badge wired to our existing missing-documents counter. **No desktop sidebar.**              |
| Ansprechpartner / Hilfe panel | **Out of scope** — Roman's personal data, his decision. Not built in Phase E.                                                                                                      |
| `/fertig`                     | Adopt the **visual pattern**; the existing locked-state German copy stays **verbatim** (R3). Lovable's "Nächste Schritte" text is a PLACEHOLDER_DE proposal to Roman, not shipped. |
| Logo                          | Proceed with the existing `public/logo.jpg`. An SVG from Roman is an **upgrade when it arrives, not a dependency**.                                                                |
| Copy                          | **Zero German copy changes.** Every string stays as authored; anything new would be PLACEHOLDER_DE and is deliberately avoided in this phase.                                      |
| Logic                         | **Zero behaviour changes** in E-2…E-7. The questionnaire engine, document rules, upload path and auth flows are untouched.                                                         |

---

## 1. Branch workflow

All Phase E work happens on **`feedback-pass3-ui`**, never directly on `main`.

```
feedback-pass3-ui  ──●──●──●──  (one commit per sub-phase)
                     │  │  │
                     ▼  ▼  ▼    Vercel preview deploy per push
                  STOP for founder review of the preview URL
                     │
                     └──► merge to main ONLY on approval (= prod deploy)
```

Per sub-phase, in order:

1. Implement on `feedback-pass3-ui`, single focused commit.
2. `npm run build` + **full e2e suite green** + unit suite green.
3. Push branch → Vercel builds a **preview deployment** (branch deploys are
   automatic; the preview URL is reported to you).
4. Capture before/after screenshots into `docs/feedback/ui-gallery/` (§7).
5. **STOP.** You review the preview URL and the gallery.
6. On your approval: merge to `main` → production deploy → verify prod →
   state-file note. On rejection: fix on the branch, repeat from 2.

**No Phase E code reaches `main` without an approved preview.** If a
sub-phase is rejected outright, the branch is reset to the last merged
commit — production is never mid-restyle.

⚠ One caveat to state plainly: the e2e suites run against
`E2E_BASE_URL`-overridable prod URLs and create **real throwaway accounts in
the production Supabase project** (there is only one). Running them against
a preview URL therefore still writes to prod data — same as today, with the
same cleanup discipline. Nothing about that changes; it just should not
surprise anyone when preview runs create and delete test users.

### Preview access (from E-1 onward)

The project has **Vercel Authentication** enabled
(`ssoProtection: all_except_custom_domains`), so preview URLs 302 to Vercel
SSO and are not machine-reachable. E-0 therefore ran against the identical
build served locally. From E-1 the founder supplies a
**Protection Bypass for Automation** secret, which I consume as:

```
VERCEL_AUTOMATION_BYPASS_SECRET=<secret>     # in .env.local (gitignored)
```

That name is Vercel's own, so a deployment-side system env var of the same
name lines up with the local one. `playwright.config.ts` then sends it on
every request:

```ts
use: {
  extraHTTPHeaders: process.env.VERCEL_AUTOMATION_BYPASS_SECRET
    ? {
        'x-vercel-protection-bypass': process.env.VERCEL_AUTOMATION_BYPASS_SECRET,
        'x-vercel-set-bypass-cookie': 'true', // keeps client-side navigations authorised
      }
    : {},
}
```

`x-vercel-set-bypass-cookie` matters: without it only the first document
request is bypassed and subsequent client-side navigations bounce to SSO.
The secret is a credential — `.env.local` only, never committed, never
echoed into a screenshot, log or commit message.

---

## 2. Sub-phase breakdown

| #       | Scope                                                                                                                                                                                                                                             | Touches                                                        | Risk                                                    |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------- |
| **E-0** | **Test hardening, zero visual change.** Add `data-testid` hooks to the DOM the restyle will move (chat answer footer, question card, history list, group prompt, locked banner) and repoint the e2e specs off structural CSS selectors onto them. | `chat-view.tsx`, 4 e2e specs                                   | none (no visual diff)                                   |
| **E-1** | **Design tokens, app-wide.** Brand `--color-*` entries, `:root` values, radius scale, Lato via `next/font`, card-shadow token. No markup changes.                                                                                                 | `app/globals.css`, `app/layout.tsx`                            | ⚠ **highest visibility — every screen changes at once** |
| **E-2** | **Shared primitives.** Buttons (copper CTA / petrol / outline / ghost), inputs + selects, cards, the petrol-tinted shadow, progress bar (track, fill, marker, % chip), tab row with the `· n offen` badge, top bar.                               | `components/ui/*`, `case-tabs.tsx`, `app/case/page.tsx` header | medium                                                  |
| **E-3** | **Fragen screen** (questionnaire). Chat bubbles: assistant left/white, user right/petrol, hint bubble, chips for yes/no + single-select, answer footer, history, edit affordance, group prompt card. **Pure-restyle items only** (§4).            | `chat-view.tsx`                                                | **highest structural risk**                             |
| **E-4** | **Dokumente screen.** DocRow pattern: status medallion (FileText → petrol check), title + status line, uploaded rows tinted, "Datei auswählen" / delete, counter header.                                                                          | `document-area.tsx`                                            | medium                                                  |
| **E-5** | **Auth + pre-steps.** Login, signup, reset, update-password (AuthShell pattern: cream page, centered logo, white card, copper CTA); care-home selector + PLZ form (FormCard pattern).                                                             | `app/(auth)/*`, `care-home-selector.tsx`, `plz-form.tsx`       | low                                                     |
| **E-6** | **Completion / locked state.** `/fertig` visual pattern applied to our under-review state: petrol check medallion, headline, existing copy verbatim, no "Nächste Schritte" list until Roman signs off.                                            | `chat-view.tsx` locked branch, `EditLockedCard`                | low                                                     |
| **E-7** | **Polish + a11y sweep.** 404/error pages, focus states, touch-target audit, contrast re-verification on the built pages, mobile pass at 375 px on every screen.                                                                                   | various                                                        | low                                                     |
| **E-8** | **Behaviour-adjacent extras — OPTIONAL, each its own STOP.** See §4.                                                                                                                                                                              | `chat-view.tsx`                                                | deferred                                                |

**Desktop + mobile are not separate sub-phases** — each screen sub-phase
delivers both, with screenshots at **1280×800 and 375×812**, because the
mockup is mobile-first (`sm:` ×32, `lg:` ×7) and a desktop-only pass would
hide breakage.

### ⚠ E-1 is the highest-visibility deploy

Merging E-1 changes **the colour, background and typeface of every screen in
production at once**, while the markup still has our current shapes. It is
the one sub-phase where the app will briefly look "half-restyled" to anyone
who knows the mockup.

**Roman heads-up before the E-1 merge** (not after): a short German note —
"Ab dem nächsten Update sieht die App in den neuen Farben und der neuen
Schrift aus; Aufbau und Texte bleiben zunächst unverändert, die einzelnen
Seiten folgen Schritt für Schritt." Sent by you, with the E-1 gallery
attached, **before** I merge. This avoids him seeing a partial restyle on
the live pilot and reporting it as a regression.

---

## 3. Token port specifics

All in `app/globals.css` — **both projects are Tailwind v4 CSS-first, there
is no `tailwind.config.js` to edit.**

**(a) The ten brand tokens** get registered in our existing `@theme inline`
block, or `bg-petrol` / `text-graphite-soft` / `bg-sage-soft/40` silently
no-op:

```css
--color-petrol / --color-petrol-soft
--color-sage   / --color-sage-soft
--color-copper / --color-copper-hover
--color-graphite / --color-graphite-soft
--color-cream  / --color-cream-deep
```

plus `:root` values exactly as in the mockup source (verified byte-for-byte
against `src/styles.css`; `.lovable/plan.md`'s `#C9825A` is stale, code
wins): petrol `#245B5A`/`#2f7371`, sage `#A9BFAE`/`#cbd8ce`, copper
`#C44F15`/`#a34111`, graphite `#2C2F32`/`#5c6166`, cream `#F7F4ED`/`#efeadd`,
and the shadcn aliases (`--background: #F7F4ED`, `--card: #ffffff`,
`--primary: #245B5A`, `--secondary`/`--muted: #efeadd`, `--accent: #A9BFAE`,
`--ring: #245B5A`, `--border`/`--input: #e6e0d0` — but see §5 on borders).

**(b) Radius scale: adopt the mockup's.** `--radius: 0.875rem` with **± px
offsets** (`sm: -4px`, `md: -2px`, `lg: =`, `xl: +4px`, `2xl: +8px`,
`3xl: +12px`), replacing our multiplier scale (`*0.6 … *2.6`). The two only
agree at `lg`; every mockup class was drawn against the offset scale, so
keeping ours would make `rounded-2xl` 25.2 px where the design says 22 px.

**(c) Lato via `next/font/google` — self-hosted, never a Google Fonts
`<link>`.** The mockup loads Lato from `fonts.googleapis.com`, which would
send **every caregiver's IP address to Google on each page load** — not
acceptable for a German care-benefits app handling health and financial
data. `next/font` downloads and self-hosts the files at build time: zero
third-party requests. Weights **400/500/600/700** (the code uses normal,
`font-medium`, `font-semibold`, `font-bold`; the mockup's `<link>` requests
300 but nothing uses it). Wired to `--font-sans`, which our `@theme inline`
already reads.

**(d) Card shadow token.** The mockup's signature lift is
`shadow-[0_2px_20px_-14px_rgba(36,91,90,0.25)]` (auth card: `-14px/0.3` at
24 px). It appears on every card and is invisible in a DOM dump — it becomes
a named utility rather than being repeated inline.

**(e) Dark mode: leave our `.dark` block untouched.** The mockup is
light-only and the app never toggles a theme; inventing brand darks would be
unreviewed guesswork. The block stays dead and harmless.

---

## 4. Chat-UI classification — pure-restyle vs behaviour-adjacent

| Mockup pattern                                         | Class                    | Why                                                                                                                                                                                                                    | Scheduled         |
| ------------------------------------------------------ | ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| Assistant bubble (white, left, `rounded-bl-md`)        | **pure restyle**         | our question prompt, re-skinned                                                                                                                                                                                        | E-3               |
| User answer bubble (petrol, right, `rounded-br-md`)    | **pure restyle**         | our answered-history entry, re-skinned                                                                                                                                                                                 | E-3               |
| Hint bubble (sage, Info icon)                          | **pure restyle**         | our existing patient-notice banner                                                                                                                                                                                     | E-3               |
| Card → bubble layout of the history                    | **pure restyle**         | presentation of the same `flatVisible` data                                                                                                                                                                            | E-3               |
| Copper "Antwort speichern" CTA                         | **pure restyle**         | our "Weiter" button, recoloured (**label unchanged**)                                                                                                                                                                  | E-3               |
| Progress bar with % chip + dot marker                  | **pure restyle**         | same `progressPercent` value                                                                                                                                                                                           | E-2               |
| Tab row + `· n offen` badge                            | **pure restyle**         | badge already exists (`docs-tab-badge`)                                                                                                                                                                                | E-2               |
| DocRow medallion / uploaded tint                       | **pure restyle**         | derived from existing upload state                                                                                                                                                                                     | E-4               |
| **Chips instead of radios** for yes/no + single-select | ⚠ **behaviour-adjacent** | changes the **control type**: native `<input type=radio>` disappears, one-click-submits instead of select-then-Weiter, and keyboard/AT semantics change. Also breaks `input[type=radio][value="Nein"]` selectors (§6). | **E-8, own STOP** |
| "Später beantworten" skipped **marker** in history     | ⚠ **behaviour-adjacent** | we currently render nothing for a skipped question; adding a marker surfaces session-only skip state in the transcript                                                                                                 | **E-8, own STOP** |
| "Ändern" edit affordance on the answer bubble          | ⚠ **behaviour-adjacent** | we have "Bearbeiten" in the history; moving it onto the bubble changes the edit entry point and its discoverability                                                                                                    | **E-8, own STOP** |
| "Antwort geändert" flash toast                         | ⚠ **behaviour-adjacent** | new transient UI + new German string (PLACEHOLDER_DE → Roman)                                                                                                                                                          | **E-8, own STOP** |
| Auto-navigate to `/fertig` 800 ms after last upload    | ❌ **not adopted**       | Lovable demo behaviour; our completion is server-derived                                                                                                                                                               | never             |

**Rule for E-3:** if a change alters _what the user must do_ or _what
control type they interact with_, it is not part of E-3. E-3 changes only
how things look.

---

## 5. Accessibility — measured, not assumed

Computed WCAG ratios for the actual palette (not estimates):

| pair                                                   | ratio                    | normal text | large text |
| ------------------------------------------------------ | ------------------------ | ----------- | ---------- |
| copper `#C44F15` **text** on white                     | **4.69:1**               | ✅ AA       | ✅         |
| copper **text** on cream `#F7F4ED`                     | **4.27:1**               | ❌ **FAIL** | ✅         |
| copper **text** on cream-deep `#efeadd`                | **3.91:1**               | ❌ **FAIL** | ✅         |
| white text on **copper fill** (CTA)                    | **4.69:1**               | ✅ AA       | ✅         |
| white on copper-hover fill                             | **6.32:1**               | ✅ AA       | ✅         |
| petrol text on white / cream                           | **7.72 / 7.03:1**        | ✅ AAA      | ✅         |
| white or cream text on **petrol fill**                 | **7.72 / 7.03:1**        | ✅ AAA      | ✅         |
| graphite body text on cream / white                    | **12.26 / 13.46:1**      | ✅ AAA      | ✅         |
| graphite-soft muted text on white / cream / cream-deep | **6.26 / 5.70 / 5.21:1** | ✅ AA       | ✅         |
| petrol fill vs sage track (progress)                   | **3.95:1**               | ✅ ≥3:1     | —          |

**Ruling on copper — the one real trap.** Copper is a **fill colour, not a
text colour**:

- ✅ copper **as a button/badge fill** with white text — anywhere.
- ✅ copper **as text on a white card**, any size (4.69:1).
- ❌ copper **as text on the cream page background** at normal size — 4.27:1
  fails AA. Permitted only at large size (≥24 px, or ≥18.66 px bold), e.g. a
  heading; **never** for body copy, links or small labels.
- ❌ copper text on cream-deep (`#efeadd`) at normal size — 3.91:1.
- Where a copper-coloured _link_ is wanted on cream, use **petrol** (7.03:1)
  instead. The mockup itself uses petrol for links.

**Two defects inherited from the mockup, to fix rather than copy:**

1. **Form-control borders fail WCAG 1.4.11.** `--input: #e6e0d0` is
   **1.32:1** against white and **1.20:1** against cream — a user cannot see
   where the input is. Non-text UI components need **≥3:1**. Fix: keep
   `#e6e0d0` for decorative dividers, and introduce a distinct
   **form-control border** at ≥3:1 — `#8c8272` (3.78:1 vs white, 3.44:1 vs
   cream) is the lightest candidate that passes; `graphite-soft #5c6166`
   (6.26 / 5.70) is the safe choice if `#8c8272` reads too warm. Decided in
   E-2 with both rendered side by side in the gallery.
2. **Focus ring too faint.** The mockup uses `focus:ring-2
focus:ring-petrol/20` — at 20 % opacity that is nowhere near 3:1. Fix:
   full-opacity **petrol** ring (7.72:1 vs white, 7.03:1 vs cream), 2 px,
   with `ring-offset-2` so it is visible against both card and page. Every
   interactive element keeps a visible focus state; **no `outline: none`
   without a replacement.**

**Touch targets:** minimum **44×44 px** hit area for every control,
including the "Weiß ich gerade nicht" skip control and the per-file
delete/download buttons in the document list (currently small text buttons
at `text-xs`). Where the visual is smaller, padding or a pseudo-element
extends the hit area. Audited screen by screen in E-7 and spot-checked in
each screen sub-phase at 375 px.

**Other a11y invariants:** heading order preserved; the progress bar keeps
`role="progressbar"` + `aria-valuenow`; tabs keep their roles and
`aria-selected`; every icon-only control gets an `aria-label`; German copy
unchanged so screen-reader output is unchanged.

---

## 6. e2e impact assessment

Selector census across the four suites (`documents-m6`, `feedback-pass`,
`m7-regression`, `visibility`, plus `auth`, `completion`,
`transitive-visibility-fix`):

| Selector                                                           | Uses          | Restyle risk                                                                      | Action                                                                                   |
| ------------------------------------------------------------------ | ------------- | --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ---------- | --------------------- | ---------------------------------- | -------------------------------------------------------------------- |
| **`.shrink-0.border-t`** (chat answer footer)                      | **9**         | 🔴 **breaks** — a structural CSS-class selector on the exact wrapper E-3 rewrites | **E-0**: add `data-testid="answer-footer"` at `chat-view.tsx:723` and repoint all 9 uses |
| `input[type=radio][value="Nein"]`, `input[type=radio][value="Ja"]` | 5+            | 🟠 breaks **only if** chips replace radios                                        | untouched in E-3; if E-8 adopts chips, that sub-phase updates them                       |
| `locator('select')`, `input[type=date                              | number        | text                                                                              | file                                                                                     | checkbox]` | ~25                   | 🟢 safe while controls stay native | E-2 restyles native controls in place; **no swap to custom widgets** |
| `[data-testid=document-area                                        | doc-slot      | slot-status                                                                       | missing-docs-counter]`                                                                   | 8          | 🟢 safe               | preserved verbatim through E-4     |
| `[data-testid=tab-documents                                        | tab-questions | docs-tab-badge]`                                                                  | 7+                                                                                       | 🟢 safe    | preserved through E-2 |
| `#care_home_id`, `#plz_input`, `[name=email                        | password      | first_name                                                                        | …]`                                                                                      | 30+        | 🟢 safe               | ids/names never change in E-5      |
| `getByRole('button', { name: 'Weiter' \| 'Anmelden' \| … })`       | 30+           | 🟢 safe                                                                           | **German labels do not change** (R3)                                                     |
| `getByText('Fehlt' \| 'In Prüfung' \| 'Angaben werden geprüft')`   | 11            | 🟢 safe                                                                           | status copy unchanged; E-6 restyles the container only                                   |
| `[data-testid=phone-input]`                                        | 3             | 🟢 safe                                                                           | E-5 restyles the wrapper only                                                            |

**Rules:** selector updates are **allowed but must be listed in the
sub-phase commit message and its state-file entry**; the **full e2e suite
must run green before every merge to main**, not merely before the final
one; and E-0 exists precisely so that no later sub-phase has to touch a
selector under time pressure.

**Known pre-existing gap (not introduced here):** the CI Playwright job is
dormant (gated on an unset repo variable), so e2e runs are local and
deliberate. Phase E does not change that; it just means "suite green" is my
manual gate, reported per sub-phase.

### 6a. The gate itself — SPLIT GATE (founder decision, 2026-07-31)

This **supersedes** "the full e2e suite must run green before every merge"
above, in one respect only: _where_ the full suite runs.

| Scope                       | E-2 … E-7 (each)                                                                             | E-8 + final pre-merge |
| --------------------------- | -------------------------------------------------------------------------------------------- | --------------------- |
| Full suite, **local** build | **required** (the correctness gate — same artifact the preview serves)                       | required              |
| **Preview** smoke           | **required** — and it _is_ the gallery run: `scripts/ui-gallery.mjs` against the preview URL | —                     |
| Full suite, **preview**     | not required                                                                                 | **required**, once    |
| Unit (Vitest)               | required                                                                                     | required              |

The gallery script is a genuine smoke, not a screenshot loop: it signs up,
completes both pre-steps, saves three answers, switches tabs, renders the
document checklist, and does it at two viewports. Anything that breaks in
the deployed CSS/font/edge pipeline but not locally shows up there.

**Why:** the E-1 preview run took **2 h** for 12 failures (see the state
file). Repeating that for E-2…E-8 is ~16 h of wall time buying a residual
delta over the local suite that the gallery already covers on the screens
each sub-phase actually touches. Pay it once, at the end.

**Prerequisite, now done:** the failures were all
`waitForLoadState('networkidle')` timeouts. All 11 sites are gone from the
specs (main, `53fdf73`), replaced by assertions on the specific element
each test needs. That is a fragility fix, **not** a diagnosis — the 2 h run
was never reproduced and no cause is claimed.

---

## 7. Screenshot gallery — Roman's sign-off package

Every sub-phase writes before/after pairs to
**`docs/feedback/ui-gallery/`**, committed with the sub-phase:

```
docs/feedback/ui-gallery/
  E-1-tokens/    before-fragen-desktop.png   after-fragen-desktop.png
                 before-fragen-mobile.png    after-fragen-mobile.png
                 …one pair per touched screen, both viewports
  E-2-components/…
  README.md      index: sub-phase → screens → what changed, in German
```

Captured with Playwright at **1280×800** and **375×812** against the
preview deployment, using a throwaway account driven to a fixed state
(questionnaire mid-flow, checklist with one uploaded and one missing
document, locked state) so before/after are comparable rather than
incidentally different.

⚠ **Privacy:** screenshots are taken on **throwaway accounts with synthetic
answers only** — never a real pilot case. The gallery is committed to a
**public** repo, so no real name, address, PLZ, IBAN or filename may appear
in any image. The fixture uses obvious test data ("Maria Musterfrau").

This gives Roman a complete visual review **without needing preview
access** — he sees exactly what changes, screen by screen, in German.

---

## 8. Assets

| Asset                           | Decision                                                                                                                                                                                                                                                      |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Logo                            | Ship with existing `public/logo.jpg`. An SVG from Roman is an **upgrade, not a blocker**; when it lands it is a one-file swap plus one gallery update. The mockup repo cannot supply it — its assets are Lovable-hosted R2 URLs in `*.asset.json`, not files. |
| Lato font files                 | Fetched and self-hosted by `next/font/google` at build time. No new committed binaries, no runtime third-party request.                                                                                                                                       |
| Icons                           | `lucide-react` is already a dependency (v1.17 vs the mockup's v0.575 — names verified at use). Icons needed: `Pencil, FileText, Menu, Check, Info` (`Phone, Mail` only if the Ansprechpartner panel is ever adopted — it is not).                             |
| Ansprechpartner photo / contact | **Not used.** Panel out of scope.                                                                                                                                                                                                                             |
| `simona-pfeiffer.png`           | Dead asset in the mockup, referenced by nothing — flagged to Roman, not adopted.                                                                                                                                                                              |

---

## 9. What I need from you to start

1. **Approve this plan** (or adjust the sub-phase order/scope).
2. Confirm the **E-0 test-hardening sub-phase** is wanted — it is a
   zero-visual-change commit whose only purpose is to make the following
   sub-phases safe. I recommend it strongly; skipping it means E-3 edits
   markup and 9 e2e selectors in the same commit.
3. Confirm you will send the **Roman heads-up before the E-1 merge** (§2), or
   tell me to draft it as a package item first.
4. Decide the **form-control border colour** in E-2 from the two candidates
   in §5 — or defer it to the E-2 gallery, which is my recommendation since
   it is easier judged visually.

**Nothing starts until you approve.** On approval I create
`feedback-pass3-ui` and implement **E-0 only**, then stop for the preview.
