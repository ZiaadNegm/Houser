-- Dedicated blacklist entries table (replaces JSON array in app_settings)
create table public.blacklist_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in ('id', 'street')),
  value text not null,
  label text not null default '',
  created_at timestamptz not null default now(),
  unique(user_id, type, value)
);

-- RLS
alter table public.blacklist_entries enable row level security;
create policy "Users can manage own blacklist entries"
  on public.blacklist_entries for all
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Index for per-user queries
create index idx_blacklist_entries_user on public.blacklist_entries(user_id);

-- Migrate existing data from app_settings JSON blacklist
insert into public.blacklist_entries (user_id, type, value, label)
select
  s.user_id,
  'id',
  e.value::text,
  ''
from public.app_settings s,
  jsonb_array_elements_text(s.value) as e(value)
where s.key = 'blacklist'
  and jsonb_typeof(s.value) = 'array';
