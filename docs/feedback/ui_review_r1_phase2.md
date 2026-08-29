# UI Review Round 1 — Phase 2 (execution record)

> 2026-08-29. GATE 1 APPROVED with answers (all recorded in the session);
> implementation per the approved classification + Q1–Q6 resolutions.
> Zero migrations, as expected — confirmed: nothing below touches the DB.

## What shipped, per item

- **U1 (reclassified "logo scale-up"):** sidebar logo `h-8 → h-12` (+50%,
  matching the mockup's ~48px lockup), tagline `text-sm → text-base`;
  flush-left alignment untouched (it was already correct — resolved as
  already-DONE in the gate answer). [page.tsx](../../app/case/page.tsx)
  sidebarTop.
- **U2 (ledger only):** the fallback-notice ledger entry in
  [german_copy_for_roman.md](../../docs/document-rules/german_copy_for_roman.md)
  is now "RESOLVED: Banner ENTFERNT" — removed 2026-08-26 (commit `6b26571`),
  reconfirmed by Roman 2026-08-29; the German is preserved verbatim in the
  entry; the inert `docs.fallback_notice` DB row stays. No code, no spec
  edits (the F-specs already guard the removed state).
- **U3:** `public/roman-photo.jpg` created — 384×384, JPEG q80 (mozjpeg),
  **18,029 bytes** from the 1.91 MB original; square file, circle stays CSS
  (`rounded-full` + `object-cover`). Wired EVERYWHERE: desktop sidebar
  HelpSheet, burger-menu photo row, and the mobile help sheet (initials
  replaced — "one face for support"; the initials circle survives in code
  only as HelpSheet's no-photo fallback). `public/roman-placeholder.svg`
  deleted (zero references remained; git history preserves it). Ledger
  entry "Foto-Platzhalter" marked RESOLVED.
- **U4 (full unification; D9 REVERSED on record):**
  [help-sheet.tsx](../../app/case/help-sheet.tsx) now has ONE chrome — below
  `sm` the shipped bottom sheet byte-identical (true-mobile stays as-is,
  including no phone pictogram there); from `sm` up a single CENTERED modal
  (`max-w-md`, viewport midpoint, existing dimmed backdrop). This supersedes
  BOTH the sm–lg right slide-over and D9's desktop bottom sheet (2026-08-28
  decision reversed 2026-08-29 by the founder). The `variant` prop is gone;
  D9's slide-up animation went with its geometry (the modal, like the
  shipped mobile sheet, has no entry animation). The phone pictogram renders
  at `sm+` only (`max-sm:hidden`).
- **U5 (case shell only):** the below-`lg` legal bar is removed from
  [page.tsx](../../app/case/page.tsx) (block deleted, decision comment left
  in place). The auth screens keep their links at EVERY width — the
  founder's deliberate exception to Roman's mobile ruling, recorded here
  and in the spec header. Desktop sidebar-foot links unchanged.
- **U6:** the "{n} von {m} Fragen beantwortet" line is `hidden lg:block` —
  desktop unchanged, mobile shows the bare percentage instead; the string
  stays in `de.ts` and remains the progressbar's `aria-label` on every
  viewport.
