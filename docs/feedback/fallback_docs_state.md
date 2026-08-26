# Fallback document list fix — session state

> Resume protocol: read this file first, then the Phase-1 report
> (`fallback_docs_phase1.md`). Gated phases, founder approval at the gate.
> Phase 1 was read-only and created exactly two repo files: that report and
> this one (plus one cross-note line in `m8_admin_state.md`, per the brief).
> Branch: none yet — nothing has been built.

## ✅ GATE 1 APPROVED (founder, 2026-08-26) — Phase 2 in execution

Decisions of record:

- **Q1 = Line A**: drop exactly the trio (PAN-016 Nachweis Bedarfsanzeige,
  PAN-017 Polizeiliche Anmeldung im Heim, PAN-018 Mobilitätsnachweis).
  Lines B/C **rejected pending Roman** — the Pankow-only tag on DOC-0004/
  DOC-0012 is treated as a seeding artifact until he confirms otherwise;
  B/C remain one config-row UPDATE away (report §2 gate note).
- **Q2 = shape (a)**: additive `app_config` row `fallback_excluded_rule_ids`.
  The brief's "new rule set + repoint" REJECTED per the rule_id binding
  finding (report §0.2).
- **Q9 = no proactive user notice** for the 4 hidden uploads; erasure by
  request stays served by the manual sweep tool; both affected accounts
  recorded in the milestone log entry.
- **Berlin scope confirmed intended**: non-Pankow Berlin cases are
  fallback-served by design; the purge applies to them.
- Q5/Q6/Q4 were not explicitly ruled; Phase 2 follows the report's
  recommendations (suffix suppression KEPT, `fallbackNoticeText` DELETED,
  Roman informed via the §5 verbatim record) — veto-able at the
  migration-push gate.

## Phase status

| Phase                       | Status                                                                   | Gate                                                                                                                                                                                                                                                  |
| --------------------------- | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Phase 1 discovery + impact  | ✅ DONE 2026-08-25 — READ-ONLY                                           | `fallback_docs_phase1.md`. 6 readers → 4 adversarial verifiers + completeness critic; load-bearing claims re-read by hand; impact numbers from a read-only prod scan mirroring the app derivation, doubly corroborated against the documentary record |
| **Gate 1**                  | ✅ **APPROVED 2026-08-26**                                               | Decisions above; report §2 carries the Line-A note                                                                                                                                                                                                    |
| Phase 2 migration + code    | ✅ PACKAGE READY 2026-08-26 on `fix/fallback-doclist` (commit `6b26571`) | Migration written, NEVER pushed; all runnable checks green (see execution record below)                                                                                                                                                               |
| **Gate 2 (migration push)** | ⏳ **AWAITING FOUNDER**                                                  | Runbook below: review package → push migration → verify (POST mode) → merge branch → prod checks; no merge to main before the push                                                                                                                    |

## Phase 2 execution record (2026-08-26)

**Branch `fix/fallback-doclist`, one package commit; nothing merged, nothing
pushed to any remote, no DB write of any kind.**

What ran green locally:

- `npx vitest run` — **279/279** (13 files; new: `rules-source.test.ts`
  ladder + fail-open matrix incl. the executable benign-deploy-ordering
  proof, `fallback-doclist.test.ts` Line-A purge gate: migration/fixture
  lockstep, subtraction golden byte-diff vs the committed
  `default-golden-slots.json` AND vs pankow-golden minus excluded rules,
  fresh list 11→8, hide-but-retain, classifyUploads).
- `npm run verify` — typecheck, eslint (0 errors; 1 pre-existing warning in
  untouched `chat-view.tsx`), `format:check`, `check:encoding` all green.
- `node scripts/verify-fallback-doclist.mjs` — **PRE mode ALL PASS against
  live prod** (GET-only): the Phase-1 baseline still holds exactly (no case
  drifted since 2026-08-25), `docs.fallback_notice` row untouched, and both
  own-office rule sets (Pankow 49, Essen 56) resolve byte-identically with
  and without the exclusion list — through the same `lib/rules-source.ts`
  the app now runs.

