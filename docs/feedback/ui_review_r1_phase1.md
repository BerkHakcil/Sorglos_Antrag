# UI Review Round 1 — Phase 1 (read-only discovery)

> 2026-08-29. Mixed mobile/desktop fixes, U1–U9 (founder-confirmed, incl. two
> decision reversals). Discovery is read-only: no code changes; the only
> repo-write is the founder-instructed asset import into
> `docs/mockups/ui-review-round1/` and this report.
>
> **Assets** (mapped by content from `C:\Users\Berk\Desktop\ui photo`):
> `u1-sidebar.png` (sidebar close-up), `roman-photo.jpg` (headshot, 3504×3506
> JPEG, 1.91 MB), `u9-draft-1.png` / `u9-draft-2.png` (mobile top-section
> drafts; draft-2 is the full-phone one with chat bubbles and is
> authoritative for colors — draft-1 sits on a white canvas), plus two
> founder-supplied supporting screenshots: `u2-infobox-current.png` (the U2
> box as once rendered) and `u4-mobile-helpsheet-current.png` (mobile help
> sheet, initials avatar). Draft measurements below are pixel-sampled
> (Python/PIL) and converted at draft-2's scale (558 px / 375 pt ≈ 1.49).

## Classification summary

| Item | Verdict | One line |
|---|---|---|
| U1 | **GATE** (likely DONE as stated / possibly a different ask) | Code + asset are already flush-left; the close-up shows a ~50 %-larger, ~30 px-indented logo the current build cannot produce |
| U2 | **DONE** (shipped 2026-08-26) + ledger note in Phase 2 | Box removal is live; German verbatim already preserved; zero spec edits needed |
| U3 | **NEW** | 2 silhouette usages + 1 initials instance; optimization plan below |
| U4 | **NEW** | Two overlay variants mapped; unified centered modal proposed (base-ui Dialog, same file) |
| U5 | **NEW**, pure presentation | 2 mounts; exactly one spec assertion flips |
| U6 | **NEW**, pure presentation | Label renders in ChatView's ProgressBar; zero automated assertions read it |
| U7 | **PARTIAL** (near-DONE) | Shipped pills match structure; deltas: centering, inactive fill, gap, radius, height, badge |
| U8 | parked | No overflow lead found; note on the 667 px height budget below |
| U9 | **NEW** | Exact current-vs-draft delta list below; 4 ambiguities → gate questions |

**DB surface: ZERO migrations, confirmed.** U2 removes nothing from the DB
(the removal already shipped; the `docs.fallback_notice` row is inert —
unmapped in [dal.ts:227](../../lib/dal.ts) — and deliberately stays). U6's
string lives in `de.ts` (code, not DB) and stays for desktop + aria. U3 is a
`public/` asset. Everything else is component CSS/markup.

---

## U1 — Desktop sidebar alignment

**Code truth:** [page.tsx:51-68](../../app/case/page.tsx) renders logo
(`h-8 w-auto`) and tagline in one `flex flex-col gap-1.5`; CaseTabs places
that block and the nav pills in the same `p-8` sidebar column
([case-tabs.tsx:136-166](../../app/case/case-tabs.tsx)) with no per-element
offsets — **all three already share one left line in code**. The asset is
flush too: `public/logo.svg` geometry starts at x ≈ 0.008 of its 172-wide
viewBox (measured), i.e. the icon touches the file's left edge.

**Close-up truth:** in `u1-sidebar.png` the tagline (x≈39) and pills (x≈36)
share a line, but the logo's ink starts at x≈95 — at the image's 2× scale a
**~30 px real indent**, and the lockup is ~48 px tall where the shipped
sidebar renders 32 px (`h-8`). The R2 Lovable mockup (design source of the
sidebar, `docs/feedback/ui-gallery/R2-mockup-reference/01-…-desktop.png`)
shows all three flush. So the close-up shows a state the current build
cannot produce; it is either an old/foreign render or a new draft whose real
delta is **logo size**, not alignment. → Gate question 1. (If the answer is
"bigger logo": the auth screens already use `h-10`
([(auth)/layout.tsx](../../app/(auth)/layout.tsx)); `h-10`/`h-12` in the
sidebar keeps flush alignment by construction.)

## U2 — Fallback "Hinweis" infobox: REMOVE

