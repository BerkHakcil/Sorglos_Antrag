# M8 — read-only admin: Phase 1 discovery + design report

> Read-only pass. No source file, migration, test or scaffold was created —
> this report and `m8_admin_state.md` are the only two files this phase wrote.
> All SQL below is **quoted for review**, not written to `supabase/migrations/`.
>
> Method: 8 parallel read-only readers over the discovery checklist, then 4
> adversarial verifiers instructed to refute the readers, then a completeness
> critic. Every load-bearing claim below was read directly from the repo by me
> as well; where the verifiers corrected the readers, the correction is what is
> recorded here.

---

## 0. Headline — the milestone brief's §2.1 premise is wrong, and acting on it would be destructive

**`public.is_admin()` already exists. `public.profiles.role` already exists. Four
live RLS policies already grant admin cross-case reads.** All of it shipped in
M1 on 2026-06-07 and has been in production ever since.

```sql
-- supabase/migrations/20260607000002_rls_policies.sql:26-33  (LIVE)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
$$;
```

Four policies depend on it today — `profiles: admin reads all` (:121),
`cases: admin reads all` (:147), `answer: admin reads all` (:174),
`status_event: admin reads all` (:259).

The brief's §2.1 requires `create or replace function public.is_admin()` with a
body reading a **new `admin_users` table**. That statement does not create
anything — it **silently redefines the admin predicate underneath four live
production policies**, changing the meaning of "admin" for all of them in one
transaction. The brief's own §1 says: _"If any step would alter, replace, or
drop an existing RLS policy, table, column, or function: stop and produce the
impact report instead of writing the migration."_

**This is that case. I have stopped, and this is the report.**

§2.1's two rejected alternatives (JWT `app_metadata`, env-var allowlist) were
rejected for reasons — staleness until token refresh, and Postgres not being
able to see Vercel env vars — that a `profiles.role` column satisfies exactly as
well as a new `admin_users` table would. It is a database column, visible to
RLS, revocable with immediate effect, already audited (the M5 RLS audit ran
50/50, milestone log :13). **Recommendation: keep it. Do not introduce
`admin_users`.** §9 Q1 puts the decision to you.

### The second headline: the admin RLS layer is half-demolished, and it fails _silently_

`20260711000005_m5r2_office_tables.sql:33-36` dropped four legacy tables:

```sql
-- ── Legacy M1 placeholders: superseded, zero code references, zero rows ───────
-- Dropped BEFORE the new tables: the M1 schema already had a document_upload
-- (old shape, FK to case_document_requirement) whose name the new table reuses.
DROP TABLE IF EXISTS public.document_upload;
DROP TABLE IF EXISTS public.case_document_requirement;
DROP TABLE IF EXISTS public.document_rule;
DROP TABLE IF EXISTS public.document_type;
```

`DROP TABLE` drops the table's policies with it. That deleted **seven** policies,
two of them admin policies — `document_upload: admin reads all` and
`case_document_requirement: admin reads all`. The replacement `document_upload`
(:70-93) was created with **three own-case policies and no admin policy**:

```sql
CREATE POLICY "document_upload: own case select" ON public.document_upload FOR SELECT TO authenticated
  USING (case_id IN (SELECT id FROM public.cases WHERE user_id = auth.uid()));
```

The consequence, verified: that policy is **doubly self-limiting** — `auth.uid()`
sits _inside_ the subquery, so it cannot be widened by any additive policy on
`cases`. An admin reading through the session client today gets **every case's
answers** (policy survived) and **zero upload rows**. `countMissingSlots` would
then report every slot as `FEHLT`. No error, no exception — a Documents view
that renders a confident, complete-looking, wrong page.

This is the single most likely way M8 ships a lie, and it is fixed by one
additive policy (§2.1 below).

---

## 1. Discovery findings

### 1.1 Auth, session, clients

| Factory             | Import path             | Key                                      | Async   | Context                                                                        |
| ------------------- | ----------------------- | ---------------------------------------- | ------- | ------------------------------------------------------------------------------ |
| `createClient`      | `@/lib/supabase/client` | publishable                              | no      | Client Components. One consumer: `app/case/document-area.tsx:13`               |
| `createClient`      | `@/lib/supabase/server` | publishable (**RLS applies**)            | **yes** | Server Components / Actions / Route Handlers                                   |
| `createAdminClient` | `@/lib/supabase/server` | `SUPABASE_SECRET_KEY` (**bypasses RLS**) | no      | 4 call sites only                                                              |
| _(none)_            | —                       | —                                        | —       | proxy builds `createServerClient` inline at `proxy.ts:30`; no exported factory |

`createAdminClient()` call sites today: `app/case/actions.ts:59` and `:253`
(status_event inserts), `app/case/document-actions.ts:55`
(`document_filename_seq`), `app/(auth)/signup/actions.ts:103`. Note
`document-actions.ts:55` is `const admin = createAdminClient() as any` with an
eslint-disable — the nearest precedent an implementer would copy, and it
violates the repo's strict-TS convention. Do not propagate it.

**`proxy.ts` protects nothing.** Its matcher already covers `/admin`:

```ts
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
```