**Cannot run now (pending, with owner):**

- **e2e** (incl. the flipped F1) — needs the branch pushed + a Vercel
  preview + a valid `VERCEL_AUTOMATION_BYPASS_SECRET` (M8 Q11 still open);
  runs under the established throwaway-user protocol at the preview gate.
- **verify-baseline.mjs local replay** — founder-run (`supabase db start` +
  `reset`); expect the exclusion row as "extra in local" until the push
  (normal pending-migration state, not drift).
- **POST-mode verification** — after the founder's `supabase db push`.
- **`git push origin main`** — Step 0's push was **blocked by the session's
  permission classifier** (push-to-main deploys prod). Commits `bcd333b`
  (Phase-1 docs, Gate 1 approved) and `41d65bc` (prettier chore on those
  docs — required or CI's blocking format:check fails on the next main
  push) are LOCAL on `main`; the founder runs the push.

## Gate 2 runbook (founder)

1. `git push origin main` (the two local docs commits; docs-only deploy).
2. Review the package: `git diff main fix/fallback-doclist` — especially
   `supabase/migrations/20260826000001_fallback_excluded_rule_ids.sql`.
3. Optional but recommended: push the branch → Vercel preview → e2e gate
   (`npx playwright test` with the preview URL), bypass-secret permitting.
4. **Push the migration** (repo root): `supabase db push`. Guards abort on
   any mismatch (ids must be active rules of the default office; a
   pre-existing conflicting row fails loudly).
5. `node scripts/verify-fallback-doclist.mjs` **from the branch checkout**
   (it uses the branch's `lib/`) — must print POST mode, ALL CHECKS PASSED:
   per-case Line-A numbers (52e364f1 stays missing 0 with its 3 files
   not_required; 78293a6c 18/5 with 1; Essen 13/7 untouched), config row
   exact, own-office byte-identity.
6. Merge `fix/fallback-doclist` → `main`, push (prod deploy: banner gone,
   purged list live). Either order relative to step 4 is proven safe
   (fail-open row-add), but migration-first makes the user-visible change a
   single step at the code deploy.
7. Post-deploy: re-run the verify script + `fallback-notice.spec.ts` against
   prod; append the verification numbers to the milestone-log entry and flip
   it from GATED to SHIPPED; close this state file.

## The findings that shaped the plan

1. **The brief's premise grew:** 8 live cases now (M8 counted 4 on
   2026-08-16) — 7 fallback-served + **one genuine Essen own-rules case**
   (`ecdf545d`) that must be provably untouched. Three fallback cases are
   locked (`under_review`), two with substantial uploads.
2. **The rule_id join is the defining constraint.** Fallback uploads are bound
   to Pankow's real rule ids; the brief's literal "new rule set + repoint"
   under new ids would detach EVERY fallback upload (the complete case
   `52e364f1` would flip from missing 0 to all-missing). Shapes (a)/(b)
   preserve bindings by construction; shape (c) needs an upload-row remap or a
   join-semantics change. Report §0.2/§3.
