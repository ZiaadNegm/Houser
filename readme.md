# WoningNet DAK Auto-Apply

A web application that automatically checks [WoningNet DAK](https://almere.mijndak.nl) (Almere) listings on a schedule, ranks available housing opportunities by provisional queue position, and manages your active application slots — applying to the best opportunities and replacing weaker ones when something better appears.

In the Dutch social housing system, WoningNet lets you respond to rental listings and your position in the queue depends on your registration time. Because you can only hold a limited number of active responses at once, timing and slot management matter. This app automates the entire loop: fetch listings, score them, apply, and swap out weaker applications — so you don't miss opportunities by not checking in time.

For the full product vision including scoring rules, apply/revoke logic, and future phases, see [productRequirements.md](./productRequirements.md).

## What's currently implemented

- **App authentication** — sign up / sign in via Supabase Auth
- **WoningNet integration** — session-based login, listing retrieval, apply, and revoke via the WoningNet DAK JSON API
- **Scoring engine** — declarative rule-based scoring (position, rent, rooms, neighborhood, contract type, property type, position limit) with weighted aggregation
- **Auto-apply** — applies to the top-scored listings that fit your preferences, manages 2 application slots
- **Revoke-and-replace** — automatically revokes weaker applications when better listings appear
- **Dry run mode** — preview what the system would do without making real applications (default ON)
- **Blacklist** — exclude specific listings from consideration
- **Preferences** — configure max rent, min rooms, preferred neighborhoods, contract type, property types, and position limit
- **Scheduled runs** — hourly cron via Supabase pg_cron with user-bucketed fan-out
- **Dashboard** — listings sorted by score with house photos for applied listings, recent activity with action counts, attention banners for failures
- **Run detail** — step-by-step timeline (login, fetch, score, decide, execute, verify) with per-action results
- **Run history** — expandable accordion view with inline listing previews
- **Listing links** — every listing links to its WoningNet detail page

## Tech stack

- **Frontend:** Next.js 16 (App Router, Server Components, Turbopack)
- **Backend:** Supabase (Postgres, Auth, Edge Functions)
- **Edge Functions:** Deno (TypeScript)
- **External API:** WoningNet DAK (Almere) — session-based SOAP/XML endpoint

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (must be running before setup)
- [Node.js](https://nodejs.org/) v18+
- A **WoningNet Almere DAK** account ([almere.mijndak.nl](https://almere.mijndak.nl))

## Setup

### 1. Clone and install dependencies

```bash
git clone https://github.com/ZiaadNegm/houser.git
cd houser
npm install
```

### 2. Start local Supabase

Make sure Docker Desktop is running, then:

```bash
supabase start
```

> If you don't have the Supabase CLI installed globally, you can use `npx supabase` instead of `supabase` for all commands in this guide.

This spins up a local Postgres database, Auth server, and Edge Function runtime. When it completes, it prints your API keys. To retrieve them at any time:

```bash
supabase status -o env
```

You'll need the `ANON_KEY` and `SERVICE_ROLE_KEY` values in the next step.

### 3. Configure environment variables

```bash
cp .env.local.example .env.local
```

Open `.env.local` and fill in:

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `http://127.0.0.1:54321` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | The `anon key` from `supabase start` output |
| `SUPABASE_SERVICE_ROLE_KEY` | The `service_role key` from `supabase start` output |
| `CREDENTIAL_ENCRYPTION_KEY` | A 256-bit base64 key for encrypting user credentials: `openssl rand -base64 32` |

WoningNet credentials are stored per-user in the database (encrypted). Users enter them via the settings page after signing in. The same `CREDENTIAL_ENCRYPTION_KEY` must be set in both Vercel and Supabase edge function secrets.

### 4. Apply database migrations

```bash
supabase db reset
```

This drops and recreates the local database with all migrations applied (tables, RLS policies, triggers).

## Running the app

You need two processes running in separate terminals:

**Terminal 1 — Edge Functions:**

```bash
supabase functions serve --env-file .env.local
```

**Terminal 2 — Next.js frontend:**

```bash
npm run dev
```

The app is available at [http://localhost:3000](http://localhost:3000).

### First use

1. Open [http://localhost:3000](http://localhost:3000)
2. Sign up with any email and password (local Supabase auto-confirms accounts — no real email needed)
3. Click **"Trigger Run"** on the dashboard
4. After a few seconds the page refreshes with real WoningNet listings

## Ports

| Port | Service |
|---|---|
| 3000 | Next.js dev server |
| 54321 | Supabase API (PostgREST, Auth, etc.) |
| 54322 | PostgreSQL database |
| 54323 | Supabase Studio (DB admin UI) |
| 54324 | Inbucket (local email testing) |

## Project structure

```
src/
  app/              # Next.js pages and API routes
  components/       # React components (UI, forms, layout)
  lib/
    supabase/       # Supabase client setup (browser, server, middleware, withAuth)
    repositories/   # Data access layer (runs, settings, blacklist)
    domain/         # Business logic (scoring engine, types, helpers)

supabase/
  migrations/       # SQL migrations (auto-applied on supabase start)
  functions/
    run-automation/  # Main automation Edge Function (pipeline: login → fetch → score → decide → execute → verify)
    _shared/
      woningnet/    # WoningNet modules (auth, client, listings, actions, types)
      scoring.ts    # Scoring engine (synced copy from src/lib/domain/scoring.ts)
      decision.ts   # Decision engine (slot management, revoke-and-replace)
  config.toml       # Supabase local dev configuration
```

## Database

Migrations in `supabase/migrations/` are applied automatically when you run `supabase start`.

To create a new migration:

```bash
supabase migration new <migration_name>
```

This creates a new timestamped SQL file in `supabase/migrations/`.

To reset the database and re-apply all migrations:

```bash
supabase db reset
```