**Source: code, not a rendered content row — and the removal already
shipped.** The box was a `static_content` row (`docs.fallback_notice`,
migration `20260809000001`) rendered on `rulesSource === 'fallback'`. The
fallback-docs fix removed the rendering entirely — commit `6b26571`
(2026-08-26, "Line-A purge + banner removal"), on `main` and deployed.
Evidence today: the key is deliberately unmapped in
[dal.ts:227](../../lib/dal.ts); `fallbackNoticeText` was deleted from
[docs-pane.ts](../../lib/docs-pane.ts) (comment lines 25-29);
[document-area.tsx](../../app/case/document-area.tsx) contains no notice
markup; and
[fallback-notice.spec.ts](../../tests/e2e/fallback-notice.spec.ts) is the
never-returns guard — `toHaveCount(0)` on `[data-testid=fallback-notice]`
on every path (F1 pre-PLZ :132, F1 fallback list :140, F1 mobile :167, F2
Pankow :178, F3 Essen :194). `u2-infobox-current.png` is therefore a
**pre-2026-08-26 state** (it also shows the docs list without the D5 white
box). **No F-spec edit is needed for U2** — yesterday's bank-docs suffix
asserts (F1 :150, F2 :182, F3 :198) already encode the accepted knock-on:
fallback users see the default list plus "(letzte 3 Monate)" with no caveat.

**German verbatim (for the ledger record — byte-exact from migration
`20260809000001`, identical in the screenshot):**

> Hinweis: Für Ihre Postleitzahl liegt uns noch keine spezifische
> Dokumentenliste vor. Diese Übersicht zeigt die üblicherweise benötigten
> Unterlagen — Ihr zuständiges Sozialamt kann zusätzliche oder abweichende
> Dokumente verlangen.

The text is already preserved in the ledger
([german_copy_for_roman.md:141-152](../../docs/document-rules/german_copy_for_roman.md),
section "Go-live (2026-08-09) … PLACEHOLDER_DE (open)") and in
`fallback_docs_phase1.md`. **Phase-2 remainder:** update that ledger entry's
status — banner permanently removed by Roman's own ruling (2026-08-29),
text preserved for the record, AWAITING-ROMAN not needed. Optional
consistency touch: the ledger's Marzahn-Hellersdorf row still says his
checklist is "the fallback set + banner". The inert DB row stays (dropping
it would be a pointless migration; expected surface stays zero).

## U3 — Roman's real photo

**Inventory (complete, verified by grep — no other references):**

1. [page.tsx:86](../../app/case/page.tsx) — desktop sidebar HelpSheet:
   `photoSrc="/roman-placeholder.svg"` (the D9 bottom sheet; becomes the U4
   modal).
2. [page.tsx:127-139](../../app/case/page.tsx) — burger-menu photo row:
   `Image src="/roman-placeholder.svg"`, `size-14 rounded-full`, testid
   `menu-roman-photo`.
3. [page.tsx:115-122](../../app/case/page.tsx) — the burger's HelpSheet
   instance passes **no photoSrc**, so mobile help renders the "RP"
   **initials** circle ([help-sheet.tsx:135-140](../../app/case/help-sheet.tsx))
   — exactly what `u4-mobile-helpsheet-current.png` shows. Strictly the
   silhouette appears in (1)+(2) only; treating "everywhere" as including
   (3) is the natural reading → gate question 3.
4. Asset: `public/roman-placeholder.svg`. No test reads it or the two
   photo testids; nothing else references it. After replacement it can be
   deleted (git history preserves it).
5. Ledger: "Foto-Platzhalter (offen)" entry
   ([german_copy_for_roman.md:217-222](../../docs/document-rules/german_copy_for_roman.md))
   — Phase 2 marks it RESOLVED (photo arrived 2026-08-29), keeping the
   history; session-context's open-queue item 1 gets the same note.

**Optimization plan (Phase 2):** source 3504×3506 px, 1.91 MB. Every render
site is a 56 px circle (`size-14`), max DPR 3 → 168 px needed;
**384×384 px JPEG, quality ~80** (≈ 25–45 KB expected) gives 2× headroom
for future larger uses. Square file, **no baked circle** — the existing
`rounded-full` (+ `object-cover`, already present at
[help-sheet.tsx:129](../../app/case/help-sheet.tsx)) does the crop.
Output: `public/roman-photo.jpg`; sharp is already in node_modules for the
resize. The help sheet's `alt=""`/`aria-hidden` treatment explicitly
anticipated the real photo (comment lines 117-120) and stays.

## U4 — ONE centered desktop help modal

**Current overlay map** (all in [help-sheet.tsx](../../app/case/help-sheet.tsx),
base-ui Dialog):

