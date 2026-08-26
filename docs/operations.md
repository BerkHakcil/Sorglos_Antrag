# Operations runbook — Sorglos Antrag

> How the two founders operate the product manually until the read-only admin
> exists. Everything here uses the service role (`SUPABASE_SECRET_KEY` from
> `.env.local`) — run only on trusted machines. Config data is NEVER touched
> here: config changes go through dated migrations + `supabase db push`, always
> (CLAUDE.md #8). This runbook covers **runtime user data** and infrastructure.

## 1. Look up a user's case

By email → user id → case id (PowerShell/bash, from the repo root):

```bash
# 1) user id (Authentication → Users in the dashboard works too)
curl -s "https://srtgqgueigyucanfzodb.supabase.co/auth/v1/admin/users?per_page=100" \
  -H "apikey: $SUPABASE_SECRET_KEY" -H "Authorization: Bearer $SUPABASE_SECRET_KEY" \
  | python -c "import json,sys; [print(u['id'],u['email']) for u in json.load(sys.stdin)['users']]"

# 2) case id for a user id
curl -s "https://srtgqgueigyucanfzodb.supabase.co/rest/v1/cases?user_id=eq.<USER_ID>&select=id,status,plz_before_move,social_office_id" \
  -H "apikey: $SUPABASE_SECRET_KEY" -H "Authorization: Bearer $SUPABASE_SECRET_KEY"
```

Reading data ad hoc: Supabase Studio (read-only browsing is fine — the
migrations-only rule forbids _edits_ via Studio, not looking).

## 2. Export a completed case (the operations bridge)

```bash
npm run case:export -- <case_id>
```

Produces `exports/<case_id>-<date>/`:

- `answers.md` — every answered question as German Q&A in questionnaire order,
  repeatable groups as "«Gruppe» 1/2/…" — this is what Roman works from when
  filling the official PDF by hand.
- `documents.md` — the evaluated checklist (same evaluator as the app):
  person, document, slot label, uploaded files or **FEHLT**. Below the
  checklist, a **not_required** table lists any upload whose requirement is
  not in the current checklist (a fallback exclusion — see the standing
  `fallback_excluded_rule_ids` config —, a retired rule, or an answer
  change): the app hides these files entirely, but they stay in the DB, in
  storage, and in `files/`, and never count as missing. An ops view must
  never lose sight of a file that exists.
- `files/` — **all** uploads downloaded, `not_required` ones included.
  Phase-D nested keys keep their readable `<Folder>_<Basename>` name; legacy
  flat keys fall back to `<rule>_<instance>_<original name>`. HEIC files have
  no preview anywhere — open locally (macOS/iOS natively; Windows may need
  the HEIF extension).

`exports/` is gitignored (personal data). **Delete the folder once the case is
processed.**

## 3. Correcting data

- **Config (questions, options, rules, German copy, offices, PLZ):** dated
  migration + `supabase db push` — no exceptions, see the project reminders in
  `docs/milestone-log.md`. After any drift suspicion: `scripts/verify-baseline.mjs`.
- **Runtime user data (answers, case fields):** the product has no edit path
  after completion (M3 lock — by design). If an operational correction is ever
  unavoidable, it is a service-role script (a one-off `.mjs` in the style of
  `scripts/case-export.mjs`), reviewed before running, never a Studio cell-edit.
  Keep the script in the repo history if the correction mattered.
- **Document statuses:** out of scope until the admin milestone; the checklist
  is fully derived, there is nothing to hand-maintain.

## 4. GDPR deletion (user requests erasure)

Order matters — storage objects do NOT cascade (verified in the M7 RLS audit;
deleting the auth user first orphans the files):

```bash
# 1) find the case id (section 1)
# 2) delete the storage prefix FIRST
curl -s "https://srtgqgueigyucanfzodb.supabase.co/rest/v1/document_upload?case_id=eq.<CASE_ID>&select=storage_path" \
  -H "apikey: $SUPABASE_SECRET_KEY" -H "Authorization: Bearer $SUPABASE_SECRET_KEY"
# for each storage_path:
curl -s -X DELETE "https://srtgqgueigyucanfzodb.supabase.co/storage/v1/object/case-documents/<STORAGE_PATH>" \
  -H "Authorization: Bearer $SUPABASE_SECRET_KEY"
# also list the prefix directly to catch orphans (tab-closed mid-upload):
#   Storage → case-documents → <case_id>/ in the dashboard, delete leftovers

# NOTE (pass 3 / Phase D): new uploads are stored NESTED as
#   {case_id}/{Personal|Housing|Financial|Insurance|Spouse}/{Name}{n}.{ext}
# The loop above is unaffected (it uses stored storage_path values), but the
# manual orphan check MUST descend into those category subfolders — a
# one-level listing of <case_id>/ shows folders, not files. Older uploads
# remain flat at {case_id}/{uuid}.{ext} and are found at the top level.

# 3) delete the auth user — cascades profile → case → answers → upload
#    (also cascades document_filename_seq, the per-case filename counters —
#     FK ON DELETE CASCADE on cases, so no counter metadata survives a case)
#    metadata → status events (all verified in the audit)
curl -s -X DELETE "https://srtgqgueigyucanfzodb.supabase.co/auth/v1/admin/users/<USER_ID>" \
  -H "apikey: $SUPABASE_SECRET_KEY" -H "Authorization: Bearer $SUPABASE_SECRET_KEY"

# 4) verify: cases/document_upload rows gone, storage prefix empty
```

Also delete any local `exports/<case_id>-*` folders — they are copies of the
personal data. If auth emails for the address should stop, that's it — nothing
else stores the user.

## 5. Logs & incidents

- **App/server logs:** Vercel → project `sorglos-antrag` → Logs (functions,
  `fra1`). The signup action logs raw Supabase error codes there (never the
  attempted email).
- **Auth logs:** Supabase → Logs → Auth — this is where SMTP failures name the
  real error (e.g. `535 Authentication failed`).
- **First responder for "signup/emails broken":** `npm run smoke:signup`
  (asserts SMTP acceptance end to end, cleans up after itself), then the
  signup-outage section of `docs/milestone-log.md` (2026-07-20) for the
  click-by-click Brevo/SMTP diagnosis path.
- **Structure drift:** `scripts/verify-baseline.mjs` against a fresh local
  replay (see the milestone log's verification-tooling notes).
  ⚠ If `supabase db start` fails with "ports are not available … access
  permissions" on 54322: Windows WinNAT has reserved the port range (check
  `netsh interface ipv4 show excludedportrange protocol=tcp`). Fix in an
  **elevated** PowerShell: `net stop winnat; net start winnat` (or reboot),
  then rerun. Seen 2026-07-23.
- No error-monitoring service is wired (known limitation) — checking Vercel
  logs after a user-reported error IS the process.

## 6. Domain cutover checklist (DEFERRED — execute at launch)

Decision of record (M7): target shape is **apex `sorglosantrag.de` primary,
`www` → 308 redirect to apex**. The pilot runs on
`https://sorglos-antrag.vercel.app`. When cutting over:

| #   | Who     | Step                                                                                                                                                                                                                                            |
| --- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | dev     | Flip the e2e default: `E2E_BASE_URL` fallback in `tests/e2e/*.spec.ts` → `https://sorglosantrag.de`; update `NEXT_PUBLIC_SITE_URL` in `.env.local`. Deploy.                                                                                     |
| 2   | founder | Vercel → Settings → Domains → add `sorglosantrag.de` (primary) and `www.sorglosantrag.de` ("Redirect to sorglosantrag.de").                                                                                                                     |
| 3   | founder | Registrar (same zone as Brevo's SPF/DKIM — **add records, touch nothing existing**): apex `A` + `www` CNAME exactly as the Vercel domains panel displays. Wait for _Valid Configuration_ + certificate; check `https://sorglosantrag.de` loads. |
| 4   | founder | Supabase → Authentication → URL Configuration: **ADD** `https://sorglosantrag.de/**` to Redirect URLs (**keep** vercel.app entries), then Site URL → `https://sorglosantrag.de`.                                                                |
| 5   | founder | Vercel → Environment Variables → `NEXT_PUBLIC_SITE_URL` = `https://sorglosantrag.de` (Production) → **Redeploy**.                                                                                                                               |
| 6   | founder | Supabase → Authentication → Emails: eyeball both templates for literal URLs (expected: only `{{ .ConfirmationURL }}`). Brevo: no action — sending domain already `sorglosantrag.de`.                                                            |
| 7   | dev     | Re-verify on the new domain: `smoke:signup`, condensed e2e regression (`E2E_BASE_URL=https://sorglosantrag.de`), one real confirmation email checked for `sorglosantrag.de` links.                                                              |
| 8   | founder | After verification: Vercel Domains → set `sorglos-antrag.vercel.app` to "Redirect to Primary Domain". Remove old Supabase redirect entries only after UAT on the new domain.                                                                    |

Rollback at any step: revert Site URL + env var — the vercel.app URL never
stops serving. Both URLs work during the whole transition (the allowlist has
both), so signup never breaks.

## 7. PLZ routing policy (founder-stated, Roman, 2026-07-23)

> When in doubt, include the PLZ. When a new social office is implemented and
> creates a duplicate routing, resolve it at that point. A missed PLZ degrades
> to the default questionnaire + default document list; if the resulting
> application reaches the wrong office, the office notifies us — accepted as a
> super edge case.

Practical consequences: office PLZ lists may deliberately include
administratively adjacent codes (e.g. Pankow's list contains 10247/10249
[Friedrichshain] and 13051 [Lichtenberg] per Roman); overlaps are resolved
when the overlapping office actually gets implemented, not before. PLZ changes
remain dated migrations like all config (§3).
