# Hilfe-zur-Pflege — Architecture & Build Plan (v2, Next.js + Supabase)

> Source-of-truth document. Keep it in the repo as `docs/architecture.md` and give it to Claude Code as context. Everything is a starting point — adjust freely.

---

## 1. The decision (TL;DR)

| Layer              | Choice                                                                                                | Why                                                                                    |
| ------------------ | ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| App framework      | **Next.js 16 (App Router) + TypeScript** (strict)                                                     | One language front-to-back; huge ecosystem; excellent Claude Code support.             |
| UI                 | **React + Tailwind v4 + shadcn/ui**                                                                   | Fast, clean, mobile-first. The chat is a schema-driven form renderer.                  |
| Chat questionnaire | Answers validated and saved **server-side** (Server Actions / Route Handlers), one question at a time | Immediate save per answer is a _requirement_.                                          |
| Auth               | **Supabase Auth** via `@supabase/ssr` (browser + server clients, `proxy.ts`)                          | Verified with `supabase.auth.getClaims()` in server code; satisfies the security spec. |
| Database           | **Supabase Postgres** (EU region)                                                                     | JSONB gives a generic answer engine while staying queryable.                           |
| File storage       | **Supabase Storage, private buckets** (EU), signed URLs only                                          | No public file URLs ever (hard requirement).                                           |
| Admin (later)      | **Supabase Studio** interim → a built read-only admin post-go-live                                    | Founders can view raw data immediately; proper admin comes later.                      |
| PDF fill (later)   | `pdf-lib` (JS), or a small Python serverless function                                                 | Fills official AcroForm PDFs by field name.                                            |
| Email (auth only)  | **Supabase Auth emails** (or Resend)                                                                  | Only signup confirmation + password reset.                                             |
| Hosting            | **Vercel**, serverless functions pinned to an **EU region (fra1)**                                    | Data lives in Supabase EU; compute kept in the EU for residency-consistency.           |

**EU note:** Supabase in an EU region gives data _residency_; Supabase is a US-incorporated company on AWS, so this is residency, not full _sovereignty_. You've accepted that bar for the pilot, with Supabase's DPA in place. Your co-founder owns the privacy policy + processor agreements (AVV).

---

## 2. Whole-product architecture (the 10,000-ft view)

A single Next.js 16 App Router application on Vercel (EU-region functions), using Supabase (Postgres + Auth + Storage) in an EU region. Anything touching personal, financial, or document data runs through **server code** (Server Components, Server Actions, Route Handlers) that verifies the user with `supabase.auth.getClaims()`; **RLS policies are a second line of defense, not the only one**. Files go straight to private Supabase Storage; the database holds only _metadata_ and a storage path, and files are served back through short-lived signed URLs after an ownership check. The founders' admin is Supabase Studio at first, with a proper read-only admin built post-go-live. The official-PDF auto-fill is a post-go-live module that reads a case's answers and writes them into a fillable PDF.

Components:

- **Auth & Roles** — Supabase Auth signup (email, name, consents), login, password reset; roles `user` and `admin`.
- **Case Management** — one case per user, care-home selection, status, progress, timestamps.
- **Social Office Resolution** — postal-code rules → responsible Sozialamt (with a clean "unclear/unsupported" path).
- **Questionnaire Engine** — loads the right questionnaire, serves the next open question, handles required/skip/edit/progress. _Fully data-driven._
- **Answer Storage** — one generic table, immediate save, supports repeatable groups.
- **Document Requirements Engine** — generates the per-case document list from rules + answers (base + conditional + repeated).
- **Upload & Secure Storage** — private files, type/size validation, multiple files per type.
- **Status Events** — append-only timestamped log of meaningful case events.
- **Read-only Admin** (post-go-live) and **PDF Mapping & Generation** (post-go-live).

---

## 3. Data model (the centerpiece)

The golden rule from your rubric: **questions, options, labels, validation, and document rules live in the database — never hardcoded in components, and never a separate answer table per Sozialamt.** Below, _config tables_ are seeded/maintained by you and authored (German text) by your co-founder; _runtime tables_ fill up as users work.

Conventions: PK = `id` (UUID). Timestamps are `created_at` / `updated_at` (timezone-aware). German user-facing text fields are suffixed `_de` and are **data your co-founder owns** — you never type German prose into code. Enable **RLS** on all case-scoped tables.

### 3.1 Configuration / seed tables

**`care_home`** (Pflegeheim) — `name`, `address`, `is_active`. _(User picks from a dropdown; no login.)_

**`social_office`** (Sozialamt) — `name`, `address`, `contact_email`, `contact_phone`, `is_active`.

**`postal_code_rule`** (PLZ-Regel) — `social_office_id`, `plz_from`, `plz_to` (range; equal values for a single code), `priority`. Resolver finds the matching office; _no match → unclear/unsupported._

**`questionnaire`** (Fragebogen) — `social_office_id` (nullable → the generic fallback questionnaire for unclear PLZ), `name`, `version`, `is_active`. ~7 at launch + 1 fallback.

