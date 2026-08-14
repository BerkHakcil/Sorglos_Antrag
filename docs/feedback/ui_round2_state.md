# UI round 2 — session state

> Resume protocol: read this file first, then the Phase-1 report
> (`ui_round2_phase1.md`). Branch `ui-round2`, built continuously per the
> founder's compressed-gating GO (2026-08-14): commit + push + gate per
> sub-phase, but STOP only at **Checkpoint 1 (after R2-2)** and
> **Checkpoint 2 (after R2-6)**. E-8 items (R2-7..R2-10) stay individually
> gated after Checkpoint 2 and are droppable one by one.

## ✅ RESOLVED 2026-08-14 — preview gate restored

The founder regenerated the Protection Bypass secret; `.env.local` updated.
Verified: bare request 302s, bypass request 200s, and the served CSS carries
the `lg:w-72` / `xl:w-80` sidebar utilities — i.e. the BRANCH build, not main.
(Probe note: with `x-vercel-set-bypass-cookie` the first response is a 307
cookie handshake — curl needs `-L` plus a cookie jar or it looks like a
failure. Playwright handles this itself.)

**The preview run settles the `visibility.spec` question below: 22 passed /
13 skipped / 0 failed in 5.2 min, single run, no re-runs, visibility green
first try.** Same commit that failed it four times locally. Environmental,
as diagnosed — 5.2 min on preview against 30–50 min locally.

### Historical record — the blocker as it stood

**`VERCEL_AUTOMATION_BYPASS_SECRET` no longer works.** Branch previews 302 to
`vercel.com/sso-api` **with the bypass header set** — verified on both
`…-git-ui-round2-…` and the untouched `…-git-main-…` alias, so it is the
secret/project setting, not this branch. Production
(`sorglos-antrag.vercel.app`) is unaffected and publicly reachable.

The Vercel MCP connector cannot substitute: it is authenticated to the OLD
team `berk-solutions` (`team_3mA8daFNLqEXHTln2gbHLyCu`) while the project now
lives under `sorglos-antrag` (`team_2yd7omDCPBYWlbe5HhPGhYSI`) — every call
403s, and `get_access_to_vercel_url` cannot mint a share link either. This is
the same class as the recorded "bypass secret died in transfer" note.

**What is needed:** re-issue the Protection Bypass for Automation secret in
the Vercel project settings (Deployment Protection → Protection Bypass for
Automation) and put the new value in `.env.local`, **or** authorize the Vercel
connector for the `sorglos-antrag` team.

**Interim gate (documented tripwire fallback, precedent: E-0):** full suite
against the **identical local build**, plus galleries captured with
BEFORE = production (which _is_ current `main`) and AFTER = the local branch
build. Recorded per sub-phase below.

## Phase status

| Sub-phase                  | Status                         | Gate                                                                                                                                                                                                                                                                                                |
| -------------------------- | ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R2-0 hardening             | ✅ done, commit `d6b3c86`      | Full suite vs **branch preview** (the last run before the bypass died): 21 passed / 13 known-skipped / 1 failed → the failure was the documented single-use completion fixture (aborts at its status pre-check, touches no UI); re-seeded and re-run **green**. Cumulative green. Unit 249/249      |
| R2-1 shell/sidebar         | ✅ code done, commit `289a819` | Preview unreachable (see blocker) → local identical build. Serialized run in progress; parallel run against local dev produced the documented **local-stall** class (17 failures, 6+ min slow files), disproved by re-running serialized: fallback-notice 3/3 green in 35 s, completion C1–C7 green |
| R2-1 shell/sidebar (final) | ✅ commit `289a819`            | Serialized local run: **22 passed / 13 known-skipped / 0 failed** (29.4 min). Unit 249/249                                                                                                                                                                                                          |
| R2-2 header/progress       | ✅ code done, commit `0a48bca` | Serialized local run in progress. Unit **255/255** (6 new `caseHeaderTitle` tests). Header renders the FALLBACK title until migration `20260814000001` is pushed — by design, and the reason those tests exist                                                                                      |
| Checkpoint 1               | ⏸ pending                      | founder: push migration, eyeball gallery, give merge word                                                                                                                                                                                                                                           |

## Founder push list — ONE migration, batched (R2-2 + R2-3 rows)

`supabase/migrations/20260814000001_ui_round2_header_content.sql`