…but the body only calls `getClaims()` to refresh the session and returns. It
performs no redirect and no DB read, by explicit design ("This separation keeps
the proxy fast — it never hits the database", `proxy.ts:19`). Assuming "the
proxy gates /admin" would ship an open admin.

**Identity:** one shared helper, `verifySession()` at `lib/dal.ts:13-23`. It
returns `{ userId }` only — **no role** — and `redirect('/login')`s when absent.
Reusing it for `/admin` lets any logged-in non-admin straight through. Eight
call sites, all inline per entry point; there is **no route-group layout guard
anywhere** (`app/(auth)/layout.tsx` is pure chrome).

`getClaims()` call sites: exactly three (`lib/dal.ts:15`, `app/page.tsx:6`,
`proxy.ts:54`). `getUser()` / `getSession()`: **zero**. `app_metadata` is unused,
so the JWT carries no role and every admin check is a DB round trip.

**Pre-existing role concept:** `public.user_role` enum `('user','admin')`
(`20260607000001_initial_schema.sql:15`); `profiles.role public.user_role NOT
NULL DEFAULT 'user'` (:216). **No migration anywhere sets any profile to
`'admin'`**, and no application code reads `profiles.role` or calls
`is_admin()`. The admin RLS layer is live but **dormant and never exercised**.

### 1.2 Schema — what backs each M8 view

`cases` (baseline, never altered):

```sql
CREATE TABLE public.cases (
  id                    UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID  NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  care_home_id          UUID  REFERENCES public.care_home(id),
  social_office_id      UUID  REFERENCES public.social_office(id),
  questionnaire_id      UUID  REFERENCES public.questionnaire(id),
  plz_before_move       TEXT,
  plz_resolution_status public.plz_resolution_status NOT NULL DEFAULT 'unclear',
  status                public.case_status           NOT NULL DEFAULT 'in_progress',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**`status` is a real column**, `case_status` enum with exactly two values
(`in_progress`, `under_review`), forward-only. **No status column needs adding.**
Set by the column DEFAULT (not by `handle_new_user()`); written in exactly one
place, `app/case/actions.ts:249-271`. ⚠ `lib/strings/de.ts:210` carries a phantom
third label `completed: 'Fragebogen vollständig'` that is **not** an enum member
— dead copy an admin status filter must not treat as a state.

Where the M8 Case Detail fields actually live:

| Field                         | Source                                                                                                         |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Caregiver name, phone         | `profiles.first_name` / `last_name` / `phone`                                                                  |
| Caregiver **email**           | **`auth.users` only — see §1.7**                                                                               |
| Care recipient name           | **answer rows**, question keys `first_name` / `last_name`, `group_instance = 'default'` (`lib/case-header.ts`) |
| Care recipient DOB, residence | answer rows                                                                                                    |
| Residence PLZ                 | **`cases.plz_before_move`** — the PLZ _question_ was deleted                                                   |
| Care home                     | `cases.care_home_id` → `care_home.name`                                                                        |
| Social office                 | `cases.social_office_id` → `social_office.name`                                                                |

Other live tables: `answer` (unique `(case_id, question_id, group_instance)`),
`status_event`, `document_catalog` (43 DOC-#### rows, `active`, `category`,
`storage_category`), `office_document_rule` (PAN-###/ESS-###, `active`,
`condition` JSONB, `period_months`, `subject`), `document_upload`,
`document_filename_seq`, `static_content`, `app_config`, plus the questionnaire
config tables. `document_upload` has **no `uploaded_by` column** (the old shape
did; the M5R2 replacement does not).

⚠ **`docs/architecture.md` §3.2 is stale and would mislead a designer**: it still
describes `case_document_requirement` with its status enum and a
`document_upload` carrying `requirement_id` / `content_type` / `uploaded_by` —
four tables dropped on 2026-07-20. The sentence _"Anzahl fehlender Dokumente =
count where status = `please_upload`"_ is exactly what an admin design would
build on, and has been false for a month. (The correction exists only as a
trailing note in §4.) The orphan enum `public.document_requirement_status` still
exists as a type.

### 1.3 RLS — current effective state

**18 live tables, all RLS-enabled, 31 effective policies (28 in `public`, 3 on
`storage.objects`). Every policy is PERMISSIVE. No RESTRICTIVE policy, no `FORCE
ROW LEVEL SECURITY`, no `GRANT`/`REVOKE` anywhere in the repo** — so the
additive-OR assumption holds. **Caveat the verifier insisted on: this is proven
about the _repo_, not about _prod_.** A repo grep cannot show a policy added
through the Supabase dashboard, and CLAUDE.md rule #8 exists precisely because
ad-hoc dashboard edits happened. Phase 2's verification must dump `pg_policies`
from live.

Per-table verdict for M8:

| Table                                                                                                                                                       | Admin read today                              | Needs an additive policy?            |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- | ------------------------------------ |
| `cases`, `answer`, `profiles`, `status_event`                                                                                                               | ✅ `admin reads all` (M1)                     | **No**                               |
| `postal_code_rule`, `category`, `question_group`, `question`, `question_option`, `static_content`, `app_config`, `document_catalog`, `office_document_rule` | ✅ `USING (true)` for `authenticated`         | **No**                               |
| **`document_upload`**                                                                                                                                       | ❌ **own-case only, doubly self-limiting**    | **YES — required**                   |
| **`storage.objects`** (`case-documents`)                                                                                                                    | ❌ own-case only, same shape                  | **YES — required for document view** |
| `social_office`                                                                                                                                             | ⚠ `USING (is_active = true)`                  | Recommended                          |
| `questionnaire`                                                                                                                                             | ⚠ `USING (is_active = true)`                  | Recommended                          |
| `care_home`                                                                                                                                                 | ⚠ `USING (is_active = true)`                  | Recommended (forward hazard only)    |
| `document_filename_seq`                                                                                                                                     | RLS on, **zero policies** (service-role only) | No — admin does not need it          |

On the three `is_active` tables, the verifier corrected an over-flag and is worth
quoting precisely:

- **`care_home` is not a live bug.** All seven rows are explicitly
  `is_active = true` (`20260705000002:34-40`) and no migration deactivates one.
  Forward hazard, not a broken read.
- **`cases → social_office` is currently safe.**
  `20260813000005:102-105` hard-asserts (RAISE EXCEPTION guards) that zero cases
  and zero PLZ rules reference the deactivated city office.
- **`questionnaire → social_office` IS broken.** `:108-110` asserts the still-ACTIVE
  Berlin default questionnaire stays anchored to the now-INACTIVE office
  `10000000-…-0001`. An admin joining that path gets a blank office name.

Also verified: **the application has never selected from `social_office`** —
zero `from('social_office')` hits in any `.ts`/`.tsx`. M8 would be its first
consumer; there is no existing query to copy and that policy has never been
exercised by a real read.

**Application-layer trap RLS does not cover:** `question.active`,
`office_document_rule.active` and `document_catalog.active` are all readable
(`USING (true)`) but **filtered in code** (`lib/questionnaire-engine.ts:78`,
`lib/dal.ts:113`, `:349`). An admin rendering a _historical_ case must decide
deliberately whether to copy those filters — copying them makes answers to
retired questions (`hat_rente`, `rentenbetrag`) render blank. §9 Q7.

### 1.4 Storage

One bucket: **`case-documents`**, `public = false`, 15 MiB,
`['application/pdf','image/jpeg','image/png','image/heic','image/heif']`
(`20260711000007:13-16`). Object key: **`{case_id}/{Folder}/{Base}{n}.{ext}`**
(five folders: Personal, Housing, Financial, Insurance, Spouse), German
transliterated to ASCII in filenames only. Legacy flat `{case_id}/{uuid}.{ext}`
keys are grandfathered forever; **nothing recomputes a path — every consumer
resolves the stored `document_upload.storage_path`**.

Signed URLs today — `app/case/document-actions.ts:243-258`,
`createDownloadUrlAction`, the **only** signed-download call site:

```ts
const { data: row } = await (supabase as any)
  .from('document_upload')
  .select('storage_path')
  .eq('id', uploadId)
  .eq('case_id', caseRow.id)
  .single()
if (!row) return { ok: false, error: content.docsErrorGeneric }
const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(row.storage_path, 60)
```

**TTL is already 60 s, already minted in a Server Action (never during render),
already after an ownership check.** The brief's §2.4 pattern has a working
precedent to mirror; only the audit-before-issue step and the admin authorization
are new.

All three `storage.objects` policies gate on
`(storage.foldername(name))[1] IN (SELECT id::text FROM public.cases WHERE user_id = auth.uid())`.
As with `document_upload`, `auth.uid()` is inside the subquery — **but a new
permissive policy directly on `storage.objects` keyed on `is_admin()` does OR
correctly.** So §2.3's "no service-role under `app/admin/**`" is achievable for
documents too; the service-role key is _not_ required. ⚠ This depends on RLS
actually being enabled on `storage.objects` — a Supabase default that appears in
no migration and must be verified on prod (Phase-2 check).

### 1.5 `scripts/case-export.mjs`

348 lines. Builds its own service-role client (`SUPABASE_SECRET_KEY`) at :41 and
performs **no ownership check** — it is an offline ops tool. ~10 queries, then
writes `exports/<case_id>-<yyyymmdd>/{answers.md, documents.md, files/}`.

It already **imports TypeScript directly** — `import { evaluateDocumentRules,
countMissingSlots, periodSuffix } from '../lib/document-rules.ts'` (:24) and
`deriveGroupData` from `'../lib/group-instances.ts'` (:25). This works because
**Node v24.18.0 strips types natively**; there is no `tsx`/`ts-node`/
`esbuild-register` in `node_modules`. `scripts/storage-sweep.mjs:19` is a second
consumer of the same bridge, which M8 must not break.

Duplication that matters:

- `case-export.mjs:237-263` is a **hand-copy** of `lib/dal.ts:314-346` (the
  office-rules + `app_config` fallback ladder). It has drifted before: the export
  lacked the fallback branch until 2026-08-11, so exactly the fallback-served
  cases disagreed between app and export. M8 would be the **third** consumer.
- `fmtValue` (:150-155) vs `formatAnswerForDisplay`
  (`lib/questionnaire-nav.ts:335-388`) — the export prints raw stored values
  (dates as `2026-07-23`, not `23.07.2026`).
- Deliberate divergences that must be **preserved**, not "fixed": the export's
  `answersMap` is uncapped and **omits** the `question.active` filter
  `getCaseAnswers` applies (`lib/dal.ts:100-113`), so ops keeps seeing preserved
  answers to retired questions. `document_catalog` is fetched **without**
  `.eq('active', true)` (:219) where `dal.ts:349` applies it — user-visible
  consequence: for a rule on a deactivated catalog doc, the export prints the
  German name while the app prints the raw `DOC-####` id.

### 1.6 Derived values — all reusable, but the _fetchers_ are not

| Value         | Where                                                                                                                                               | Pure?                                                            |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Progress      | `buildNav()`, `lib/questionnaire-nav.ts:273-276` — `answeredRequired / totalRequired`, empty denominator ⇒ 100                                      | ✅ pure, already called server-side at `app/case/actions.ts:214` |
| Completion    | `:328` `allRequiredAnswered`                                                                                                                        | ✅                                                               |
| Missing docs  | `countMissingSlots()`, `lib/document-rules.ts:269` — slot with zero uploads matching **both** `rule_id` and `instance_key`; binary, no review state | ✅                                                               |
| Doc checklist | `evaluateDocumentRules(rules, catalog, input)` `:277`                                                                                               | ✅ `lib/document-rules.ts` has **zero imports** — totally pure   |
| Visibility    | `isVisible()` `lib/questionnaire-nav.ts:50-55`                                                                                                      | ✅                                                               |
| Status        | real column                                                                                                                                         | —                                                                |

**The derivation layer is entirely reusable server-side. The data layer is
not.** Not one fetcher accepts a client or pre-fetched rows — every one calls
`createClient()` internally, and `lib/supabase/server.ts:19` does
`await cookies()`, so they **throw outside a Next.js request**. Worse for an
admin: **`getCase()` (`lib/dal.ts:29`) takes no `caseId` at all** — its body is
`verifySession()` then `.eq('user_id', userId)`. _There is no function anywhere
in `lib/` that loads a case by id._ This is precisely why client injection
(brief §4.4) is the right move.

⚠ **Silent-failure trap:** `getCaseAnswers(caseId)` and `getStaticContent()`
never call `verifySession()`, and `getDocumentData(caseId, …)` verifies the
_session_ but never the _ownership_ of the `caseId` passed in. Under the user
client an unauthorised `caseId` returns `{}` / `[]` — progress 0 %, header
`"Antrag für "`, all documents missing. Under a service-role client the same call
returns everything. **Never let a service-role client and an unvalidated caseId
meet in one function.**

**Skipped questions do not exist as data.** `skippedIds` is session-only client
state (`chat-view.tsx:628`); `handleSkip` (`:944-961`) calls no Server Action;
there is no skipped column, table or `status_event`. The R2-7 "deferred" marker
is a pure client display filter over the same Set. **M8 cannot report "skipped".**
It can report _answered_, _unanswered-but-applicable_, and _not-applicable
(hidden by visibility)_. This is a correction to Phase 7's scope, not a gap.

**Progress caveat:** `progressPercent` is rendered only client-side, and between
"add another instance" and the first save in that instance the server-derivable
number reads _higher_ than the chip the user sees. Label the admin column **"as
of last saved answer"**, not "identical to what the user sees".

### 1.7 Two things no policy can fix

1. **`public.profiles` has no email column.** The applicant's login email lives
   only in `auth.users`, which the `authenticated` role cannot SELECT.
   `case-export.mjs:58` gets it via `db.auth.admin.getUserById()` — a GoTrue
   admin endpoint requiring the service key. An admin list showing email forces
   service-role or the Auth Admin API into the web app, widening the secret
   key's blast radius from 4 narrow audited call sites to a whole UI surface.
   §9 Q5.
2. **No admin account exists.** `profiles.role` defaults to `'user'`;
   `supabase/seed.sql` has no admin; no migration sets one. Until a row is
   granted, `is_admin()` returns false for everyone and `/admin` is empty for
   its author too.

### 1.8 Testing — and the loud finding

**⚠ Vercel preview deployments, local dev, and every e2e run all point at the
PRODUCTION Supabase project. There is exactly one Supabase project.** Confirmed
on three independent lines: `.env.local` carries a single project ref that
`docs/operations.md` uses as the production host; 11 of 13 specs default
`BASE` to `https://sorglos-antrag.vercel.app` and all build service-role clients
from that same `.env.local`; and `ui_round2_state.md:271-274` records this
session creating and deleting _"~50 throwaway accounts against the single prod
Supabase project"_. A dedicated test project is already an open backlog item
(`ui_round2_state.md:277-280`).

**Consequence for M8: any e2e coverage of `/admin` requires writing
`profiles.role = 'admin'` into the production database. Testing the feature means
granting production admin.** That is a founder decision, not a default. §9 Q10.

Other testing facts: `playwright.config.ts` gates previews via
`VERCEL_AUTOMATION_BYPASS_SECRET` + the mandatory `x-vercel-set-bypass-cookie`
header pair; `webServer` is disabled when `E2E_BASE_URL` is non-localhost. Test
users come from `scripts/create-test-user.mjs` (prod service role, GCs the
previous fixture, `email_confirm: true`, writes `.playwright-test-user.json`,
gitignored). The **CI e2e job is dormant**, gated on an unset repo variable
(`.github/workflows/ci.yml:45-84`). 11 unit test files; `auth.spec.ts` contains
the closest thing to a route-denial test and it is **currently skipped**.

### 1.9 Docs to update

- `docs/architecture.md` §2 (component list — the "Read-only Admin
  (post-go-live)" bullet, and the "founders' admin is Supabase Studio at first"
  sentence at :28), **§3.2 (stale — see §1.2)**, §5 RBAC bullet at :117 (needs
  the caveat that uploads and storage had no admin path), §7 :147.
- `docs/known-limitations.md:10-12` ("No admin interface") — retired by M8.
- `docs/operations.md:1-7` ("until the read-only admin exists") and `:57`
  ("Document statuses: out of scope until the admin milestone" — reads like a
  promise M8 delivers them; §9 Q6).
- `docs/milestone-log.md` — newest-at-top H2, plus the **"Current state
  snapshot"** block at :11-25 must have its date and "Milestone status" line
  refreshed, not merely appended below. No entry anywhere uses the label "M8"
  yet; the last numbered milestone in the log is M7.

---

## 2. Proposed migration — quoted for review, **not written**

Additive only. **No existing policy, table, column, function or enum is
modified.** `is_admin()` is reused as-is, not redefined.

```sql
-- ============================================================
-- Migration: 2026MMDD000001_m8_admin_read_access
-- M8 — read-only admin. ADDITIVE ONLY.
--
-- Nothing existing is altered, replaced or dropped:
--   * every policy below is a NEW policy under a NEW name; no DROP POLICY,
--     no ALTER POLICY, no CREATE OR REPLACE of an existing object;
--   * public.is_admin() (20260607000002:26-33) is REUSED, not redefined —
--     public.profiles.role stays the single source of truth for 'admin';
--   * no table, column, function or enum is modified.
--
-- New objects: 5 SELECT-only policies (4 public + 1 storage),
--              admin_access_log, log_admin_access(), 2 indexes.
--
-- REAL-DATA REPORT: zero user rows read or written. No storage object is
-- moved, renamed or deleted. admin_access_log is created empty. This
-- migration GRANTS READ VISIBILITY ONLY, and only to accounts that already
-- have profiles.role = 'admin'.
--
-- Performance: every policy uses the (SELECT public.is_admin()) subselect
-- form, evaluated once per query as an initplan rather than per row. The
-- four M1 admin policies use the bare form; they are deliberately NOT
-- touched here (see report §9 Q2).
-- ============================================================

BEGIN;

-- ── Guard: this migration must be additive. Abort if a name is taken. ────────
DO $$
BEGIN
  IF to_regclass('public.admin_access_log') IS NOT NULL THEN
    RAISE EXCEPTION 'admin_access_log already exists — this migration is not additive here';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public' AND p.proname = 'log_admin_access') THEN
    RAISE EXCEPTION 'log_admin_access already exists — this migration is not additive here';
  END IF;
  -- is_admin() must exist and stay untouched: M8 depends on it.
  IF NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                 WHERE n.nspname = 'public' AND p.proname = 'is_admin') THEN
    RAISE EXCEPTION 'public.is_admin() missing — M8 premise broken, stop';
  END IF;
  RAISE NOTICE 'M8 guards passed: names free, is_admin() present';
END $$;

-- ═══════════════════════════════════════════════════════════
-- 1. THE REQUIRED POLICY — without it the admin sees zero uploads
--    and every document reads FEHLT (report §0).
-- ═══════════════════════════════════════════════════════════

CREATE POLICY "document_upload: admin reads all"
  ON public.document_upload FOR SELECT TO authenticated
  USING ((SELECT public.is_admin()));

-- ═══════════════════════════════════════════════════════════
-- 2. STORAGE — SELECT only, scoped to the one private bucket.
--    Permissive, so it ORs with the own-case policy; the existing
--    three policies are untouched. No INSERT/UPDATE/DELETE.
-- ═══════════════════════════════════════════════════════════

CREATE POLICY "case-documents: admin reads all"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'case-documents' AND (SELECT public.is_admin()));

-- ═══════════════════════════════════════════════════════════
-- 3. is_active-FILTERED CONFIG TABLES
--    The three existing policies read USING (is_active = true), so an
--    admin cannot see a deactivated row. Live impact today:
--      * questionnaire -> social_office IS broken (the ACTIVE Berlin
--        questionnaire is anchored to the INACTIVE office
--        10000000-...-0001, asserted at 20260813000005:108-110);
--      * cases -> social_office is currently safe (:102-105 asserts no
--        case references it) but only by assertion, not by construction;
--      * care_home has no deactivated row today — forward hazard only.
--    A read-only admin must render history, including deactivated config.
-- ═══════════════════════════════════════════════════════════

CREATE POLICY "social_office: admin reads all"
  ON public.social_office FOR SELECT TO authenticated
  USING ((SELECT public.is_admin()));

CREATE POLICY "questionnaire: admin reads all"
  ON public.questionnaire FOR SELECT TO authenticated
  USING ((SELECT public.is_admin()));

CREATE POLICY "care_home: admin reads all"
  ON public.care_home FOR SELECT TO authenticated
  USING ((SELECT public.is_admin()));

-- ═══════════════════════════════════════════════════════════
-- 4. AUDIT LOG — append-only, server-written only.
--    RLS enabled with ZERO policies: no client can read or write it
--    through PostgREST. Precedent: public.document_filename_seq
--    (20260730000004:140), the only other table in this shape.
-- ═══════════════════════════════════════════════════════════

CREATE TABLE public.admin_access_log (
  id                 BIGINT      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  admin_user_id      UUID        NOT NULL REFERENCES auth.users(id),
  action             TEXT        NOT NULL
                       CHECK (action IN ('case_list','case_detail','document_signed_url')),
  target_case_id     UUID,
  target_document_id UUID,
  occurred_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  request_id         TEXT
);
COMMENT ON TABLE public.admin_access_log IS
  'Append-only record of admin reads of user data. Written ONLY via public.log_admin_access(). RLS on, zero policies by design.';

ALTER TABLE public.admin_access_log ENABLE ROW LEVEL SECURITY;

CREATE INDEX admin_access_log_admin_time_idx
  ON public.admin_access_log (admin_user_id, occurred_at DESC);
CREATE INDEX admin_access_log_case_idx
  ON public.admin_access_log (target_case_id);

-- No FK on target_case_id / target_document_id ON DELETE CASCADE:
-- the audit trail must survive the deletion of the case it describes
-- (GDPR erasure of a case must not erase the record that it was read).
-- They are therefore plain UUIDs, deliberately unconstrained.

-- ── The only write path ──────────────────────────────────────────────────────
-- admin_user_id is DERIVED from auth.uid() and is NOT a parameter, so a
-- caller cannot attribute their read to somebody else. Re-checks is_admin()
-- itself, so the audit table cannot be used as a write oracle by a non-admin.
CREATE FUNCTION public.log_admin_access(
  p_action             TEXT,
  p_target_case_id     UUID DEFAULT NULL,
  p_target_document_id UUID DEFAULT NULL,
  p_request_id         TEXT DEFAULT NULL
) RETURNS BIGINT
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id BIGINT;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'log_admin_access: caller is not an admin';
  END IF;

  INSERT INTO public.admin_access_log
    (admin_user_id, action, target_case_id, target_document_id, request_id)
  VALUES
    (auth.uid(), p_action, p_target_case_id, p_target_document_id, p_request_id)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL     ON FUNCTION public.log_admin_access(TEXT, UUID, UUID, TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.log_admin_access(TEXT, UUID, UUID, TEXT) TO authenticated;

DO $$
DECLARE
  n_new_policies INT;
BEGIN
  SELECT count(*) INTO n_new_policies FROM pg_policies
   WHERE policyname IN ('document_upload: admin reads all',
                        'case-documents: admin reads all',
                        'social_office: admin reads all',
                        'questionnaire: admin reads all',
                        'care_home: admin reads all');
  IF n_new_policies <> 5 THEN
    RAISE EXCEPTION 'expected 5 new admin policies, found %', n_new_policies;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies
              WHERE policyname LIKE '%admin reads all%' AND cmd <> 'SELECT') THEN
    RAISE EXCEPTION 'a new admin policy is not SELECT-only';
  END IF;
  RAISE NOTICE 'M8 applied: 5 SELECT-only admin policies, admin_access_log + log_admin_access created';
END $$;

COMMIT;
```

**Deliberately NOT in this migration** (each would modify a live object; all are
§9 decisions): no `admin_users` table; no redefinition of `is_admin()`; no
`search_path` hardening of `is_admin()`; no rewrite of the four M1 admin policies
into the `(SELECT …)` form; no admin **grant** (§9 Q3 — the grant is a separate,
named, reviewed statement); no `status` column, no new enum value, no new German
string.

### 2.1 Phase-2 live verification (founder runs after pushing)

Beyond the brief's list, three checks the discovery added:

1. **Run first, before pushing:** `SELECT id, role FROM public.profiles WHERE
role = 'admin';` — if a row already exists, that account **already** has
   cross-user SELECT on `profiles`/`cases`/`answer`/`status_event` today, through
   the ordinary publishable key, with no admin UI involved.
2. `SELECT * FROM pg_policies WHERE schemaname IN ('public','storage')` **before
   and after**; diff must show exactly 5 additions and **zero modifications**.
   This is also the only way to prove no dashboard-added RESTRICTIVE policy
   exists (§1.3 caveat).
3. `SELECT relrowsecurity, relforcerowsecurity FROM pg_class WHERE oid =
'storage.objects'::regclass;` — **`relrowsecurity` must be true.** If RLS is
   not actually on for `storage.objects`, the three existing case-documents
   policies are inert no-ops and every authenticated user can already read every
   case's files. Unverifiable from the repo; load-bearing for M8.

Plus the brief's list: `is_admin()` true for the founder / false for a pilot
user; **row counts identical for a normal pilot user before and after** on
`cases`, `answer`, `document_upload`, `social_office`, `questionnaire`,
`care_home`, `profiles`, `status_event`; `admin_access_log` RLS on with zero
policies; `INSERT INTO public.admin_access_log …` as `authenticated` **fails**
while `SELECT public.log_admin_access('case_list')` succeeds for an admin and
raises for a non-admin; every new policy `cmd = 'SELECT'`; `is_admin()` is
`SECURITY DEFINER` (recording that its `search_path` is `public`, **not**
`public, pg_temp` — §9 Q2).

---

## 3. Audit design

Shape as quoted in §2. Confirmations the brief asked for: RLS on with zero
policies ✅; writes only through a `SECURITY DEFINER` function that derives
`admin_user_id` from `auth.uid()` and never accepts it ✅; UPDATE/DELETE
unreachable for `authenticated` (no policies at all, so no grant to revoke) ✅;
both indexes ✅.

**Failure semantics — fail closed everywhere, including the case list.** The
brief invited a challenge on the list view; I do not take it. The list is the
screen that renders every pilot user's name and care home at once — it is the
highest-value read in the product, not the cheapest. Fail-open there would mean
the one unlogged surface is the broadest one. The audit insert is a single
indexed write against an empty table on the same connection; if it fails,
something is wrong enough that not serving the page is correct.

Concretely: `log_admin_access()` is awaited **before** the data query for
`case_list` and `case_detail`, and **before** `createSignedUrl` for
`document_signed_url`. Any throw propagates; no data is returned. `Cache-Control:
no-store` on the signed-URL response; the URL is never logged, cached or embedded
— the document id only.

---

## 4. Shared case-view module

`lib/case-view.ts`, exporting `buildCaseView(client, caseId)` with the client
injected — required, not stylistic, because **no existing function loads a case
by id** and every fetcher hard-wires `createClient()` + `await cookies()`.

```ts
export type CaseView = {
  caseRow: CaseRow
  applicant: { firstName: string; lastName: string; phone: string | null }
  careRecipient: { firstName: string; lastName: string }
  careHome: { name: string } | null
  socialOffice: { name: string } | null
  questionnaire: { id: string; name: string }
  answers: { answersMap: …; answersRaw: …; groupInstances: …; groupAnswers: … }
  documents: { slots: DocumentSlot[]; uploads: UploadRow[]; missing: number; rulesSource: RulesSource }
  progress: { answeredRequired: number; totalRequired: number; percent: number; allRequiredAnswered: boolean }
}
export async function buildCaseView(client: SupabaseClient, caseId: string, opts: { mode: 'app' | 'export' }): Promise<CaseView>
```

`case-export.mjs` becomes a thin wrapper: build the service-role client, call
`buildCaseView(db, caseId, { mode: 'export' })`, render markdown. The `mode` flag
is **not optional** — it carries the export's deliberate divergences (§1.5:
uncapped answers, no `question.active` filter, no `document_catalog.active`
filter). Erasing them would silently change what ops sees.

**Hard constraints, both reproduced at runtime by the verifier:**

- `node --input-type=module -e "await import('./lib/dal.ts')"` →
  `ERR_MODULE_NOT_FOUND: Cannot find package '@/lib'`. Node does not read
  tsconfig `paths`. **`lib/case-view.ts` may contain zero `@/…` imports** — which
  also means it can never import `lib/supabase/server.ts` or
  `lib/questionnaire-engine.ts`.
- `await import('./lib/document-rules')` → `ERR_MODULE_NOT_FOUND`. Relative
  specifiers need the explicit **`.ts` extension** — and that requires
  **`allowImportingTsExtensions: true` in `tsconfig.json`**, currently unset;
  TS 5.9.3 emits TS5097 otherwise. Legal here because `tsconfig.json:8` already
  sets `noEmit: true`. **This is an unstated prerequisite of the plan.** Today's
  `case-export.mjs` specifier is exempt only because `scripts/**/*.mjs` is not in
  tsconfig `include` and is never typechecked.
- `dotenv` is **not a declared dependency**; `case-export.mjs:23` resolves it as a
  hoisted transitive. An upstream lockfile change silently breaks
  `npm run case:export`. Worth fixing while in the file.

**Proof of equivalence — the brief's method is not executable as written.** All
four prod cases sit on rule-less offices and are served the Pankow set via the
`app_config` fallback, so a diff exercises **only** the `usedFallback = true`
branch; two of the four are `in_progress`, so their `updated_at` moves under you;
and `exports/` is gitignored, untracked, three commits stale, and its case ids no
longer exist in prod. There is **no Berlin/Essen golden pair to diff.**

Revised proof, in this order:

1. **Neutralize non-determinism first** — several queries have no total order.
   Add `.order('id')` as a tiebreak to both `office_document_rule` queries, and
   to `answer`, `question` and `document_upload`, in **both** `case-export.mjs`
   and `lib/dal.ts` / `lib/questionnaire-engine.ts`, so the two stay _equivalent_
   rather than merely _repeatable_. Pin `TZ`.
2. **Baseline before touching anything**: run today's script against the two
   **locked** cases (`52e364f1` real, `461038b0` fixture) and commit the output
   to a scratch dir outside the repo. Only locked cases are diffable.
3. Refactor; re-run; diff must be empty.
4. **Manufacture the missing coverage** rather than claim it: seed a throwaway
   Essen case and a throwaway own-rules case to exercise the
   `usedFallback = false` branch and the Essen rule set, and diff those too.
   Record in the state file that prod alone could not provide them.

**Cheap win, separable from all of the above:** `lib/questionnaire-nav.ts` has
only a type-only import and is **already** `.mjs`-importable. `formatAnswerForDisplay`
can be shared into the export today with no tooling change — the only blocker is
that the export never queries `question_option`. One added query closes the
largest app/export divergence without waiting for `buildCaseView`.

---

## 5. N+1 analysis

Naive reuse of the DAL as written, **measured**: 10 round-trips per case
(own-office), 11 (office NULL / unsupported PLZ), 12 (office set but rule-less)
— `getCase` 1 + `getStaticContent` 1 + `getDocumentData` 3-5 + `loadQuestionnaire`
4 + `getCaseAnswers` 2. **For 50 cases: 500-600 queries.**

Batched list: **~13 queries total, independent of case count.**

| #   | Query                                                                                 |
| --- | ------------------------------------------------------------------------------------- |
| 1   | `cases` — all rows (hard limit, server-side sort)                                     |
| 2-9 | `loadQuestionnaire` × the **two** live questionnaires (4 queries each) — not per case |
| 10  | `office_document_rule` where `active` — all 104 rows across both rule-owning offices  |
| 11  | `document_catalog` — global, 43 rows                                                  |
| 12  | `app_config` — global                                                                 |
| 13  | `answer` `.in('case_id', ids)`                                                        |
| 14  | `document_upload` `.in('case_id', ids)`                                               |
| +2  | `profiles`, `care_home` / `social_office` `.in(...)`                                  |

Every saving is available **today at the derivation layer** — `buildNav`,
`deriveGroupData`, `evaluateDocumentRules` and `countMissingSlots` all already
accept pre-fetched inputs. Only the _fetchers_ need to change. Per-case CPU is
negligible: 50 cases × ~250 questions ≈ 12 k predicate evaluations. The cost is
100 % I/O shape.

`buildCaseView` (which fetches per case) is therefore reserved for the **detail**
page. The list gets a separate `buildCaseListRows(client)` sharing the same pure
derivations. Hard row limit, no pagination machinery.

---

## 6. PII posture for the list

This is German care and financial data, and the list is one screen showing all of
it at once. Recommendation:

**List (minimum viable for triage):** care recipient's name, care home, social
office, derived status, progress %, missing-document count, last activity
(`updated_at`). **Not** the caregiver's phone, **not** email (unobtainable
anyway, §1.7), **not** PLZ, **not** any answer value, **not** any financial or
health field.

**Detail:** everything the case legitimately contains — that screen is the
deliberate, audited act.

Rationale: the care recipient's name is the minimum that makes a list usable for
"which case is this", and it is already the app's own choice of display name
(`lib/case-header.ts`). Everything beyond it turns a list view into a bulk
disclosure whose audit row cannot distinguish "glanced at the list" from "read 40
people's data". Every list render still writes one `case_list` audit row.

---

## 7. Route protection + the denial test

Three independent layers, per brief §2.3:

1. **`proxy.ts` — UX only, and today it does not even do that.** Recommendation:
   **leave `proxy.ts` alone.** Adding a role read would violate its stated
   design ("never hits the database") and add a query to every request on the
   live user app. Its matcher already covers `/admin`; treating that as
   protection is the trap. CVE-2025-29927 (`x-middleware-subrequest`) makes the
   point moot regardless.
2. **`requireAdmin()`** at the top of every admin page, route handler and server
   action. Proposed shape — note the two different failure modes:
   - anonymous → `redirect('/login')` (matches `verifySession()`),
   - authenticated non-admin → **`notFound()`**, not a redirect, so `/admin`'s
     existence is not disclosed to a logged-in pilot user.

   It must not be built on `verifySession()` alone (that returns no role). It
   reads the role through the session client under RLS — `profiles: user reads
own` already permits an admin to read their own row, so no new policy is
   needed for the check itself.

3. **RLS** — the five additive policies. Must deny even if 1 and 2 are bypassed
   entirely.

**Denial test, shipped in Phase 3 (not Phase 9)** so every route added in Phases
5-8 is covered automatically: enumerate `app/admin/**` for `page.tsx` /
`route.ts` **at test time**, derive the URL list, assert anon **and** non-admin
sessions are denied on each — asserting the _correct_ failure per identity (302
vs 404), so a bug that turns 404 into 302 is caught. Plus a static assertion that
every module under `app/admin/**` exporting a page, route handler or server
action calls `requireAdmin`, and that no `insert`/`update`/`delete`/`upsert`
write call and no service-role reference appears anywhere under `app/admin/**`.

⚠ The existing `auth.spec.ts` route-denial test is **currently skipped** — do not
inherit that skip.

---

## 8. Revised phase plan

| Phase | Deliverable                                                                                                                                              | Exit criterion                                                                                                                                                    |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | **This report.**                                                                                                                                         | Founder answers §9 — **Q1, Q2, Q3, Q4 are blocking**                                                                                                              |
| 2     | Migration file (§2) + live-verification script (§2.1)                                                                                                    | Founder pushes; `pg_policies` diff shows 5 additions / 0 modifications; `storage.objects` RLS confirmed on; pilot-user row counts unchanged                       |
| 2b    | **Admin grant** — separate reviewed statement naming the user id                                                                                         | `is_admin()` true for that account, false for a pilot user                                                                                                        |
| 3     | `requireAdmin()`, `/admin` shell, audit RPC wrapper, **route-inventory denial test**, static assertions                                                  | Denial test green for anon + non-admin with the correct status each                                                                                               |
| 4     | Determinism fixes → baseline capture → `lib/case-view.ts` + `case-export.mjs` wrapper. Includes `allowImportingTsExtensions` and the `dotenv` dependency | Empty diff on both locked cases; manufactured Essen + own-rules cases also diff clean; `npm run case:export` and `storage-sweep.mjs` still run under plain `node` |
| 5     | Case List (batched, §5)                                                                                                                                  | ≤ ~15 queries for 50 cases, proven by count; one `case_list` audit row per render                                                                                 |
| 6     | Case Detail shell                                                                                                                                        | Consumes `buildCaseView`; one `case_detail` audit row per open                                                                                                    |
| 7     | Answers View — **answered / unanswered-applicable / not-applicable.** No "skipped": it does not exist as data (§1.6)                                     | Question + option text verbatim from DB                                                                                                                           |
| 8     | Documents View + audited signed URLs (60 s, mirrors `createDownloadUrlAction`)                                                                           | Audit row exists for every URL issued; a failed audit insert yields no URL                                                                                        |
| 9     | Adversarial pass + docs, incl. the **stale §3.2 correction**                                                                                             | `x-middleware-subrequest` denied; non-admin direct queries return zero rows on every touched table; expired URL rejected                                          |

Changes from the brief: Phase 2 splits out the **grant** as its own gated step;
Phase 4 gains the determinism/tooling prerequisites and a manufactured-coverage
requirement; Phase 7 narrows to what the data supports.

---

## 9. Open questions — batched

**Blocking (Phase 2 cannot start without 1-4):**

1. **`profiles.role` or a new `admin_users` table?** My recommendation:
   `profiles.role`, unchanged. Choosing `admin_users` means the same migration
   must also rewrite the four M1 admin policies — a destructive change requiring
   its own per-row impact report, and two competing definitions of "admin" until
   it lands.
2. **Harden `is_admin()`?** It is `SET search_path = public` — missing `pg_temp`,
   the documented `SECURITY DEFINER` hijack vector. Fixing it is a one-clause
   `CREATE OR REPLACE` of a function backing four live policies, i.e. a
   modification. Same question for rewriting those four policies from bare
   `public.is_admin()` to `(SELECT public.is_admin())` (per-row → per-query
   evaluation). **Recommendation: do both, but in a separate, separately-gated
   migration after M8 ships**, so a policy change and a feature launch are never
   in the same push.
3. **Who gets admin, and how is the grant made?** A dated migration naming a user
   id, or a reviewed one-off script? This is a production privilege change on a
   live system with real users mid-application.
4. **Must the admin open a pilot user's file in the browser**, or does
   `npm run case:export` remain the way documents are read? Good news: with the
   §2 storage policy this needs **no service-role key** — but it is still the
   most sensitive surface in the product.

**Non-blocking but needed before the phase that consumes them:**

5. **Email in the list?** `profiles` has none and `auth.users` is unreadable by
   `authenticated`. Showing it forces service-role/Auth-Admin-API into the web
   app. Recommendation: drop it for M8.
6. **Is "read-only" strictly read-only** — no document-status marking, no notes,
   no "processed" flag? `docs/operations.md:57` reads like a promise that this
   milestone delivers document statuses.
7. **Raw or filtered case view?** Should the admin see retired-question answers
   and over-cap group instances (what `case-export.mjs` deliberately prints), or
   the filtered view the user sees? They disagree by design.
8. **What does Roman actually work from** — all cases or only `under_review`?
   Sort order? Which columns at a glance? Every derived column is recomputed, so
   the column list is also a performance decision.
9. **Does CLAUDE.md rule #2 (German text is data) apply to an internal
   founder-facing admin?** The brief says English chrome, which contradicts rule
   #2 as literally written. If English chrome is right, the exemption should be
   written into CLAUDE.md rather than assumed.
10. **Dedicated non-production Supabase project?** Without it, e2e for `/admin`
    means granting production admin (§1.8). Already an open backlog item.
11. **Is `VERCEL_AUTOMATION_BYPASS_SECRET` still valid** after the team transfer?
    Without it no e2e can reach a preview of `/admin`.
12. **GDPR/AVV:** is a screen rendering one person's financial and care-level
    answers to a founder covered by the existing record of processing and the
    consent text pilot users accepted? Roman's call, not a technical one.

### Risk list

1. **Silent empty-truth on documents.** No `document_upload` admin policy ⇒
   admin sees zero uploads ⇒ every slot renders `FEHLT`. No error. Fixed by §2.
2. **Two definitions of admin** if `admin_users` is introduced without rewriting
   the four M1 policies.
3. **Service-role + unvalidated `caseId` in one function** — `getCaseAnswers` /
   `getDocumentData` have no ownership check. Every admin read must be a named
   function with the admin check inside it.
4. **`storage.objects` RLS may not actually be enabled** — unverifiable from the
   repo, load-bearing.
5. **Preview = production database.** Testing `/admin` writes an admin row to
   prod.
6. **Migration-before-code on a live system** (CLAUDE.md #8): five policies plus
   a table and a function must land and verify before any `/admin` code deploys.
7. **N+1**: 500-600 queries for a 50-case list if the DAL is reused naively.
8. **Stale `architecture.md` §3.2** will be mistaken for spec.
9. **Three-way drift** on the fallback rule ladder once M8 becomes its third
   consumer; it has already drifted once.
10. **`verify-baseline.mjs`** will not cover `admin_access_log` unless added, so
    the founder's drift check silently stops covering the newest table.
11. **`exports/` is not a baseline** — gitignored, untracked, stale, and its case
    ids are gone from prod.
12. **UUID `10000000-…-0001` is ambiguous**: `supabase/setup.sql:373` seeds it as
    "Sozialamt Frankfurt am Main" while `20260813000005` treats it as the Berlin
    city office. An admin rendering office names must not trust `setup.sql`.
