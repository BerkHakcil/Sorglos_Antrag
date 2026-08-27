# Session context — fresh-session briefing

> **DRAFT (2026-08-27) — founder review pending.** Recreated from repo
> sources only (CLAUDE.md, docs/feedback/\*, docs/document-rules/\*,
> supabase/migrations history). Read CLAUDE.md first; this file adds the
> working context CLAUDE.md deliberately doesn't carry. When the two
> disagree, CLAUDE.md wins.

## What this is

Sorglos Antrag — a German-language Next.js 16 + Supabase (EU) app that
guides relatives of care-home residents through a _Hilfe zur Pflege_
application: WhatsApp-style questionnaire, document uploads, near-complete
case for the team. Small scale (~7 partner homes, 20–50 cases/month);
correctness, trust and security over scaling. Prod:
https://sorglos-antrag.vercel.app (Vercel team `sorglos-antrag`, fra1;
pushing `main` auto-deploys). ONE Supabase project total — previews, local
dev and e2e all hit PRODUCTION data.

## Standing conventions (enforced in every pass)

1. **Verbatim-German rule.** Founder/Roman-provided German ships
   character-for-character — never reworded, never grammar-"fixed". Any
   German a session needs that was not provided is `PLACEHOLDER_DE` plus an
   entry in the ledger `docs/document-rules/german_copy_for_roman.md`.
   All user-facing German lives in data (`static_content`, question rows)
   or `lib/strings/de.ts` — never inline in components.
2. **Real-Data Rule.** Never invent data or provenance. Data changes ship
   with a per-row impact report (current value → new value, row identity,
   tables touched) BEFORE the migration file is written. A stated reason
   must be a verified reason (CLAUDE.md Conventions).
3. **Migrations: founder-pushed, never by the agent.** The agent writes
   dated SQL in `supabase/migrations/` with loud aborting DO-block
   assertions + RAISE NOTICEs, then STOPS. The founder runs
   `supabase db push` from the repo root. Migration-before-code ordering
   for columns; row additions/updates are the benign class.
4. **Preview-gated e2e.** Full Playwright suite (`tests/e2e/`) runs against
   a Vercel preview URL with the bypass secret from `.env.local`
   (`E2E_BASE_URL` + `VERCEL_AUTOMATION_BYPASS_SECRET`). Local full-suite
   drives are a known-flaky fallback (dev-server refresh latency; see
   mobile_round3_phase2.md e2e section). `completion.spec` needs a fresh
   fixture (`node scripts/create-test-user.mjs`) per run. e2e users are
   created via the admin key on PROD and cleaned up per-user — never
   bulk-delete by pattern.
5. **Two-phase pattern with a hard gate.** Phase 1 is read-only discovery
   producing `docs/feedback/<slug>_phase1.md` (classification DONE /
   PARTIAL / NEW, evidence, GATE QUESTIONS); implementation waits for the
   founder's literal "GATE 1 APPROVED" plus gate answers. Phase 2 builds
   only PARTIAL/NEW, ends with a session report (files changed, ledger
   entries, e2e results, deferred). State files
   (`docs/feedback/<slug>_state.md`) carry resume protocol.
6. **Git hygiene.** Stage explicit paths, never `git add -A`. Commit/push
   only when the founder asks; gated feature branches keep `main` and the
   branch deliberately different.

## Current state (as of 2026-08-27)

- **`main` = 28f953e** (fallback-doclist close-out). The working tree holds
  the **UNCOMMITTED Mobile UI Round 3** changes — the founder reviews and
  commits the round as a whole. Records:
  `docs/feedback/mobile_round3_phase1.md` (discovery + gate answers
  context) and `mobile_round3_phase2.md` (execution + e2e + R10 impact
  report).
- **One migration is PENDING founder push:**
  `supabase/migrations/20260827000001_mobile_round3_docs_intro.sql` —
  UPDATEs `static_content.'docs.area_intro'` to the founder's R10 sentence
  (impact report at the top of mobile_round3_phase2.md). Until pushed, the
  docs page shows the old intro plus the new type/size secondary line
  (cosmetic duplication, self-heals).
