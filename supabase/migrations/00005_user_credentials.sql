-- Per-user encrypted credentials for third-party services (e.g. WoningNet).
-- Credentials are AES-256-GCM encrypted at the application layer before storage.
-- The encryption key lives in edge function / Vercel env vars, NOT in the database.

create table public.user_credentials (
  id                    uuid primary key default uuid_generate_v4(),
  user_id               uuid not null references public.profiles(id) on delete cascade,
  provider              text not null default 'woningnet',
  encrypted_credentials text not null,   -- base64(IV || ciphertext || authTag)
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique(user_id, provider)
);

alter table public.user_credentials enable row level security;

create policy "Users can view own credentials"
  on public.user_credentials for select
  using (auth.uid() = user_id);

create policy "Users can insert own credentials"
  on public.user_credentials for insert
  with check (auth.uid() = user_id);

create policy "Users can update own credentials"
  on public.user_credentials for update
  using (auth.uid() = user_id);

create policy "Users can delete own credentials"
  on public.user_credentials for delete
  using (auth.uid() = user_id);
