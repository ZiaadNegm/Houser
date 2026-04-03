import type { SupabaseClient } from "@supabase/supabase-js";
import type { UserPreferences } from "@/lib/domain/types";
import { DEFAULT_PREFERENCES } from "@/lib/domain/types";

export async function getPreferences(
  supabase: SupabaseClient,
  userId: string
): Promise<UserPreferences> {
  const { data, error } = await supabase
    .from("app_settings")
    .select("value")
    .eq("user_id", userId)
    .eq("key", "preferences")
    .single();

  if (error || !data) return { ...DEFAULT_PREFERENCES };
  return { ...DEFAULT_PREFERENCES, ...(data.value as Partial<UserPreferences>) };
}

export async function savePreferences(
  supabase: SupabaseClient,
  userId: string,
  prefs: UserPreferences
): Promise<void> {
  const { error } = await supabase
    .from("app_settings")
    .upsert(
      {
        user_id: userId,
        key: "preferences",
        value: prefs,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,key" }
    );

  if (error) throw error;
}
