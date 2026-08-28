# Desktop UI Round 1 — Phase 2 execution record

> **GATE 1 APPROVED 2026-08-28** (founder, in-session). Built exactly the four
> PARTIAL/NEW items of the approved classification — **D5 box, D6 removal,
> D9 bottom sheet, D10 bar** — plus the gate's screenshot facts:
> D1 was re-classified **DONE** (current sidebar placement matches the
> founder's reference image; no restructure), and D2/D3/D4/D8/D11 stayed
> untouched as classified. D7 remains permanently withdrawn. Zero DB surface
> held (P1-7): no migrations, no DB commands, no data changes.

## Gate answers applied (verbatim decisions)

1. **D6**: remove the ENTIRE pre-step meta card — intentionally on all
   viewports (case id / PLZ / status leave the applicant-facing UI
   everywhere); exactly the P1-3 table, nothing beyond it.
2. **D1**: DONE — foot-link placement matches the screenshot; tagline and
   legal links stay.
3. **D5**: one wrapping white (#FFFDFA) box at lg+ containing infobox +
   transcript + answer band; progress band stays OUTSIDE on cream;
   visual-only, below-lg behavior unchanged.
4. **D9**: centred max-w-xl slide-up bottom sheet, dimmed backdrop, base-ui
   primitives; existing HelpSheet content with its **DB-driven** phone number
   (`contact.phone`) — `tel:+491789125300` stays burger-menu-only while the
   two-number question sits in Roman's queue; placeholder photo on this
   desktop sheet only; mobile burger + its HelpSheet untouched.
5. **D10**: delete the `lg:hidden`; bar keeps its position (between counter
   and intro sentence) at all breakpoints.

## Files changed

| File                                                               | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [app/case/page.tsx](../../app/case/page.tsx)                       | **D6**: the pre-step "Case meta" card (subheading + Status row + PLZ row, incl. the suppressed unsupported-PLZ comment block) deleted; replacement comment records the founder decision. **D9**: the sidebar HelpSheet instance now passes `variant="bottomSheet"` + `photoSrc="/roman-placeholder.svg"` (burger instance untouched).                                                                                                                                                                                                                                                                                                                                                                                           |
| [lib/strings/de.ts](../../lib/strings/de.ts)                       | **D6** dead-code follow-up per the approved table: `plzLabel`, `statusLabel`, `statusLabels` deleted (code-side strings, no DB rows involved; tombstone comment left).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| [app/case/chat-view.tsx](../../app/case/chat-view.tsx)             | **D5**: new wrapper div around history + answer footer — a plain flex pass-through below `lg`; from `lg` it is the white central box (`lg:bg-card lg:rounded-2xl lg:shadow-card lg:max-w-2xl lg:mx-auto lg:my-4 lg:overflow-hidden`). Inside it, the transcript card drops its own chrome at lg (`lg:rounded-none lg:shadow-none`) and the answer footer swaps cream for the box's white (`lg:bg-card lg:backdrop-blur-none`); the `border-t` hairline stays as the internal divider. The reachability flex chain (history = only scroller, footer = separate shrinkable row; 2026-08-11 field-bug contract) is unchanged — same members, one level deeper. Progress band (`case-header`) untouched: outside the box, on cream. |
| [app/case/help-sheet.tsx](../../app/case/help-sheet.tsx)           | **D9**: new `variant` prop (`'panel'` default = shipped chrome, byte-identical classes). `'bottomSheet'`: centred `max-w-xl` sheet pinned to the bottom, slide-up via base-ui `[data-starting-style]`/`[data-ending-style]` + `transition-transform` (reduced-motion honoured by the global override); same dimmed `Dialog.Backdrop`; load-bearing `data-closed:hidden` kept. Phone row gains the call pictogram (aria-hidden `Phone` icon; visible number = accessible name) in the bottomSheet variant only. `photoSrc` branch: `alt=""`/`aria-hidden` + `unoptimized` (silhouette precedent; name is adjacent text) + `data-testid="help-sheet-photo"`.                                                                      |
| [app/case/document-area.tsx](../../app/case/document-area.tsx)     | **D10**: `lg:hidden` removed from the `docs-progress` wrapper; comment updated. Same bar, same source (uploaded ÷ required slots), same position (counter → bar → `docs.area_intro` → types line) at every breakpoint.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| [docs/feedback/desktop_round1_phase1.md](desktop_round1_phase1.md) | Status header updated to record the gate approval.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |

**Not touched** (DONE per gate): sidebar structure (D1), header title (D2),
subheader row (D3), questions progress bar (D4), autosave notice/dismiss
logic (D8), palette (D11), MobileMenu, LegalFooter, all server code.

## German / ledger

**No new German strings** — visible or a11y — were introduced. The bottom
sheet reuses the existing `contact.*` rows and the existing approved
`help.closeLabel`; the call pictogram is `aria-hidden` with the visible
number as its accessible name (burger precedent), so no label was needed.
The `de.ts` deletions are removals of now-unreferenced code-side labels, not
authorship. **Ledger unchanged.**

## Verification

- `npm run verify` (typecheck + ESLint + Prettier + encoding): **green**.
- `npm test` (Vitest): **279/279 passed**.
- **e2e, local** (`E2E_BASE_URL=http://localhost:3000`, fresh
  `create-test-user.mjs` fixture per run):
  - First full run (default workers) collapsed with 22 timeouts including
    pure login-page specs — the documented local-stall mode (dev-server
    overload), not app failures.
  - Re-run on a warm server with `--workers=2`: **21 passed, 1 failed,
    13 skipped** (the known skips: `auth.spec` signup gates etc.).
  - The 1 failure — `transitive-visibility-fix.spec` **T2** — was the final
    DB assert only (`status` read `in_progress`, expected `under_review`);
    its failure snapshot shows the UI fully working (46/46 answered,
    all-answered card). Verified as a **timing flake, not a regression**:
    (a) `completion.spec`, the canonical test of the same server-side
    under_review flip, passed in the same run; (b) the all-answered card
    renders optimistically before the final server action resolves, so T2's
    immediate DB read can race the completion UPDATE under load; (c) **T2
    passed in isolation** on re-run (1.7m, `status=under_review`). No spec
    was modified.
  - Per the gate reminder: **no spec tripped on the removed meta card** —
    confirming the Phase-1 finding that nothing reads it.
- **Visual check** (throwaway `pw-desktopr1` user via admin key, deleted
  per-user after the run; screenshots shared in-session, desktop 1440×900 +
  mobile 375×812):
  - Desktop Angaben: sidebar (D1 as approved), "Antrag für Maria
    Musterfrau" (D2), verbatim subheader (D3), progress bar outside on
    cream (D4/screenshot fact), ONE white box with transcript + answer area
    (D5), no case id/PLZ/status anywhere (D6).
  - Desktop pre-steps: meta card gone; header title carries the subheading.
  - Hilfe: centred bottom sheet over dimmed page, placeholder photo, call
    pictogram + `contact.phone` ("0159 0469 5761"), email (D9).
  - Desktop Unterlagen: subheader + progress bar (0%) between counter and
    the R10 intro sentence, types line below (D10) — exactly 1 visible
    `docs-progress` instance asserted programmatically.
  - Mobile 375×812: burger + name bar + pills + separate transcript/answer
    cards on cream + mobile docs bar + legal-footer bar — Round 3 chrome
    intact (all lg: additions inert below lg).

## Deferred / notes for the founder

- **Roman queue unchanged:** real photo (now also the desktop sheet's
  `photoSrc` slot), the two-phone-numbers decision (`contact.phone` vs the
  burger's `tel:+491789125300` — the desktop sheet deliberately shows only
  the DB-driven number per gate answer 4), "…der Antragsteller." variant,
  burger a11y labels, Unterlagen/Dokumente vocabulary.
- The e2e fixture file `.playwright-test-user.json` holds the latest
  completion-test user (per that script's contract); e2e users from the
  stalled first run were cleaned up by their specs' per-user deletes where
  the specs reached their `finally` blocks — the stalled run's timeouts
  happened before user creation in most cases (login never loaded).
- Not committed: per standing git hygiene, the founder reviews and commits
  the round (explicit paths; the five changed source files + the two
  `docs/feedback/desktop_round1_*.md` records).