**`category`** (Kategorie) — `questionnaire_id`, `key`, `sort_order`, `label_de`. e.g. Antragsteller, Wohnort, Familienstand, Kinder, Einnahmen, Vermögen, Ausgaben, Dokumente.

**`question_group`** (wiederholbare Gruppe — optional) — `category_id`, `key`, `sort_order`, `label_de`, `is_repeatable`, `min_count`, `max_count`. For "children" or "pensions" where the user adds N instances.

**`question`** (Frage) — `category_id`, `group_id` (nullable), `key`, `sort_order`, `answer_type`, `is_required`, `prompt_de`, `help_de` (nullable), `validation` (JSONB: min/max, regex, etc.), `visibility_rule` (JSONB: show only if a prior answer matches — powers conditional questions).
`answer_type` ∈ `short_text, long_text, number, amount, date, yes_no, single_select, multi_select, address, person, bank_account, document_upload`.

**`question_option`** (Option) — `question_id`, `key`, `sort_order`, `label_de`, `value`. For single/multi-select.

**`document_type`** (Dokumenttyp catalog) — `key`, `label_de`, `description_de`, `is_base` (always required). e.g. Perso, Vollmacht, Heimvertrag, Krankenkassenkarte, Sterbeversicherung, Heimrechnung, MDK-Bericht, Pflegekassenbescheid, Kontoauszüge, Schwerbehindertenausweis, Rentenbescheid, Ehepartner-Unterlagen, Vermögensnachweis.

**`document_rule`** (Dokumentregel) — `questionnaire_id` (or `social_office_id` for office-specific docs), `document_type_id`, `condition` (JSONB: which answers trigger it, e.g. `assets > 0` → Vermögensnachweis), `repeat_per_group_key` (nullable: e.g. the pensions group → one Rentenbescheid per pension). This single table expresses base + conditional + repeated documents.

### 3.2 Runtime / case tables

**`profiles`** — extends Supabase `auth.users`. `id` (= the auth user id), `full_name`, consent flags + timestamps, `role` ∈ `user, admin`. Auth itself (email, password, sessions) is managed by Supabase Auth.

**`case`** (Fall) — `user_id` **(one-to-one — one case per user)**, `care_home_id`, `social_office_id` (nullable if unclear), `questionnaire_id`, `plz_before_move`, `plz_resolution_status` ∈ `resolved, unclear, unsupported`, `status` ∈ `in_progress, under_review`, `created_at`, `updated_at`. _(Care-recipient identity is captured as answers; optionally cache a display name here for the admin list.)_

**`answer`** (Antwort) — `case_id`, `question_id`, `group_instance` (a **stable identifier** for the repeatable-group instance — use a generated id, **not** a positional index, so deleting one instance never renumbers the others; default a single fixed value for non-repeating questions), `value` (JSONB), `created_at`, `updated_at`. **Unique on `(case_id, question_id, group_instance)`.** This one constraint gives immediate save + reliable edit + uniquely-retrievable answers + resume-after-reload. JSONB `value` holds any type (text / number / date / yes-no / array of option keys / address / person / bank object) — one generic table, no per-Sozialamt tables.

**`case_document_requirement`** (the materialized per-case list) — `case_id`, `document_type_id`, `source_rule_id`, `repeat_ref` (nullable, e.g. which pension instance), `label_de` (resolved, may include "für Rente 2"), `status` ∈ `please_upload, in_review, checked, resubmit`, `is_active` (for reconcile — see §4). **"Anzahl fehlender Dokumente" = count where status = `please_upload` (+ `resubmit`) and `is_active`.**

**`document_upload`** (Datei-Metadaten) — `requirement_id`, `storage_path` (the private object path — _never a public URL_), `original_filename`, `content_type`, `size_bytes`, `uploaded_by`, `created_at`. Multiple uploads per requirement = multiple files per document type. The file lives in private Supabase Storage; the DB holds only this metadata.

**`status_event`** (Statusereignis) — `case_id`, `event_type` (e.g. `case_created`, `social_office_resolved`, `mandatory_complete`, `document_uploaded`, `document_status_changed`), `payload` (JSONB), `created_at`. Append-only — your timestamps + audit trail.

### 3.3 PDF tables (post-go-live)

**`pdf_template`** — `social_office_id`, `name`, `version`, `source_note`, `storage_path`.
**`pdf_field_mapping`** — `pdf_template_id`, `pdf_field_name`, `source_question_key` (or a computed expression), `transform` (date format, amount format, checkbox logic), `repeat_handling`.

---

## 4. How the tricky mechanics work (on this schema)

**PLZ → Sozialamt.** On case start the user enters the pre-move postal code. The resolver queries `postal_code_rule`. Match → set `case.social_office_id` and load that office's `questionnaire`. No match → `plz_resolution_status = unsupported`, load the **fallback questionnaire**, flag for manual handling. The user is never blocked. _(Highest-priority test area.)_