| Variant | Chrome | Reachable from | Where seen |
|---|---|---|---|
| `panel` (default) | `< sm`: bottom sheet; `sm+`: right slide-over (`sm:right-0 sm:w-80`, :89) | burger menu → Hilfe (below `lg`, both pre-step and case states) | the founder's "pre-step right-corner slide-over" = this variant in the sm–lg window band |
| `bottomSheet` (D9, 2026-08-28) | centred `max-w-xl` sheet sliding up from the bottom, every width (:88) | desktop sidebar foot → Hilfe (`lg+` only, pre-step and case states) | the founder's "case-page bottom sheet" |

Both instances live in [page.tsx](../../app/case/page.tsx) (:80 sidebar,
:115 burger). Content is identical (cardLabel, photo/initials, name, phone,
email) — only the popup chrome differs.

**Proposed unification (Phase 2):** replace `bottomSheet` with a `modal`
variant in the same file — same base-ui `Dialog.Portal`/`Backdrop`
(`bg-graphite/40` dim already exists) with a centred popup:
`fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100vw-2rem)]
max-w-md rounded-2xl p-6 bg-card shadow-card-lg`, fade/scale entry via the
existing `data-starting-style`/`data-ending-style` mechanism
(reduced-motion already globally honoured), `data-closed:hidden` kept
(load-bearing). Content block unchanged: photo (real, after U3), name,
phone with pictogram, email. `page.tsx:87` flips the variant name; the D9
slide-up CSS goes. This reverses D9 per the founder's 2026-08-29
confirmation. **Scope question:** the sm–lg right slide-over is technically
"mobile chrome" (burger) but appears in desktop browser windows below
1024 px → gate question 4. No e2e reads the help sheet (verified — no spec
references the trigger, sheet, or its testids), so the only Phase-2
verification is the visual pass.

## U5 — Remove mobile legal links

**Mounts (complete):**

1. [page.tsx:258-260](../../app/case/page.tsx) — bar variant inside the
   case shell, wrapper `shrink-0 lg:hidden` → **delete the block** (below
   `lg` nothing renders; `lg+` keeps the sidebar-variant at :99, untouched).
2. [(auth)/layout.tsx:33-35](../../app/(auth)/layout.tsx) — bar variant on
   the auth screens at **all** widths → below-`lg` removal means wrapping
   `hidden lg:block` (pending gate question 5 on whether auth is in scope;
   recommendation: yes — "below lg entirely" reads app-wide).

**Pure presentation-layer**: LEGAL_URLS, `de.footer.*` strings and the
`LegalFooter` component itself stay (desktop uses them).

**Spec surface — exactly one assertion flips:**
[legal-footer.spec.ts](../../tests/e2e/legal-footer.spec.ts) F2's viewport
loop (:118-131) asserts the footer's boundingBox exists at **375×667** —
after U5 that must become "no visible legal footer below lg"
(`[data-testid=legal-footer]:visible` count 0), keeping the 1280×800
assertion. F1 (login) runs at the suite default viewport (Desktop Chrome,
≥ lg) and stays valid. `mobile-footer.spec.ts` never references the legal
footer (verified); removing the ~25 px bar only *frees* answer-footer
height at 667 px.

