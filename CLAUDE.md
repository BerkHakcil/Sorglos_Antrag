# CLAUDE.md — Hilfe-zur-Pflege

> This file is the standing brief for Claude Code. It applies to every prompt. Keep it at the repo root. The full data model lives in `docs/architecture.md` §3.
>
> **Next.js 16 note:** This project uses Next.js 16. Read `AGENTS.md` and the embedded docs in `node_modules/next/dist/docs/` before writing framework code. Key change: `middleware.ts` is now `proxy.ts`.

## What we're building

A German-language web app that guides relatives through applying for _Hilfe zur Pflege_ (a means-tested German care-cost benefit) as a friendly, WhatsApp-style guided questionnaire, collects the required documents, and hands the team a near-complete case. Care homes are the customers. Scale is small: ~7 partner homes, 20–50 cases/month. This is a correctness, trust, and security problem — **not** a scaling problem.

## Stack

- **Next.js 16 (App Router) + TypeScript** (strict mode).
- **Supabase** — Postgres database + Auth + Storage, **EU region** (Frankfurt or Ireland).
- **Tailwind CSS v4 + shadcn/ui** for UI.
- **Deploy on Vercel**, with serverless functions pinned to an **EU region (fra1)** for residency-consistency. Data lives in Supabase EU.
- Tooling: ESLint + Prettier, Vitest (unit) + Playwright (e2e), GitHub Actions CI.

## Non-negotiable rules

1. **The questionnaire is data-driven.** Questions, options, validation, and document rules live in the database — never hardcoded in components, and never a separate answer table per Sozialamt. See `docs/architecture.md` §3.
2. **All German user-facing text is data**, authored by the non-technical co-founder and stored in `*_de` columns / seed data. Never hardcode German prose in code. (The developer does not read German.)
3. **Security is server-centric for sensitive data.** Anything touching personal, financial, or document data goes through Server Components / Server Actions / Route Handlers with a verified `supabase.auth.getClaims()` check. RLS policies are defense-in-depth, not the only line of defense. Never trust the browser/client alone.
4. **Secrets stay server-side.** The Supabase secret/service key is used only in server code, never exposed to the browser. Client code uses only the publishable key.
5. **Auth uses `@supabase/ssr`** (the deprecated `@supabase/auth-helpers` is forbidden). Browser client for Client Components, server client for server code, `proxy.ts` to refresh sessions (Next.js 16 — not `middleware.ts`). Use `getClaims()` (not `getSession()`) to verify identity in server code. Use the current publishable/secret key format.
6. **Private file storage only.** Supabase Storage private buckets, access via short-lived signed URLs after an ownership check. No public buckets, no public file URLs. Validate file type (PDF, JPG, PNG, HEIC) and size (≤ 15 MB) server-side.
7. **Roles:** `user` and `admin`. A `user` only ever accesses their own case (enforced in server code _and_ RLS). One **case per user**.
8. **Migrations are the single source of truth.** Schema changes go through SQL migrations in `supabase/migrations`, committed to the repo. Do not rely on ad-hoc Supabase dashboard edits. Provide a reproducible seed.
9. **EU data residency** for database, storage, and compute.
10. **Do not over-engineer.** At 20–50 cases/month, no queues, caching layers, sharding, or microservices. Keep it simple and correct.
11. **Tests + CI from day one.** Core logic (PLZ routing, questionnaire engine, document rules, access control) must be tested.

## Conventions

- `app/` — routes (App Router). `components/` — UI. `lib/supabase/{client,server}.ts` — the two Supabase clients. `lib/` — engine/validation logic. `supabase/migrations/` — SQL. `supabase/seed.sql` — reproducible config data.
- `proxy.ts` at project root — session refresh (Next.js 16 name for middleware).
- TypeScript strict; no `any` without justification.
- Explain non-obvious decisions in code comments and in `docs/` so the developer can learn and defend the architecture.
- Keep PRs/changes scoped to one milestone at a time.

## Out of scope (do not build)

Care-home login/dashboard, transmission to authorities, emails beyond auth, no-code editor, OCR, free AI chat, multiple cases per user, analytics, integrated support — and **anything admin or PDF-generation before go-live**.
