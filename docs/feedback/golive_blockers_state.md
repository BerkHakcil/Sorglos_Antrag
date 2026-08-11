# Go-live blockers — legal links + fallback-list banner — ✅ SHIPPED 2026-08-09

> BOTH items are LIVE ON PROD and verified same-day. Everything below the
> "shipped record" section is the historical mid-session state (the STOP on
> two blockers, both since cleared); kept as the record of what happened.

## Shipped record (2026-08-09)

**Blockers cleared same-day:** (1) the founder regenerated the Vercel
automation bypass secret in the NEW team's Deployment Protection settings
(first `db push` attempt from `C:\Users\Berk` hit the known wrong-directory
signature — the suggested `migration repair --status reverted` was NOT run;
re-run from the repo root applied cleanly); (2) migration `20260809000001`
applied — NOTICE fired, row verified byte-identical on prod read-only.
R8 order held: migration first, code merge after.

**Gate:** full suite vs the immutable `golive-fallback-banner` preview —
**17 passed / 13 skipped (known auth block) in 3.9 min, zero failures, zero
stalls** — the first single-run all-green gate since the machine-stall class
appeared. Includes the new fallback-notice spec (positive 21682 banner leg
green on the preview post-migration) and the legal-links assertions.

**Merge:** `main` fast-forwarded `7fdb15c → beb631d` (both features + docs),
prod deployed. Follow-up `c0667f8`: the statically prerendered /agb +
/datenschutz redirect pages served HTTP 200 with a 1-second meta refresh —
replaced by next.config `redirects()` for a real routing-layer 307 (targets
still from `lib/legal-links.ts`).

**Live on prod (all green):** committed specs re-run vs prod 4/4 (F1 21682
banner + placeholder, F2 13187 no banner, F3 45127 no banner + suffix,
legal-links exact hrefs); scratchpad drive proved 21682 resolves to office
`…0062` (Stade, rule-less) yet carries the BERLIN questionnaire id in the DB,
opens on "Wie lautet Ihr Vorname?", and renders the banner with the migrated
German ABOVE 11 default slots; both /hzp/ targets fetch 200; /agb +
/datenschutz 307 to them (3/3 consistent after edge propagation).

**Hygiene:** every throwaway from this session deleted (spec afterEach +
per-run checks); completion fixture freshly re-seeded and kept. ⚠ Pre-existing
leftovers flagged, NOT deleted (verify-per-user rule): 4× old
`pw-completion+17828…`, 2× `pw-vis+17829…`, `pw-vis-married+17855…`, and
`pw-vis-stale+17855…` (the pass-4 resume-report TEST case `deb82390` —
knowingly kept then). Decide + sweep deliberately in a hygiene pass.

**Still with Roman:** banner text is PLACEHOLDER_DE (ledgered); no Impressum
link exists anywhere in the app (observation, out of scope this session).

---

## Historical mid-session state below (blockers since cleared)

**Session: 2026-08-09.** Branches (both pushed to origin = BerkHakcil):

- `golive-legal-links` (`bedbdbf`) — Task 1, code only, no migration.
- `golive-fallback-banner` (`c937fad`, contains Task 1 too) — Task 2 code +
  migration `20260809000001_docs_fallback_notice.sql` + this docs commit.

## ⚠ BLOCKERS (human actions, in order — CLEARED 2026-08-09, see shipped record)

1. **Vercel automation bypass secret is DEAD after the team transfer.**
   Verified 2026-08-09 on the fresh preview
   `sorglos-antrag-git-golive-legal-links-sorglos-antrag.vercel.app`: with
   `x-vercel-protection-bypass` + `x-vercel-set-bypass-cookie` headers the
   response is still a 302 to `vercel.com/sso-api` (same as without). The
   MCP/API token also cannot see the new team (`sorglos-antrag`) — only
   `berk-solutions`. **Action: regenerate the Protection Bypass for
   Automation secret in the NEW team's project → Settings → Deployment
   Protection, update `VERCEL_AUTOMATION_BYPASS_SECRET` in `.env.local`.**
   Both preview gates are blocked until then.