- **Mobile Round 3 in one line:** below `lg` the case shell is burger menu
  (Hilfe = HelpSheet, Roman-photo placeholder, `tel:+491789125300`, logo,
  Abmelden) + applicant-name top bar + pinned subheader + Angaben/
  Unterlagen pills; autosave notice dismisses on scroll once per login
  session; docs pane gained a mobile upload-progress bar; the GLOBAL
  palette is now the six brand colors (Black `#2F2B2C`, Orange `#C44F15`,
  Dark green `#245B5A`, Light green `#DDE8DE`, Cream `#F8F3EB`, White
  `#FFFDFA`) plus documented derived tints; error red survives as the one
  `--semantic-error` exception. Desktop layout untouched (its pass comes
  later; the docs progress bar is `lg:hidden`).
- **M8 (read-only admin) is SHELVED — not cancelled** — at Gate 1 on
  2026-08-25 in favor of M9. `docs/feedback/m8_admin_state.md` carries the
  shelved header; `m8_admin_phase1.md` remains a valid discovery reference
  (notably: `document_upload` has no admin RLS policy; everything runs
  against the one prod Supabase; DAL fetchers need client injection;
  `docs/architecture.md` §3.2 is stale).
- **Fallback docs fix shipped 2026-08-26:** the fallback checklist is the
  purged generic default with NO notice banner; the per-office period
  suffix stays suppressed on fallback lists. `docs.fallback_notice` row
  exists but is inert (unmapped in `lib/dal.ts`).
- **Open PII decision (no names here on purpose):** a 2026-08-27 sweep
  found two real-customer surnames in historical `docs/feedback/` reports,
  the milestone log, the Roman ledger and
  `scripts/verify-fallback-doclist.mjs` — in the working tree AND in
  pushed `origin/main` history. Do not copy those names into new files.
  **Status: current-tree redactions APPLIED 2026-08-27** (names → case
  ids, customer/founder e-mails redacted, filenames elided; the verify
  script now matches hidden uploads by rule id, re-verified green against
  prod) — **the history scrub of `origin/main` is still an OPEN founder
  decision**; every pre-edit hit remains in pushed commits.

## Open Roman queue (details in `docs/document-rules/german_copy_for_roman.md`)

1. Real photo of Roman (burger menu + HelpSheet `photoSrc`); neutral
   silhouette placeholder ships meanwhile.
2. Two phone numbers on purpose: burger dials `tel:+491789125300`
   (founder-specified verbatim), HelpSheet shows `contact.phone`
   ("0159 0469 5761") — which number wins is Roman's call.
3. "…sie ist **der** Antragsteller." — Roman's live row stands; the
   founder's round-3 variant without "der" awaits his decision
   (one-line UPDATE if adopted).
4. Three PLACEHOLDER_DE screen-reader labels of the burger menu
   (`case.menu.*`: "Menü", "Menü öffnen", "Schließen").
5. The relocated type/size sentence ("Erlaubt sind PDF, JPG, PNG und HEIC
   bis 15 MB pro Datei.") now lives in `de.ts` (`case.docs.typesLine`) —
   no longer DB-editable.
6. Older, still-open ledger items: auth email texts (Roman-owned, Supabase
   dashboard); Marzahn-Hellersdorf own document list (backlog — first real
   customer's district); vocabulary mismatch "Unterlagen" (nav) vs
   "Dokumente" (docs.\* rows) — founder said leave until Roman cares.

## Operational gotchas (verify before relying — see also agent memory)

- Supabase rejects `.invalid`-TLD signups via the public UI and
  rate-limits signups fast; e2e users go through the admin key.
- `auth.spec` signup tests are KNOWN SKIPs unless `E2E_ALLOW_SIGNUP=1`
  (prod has email confirmation on).
- `mobile-footer.spec.ts` defaults `BASE` to PROD when `E2E_BASE_URL` is
  unset — always set `E2E_BASE_URL` explicitly.
- The mobile case shell is a locked `h-dvh` column: every pinned pixel
  above the answer footer costs footer height at 667px viewports
  (2026-08-11 field bug). `mobile-footer.spec.ts` is the regression gate;
  the multiselect option-list cap in `question-renderer.tsx` is derived
  against the current pinned chrome.
