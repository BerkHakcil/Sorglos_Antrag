# Go-live blockers — legal links + fallback-list banner — session state

> Resume protocol: read this first. Code for BOTH items is complete and
> locally verified on the two branches below. The session STOPPED on two
> human actions (§ blockers). Do not redo the inventory or re-litigate the
> design — pick up at § resume steps.

**Session: 2026-08-09.** Branches (both pushed to origin = BerkHakcil):

- `golive-legal-links` (`bedbdbf`) — Task 1, code only, no migration.
- `golive-fallback-banner` (`c937fad`, contains Task 1 too) — Task 2 code +
  migration `20260809000001_docs_fallback_notice.sql` + this docs commit.

## ⚠ BLOCKERS (human actions, in order)

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