2. **Founder push of migration `20260809000001_docs_fallback_notice.sql`**
   (`supabase db push`) — one additive `static_content` row
   (`docs.fallback_notice`); expect the NOTICE `docs.fallback_notice present
and non-empty`. Config table, zero user rows. Until it lands, the banner
   correctly renders nowhere (empty-text degradation, unit-pinned).

## Task 1 — AGB/Datenschutz links (code done, ship blocked on gate)

Inventory (complete): signup form Datenschutz + AGB consent links (the only
legal links in the app; previously internal `/datenschutz`, `/agb`), the two
internal placeholder pages themselves, and the now-unused de.ts page strings
(left in place — zero German changes). NO footer legal links exist anywhere,
NO static_content legal rows, login/reset pages carry none, the two
consent-info-popovers are plain text. **No Impressum link exists in the app
at all — flagged to the founder as an observation (out of scope).**

Wired: both consent links → `https://www.sorglosantrag.de/hzp/agb` /
`…/hzp/datenschutz` (constants in `lib/legal-links.ts`), external,
`target=_blank rel="noopener noreferrer"`, consent sentence German
byte-untouched. The internal `/agb` + `/datenschutz` routes now 307-redirect
to the same URLs (no visitor may see "wird in Kürze veröffentlicht" while
the real documents are live). Pre-wiring verification: both URLs HTTP 200;
apex (non-www) 308-redirects to www — www is canonical.

Tests: new NON-skipped e2e block in auth.spec.ts (`Legal links (go-live)`)
asserting exact hrefs, target/rel, and zero internal legal anchors —
**green against localhost 2026-08-09**. Unit/verify/build all green.

## Task 2 — out-of-coverage banner (code done; migration awaits push)

Trigger: `getDocumentData` (lib/dal.ts) now returns `rulesSource`
(`'own' | 'fallback' | 'none'`) derived inside the existing query flow — no
second query. Pure gate `fallbackNoticeText` (lib/docs-pane.ts, 5 unit
tests): notice renders ONLY for `rulesSource='fallback'` + pane mode
`'list'` + non-empty text. Pankow/Essen (own rules) can never show it; the
pre-PLZ placeholder state is untouched.

