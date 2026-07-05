# Hilfe-zur-Pflege — Milestone / Change Log

> Running log of shipped changes, in enough detail that a future Claude Code session
> or a new engineer can understand the current state of the product **without**
> reverse-engineering it from git history. Complements `docs/architecture.md`
> (the source-of-truth design doc; its §7 lists the original M1–M5 milestones).
> Newest entries at the top.

---

## Current state snapshot (as of 2026-07-05)

Quick orientation for anyone picking this up cold:

- **Live app:** https://sorglos-antrag.vercel.app — Next.js 16 + Supabase (EU), Vercel prod region `fra1`.
- **Deploy:** push to `main` on GitHub (`BerkHakcil/Sorglos_Antrag`) → Vercel auto-deploys prod. Vercel team `berk-solutions`, project `sorglos-antrag`.
- **DB migrations:** dated SQL in `supabase/migrations/`, applied to prod with **`supabase db push`** (the CLI is linked; it records each version in `supabase_migrations.schema_migrations`). **Never** apply content via the Supabase dashboard/Studio (see reminders). DDL cannot be run from the Claude Code sandbox — the co-founder runs `db push` after reviewing each migration.
- **Questionnaire is data-driven** (see `architecture.md` §3): categories → questions (some in repeatable `question_group`s) → `question_option`s; answers keyed `(case_id, question_id, group_instance)`.
- **Current category flow order** (`category.sort_order`): `antragsteller` (0) → `wohnsituation` (1) → `einkommen` (2) → `kinder` (3) → `income` (4) → `expenditure` (5) → `wealth` (6) → `additional` (7) → `spouse` (8).
- **Fresh-case required-question count (progress denominator):** **59** for a single applicant (before answering `marital_status`; selecting a spouse status reveals the ~30-question spouse section and it rises, e.g. to ~92 for "verheiratet").
- **Repeatable groups** (`question_group.is_repeatable = true`, all uncapped `max_count = NULL`): `children` (Kinder), `pension`, `other_income`, `bank_additional`, `additional_wealth`, plus the spouse mirrors `spouse_pension`, `spouse_other_income`.
- **Verification tooling:** Playwright **MCP** works (needed `npx @playwright/mcp install-browser chrome-for-testing` once) and the **e2e runner** (`npx playwright test`, bundled Chromium). Live structural checks use an adaptive-loop e2e spec driven against prod; throwaway test users are created via the admin API and deleted in `finally`.

### Migrations added in this pass (all applied + tracked on prod)
| File | Tier | Effect |
|---|---|---|
| `20260703000001_fix_spouse_dependent_visibility_not_value.sql` | 1 | spouse Sonderstatus/life-insurance-amount rules `value:"Ja"` → `not_value:"Nein"` |
| `20260703000002_static_content.sql` | 2 | new `static_content` table + 6 header/footer strings |
| `20260704000001_reorder_front_split_name.sql` | 4 | split name; reorder front of `antragsteller`; move address block in |
| `20260704000002_tier5_categories.sql` | 5 | new `wohnsituation`; rename `dokumente`→`kinder`; delete `familienstand` |
| `20260704000003_tier6_additional_wealth_repeatable.sql` | 6 | make `additional_wealth` a repeatable group |

(All 15 migrations that existed before Tier 4 were backfilled into `schema_migrations` — see Tier 2. The three Tier 4/5/6 migrations were applied via `supabase db push`, which tracks them automatically.)

---

## 2026-07 — Berlin content pass (Tiers 0–6) + engine fixes

Worked in numbered "tiers." Tier 0 was read-only diagnosis; Tiers 1–6 shipped. Each structural content tier used the same two-phase safety pattern (see reminders): a read-only Phase 1 report with explicit flags, then a Phase 2 migration only after the co-founder confirmed the plan.

### TIER 0 — Diagnostics (read-only)
Investigated three suspected problems in the questionnaire engine:

1. **Progress-bar denominator.** Confirmed it is computed *dynamically*, not hardcoded: `buildNav()` (`lib/questionnaire-nav.ts`) sets `totalRequired = flatVisible.filter(is_required).length`, where `flatVisible` is the set of currently-*visible* questions. So the denominator correctly grows/shrinks as visibility changes. No bug in the denominator itself — but it's only as correct as the visibility logic feeding it (see Tier 1).
2. **Dependency re-evaluation.** The client recomputes `buildNav` via `useMemo` on every answer change, and `isVisible` is pure — so editing a trigger *does* re-evaluate dependents. The originally-reported "dependents don't reappear" symptom traced to **data**, not the engine (a controller/typo mismatch already fixed in an earlier migration), plus the two real gaps fixed in Tier 1.
3. **Spouse visibility.** Found the real defect: several spouse dependents (`spouse_special_origin_rights_issued/_issued_by`, `spouse_life_insurance_amount`) were gated `value:"Ja"` on controllers that have **no "Ja" option** (their options are `Nein` + Ausweis/insurance types), so they could *never* show. Root cause was two-fold — the wrong match value *and* the engine's non-transitive visibility. Both addressed in Tier 1.

