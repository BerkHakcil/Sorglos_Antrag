# M8 — read-only admin: session state

> Resume protocol: read this file first, then the Phase-1 report
> (`m8_admin_phase1.md`). Gated phases, founder approval at every gate.
> Phase 1 was read-only and created exactly two files: that report and this one.
> Branch: none yet — nothing has been built.

## ⚠ GATE 1 OPEN — the milestone brief's §2.1 premise is wrong

**`public.is_admin()`, `public.profiles.role` and four admin RLS policies have
existed in production since M1 (2026-06-07).** The brief's §2.1 mandates a new
`admin_users` table plus `create or replace function public.is_admin()` — which
would silently redefine the admin predicate underneath four live policies
(`profiles`/`cases`/`answer`/`status_event` `: admin reads all`).

Per the brief's own §1 and CLAUDE.md's destructive-migration rule, **no migration
was written.** The report is the deliverable instead. Report §9 Q1-Q4 are
blocking; Phase 2 cannot start until they are answered.

## Phase status

| Phase                         | Status                         | Gate                                                                                                                      |
| ----------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| Phase 1 discovery + design    | ✅ DONE 2026-08-16 — READ-ONLY | `m8_admin_phase1.md`. 8 readers → 4 adversarial verifiers → completeness critic; every load-bearing claim re-read by hand |
| **Gate 1**                    | ⏳ **AWAITING FOUNDER**        | Answer report §9. **Q1-Q4 blocking.** No implementation until approved                                                    |
| Phase 2 migration (file only) | ⛔ blocked on Gate 1           | SQL quoted in report §2. Founder pushes manually; live checks in §2.1                                                     |
| Phase 2b admin grant          | ⛔ blocked                     | Split out of Phase 2 deliberately — a production privilege change deserves its own gate                                   |
| Phases 3-9                    | ⛔ blocked                     | Revised plan in report §8                                                                                                 |

## The five findings that changed the plan

1. **`document_upload` has no admin RLS policy, and the failure is silent.**
   `20260711000005:33` `DROP TABLE IF EXISTS public.document_upload` destroyed
   the M1 `document_upload: admin reads all` policy along with the table. The
   replacement has three own-case policies only, and its
   `USING (case_id IN (SELECT id FROM public.cases WHERE user_id = auth.uid()))`
   is **doubly self-limiting** — `auth.uid()` is inside the subquery, so no
   additive policy on `cases` widens it. An admin would read every case's answers
   and **zero uploads**, rendering every document as `FEHLT`. No error thrown.
   This is the likeliest way M8 ships a lie. One additive policy fixes it.

2. **Preview deployments, local dev and every e2e run all hit the PRODUCTION
   Supabase project.** One project total, confirmed three independent ways.
   **Any e2e coverage of `/admin` means writing `profiles.role = 'admin'` into
   the production database.** Founder decision (§9 Q10), not a default.

3. **"Skipped questions" do not exist as data.** `skippedIds` is session-only
   client state; no column, no table, no `status_event`. The R2-7 deferred marker
   is a pure display filter over the same Set. Phase 7 narrows to
   answered / unanswered-applicable / not-applicable.

4. **The derivations are all reusable; the fetchers are not.** `buildNav`,
   `evaluateDocumentRules`, `countMissingSlots`, `deriveGroupData`, `isVisible`
   are pure and already accept pre-fetched inputs. But every fetcher calls
   `createClient()` internally and `await cookies()`, and **`getCase()` takes no
   `caseId` at all** — no function in `lib/` loads a case by id. Client injection
   is required, not stylistic. Naive DAL reuse costs 10-12 queries per case
   (500-600 for a 50-case list); batched, ~13 total regardless of case count.

