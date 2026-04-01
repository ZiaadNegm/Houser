import type { SupabaseClient } from "@supabase/supabase-js";
import type { AutomationRun, RunStatus, TriggerType } from "@/lib/domain/types";

export async function getRecentRuns(
  supabase: SupabaseClient,
  userId: string,
  limit = 20
): Promise<AutomationRun[]> {
  const { data, error } = await supabase
    .from("automation_runs")
    .select("*")
    .eq("user_id", userId)
    .order("started_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data as AutomationRun[];
}

export async function createRun(
  supabase: SupabaseClient,
  userId: string,
  triggerType: TriggerType
): Promise<AutomationRun> {
  const { data, error } = await supabase
    .from("automation_runs")
    .insert({
      user_id: userId,
      status: "running" as RunStatus,
      trigger_type: triggerType,
      started_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw error;
  return data as AutomationRun;
}

export async function completeRun(
  supabase: SupabaseClient,
  runId: string,
  status: "success" | "failed",
  result?: { listings_found?: number; actions_taken?: number; error_message?: string }
): Promise<AutomationRun> {
  const { data, error } = await supabase
    .from("automation_runs")
    .update({
      status,
      completed_at: new Date().toISOString(),
      ...result,
    })
    .eq("id", runId)
    .select()
    .single();

  if (error) throw error;
  return data as AutomationRun;
}
