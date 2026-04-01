-- result_data: stores WoningNetListing[] from a successful run
-- step_log: stores step-by-step execution log for debugging

ALTER TABLE public.automation_runs ADD COLUMN result_data jsonb;
ALTER TABLE public.automation_runs ADD COLUMN step_log jsonb;
