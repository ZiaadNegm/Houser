import type { SupabaseClient } from "@supabase/supabase-js";

export type BlacklistEntryType = "id" | "street";

export interface BlacklistEntry {
  id: string;
  user_id: string;
  type: BlacklistEntryType;
  value: string;
  label: string;
  created_at: string;
}

const MAX_ENTRIES = 50;

export async function getBlacklistEntries(
  supabase: SupabaseClient,
  userId: string
): Promise<BlacklistEntry[]> {
  const { data, error } = await supabase
    .from("blacklist_entries")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function addBlacklistEntry(
  supabase: SupabaseClient,
  userId: string,
  type: BlacklistEntryType,
  value: string,
  label: string
): Promise<BlacklistEntry> {
  // Check entry limit
  const { count, error: countError } = await supabase
    .from("blacklist_entries")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId);

  if (countError) throw countError;
  if ((count ?? 0) >= MAX_ENTRIES) {
    throw new Error(`Blacklist limit reached (${MAX_ENTRIES} entries)`);
  }

  const { data, error } = await supabase
    .from("blacklist_entries")
    .insert({ user_id: userId, type, value, label })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function removeBlacklistEntry(
  supabase: SupabaseClient,
  userId: string,
  entryId: string
): Promise<void> {
  const { error } = await supabase
    .from("blacklist_entries")
    .delete()
    .eq("id", entryId)
    .eq("user_id", userId);

  if (error) throw error;
}
