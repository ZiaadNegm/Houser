# WoningNet DAK Auto-Apply

A web application that automatically checks [WoningNet DAK](https://almere.mijndak.nl) (Almere) listings on a schedule, ranks available housing opportunities by provisional queue position, and manages your active application slots — applying to the best opportunities and replacing weaker ones when something better appears.

In the Dutch social housing system, WoningNet lets you respond to rental listings and your position in the queue depends on your registration time. Because you can only hold a limited number of active responses at once, timing and slot management matter. This app automates the entire loop: fetch listings, score them, apply, and swap out weaker applications — so you don't miss opportunities by not checking in time.

For the full product vision including scoring rules, apply/revoke logic, and future phases, see [productRequirements.md](./productRequirements.md).

## What's currently implemented

The project is in early MVP stage. The following is working end-to-end:

- **App authentication** — sign up / sign in via Supabase Auth
- **WoningNet integration** — session-based login and listing retrieval from the WoningNet DAK SOAP/XML API
- **Listing display** — dashboard shows all available listings sorted by queue position, with address, rent, rooms, contract type, deadline, and applicant count
- **Manual trigger** — click "Trigger Run" to fetch fresh listings on demand
- **Run logging** — each run is persisted with status, result data (full listing JSON), and a step-by-step execution log for debugging
- **Error handling** — failed runs show an error banner on the dashboard; credentials are sanitized from all stored data

**Not yet implemented:** automated scheduling, scoring/ranking engine, auto-apply, revoke-and-replace, blacklist management, and metrics. See the [PRD](./productRequirements.md) for the full MVP scope.

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
| `WONINGNET_EMAIL` | Your WoningNet login email |
| `WONINGNET_PASSWORD` | Your WoningNet login password |

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
    supabase/       # Supabase client setup (browser, server, middleware)
    repositories/   # Data access layer (runs, settings, blacklist)
    domain/         # Business logic (scoring, decision-making)
    woningnet/      # WoningNet HTTP client (mirrors Edge Function code)

supabase/
  migrations/       # SQL migrations (auto-applied on supabase start)
  functions/
    run-automation/  # Main automation Edge Function
    _shared/
      woningnet/    # Shared WoningNet modules (auth, client, listings, types)
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