**Compliance consideration (recorded per the founder's instruction):** the
reachability of Impressum/Datenschutz on mobile viewports was raised; the
founders decided desktop-only for now (founder + Roman, 2026-08-29,
reversing the round-3 "keep legal bar" gate answer). Mobile users retain
the marketing-site pages themselves; the in-app links below `lg` disappear.

## U6 — Remove "X von Y Fragen beantwortet" on mobile

**Where it renders:** ChatView's ProgressBar —
[chat-view.tsx:147](../../app/case/chat-view.tsx), the
`<p class="text-graphite-soft text-xs">` fed by `de.ts`
`case.chat.progressLabel` (:264). One render site, both viewports, Angaben
pane only. **Mobile-only removal is presentation-layer:** `hidden lg:block`
on that `<p>` (or a variant prop). The string stays in `de.ts` (desktop
keeps the line — U6 says desktop unchanged) and stays as the progressbar's
`aria-label` (:157), so screen-reader users keep the denominator on every
viewport.

**Spec surface: zero.** No automated spec reads the label or
`role=progressbar` (verified by grep; `completion.spec.ts:140` explicitly
avoids matching it). The code comment "four spec sites read it"
(chat-view.tsx:138) is **stale** — those reads no longer exist; Phase 2
should correct that comment while touching the block. The only reference
anywhere is the manual UAT doc `docs/uat-m7.md` (desktop drive), unaffected.

## U7 — Angaben/Unterlagen "as buttons" vs the shipped round-3 pills

Shipped: [case-tabs.tsx:126-133](../../app/case/case-tabs.tsx) compact
variant in a `grid grid-cols-2 gap-2` (:228). Diff against the drafts
(both drafts agree):

| Property | Shipped (round 3) | Draft (measured) | Delta |
|---|---|---|---|
| Side-by-side proportions | equal 50/50 grid | equal 50/50 | ✅ DONE |
| Active fill | `bg-copper` + white text + shadow-sm | copper + white | ✅ DONE |
| Icon | lucide Pencil / FileText, in-row | same two glyphs | ✅ DONE |
| **Content layout** | `justify-between`: label left, icon right | **label + icon centered as one group** | ✋ main visible delta |
| Inactive fill | translucent `bg-background/60` + `border-sage/50` | **solid `#F4F2EE` card, soft drop shadow, no visible border** | ✋ |
| Gap | 8 px (`gap-2`) | ≈ 14 px (`gap-3.5`) | small |
| Radius | 12 px (`rounded-xl`) | ≈ 6–8 px (`rounded-md`/`lg`) | small |
| Height | 44 px (`min-h-11`) | ≈ 40 px | ⚠ shipped 44 px is the E-7 touch floor — recommend keeping `min-h-11` |
| Docs badge "· n offen" | rendered on Unterlagen | **absent in both drafts** | gate question 6a |

**Verdict: PARTIAL** — structure and colors are done; the deltas are the
centering, the inactive-tile treatment, gap/radius, and the badge decision.

## U8 — Parked overflow bug

Not hunted, per the brief. Nothing obviously fixed-width or
overflow-suspect crossed my path in the touched files. One adjacent note,
not claimed as the reported bug: the mobile chrome is height-budgeted at
667 px viewports (the 2026-08-11 field-bug constraint, documented at
[case-tabs.tsx:31-36](../../app/case/case-tabs.tsx)) — U9's larger title
and paddings **consume** budget while U5/U6 free some;
`mobile-footer.spec.ts` (375×667, asserts answer-footer controls stay
in-viewport) is the mandatory Phase-2 regression gate for the net effect.

## U9 — Mobile top section per the drafts

Question+answer area stays AS IS (the drafts' bubbles/input are generic
placeholders). Chrome delta list, current → draft (draft-2 authoritative;
draft-1 structurally identical):

1. **Panel background & structure.** Current: TWO cream bands, each with
   its own `border-b` — CaseTabs' chrome (title/intro/pills,
   [case-tabs.tsx:216](../../app/case/case-tabs.tsx)) and ChatView's
   progress band ([chat-view.tsx:1131-1148](../../app/case/chat-view.tsx)).
   Draft: **ONE sage panel** — `#DFE8DF` = exactly `--sage-soft` (brand
   Light green `#dde8de`, globals.css:98) — spanning title row → progress
   bar, with a hairline **only under the title row**, no separator between
   intro/buttons/progress, and the panel simply ending where the
   white/cream chat begins. (ProgressBar stays code-wise in ChatView — its
   % is live client state; the merge is paint-only: same bg, borders
   re-assigned. Presentation-layer.)
2. **Title.** `text-base` (:221) → ≈ 20–22 px (`text-xl`), still bold,
   burger unchanged at left.
3. **Intro sentence.** Same string (Roman's `patientBannerBody` verbatim —
   the draft even matches his live "… sie ist Antragsteller." wording);
   size one step up: `text-sm` (:226) → ≈ 15–16 px.
4. **Buttons** = U7's delta table.
5. **Progress presentation.** Current
   ([chat-view.tsx:145-178](../../app/case/chat-view.tsx)): "{n} von {m}"
   text-xs line, floating petrol %-chip riding the fill edge (with a
   `pt-6` reservation row), `h-1.5` sage-soft track, petrol fill, 12 px
   ring marker. Draft: **no count line** (= U6), **no floating chip** —
   instead a plain graphite semibold "22%" (≈ 12–13 px) left-aligned above
   the track; track height unchanged (≈ 6 px ✅); fill/track colors match
   the shipped tokens ✅; ring marker (petrol ring, light center) stays but
   ≈ 19–20 px (`size-5`) instead of `size-3`. The `pt-6` chip row goes on
   mobile → net height saving that partly funds the bigger title.
6. **Side padding.** Current `px-4` (16 px) → draft ≈ 30 px inset. Width
   only, no height cost — gate question 6b.
7. **Docs badge** absent on the draft's Unterlagen button → gate 6a.
8. Draft shows the Angaben tab only; whether the sage panel also wraps the
   Unterlagen tab's chrome (which since round 3 has its own upload-progress
   bar in the pane) → gate 6c.

Desktop (`lg+`): untouched by U9 — the deltas above are all inside
`lg:hidden` chrome or get `lg:`-guarded classes (U6's label stays on
desktop, the chip/marker treatment stays on desktop).