3. **All three suspect entries confirmed office-specific** (known-limitations
   trio + Roman's master `used_for_offices: "Pankow"`), but the master tags
   FIVE always-mandatory docs Pankow-only (also Pflegegutachten MDK,
   Krankenversicherungskarte) — hence three priced drop lines, founder picks.
   DOC-0016 Sterbeurkunde Partner is generic by the ESS-056 approved override
   and is in no drop line.
4. **Hide-but-retain already exists structurally** — the UI renders uploads
   only inside matching slots; orphaned uploads are unit-test-pinned invisible
   and uncounted. What's genuinely new is the export's `not_required` section
   (today an unmatched upload appears only in `files/`, silently).
   `storage-sweep.mjs` is rule-unaware and cannot selectively delete — safe.
5. **The fallback list serves all non-Pankow BERLIN cases too** (Batch C
   design), not just exotic PLZs — five of the seven fallback cases are Berlin
   residents. Purging applies to them identically; flagged as §8 Q3.
6. **Banner German recovered verbatim** (report §5) for Roman; finalized under
   the 2026-08-13 waiver; the static_content row stays (unread, inert).

## Standing constraints honored in Phase 1

- Read-only: no source edit, no migration, nothing staged or committed. Repo
  writes = the two convention files + the M8 cross-note line.
- Prod access was **GET-only** (REST select); the scan script and raw JSON
  live in the session scratchpad, outside the repo.
- No new German string anywhere; the fix removes exactly one (recorded
  verbatim in report §5).
- M8's `document_upload` RLS finding NOT touched (same subsystem, explicitly
  out of scope).
- Pankow rules, Essen rules, uploads, storage: untouched, unproposed for
  deletion or edit anywhere in the recommended shape.

## M8 interaction (cross-noted in `m8_admin_state.md`)

This fix and M8 Phase 4 exercise the same rules layer and the same two ladder
copies (`lib/dal.ts` + `scripts/case-export.mjs`). **Whichever lands second
re-baselines the case-view equivalence fixtures** — M8's two locked baseline
cases (`52e364f1`, `461038b0`) are both fallback-served, i.e. baselines of
exactly the output this fix changes. Recommended order: this fix first
(report §8 Q7). Whichever goes first should extract the shared pure ladder so
the other consumes it (report §6.1).

## Notes for whoever resumes this

- Impact numbers in report §4 are **assertions for Phase 2's live
  verification**, computed 2026-08-25. If new cases appear or answers change
  before the gate closes, RE-RUN the scan — the table is a snapshot, not a
  contract with future prod. (Two `in_progress` Berlin cases had single-digit
  answer counts at scan time and will grow.)
- The scan mirrors the app path exactly (active-question filter,
  `deriveGroupData 'render'`, ladder, evaluator). Corroborations on record:
  `52e364f1` = 17 slots / missing 0, PAN-016/017/018 among the uploads
  (`golive_round2_batch_c.md:530-532`); fresh fallback list = 11 slots
  (`golive_blockers_state.md:31-35`).
- `completion.spec.ts`'s fixture drives PLZ 10115 → Mitte → **fallback-served
  its entire life** (its office never had rules; Batch C only changed which
  rule-less office it resolves to) — an existing e2e that will exercise the
  purged list automatically; its counts are DOM-relative and survive.
- Shape (a)'s honest cost is governance: the default list stays derived from
  Pankow's live set, so future PAN-rule migrations must re-review
  `fallback_excluded_rule_ids` (standing rule to record in the docs pass).
- The export's fallback preamble (`case-export.mjs:274-280`, English) claims
  "this mirrors the checklist the app shows" — it must be updated in the same
  commit as any ladder change, or it lies.
- Period-suffix suppression (`fromFallbackRules`) is banner-independent and
  survives banner removal untouched; whether to keep it is §8 Q5 (recommend
  keep).
- Shape (a) resume notes: once the migration file is committed but before the
  founder's `db push`, `verify-baseline.mjs` will report the exclusion row as
  "extra in local" — the normal pending-migration state, not drift. Later
  changes to the exclusion list must be UPDATE migrations (the seeding
  `ON CONFLICT DO NOTHING` silently no-ops against an existing row). The
  standing governance rule has TWO triggers: PAN-rule migrations AND
  `default_document_office_id` repoints both re-review the exclusion list.
- Verification pass closed clean: all 4 adversarial verifiers CONFIRMED every
  assigned claim (one citation anchor and one quoted test title corrected in
  place); the completeness critic's 8 findings are folded into report
  §1.6/§3a/§4/§6/§7/§8 Q9/§9.