5. **Phase 4's equivalence proof is not executable as specified.** All four prod
   cases are fallback-served (only the `usedFallback = true` branch is
   exercised), two are `in_progress` so `updated_at` moves under you, and
   `exports/` is gitignored, untracked, stale, and its case ids are gone from
   prod. There is no Berlin/Essen golden pair. Revised method in report §4:
   neutralize query non-determinism first, baseline the two **locked** cases,
   then manufacture the missing coverage rather than claim it.

## Prerequisites the brief did not anticipate

- **`allowImportingTsExtensions: true` in `tsconfig.json`.** `lib/case-view.ts`
  must import `'./document-rules.ts'` with the explicit extension (Node needs it;
  Node also cannot read tsconfig `paths`, so **zero `@/…` imports**). TS 5.9.3
  emits TS5097 otherwise. Legal because `noEmit: true` is already set. Today's
  `case-export.mjs` is exempt only because `scripts/**/*.mjs` is never
  typechecked.
- **`dotenv` is not a declared dependency** — `case-export.mjs:23` resolves it as
  a hoisted transitive. An upstream lockfile change silently breaks
  `npm run case:export`.
- **`scripts/storage-sweep.mjs:19`** is a second consumer of the `.mjs → .ts`
  bridge. Phase 4 must not break it.

## Standing constraints honored in Phase 1

- Read-only: exactly two files created, both in `docs/feedback/`, matching the
  `<slug>_state.md` + `<slug>_phase1.md` convention of `ui_round2_*`.
- No migration file written; all SQL quoted in the report for review.
- `supabase db push` not run, not suggested. Founder pushes manually.
- No new German string. M8 introduces none by design.
- Nothing staged, nothing committed.

## Notes for whoever resumes this

- **Cross-note (2026-08-25, fallback-docs fix Phase 1):** the fallback
  document-list fix (`fallback_docs_state.md` / `fallback_docs_phase1.md`)
  exercises the same rules layer and the same two ladder copies (`lib/dal.ts`
  and `scripts/case-export.mjs`) as M8 Phase 4. **Whichever lands second
  re-baselines the case-view equivalence fixtures** — both Phase-4 locked
  baseline cases (`52e364f1`, `461038b0`) are fallback-served, so their
  export output changes when that fix's purge lands (fewer slots, changed
  summary line and preamble, new `not_required` section). Prod has grown to
  8 cases since this report (7 fallback + 1 Essen own-rules) — Phase 4's
  "all four prod cases are fallback-served" premise is stale; an Essen
  own-rules case now exists in prod (`ecdf545d`), which weakens §4's
  "manufacture the missing coverage" requirement for the Essen branch.

- `docs/architecture.md` §3.2 is **stale and dangerous to design from** — it
  still documents `case_document_requirement` and a `document_upload` with
  `requirement_id`/`uploaded_by`, four tables dropped 2026-07-20. Its
  "Anzahl fehlender Dokumente = count where status = please_upload" sentence has
  been false for a month. Phase 9 corrects it.
- **No admin account exists** anywhere — no migration sets `profiles.role =
'admin'`, `supabase/seed.sql` has none. Before pushing anything, run
  `SELECT id, role FROM public.profiles WHERE role = 'admin';` on prod: if a row
  exists, that account **already** has cross-user SELECT on
  `profiles`/`cases`/`answer`/`status_event` today, via the ordinary publishable
  key, with no admin UI involved.
- **`social_office` has never been read by the app** (zero `from('social_office')`
  hits). M8 is its first consumer; the `is_active = true` policy has never been
  exercised by a real read, and the `questionnaire → social_office` join is
  currently broken by a deactivated office.
- Repo greps proved "no RESTRICTIVE policy, no FORCE RLS" about the **repo**, not
  about **prod**. Phase 2 must diff `pg_policies` from live, and must confirm
  `relrowsecurity` is actually true on `storage.objects` — if it is not, the
  three existing case-documents policies are inert no-ops today.
- `app/case/document-actions.ts:55` is `createAdminClient() as any` with an
  eslint-disable. It is the nearest precedent an implementer will copy. Do not
  propagate it.