---

## Affected e2e specs — complete enumeration

| Spec | Touched by | What changes |
|---|---|---|
| [legal-footer.spec.ts](../../tests/e2e/legal-footer.spec.ts) | U5 | F2 :118-131 — the 375×667 loop iteration flips to "footer not visible below lg"; 1280×800 kept; F1 unchanged (desktop viewport) |
| [fallback-notice.spec.ts](../../tests/e2e/fallback-notice.spec.ts) | U2 | **No edits.** Already the never-returns guard (count-0 asserts :132 :140 :167 :178 :194) + the accepted-knock-on suffix asserts (:150 :182 :198), shipped with yesterday's bank-docs pass |
| [mobile-footer.spec.ts](../../tests/e2e/mobile-footer.spec.ts) | U9 (indirect) | No assertion edits expected — it asserts outcomes (controls within 667 px), not chrome pixel values; mandatory re-run as the height-budget gate |
| all other specs | — | No spec reads the progress label, help sheet, burger photo, or logo alignment (verified); `documents-m6` / `feedback-pass` / `completion` untouched by U1–U9 |

Fixtures/goldens: none affected (no questionnaire, document-rule, or
content-row changes anywhere in this round).

## GATE QUESTIONS

1. **U1:** In code and asset, logo/tagline/pills are already flush on one
   left line (evidence above), and the close-up shows a logo the build
   cannot produce (~50 % larger, ~30 px indented). What is the actual ask —
   (a) alignment only (then: DONE; if you see a misalignment on live prod,
   send a full-window screenshot + browser/zoom so I can reproduce), or
   (b) a **larger** logo, flush-left (my reading of the draft; if so:
   `h-10` like auth, or `h-12`)?
2. **U2:** The box shipped out on 2026-08-26 (commit `6b26571`) — your
   screenshot predates that. Confirm Phase 2 is ledger-status-only (Roman's
   ruling recorded, German preserved as above) and that the inert
   `docs.fallback_notice` DB row **stays** (zero migrations, as expected).
3. **U3:** "Everywhere" — does the mobile help sheet's "RP" initials circle
   (burger → Hilfe) also become the real photo (recommend yes), and may
   `public/roman-placeholder.svg` be deleted once nothing references it
   (git history keeps it)?
4. **U4:** The right slide-over you saw on the pre-step page is the burger
   help panel in the sm–lg band (desktop windows narrower than 1024 px).
   Unify scope: (a) modal at `sm+` (burger help becomes the centered modal
   too; true-mobile < sm keeps the bottom sheet — my recommendation), or
   (b) modal only at `lg+` (the sm–lg slide-over stays)? Also confirm the
   modal spec: centered, dimmed backdrop, ≈ `max-w-md`.
5. **U5:** Do the auth screens (login/register/email-sent) also lose the
   links below `lg` (recommend yes — "below lg entirely"), or the case
   shell only?
6. **U9/U7 ambiguities** (drafts silent or loose):
   a. Docs badge "· n offen" on the mobile Unterlagen button — keep despite
      the drafts omitting it (recommend keep: it is the only mobile signal
      for open documents), or drop on mobile?
   b. Side inset: adopt the draft's ≈ 30 px or keep the shipped 16 px
      (recommend keep `px-4`; pure width, drafts look loosely drawn here)?
   c. Does the sage panel treatment also apply to the chrome when the
      Unterlagen tab is active (recommend yes, symmetric)?
   d. Button height: the drafts' ≈ 40 px is under the repo's 44 px touch
      floor (E-7) — I recommend keeping `min-h-11` and adopting only
      centering/fill/gap/radius. Confirm.
   e. Button radius ≈ 6–8 px per the drafts vs the shipped 12 px — adopt
      the drafts' (`rounded-lg`) or keep `rounded-xl`? (The desktop close-up
      and R2 mockup each show yet another radius, so naming one canonical
      value here settles U7's last delta.)

**Phase 2 expected shape once gated:** component/CSS edits in
`case-tabs.tsx`, `chat-view.tsx` (ProgressBar variant), `help-sheet.tsx`
(modal variant), `page.tsx` (variant flip, photo swap, legal-footer block
removal), `(auth)/layout.tsx` (footer gating), `public/roman-photo.jpg`
(new, optimized) − `public/roman-placeholder.svg` (deleted), one
legal-footer.spec edit, ledger updates (U2 disposition, U3 photo resolved),
full local e2e incl. mobile-footer + fallback-notice, feature branch →
preview suite → founder merge. Zero migrations.