### TIER 1 — Engine bug fixes
Commit `ac6c4dc` (+ e2e verification `10917d1`). Files: `lib/questionnaire-nav.ts`, `lib/questionnaire-types.ts`, `app/case/actions.ts`, `app/case/chat-view.tsx`.

- **Transitive visibility (`isVisible`).** Previously `isVisible(rule, answers)` only checked whether the question's *own* rule matched. Now it also requires the **controller named by that rule to itself be visible**, applied recursively up the whole chain (cycle-guarded). New signature `isVisible(rule, answers, rulesByKey?, seen?)`; `buildNav` builds a `question_key → rule` map via the new `buildRulesByKey()` and passes it to every call. The old one-level form is preserved for any caller that omits the map.
  - **General principle for all future content work:** a question is reachable only when **every** controller up its dependency chain is also satisfied — not just when its immediate rule value matches. When authoring a visibility rule, ask: *could the controller I reference itself be hidden?* If yes, the child inherits that gating automatically now (which is what makes the Tier 1 spouse fix safe — see below).
- **Stale-answer clearing on hide.** When a saved answer changes such that previously-answered questions become hidden, `saveAnswerAction` (`app/case/actions.ts`) now deletes those now-unreachable answer rows (via `findStaleAnswerRefs()` over `buildNav().flatVisible`) so a later re-show of the trigger re-prompts from scratch instead of resurfacing stale data. It returns the cleared refs; `chat-view.tsx` applies them to local state (`applyClearedAnswers`). Runs only on an explicit save, never on load; the completion gate is unaffected (hidden questions were already out of the required count).
- **Spouse rule value fix** (migration `20260703000001`). Changed `spouse_special_origin_rights_issued`, `spouse_special_origin_rights_issued_by`, and `spouse_life_insurance_amount` from `value:"Ja"` → **`not_value:"Nein"`** (mirroring the working patient-side equivalents). This is only *safe* because of the transitive-visibility fix: `not_value:"Nein"` would otherwise be true when the controller is `undefined` (i.e. hidden for a single applicant), but transitive visibility now also requires the marital-gated controller to be visible, so these stay correctly hidden for non-spouse cases.

### TIER 2 — Header/footer copy → DB + logo + migration-tracking repair
Commits `b86714e` (refactor), `80d30f6` (logo). Migration `20260703000002_static_content.sql`.