Three `static_content` rows, all final copy under the D4 waiver ("approved by
Erman 2026-08-14, Roman review waived"):
`case.header_title_pattern`, `case.header_intro_documents`,
`case.autosave_notice`. R2-2 consumes the first two, R2-3 the third — batched
into one push per founder instruction; an unused row is inert.

Expected NOTICEs, in order:

1. `UI round 2 content present: 3 rows non-empty, title pattern carries both tokens`
2. `header fallback row case.subheading present`

Aborts if any row is missing/empty, if the title pattern lost either
`{first_name}` / `{last_name}` token, or if the `case.subheading` fallback row
is absent. `ON CONFLICT DO NOTHING`, config table, zero user rows.

**R8:** additive rows only, and every consumer `''`-guards (missing key →
`''` by design in `getStaticContent`), so code-before-rows degrades to today's
UI rather than an empty scaffold. Migration-first is still the order used.
**Must be pushed before the Checkpoint-1 merge to prod.**

## Decisions applied this round

- **F1** case-id / PLZ / status row dropped from the case header (R2-2).
- **F2** the Angaben intro reuses Roman's existing `case.patient_banner_body`;
  the separate sage banner is retired, not duplicated (R2-2).
- **F3** the mockup's "Freigabe" sentence NOT adopted.
- **F4** "Datei hochladen" stays.
- **F5** tab says "Unterlagen", `docs.*` pane rows keep "Dokumente" — mismatch
  ledgered for Roman.
- Sidebar breakpoint **lg (1024px)**; below it the shipped mobile layout is
  untouched.
- Badge `/80` opacity dropped (fixes a **pre-existing** 3.72:1 AA miss).
- Disabled-CTA alternative, white-on-white bubbles rejected, chat-card look
  without the inline-input geometry — all as proposed in Phase 1.

## `visibility.spec` — CLEARED on the preview (historical detail below)

**Resolved:** green on the first preview run (5.2 min suite). The diagnosis
below held — it was the local fallback, not the product.

Historical status while the fallback was the only gate: **this spec passed
twice and failed four times on byte-identical code**, and I could not get it to
a clean local re-run. It was the only spec in that state.

Every failure is the same signature and never an assertion: a test timeout with
`[data-testid=answer-footer] button[disabled]` stuck at 2 — the save and skip
buttons, i.e. a save action that never returned. It fails at a DIFFERENT point
each time (step 108, step 0, a `select` save near line 256), which is what rules
out a deterministic product bug.

What passed on that same build argues strongly for environment over product:
`completion.spec` drove a full Berlin questionnaire to `under_review` (C1–C7),
`documents-m6` A1–A6, `feedback-pass` L1–L4 + T1, `m7-regression` R1+R2 (a full
Essen drive), `mobile-footer` M1, `transitive-visibility` T1–T3 — several
hundred successful saves through the same code path. `visibility.spec` is the
longest and most save-dense drive in the suite (100+ steps incl. group
instances), so it is the first to break when saves get slow.

**Root cause is the fallback itself.** A local dev server round-trips every
save to prod Supabase in the EU and re-renders server-side unoptimised; the
suite takes **30–50 minutes** locally against **3–5 minutes** on a preview,
where the production build runs on Vercel EU next to the database. The runs
also degraded measurably as the session went on (`feedback-pass` 7.9 → 10.2 →
14.0 min), and a fresh dev server did not recover it.

**Consequence for the round:** the local fallback is not a dependable gate for
R2-3…R2-6. Restoring the preview bypass secret is now a prerequisite, not a
convenience.

## Deviations on record

1. **Preview gate replaced by the local identical build** for R2-1 onward
   until the bypass secret is re-issued (see blocker).
2. **Local dev cannot be run with parallel workers.** Playwright's default
   parallelism against one dev server compiling on demand produces mass
   timeouts (17 failures) that vanish serialized (`--workers=1`). Any local
   fallback run in this round must be serialized; the tally only counts
   serialized runs.
3. **R2-0's census missed two label anchors** found while wiring R2-1:
   `legal-footer.spec`'s `header img[src="/logo.svg"]` (the top header is
   hidden at lg) and `scripts/ui-gallery.mjs`'s
   `getByRole('tab', { name: 'Dokumente' })`. Both repointed onto testids; the
   Phase-1 blast-radius table was otherwise accurate.
4. **The R2-2 gate caught two real regressions** (`0a48bca` → fixed in
   `d2f8cae`), both worth remembering:
   - **The mobile answer-footer bug was re-created.** The new title/intro
     block sat above the panes as a fixed-height row; on an `h-dvh` column
     that height is taken from the answer footer, and `mobile-footer.spec`
     measured the save control at **702px in a 667px viewport**. The pinned
     block is now desktop-only, with the same title and intro rendered inside
     each pane's scroller below `lg` — which is precisely how the patient
     banner they replace always behaved. **The guard did its job; keep running
     it every sub-phase.**
   - **F1 removed the only render site of the "In Prüfung" status chip**, and
     six spec sites read it. Only two were hard asserts; the other four were
     soft completion probes that would have gone on silently never firing —
     a drive loop losing its termination signal without failing. All six now
     read `[data-testid=locked-banner]`. **Process note:** the Phase-1 census
     marked those green, correctly at the time — the F1 ruling came later and
     invalidated it. A founder ruling that deletes UI must trigger a re-run of
     the census rows that mention it.
5. **Progress bar stays inside the Angaben pane** rather than moving to the
   shell as in the mockup. **DEVIATION ACCEPTED by the founder, 2026-08-14** —
   deliberate, not an oversight.

   Two reasons. The percentage is derived from ChatView's live client state, so
   lifting the bar into the shell would mean lifting the whole questionnaire
   nav. More importantly, **the two bars do not measure the same thing**: ours
   is answered-required-questions ÷ applicable-required-questions, while the
   mockup's folds document uploads into the same number (`0.5 + uploaded/total
   - 0.5`in`unterlagen.tsx`). Rendering our questions-only number above the
     Unterlagen tab would tell a user their documents were counted when they are
     not — a completeness claim we cannot make. The bar therefore lives with the
     questions it counts. Also recorded in the Roman gallery README so it does
     not read as an oversight.
