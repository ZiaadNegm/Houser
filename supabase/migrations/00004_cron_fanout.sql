-- Enable pg_net for HTTP calls from within the database
create extension if not exists pg_net with schema extensions;

-- Fan-out function: resolves eligible users for the current hourly bucket
-- and fires one edge-function invocation per user via pg_net.
create or replace function public.cron_run_automations()
returns void
language plpgsql
security definer
as $$
declare
  current_hour int;
  bucket       int;
  base_url     text;
  svc_key      text;
  rec          record;
begin
  -- Only run between 07:00 and 23:59 Amsterdam time
  current_hour := extract(hour from now() at time zone 'Europe/Amsterdam')::int;
  if current_hour < 7 or current_hour > 23 then
    return;
  end if;

  -- 17 buckets (hours 7-23 inclusive)
  bucket := current_hour - 7;

  -- Read secrets from Vault
  select decrypted_secret into base_url
    from vault.decrypted_secrets
   where name = 'supabase_url';

  select decrypted_secret into svc_key
    from vault.decrypted_secrets
   where name = 'service_role_key';

  if base_url is null or svc_key is null then
    raise warning 'cron_run_automations: missing vault secrets (supabase_url or service_role_key)';
    return;
  end if;

  -- Loop over eligible users in this bucket
  for rec in
    select p.id as user_id
      from public.profiles p
     where p.automation_enabled = true
       and mod(abs(hashtext(p.id::text)), 17) = bucket
       and not exists (
         select 1
           from public.automation_runs ar
          where ar.user_id = p.id
            and ar.status in ('queued', 'running')
            and ar.started_at > now() - interval '1 minute'
       )
  loop
    perform net.http_post(
      url     := base_url || '/functions/v1/run-automation',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || svc_key,
        'Content-Type',  'application/json',
        'apikey',         svc_key
      ),
      body    := jsonb_build_object(
        'trigger_type', 'cron',
        'user_id',       rec.user_id
      )
    );
  end loop;
end;
$$;

-- Schedule hourly cron job (only if pg_cron is available)
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule(
      'hourly-automation-fanout',
      '0 * * * *',
      'select public.cron_run_automations()'
    );
    update cron.job
       set timezone = 'Europe/Amsterdam'
     where jobname = 'hourly-automation-fanout';
  else
    raise notice 'pg_cron not available, skipping schedule creation';
  end if;
end $$;