- **`static_content` table** (`key`, `value_de`, `updated_at`, RLS: authenticated read). Six header/footer strings moved out of hardcoded `lib/strings/de.ts` into it (honoring CLAUDE.md rule #2 "German text is data"): `brand.tagline`, `case.subheading`, `case.patient_banner_title`, `case.patient_banner_body`, `case.all_answered_heading`, `case.all_answered_message`. Loaded server-side via new `getStaticContent()` (`lib/dal.ts`) and threaded into `app/case/page.tsx` + `chat-view.tsx`. Missing keys degrade to `''` (never throws).
- **Logo.** Added `public/logo.jpg` (the "Sorglos Antrag" lockup) rendered via `next/image` in the brand header, replacing the placeholder box *and* the duplicate wordmark text; tagline kept alongside.
- **Migration-tracking gap (important).** The `static_content` table was first created by hand in Studio (Claude Code can't run DDL). This revealed that **prod had no `supabase_migrations.schema_migrations` table at all** — i.e. *nothing* had ever been tracked; the repo migrations were a reconstruction verified only by the baseline-replay script. Resolution: the co-founder linked the CLI and ran `supabase migration repair --status applied <version>` for **all 15** then-existing migrations, backfilling the tracking table. From that point on, `supabase db push` applies + tracks new migrations normally (used for Tiers 4–6).
- Also in this window: a separate **repo-wide Prettier PR** (`#1`, squash `c8c02a5`) — formatting only, no logic — to get `format:check` green.

### TIER 3 — Question-card category label removed + sticky header
Commit `f676951`. Files: `app/case/chat-view.tsx`, `app/case/page.tsx`.

- **Category label** no longer repeats on the active question card; the category now appears only as a section header in the answered/history view.
- **Sticky header.** Kept the codebase's app-shell pattern (flex column + inner scroll) but fixed the real mobile bug: shell height `h-screen` (100vh, breaks with the mobile address bar) → **`h-dvh`** (dynamic viewport), so the header stays pinned on mobile too. Progress bar stays visible; auto-scroll-to-latest still works; no z-index/overlap issues (flex regions don't overlap).
- **Mobile-specific decision:** the amber patient info-box is **pinned in the header on desktop** but on mobile it is **not pinned** — it renders once at the top of the scroll area and scrolls away — because pinning it left the mobile chat area cramped (~316px). Implemented with `hidden sm:block` (pinned copy) + `sm:hidden` (in-scroll copy).

### TIER 4 — Front-of-flow reorder + name split
Commit `1ca1944`. Migration `20260704000001_reorder_front_split_name.sql`.

- **Name split:** the single merged `name_pflegebedueftiger` ("Vollständiger Name…") was replaced by two required free-text questions **`first_name`** + **`last_name`** (ids `…f1`/`…f2`). The old question was deleted (its 10 pre-launch test answers cascade-deleted).
- **New front order of `antragsteller`:** `first_name → last_name → geburtsdatum → last_residence_plz → last_residence_street → last_residence_city → district_of_birth → …` (rest unchanged).
- **Address block moved:** `last_residence_plz/street/city` moved from `einkommen` into `antragsteller` (later moved again in Tier 5 — see below).
- **"Nursing home selection" is not a questionnaire question.** It's the **pre-questionnaire step** that sets `cases.care_home_id` (via `CareHomeSelector`), which runs before any question renders — so it needed no reorder. Likewise the *routing* PLZ is the pre-questionnaire `PlzForm` (`cases.plz_before_move` → `resolvePlzAction` picks the questionnaire); the `last_residence_plz` *question* is inert data (read by no code, controls no rule), so moving it has zero routing effect.
- Denominator went 59 → **60** here (one question became two).

### TIER 5 — Category restructuring
Commit `4aeb2fc`. Migration `20260704000002_tier5_categories.sql`.

- **New category `wohnsituation`** ("Wohnsituation") at `sort_order = 1` (right after `antragsteller`); subsequent categories renumbered contiguously. It contains the address block (`last_residence_plz`, `_street`, `_city`) — moved again out of `antragsteller` — plus **`apartment_ownership`** ("Was war das Mietverhältnis vor Heimeinzug?"), moved from `einkommen`. `wohnsituation` sits *before* `einkommen` deliberately: `apartment_ownership` controls 5 rent-detail questions still in `einkommen`, so the controller must precede its dependents in flow order.
- **`dokumente` renamed in place to `kinder`** ("Kinder") — same category id `…0003`, so its 8 `child_*` questions and the `children` group followed automatically (no reassignment needed). (The old "Erforderliche Dokumente" category held only the child questions after the earlier document-upload removal.)
- **Deleted the duplicate marital-status question `familienstand`** ("Familienstand der pflegebedürftigen Person", `…0003` question id). It controlled nothing; 9 pre-launch test answers cascade-deleted. The **kept** question is `marital_status` ("Was ist Ihr Familienstand?") — it stays at its Tier-4 front position in `antragsteller` and controls **30 dependents** (the entire spouse section). `familienstand`'s options were a strict subset of `marital_status`'s, confirming which to keep.
- Denominator went 60 → **59** (one deletion).

### TIER 6 — Repeatable groups
Commit `6605c86`. Migration `20260704000003_tier6_additional_wealth_repeatable.sql`.

- **Key finding:** three of the four target sections were *already* repeatable groups (built during M3/earlier group work but not documented as such): **`pension`**, **`other_income`**, **`bank_additional`** all have `is_repeatable = true` and loop via the existing "add another?" prompt. No change needed.
- **Only `additional_wealth` ("Besitzen Sie weitere Vermögenswerte?") was still flat.** Converted it to a repeatable group mirroring `bank_additional`: new `question_group` `additional_wealth` (uncapped), with `additional_wealth_type` + `additional_wealth_amount` as members (their `{value:"Ja", question_key:"additional_wealth_yes_no"}` visibility kept; `additional_wealth_yes_no` stays the flat trigger). 8 stale `group_instance='default'` test answers dropped.
- **How the group mechanism works** (for future reference): instances are *not* rows — each `answer` carries a `group_instance` UUID (or `'default'`). `deriveGroupData` (`page.tsx`) rebuilds `groupInstances`/`groupAnswers` from answers and auto-creates one instance for empty repeatable groups. `buildNav` expands each instance and emits a `groupPrompt` once a group's visible questions are all answered (and it's under `max_count`, `NULL`=uncapped). `chat-view` renders the "Möchten Sie eine weitere {group} hinzufügen?" card (`Ja, hinzufügen` / `Nein, weiter`); "Ja" appends a new instance UUID. History shows a header per instance ("{group} {n}").
- Pension cap decision: kept **uncapped** (consistent with the other groups; a cap is arbitrary and easy to add later if ever needed).
- Verified live: answering the assets trigger "Ja" then the loop prompt produced two instances ("Weitere Vermögenswerte 1" and "…2").