Render: sage info panel (E-3/E-5 pattern, semantic palette — informational,
not amber/red), `data-testid="fallback-notice"`, above the first document
group in document-area.tsx, Info icon, notice text from static_content
`docs.fallback_notice` (PLACEHOLDER_DE — ledgered in
`german_copy_for_roman.md`, awaits Roman's blessing).

Local verification (2026-08-09, vs prod Supabase, throwaways deleted, leak
sweep 0): F2 Pankow 13187 full own list NO banner ✅; F3 Essen 45127 own
list + "(letzte 4 Monate)" suffix intact NO banner ✅; F1 21682 pre-PLZ
placeholder unchanged + fallback checklist renders, then failed EXACTLY at
the banner-visible assert — the designed pre-migration degradation (the
static_content row does not exist yet). Unit 224/224, verify + prod build
green.

## Resume steps (after both blockers clear)

1. Re-verify bypass: `curl -H "x-vercel-protection-bypass: $SECRET" -H
"x-vercel-set-bypass-cookie: true"` against the freshest preview → expect
   200, not 302/sso.
2. Confirm migration applied (read `static_content.docs.fallback_notice` on
   prod, non-empty).
3. Gate `golive-fallback-banner` (superset branch): full suite vs its
   preview (`E2E_BASE_URL=https://sorglos-antrag-git-golive-fallback-banner-sorglos-antrag.vercel.app`),
   standing ~3min expectation, 15-min tripwire, machine-stall class on
   record (re-run single specs vs the SAME deployment on stall signatures).
4. Merge to main (fast-forward carries both commits + docs), prod deploy.
5. Live checks on prod with throwaways, then delete + leak-sweep:
   21682 → Berlin questionnaire + default list WITH banner above it;
   13187 → full Pankow list NO banner; 45127 → Essen list with
   "(letzte 4 Monate)" NO banner; /signup → both legal links exact +
   fetch both targets 200; /agb + /datenschutz redirect externally.
6. Update this file + the milestone-log entry from "pending" to verified.

---

# Follow-ups (2026-08-11) — ✅ SHIPPED: fallback suffix + mobile footer

Branch `golive-followups` (commits `346bb08` suffix, `ed66a80` mobile),
merged to `main` (`ed66a80`), prod-deployed and live-verified 2026-08-11.
No migration this round (both fixes code-only).

**1 — Fallback lists no longer make the period claim.** `periodSuffix`
gained a REQUIRED `fromFallbackRules` param (suppress wholesale); the
trigger reuses `rulesSource === 'fallback'` — the banner's exact signal,
no second query, deliberately independent of the banner's text row. Sweep
confirmed exactly two render sites (checklist + export documents.md);
period*months touches nothing else user-facing (not storage paths, not
filenames, not answers.md). BONUS FIND, fixed: `case-export.mjs` never
replicated the default-office fallback — fallback-population cases had a
checklist in the app but "\_no rules*" in documents.md. The export now
mirrors dal.ts (own office → app_config default), marks fallback exports
with a note line, and omits suffixes there. Verified on prod data: fallback
export = 11 slots + note + 0 "letzte"; Pankow export keeps
"Kontoauszüge (letzte 4 Monate)". Own-office rendering byte-unchanged
(unit-pinned + F2/F3 e2e).

**2 — Mobile: tall multiselects clipped the save buttons.** Verified
mechanism (NOT vh-vs-dvh; shell already h-dvh): the active card renders in
the shrink-0 answer footer below the only scroller inside overflow-hidden
ancestors; a 7-option bulk pushed the Weiter row off-screen unreachably —
measured 703px button bottom on a 667px viewport; iOS worst because its
toolbar never collapses (document never scrolls), so dvh stays small.
Fix: (a) multiselect option list `max-h-[35dvh] sm:45dvh` + overflow —
buttons visible with ZERO scrolling; (b) footer `shrink-0` removed +
`min-h-0 overflow-y-auto` — flexbox hands it exactly the remaining height,
so ANY oversized card (locked card incl.) scrolls within the footer instead
of clipping. Desktop renders unchanged (caps never bind on current
content). New `mobile-footer.spec.ts`: full Essen 45326 drive at 375x667
(iPhone SE class — 812 minus real browser chrome; at 812 the bug does NOT
fire, measured), asserting every multiselect (7, 7, and the 9-option
tallest, found programmatically) and group prompt fully in-viewport,
locked card + docs tab sane.

**Gate + live:** preview suite **18 passed / 13 known-skipped, 4.9 min,
zero stalls**; prod: mobile 45326 drive green, F1 (banner + suffix-free
Kontoauszüge) / F2 (Pankow suffix intact) / F3 (Essen suffix intact) green;
export pair verified; leak sweep 0. One transient at deploy-flip: the first
prod run failed 4/4 at the FIRST login fill (machine-stall class signature,
all recovered on immediate re-run against the same deployment; on record).
Stale m7 comment ("Essen has no rules") corrected per the verified-reason
rule.

**⚠ HUMAN FOLLOW-UP — real-device check (emulation approximates iOS):**
on an iPhone (Brave or Safari), log in with a test account, PLZ 45326,
answer until "Trifft eine dieser besonderen Einkommens- oder
Rentensituationen auf Sie zu?" appears, tap "Nein, nichts davon", tap
"Weiter" — the next question must appear with the button visible without
any scrolling. If anything is still clipped, screenshot + report.
