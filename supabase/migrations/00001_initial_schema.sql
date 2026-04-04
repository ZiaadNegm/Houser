-- Phase A: Initial schema — 3 core tables
-- profiles, automation_runs, app_settings

create extension if not exists "uuid-ossp";

-- ============================================================
-- profiles: extends auth.users with app-specific data
-- ============================================================
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  automation_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on public.profiles for select
  using ((select auth.uid()) = id);

create policy "Users can update own profile"
  on public.profiles for update
  using ((select auth.uid()) = id);

-- ============================================================
-- automation_runs: log of each automation execution
-- ============================================================
create table public.automation_runs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'queued'
    check (status in ('queued', 'running', 'success', 'failed')),
  trigger_type text not null default 'manual'
    check (trigger_type in ('manual', 'cron')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  listings_found integer not null default 0,
  actions_taken integer not null default 0,
  error_message text,
  created_at timestamptz not null default now()
);

alter table public.automation_runs enable row level security;

create policy "Users can view own runs"
  on public.automation_runs for select
  using ((select auth.uid()) = user_id);

create policy "Users can insert own runs"
  on public.automation_runs for insert
  with check ((select auth.uid()) = user_id);

create policy "Users can update own runs"
  on public.automation_runs for update
  using ((select auth.uid()) = user_id);

create index idx_automation_runs_user_started
  on public.automation_runs(user_id, started_at desc);

-- ============================================================
-- app_settings: per-user key-value settings
-- ============================================================
create table public.app_settings (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  key text not null,
  value jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, key)
);

alter table public.app_settings enable row level security;

create policy "Users can manage own settings"
  on public.app_settings for all
  using ((select auth.uid()) = user_id);

-- ============================================================
-- Trigger: auto-create profile on auth.users insert
-- ============================================================
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