---

## Known open items → Tier 7 (nothing here is done)

- **Country-of-birth dropdown** — `country_of_birth` (and likely the spouse equivalent) is free text; should become a select.
- **Betreuer/Beistand options** — `power_of_attorney` ("Gibt es einen Betreuer oder Beistand?") needs proper options/follow-ups.
- **Year-picker + district-linking** — a year-only picker where appropriate, and linking the Berlin district fields (`berlin_since` / `berlin_district_since`) to the residence data.
- **"Mietfrei bei Freunden/Familie" option** — add to `apartment_ownership` (current options: `Eigenheim`, `Eigentumswohnung`, `Mietwohnung`). Intentionally deferred from Tier 5.
- **Insurance question reorder** — reorder the `expenditure` insurance questions (health/care/liability/life).
- **IBAN copy fix** — the two IBAN questions (`bank_giro_iban`, `bank_savings_iban`) share the identical prompt "Was ist Ihre IBAN Nummer?"; disambiguate.
- **Pension "none" option** — `pension` has no yes/no gate (its entry `pension_type` always shows one instance). Add a "keine Rente" path so applicants with no pension aren't forced to enter one.
- **Repeatable-group loop-prompt wording** — the shared template `"Möchten Sie eine weitere {group} hinzufügen?"` reads awkwardly for group labels starting with "Weitere" or that aren't feminine-singular, e.g. "eine weitere **Weitere** Vermögenswerte" and "eine weitere **Weitere** Bankkonten" (and "eine weitere Kinder" / "…Sonstige Einkünfte"). Fix needs a **per-group prompt override** rather than the one shared template. Exact corrected strings from the co-founder (Roman), ready to apply:
  - `pension` → "Möchten Sie weitere Renten hinzufügen?"
  - `other_income` → "Möchten Sie sonstiges Einkommen hinzufügen?"
  - `bank_additional` → "Möchten Sie weitere Bankkonten hinzufügen?"
  - `additional_wealth` → "Möchten Sie weitere Vermögenswerte hinzufügen?"

---

## Project-wide reminders (restate every session)

1. **Migrations only — no dashboard/Studio content edits.** All content/schema changes go through dated `supabase/migrations/*.sql` applied with `supabase db push`. If Studio is *ever* used for something urgent, **immediately** backfill the migration history (`supabase migration repair --status applied <version>`) — the Tier 2 discovery showed that skipping this leaves prod untracked and creates repo↔DB drift. Migrations are the single source of truth (CLAUDE.md #8).
2. **Transitive-visibility principle (from Tier 1).** Any new/edited `visibility_rule` must consider whether its referenced *controller could itself be hidden*, not just whether the immediate value matches. `isVisible` now enforces this recursively, so authoring `not_value:"Nein"` on a controller that can be `undefined`/hidden is safe *only* because the chain is also checked — reason about the whole chain.
3. **Two-phase pattern for structural changes.** For anything touching ordering, categories, question IDs, or deletions: do a **Phase 1 read-only report with explicit flags** for every ambiguous call, get human confirmation, then write the **Phase 2 migration**. Don't skip it even when a change looks trivial — Tiers 4/5/6 each surfaced a non-obvious issue (e.g. "nursing home" isn't a question; the address block spanned two categories; three of four "repeatable" sections were already done; a controller-before-dependents ordering constraint). Confirm answer counts before any cascade delete (pre-launch test data only so far).
4. **Verification is live.** Prove content/engine changes against prod with Playwright (MCP or the e2e adaptive-loop runner): check flow order, that expected controllers still gate their dependents, and that the progress denominator changes by exactly the expected amount. Create throwaway test users via the admin API and delete them afterward.
