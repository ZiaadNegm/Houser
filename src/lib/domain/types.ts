export type RunStatus = "queued" | "running" | "success" | "failed";
export type TriggerType = "manual" | "cron";

export interface AutomationRun {
  id: string;
  user_id: string;
  status: RunStatus;
  trigger_type: TriggerType;
  started_at: string;
  completed_at: string | null;
  listings_found: number;
  actions_taken: number;
  error_message: string | null;
  created_at: string;
}