- **U7 (mobile buttons):** centered label+icon group (`justify-center`),
  inactive = solid `bg-card` tile with `shadow-sm` (border dropped), gap
  `gap-2 → gap-3.5`, radius `rounded-xl → rounded-lg` (~8px per the
  drafts). Kept per gate answers: `min-h-11` (44px touch floor beats the
  drafts' 40px), the docs badge "· n offen", equal 50/50 widths. Desktop
  pills byte-identical.
- **U9 (mobile chrome):** ONE `bg-sage-soft` panel replaces the two cream
  bands — title row (now `text-xl`) over a full-bleed hairline, intro at
  `text-[15px]`, buttons, then ChatView's progress band continuing the same
  panel (no border between; the panel simply ends where the chat begins).
  Side inset `px-4 → px-7` on the content rows per gate answer 6b (the
  title row keeps `px-4` — the burger icon's own box already lands its
  glyph at the drafts' ~27px). Progress: floating petrol chip is
  desktop-only; mobile shows a plain graphite semibold % left-aligned above
  the track; ring marker `size-5` on mobile (`lg:size-3` desktop
  unchanged); the desktop chip's `pt-6` reservation is `lg:`-only. Vertical
  rhythm deliberately stays the shipped compact one (667px height budget) —
  same reasoning as the 44px floor; only measured colors/sizes/insets
  follow the drafts.
  - **Fix found during browser verification:** the unfilled track
    (`bg-sage-soft/60`) vanished on the new sage panel (same color on
    itself). Mobile track is now `bg-sage/60` (the drafts' own deeper
    unfilled tone), desktop keeps `bg-sage-soft/60` on its cream band.

## Spec edits (explicitly reported, per the gate)

1. [legal-footer.spec.ts](../../tests/e2e/legal-footer.spec.ts) — the
   agreed F2 flip: at 1280×800 the footer must render inside the viewport
   (kept); at 375×667 the case shell must have **no** visible legal footer
   (`:visible` count 0). Plus the cheap auth assertion the founder asked
   for: F1 now re-asserts all three links at 375×667 on /login (auth keeps
   its links below lg). Spec header rewritten to the new scope.
2. [mobile-footer.spec.ts](../../tests/e2e/mobile-footer.spec.ts) — ONE
   U6-dependent sentinel: M1's "Essen questionnaire loaded" check read the
   now-mobile-hidden label via `getByText('von 49 Fragen')`; it now reads
   `getByRole('progressbar', { name: /von 49 Fragen/ })` — same denominator
   pin, viewport-independent (the aria-label).
3. No other spec touched. `fallback-notice.spec.ts` needed nothing (as
   predicted).

**Phase-1 correction, on the record:** the Phase-1 report claimed "no
automated spec reads the progress label — the 'four spec sites' comment is
stale". That was **wrong**: my grep pattern (`Fragen beantwortet`) missed
the `von N Fragen` substring form. Five sites read it — four at desktop
viewport (unaffected by U6: `m7-regression` ×3, `feedback-pass` ×1) and one
at mobile viewport (`mobile-footer` M1, fixed above). The early
mobile-footer gate run caught it — precisely why the founder ordered it
first. The ProgressBar comment now states the verified surface.

## Verification

- `tsc --noEmit` clean; ESLint clean; **unit 276/276 passed**.
- Browser pass (local dev, real prod data, disposable admin-created user —
  deleted after): desktop 1280 (logo scale, sidebar, chip progress, modal),
  mobile 375×812 (sage chrome per drafts, centered buttons, badge wrap, %
  + visible track + size-5 marker, burger photo, bottom-sheet help with
  photo, NO legal bar), tablet 768 (centered modal replacing the
  slide-over, pictogram present). Backdrop dim verified via computed style.
- **mobile-footer.spec (early, as ordered): PASSED** at 375×667 — every
  multiselect (4/7/7/9 options) and group-prompt action reachable, locked
  card + docs tab sane. First run failed on the U6 sentinel (see above);
  green after the one-line spec fix.
- Full local e2e: results below (local = known-flaky fallback per standing
  conventions; the preview suite after push is the gate).

### Full local e2e results (2026-08-29, local dev server, chunked runs)

| Run | Specs | Result |
|---|---|---|
| Gate (early, as ordered) | mobile-footer | 1 failed → the U6 sentinel (spec edit 2) → **1 passed** (1.3m) on re-run |
| Chunk A | auth, date-bounds, disability-gate, documents-m6, fallback-notice, legal-footer, transitive-visibility-fix, visibility | **12 passed, 13 skipped** (the standing auth.spec signup skips, `E2E_ALLOW_SIGNUP` unset), 1 failed: transitive-visibility T2 (4.4m) |
| T2 isolation re-run | transitive-visibility-fix | **3/3 passed** (2.3m) — the chunk failure was parallel-worker dev-server flake (case never reached under_review mid-drive), the documented local-mode failure shape; nothing in this round touches questionnaire logic or the completion gate |
| Chunk B | feedback-pass (incl. L2/L4 widowed drives + its desktop label read), m7-regression (incl. its three desktop label reads) | **7 passed** (2.1m) |
| Chunk C | completion (fresh fixture via create-test-user.mjs) | **1 passed** (1.5m) |

Net: every spec green (T2 green on isolation; the one genuine regression the
early gate caught — the U6 sentinel — was fixed as spec edit 2 above). All
e2e users admin-created and deleted per-user, per convention.

## Zero-migration confirmation

No file under `supabase/migrations/` was added or changed. The only DB-side
mention anywhere in this round is documentation (`docs.fallback_notice`
stays inert in the DB, per the gate answer).

## Deferred / noted

- The ledger's Marzahn-Hellersdorf row still describes his checklist as
  "fallback set + banner" — now stale on the banner half; left untouched
  (outside this round's approved ledger scope). Flagged for the next ledger
  pass.
- `docs/session-context.md` open-queue item 1 (Roman photo) is now
  resolved by U3; the file is the founder's to refresh (draft header says
  founder review pending) — not edited here.
- U8 (parked overflow bug): nothing new surfaced during implementation or
  the browser pass; mobile-footer green is the standing evidence the
  chrome fits 667px.

## Ship record

- Branch `feat/ui-review-r1`, commit `b869953` (17 files, +721/−165),
  pushed 2026-08-29; this results addendum is a follow-up commit on the
  same branch.
- **Preview suite: ALL GREEN** against the branch deployment
  `sorglos-antrag-git-feat-ui-review-r1-sorglos-antrag.vercel.app`
  (bypass secret from `.env.local` — alive again despite the team-transfer
  note; agent memory updated):
  - Chunk A (auth, date-bounds, disability-gate, documents-m6,
    fallback-notice, legal-footer, transitive-visibility-fix, visibility):
    **13 passed, 13 skipped, 0 failed** (3.4m) — T2 green here, closing the
    local-flake question; the U5 legal-footer asserts green on the real
    build.
  - Chunk B (feedback-pass, m7-regression): **7 passed** (1.4m).
  - Chunk C (completion — fresh fixture, mobile-footer): **2 passed**
    (1.5m).
  - Net: **22 passed, 13 skipped (standing auth signup skips), 0 failed.**
- **HARD STOP — merge is the founder's call.**