**Next-question / skip / progress.** Load `category`s (sorted) for the case's questionnaire; within each, `question`s (sorted), filtered by `visibility_rule`. The "next open question" is the first applicable question (or group instance) with no valid `answer` and not skipped this session. Skipping marks it open (not complete). Re-entering a category jumps to its first open question. **Progress = answered required questions ÷ applicable required questions.** Repeatable groups: each added instance's required sub-questions count toward the total.

**Immediate save.** Each answer is sent to a Server Action / Route Handler that **upserts** the `answer` row (the unique constraint makes this idempotent) and returns the next question. This keeps the chat responsive and surviving a refresh/logout.

**Auto status change + edit lock.** After each saved answer, check whether all applicable required questions across all categories are answered. If yes and the case is `in_progress` → set `under_review`, write a `status_event`, show _"Angaben werden geprüft und Antrag wird erstellt."_ (independent of documents). **Once a case is `under_review`, lock further edits (or route changes to manual)** so a later conditional answer can't silently "un-complete" a submitted case.

**Dynamic documents.** Whenever a relevant answer changes, recompute `case_document_requirement` from `document_rule` (base + `condition` + `repeat_per_group_key`). **Reconcile — never hard-delete:** add new requirements, and mark now-irrelevant ones `is_active = false` rather than deleting them, so an existing upload is never orphaned. At go-live, document _statuses_ are changed manually (admin is read-only until post-go-live).

---

## 5. Security, EU residency & GDPR

Mapped to your non-negotiables:

- **HTTPS** — automatic on Vercel.
- **Auth + sessions** — Supabase Auth via `@supabase/ssr`; http-only cookies; **server code verifies the user with `supabase.auth.getClaims()`** (don't trust an unverified session; never use `getSession()` in server code).
- **RBAC** — server-side ownership checks so a `user` only ever touches their own case; **RLS as defense-in-depth**; `admin` reads all.
- **Server-side validation** — every answer validated in server code by `answer_type` + the question's `validation` JSON. Client-side hints are a convenience, not the source of truth.
- **Secrets** — the Supabase **secret key is server-only**, never exposed to the browser; client code uses only the publishable key.
- **Private storage** — Supabase Storage private buckets; files reach the user only via short-lived signed URLs after an ownership check. Uploads validated for type (PDF/JPG/PNG/HEIC) and size (≤ 15 MB) server-side.
- **Encryption at rest** — Supabase-managed.
- **Backups** — Supabase automated backups (confirm the tier / point-in-time recovery you need).
- **Auditability** — the `status_event` log; no sensitive data in application logs.
- **EU data residency** — Supabase EU region + Vercel EU-region functions.

**GDPR flag (business side — I'm not a lawyer):** this is sensitive personal + financial + care-level data. You'll want data minimization, a deletion path, a record of processing, genuine consent at signup, and a DPA/AVV with Supabase, Vercel, and any email provider. Supabase EU solves residency, not sovereignty. Your co-founder owns the privacy policy and AVVs.

**The Supabase-specific risk to respect:** a misconfigured RLS policy on this data is a leak. Mitigation: do sensitive reads/writes in server code with `getClaims()` checks, keep RLS as a second layer, and run an explicit RLS audit at M5.

---

## 6. Providers / services

- **Database + Auth + Storage:** Supabase, **EU region** (Frankfurt or Ireland). Set the region at project creation — it can't be changed later.
- **Hosting:** Vercel, with functions pinned to an EU region (fra1).
- **Email:** Supabase Auth's built-in emails, or Resend for nicer templates. Auth mails only.

---

## 7. Build sequence (milestones)

- **M1 — Foundation, auth, data model.** Next.js + TS scaffold; §3 schema as Supabase migrations; Supabase Auth (`@supabase/ssr`); one case per user; reproducible seed; tests + CI. _Demo: register, log in, get exactly one case._
- **M2 — PLZ routing + questionnaire engine.** Care-home dropdown; PLZ resolver; load questionnaire from data; answer types; immediate server-side save; required/skip/progress.
  - **Reminder for M2 (questionnaire start):** The signup form collects caregiver data (the relative filling out the form). At the very start of the questionnaire, before the first question, show a short notice reminding the user that all questions from here on are about the **patient** (the care-home resident), not about themselves. Suggested placement: a dismissible info banner or the first "screen" of the questionnaire. The copy lives in the `questionnaire` seed data or `lib/strings/de.ts`.
- **M3 — Chat UX (Go/No-Go gate).** Case overview; React chat per category; skip + edit; auto status flip + edit lock.
- **M4 — Documents.** Document area; secure upload to private storage; rule engine with reconcile.
- **M5 — Stabilize & go live.** QA; security review including RLS audit; launch checklist.
- **Post-go-live 1 — Read-only admin.**
- **Post-go-live 2 — Internal PDF for one office.**

**Do not build:** care-home login/dashboard, transmission to authorities, emails beyond auth, no-code editor, OCR, free AI chat, multiple cases per user, analytics, and _anything admin or PDF before go-live._
