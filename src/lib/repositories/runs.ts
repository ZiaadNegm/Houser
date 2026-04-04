import type { SupabaseClient } from "@supabase/supabase-js";
import type { AutomationRun } from "@/lib/domain/types";

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


export async function getRunById(
  supabase: SupabaseClient,
  userId: string,
  runId: string
): Promise<AutomationRun | null> {
  const { data, error } = await supabase
    .from("automation_runs")
    .select("*")
    .eq("id", runId)
    .eq("user_id", userId)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null; // Not found
    throw error;
  }
  return data as AutomationRun;
}

export async function getTotalRunCount(
  supabase: SupabaseClient,
  userId: string,
): Promise<number> {
  const { count, error } = await supabase
    .from("automation_runs")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  if (error) throw error;
  return count ?? 0;
}
