-- Enable pg_cron and register the hourly fan-out schedule.
--
-- 00004_cron_fanout.sql created the cron_run_automations() function but
-- wrapped cron.schedule() in an `if exists (pg_extension pg_cron)` guard that
-- silently fell through on a fresh Supabase project where pg_cron isn't
-- installed by default. Result: the function existed but was never invoked,
-- so scheduled runs never fired and the UI automation toggle appeared broken.
-- This migration installs the extension and ensures the schedule is present.

create extension if not exists pg_cron with schema pg_catalog;

do $$
begin
  if not exists (select 1 from cron.job where jobname = 'hourly-automation-fanout') then
    perform cron.schedule(
      'hourly-automation-fanout',
      '0 * * * *',
      'select public.cron_run_automations()'
    );
  end if;
end $$;
