-- Step 5: Add result_data and step_log JSONB columns to automation_runs
-- result_data: stores WoningNetListing[] from a successful run
-- step_log: stores step-by-step execution log for debugging

ALTER TABLE public.automation_runs ADD COLUMN result_data jsonb;
ALTER TABLE public.automation_runs ADD COLUMN step_log jsonb;
