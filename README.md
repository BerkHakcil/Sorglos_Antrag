# Hilfe-zur-Pflege

A German-language web app that guides relatives through applying for _Hilfe zur Pflege_ — a means-tested German care-cost benefit. Built for care homes as customers.

**Stack:** Next.js 16 (App Router) · TypeScript (strict) · Tailwind CSS v4 · shadcn/ui · Supabase (Postgres + Auth + Storage, EU region) · Vercel (EU functions)

See [docs/architecture.md](docs/architecture.md) for the full data model and architecture decisions.

---

## Local development setup

### Prerequisites

- **Node.js 20+** and **npm 10+**
- **Supabase CLI** — `npm install -g supabase`
- A **Supabase project in an EU region** — Frankfurt (`eu-central-1`) or Ireland (`eu-west-1`). This is mandatory for data residency and **cannot be changed** after the project is created.

### 1. Clone and install

```bash
git clone <repo-url>
cd hilfe-zur-pflege
npm install
```

### 2. Environment variables

```bash
cp .env.local.example .env.local
```

Fill in `.env.local`:

| Variable                               | Where to find it                                                                |
| -------------------------------------- | ------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`             | Supabase → Project Settings → API → Project URL                                 |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase → Project Settings → API → Project API keys (publishable)              |
| `SUPABASE_SECRET_KEY`                  | Supabase → Project Settings → API → Project API keys (secret) — **server only** |

> The old key names (`NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) also work during the Supabase migration period but prefer the new `sb_publishable_...` / `sb_secret_...` format.

### 3. Apply the database schema and seed

```bash
# Link to your Supabase project
supabase login
supabase link --project-ref <your-project-ref>

# Push all migrations (creates all tables + RLS policies)
supabase db push

# Seed config data (care homes, social offices, questionnaire, etc.)
# For a fresh local environment:
supabase db reset  # applies migrations + seed.sql
```

For **local Supabase** (Docker):

```bash
supabase start        # starts local Postgres + Auth + Storage
supabase db reset     # applies all migrations + seed.sql
```

### 4. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Available commands

| Command                | Description                       |
| ---------------------- | --------------------------------- |
| `npm run dev`          | Start development server          |
| `npm run build`        | Production build                  |
| `npm run lint`         | ESLint                            |
| `npm run lint:fix`     | ESLint with auto-fix              |
| `npm run format`       | Prettier (write)                  |
| `npm run format:check` | Prettier (check only, used in CI) |
| `npm run typecheck`    | TypeScript type check (no emit)   |
| `npm test`             | Vitest unit tests                 |
| `npm run test:watch`   | Vitest in watch mode              |
| `npm run test:e2e`     | Playwright end-to-end tests       |

---

## Project structure

```
app/                — Next.js App Router routes
  (auth)/           — Login, register, reset-password pages
  (protected)/      — Authenticated-only routes (case overview)
components/
  ui/               — shadcn/ui components
lib/
  supabase/
    client.ts       — Browser Supabase client (for Client Components)
    server.ts       — Server Supabase client (for Server Components / Actions)
  dal.ts            — Data access layer: verifySession(), getCase(), etc.
supabase/
  migrations/       — SQL migrations (single source of truth for schema)
  seed.sql          — Reproducible config data (care homes, offices, questionnaire)
docs/
  architecture.md   — Full data model and architecture decisions
tests/
  unit/             — Vitest unit tests
  e2e/              — Playwright end-to-end tests
.github/workflows/  — GitHub Actions CI
proxy.ts            — Session refresh (Next.js 16 name for middleware)
```

---

## Auth flow (Milestone 1)

1. User visits `/register` — fills full name, email, password, and required consents
2. Server Action calls Supabase Auth — creates the `auth.users` row
3. A Postgres trigger creates a `profiles` row and exactly **one `case`** row (enforced by a UNIQUE constraint on `case.user_id`)
4. User is redirected to `/case` (protected route)
5. On every request, `proxy.ts` calls `supabase.auth.getClaims()` to refresh the session cookie
6. Every Server Component and Server Action that touches case data calls `getClaims()` again — this is the primary security check; RLS policies are a second layer

---

## Security notes

- `SUPABASE_SECRET_KEY` is used **only in server code** (`lib/supabase/server.ts`). It is never imported from client code.
- Row-Level Security (RLS) is enabled on all case-scoped tables. Policies ensure a `user` can only access their own case. These are a second line of defense after server-side `getClaims()` checks.
- No public Supabase Storage buckets. Files (added in Milestone 4) are served via short-lived signed URLs after an ownership check.
- See `docs/architecture.md` §5 for the full security model.
