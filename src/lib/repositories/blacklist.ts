import type { SupabaseClient } from "@supabase/supabase-js";

export async function getBlacklist(
  supabase: SupabaseClient,
  userId: string
): Promise<string[]> {
  const { data, error } = await supabase
    .from("app_settings")
    .select("value")
    .eq("user_id", userId)
    .eq("key", "blacklist")
    .single();

  if (error || !data) return [];
  return Array.isArray(data.value) ? data.value : [];
}

async function upsertBlacklist(
  supabase: SupabaseClient,
  userId: string,
  ids: string[]
): Promise<string[]> {
  const { error } = await supabase
    .from("app_settings")
    .upsert(
      {
        user_id: userId,
        key: "blacklist",
        value: ids,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,key" }
    );

  if (error) throw error;
  return ids;
}

export async function addToBlacklist(
  supabase: SupabaseClient,
  userId: string,
  listingId: string
): Promise<string[]> {
  const current = await getBlacklist(supabase, userId);
  if (current.includes(listingId)) return current;
  return upsertBlacklist(supabase, userId, [...current, listingId]);
}

export async function removeFromBlacklist(
  supabase: SupabaseClient,
  userId: string,
  listingId: string
): Promise<string[]> {
  const current = await getBlacklist(supabase, userId);
  return upsertBlacklist(supabase, userId, current.filter((id) => id !== listingId));
}
