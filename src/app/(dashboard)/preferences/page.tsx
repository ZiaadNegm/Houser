import { createClient, getUser } from "@/lib/supabase/server";
import { getPreferences } from "@/lib/repositories/settings";
import { getBlacklistEntries } from "@/lib/repositories/blacklist";
import { getRecentRuns } from "@/lib/repositories/runs";
import { PreferencesForm } from "@/components/preferences-form";
import { BlacklistManager } from "@/components/blacklist-manager";
import type { WoningNetListing } from "@/lib/domain/types";

export default async function PreferencesPage() {
  const user = await getUser();
  if (!user) return null;

  const supabase = await createClient();

  const [preferences, blacklistEntries, runs] = await Promise.all([
    getPreferences(supabase, user.id),
    getBlacklistEntries(supabase, user.id).catch(() => []),
    getRecentRuns(supabase, user.id, 10).catch(() => []),
  ]);

  // Get listings from latest successful run for autocomplete in blacklist manager
  const latestSuccessful = runs.find((r) => r.status === "success" && r.result_data);
  const listings: WoningNetListing[] = latestSuccessful?.result_data ?? [];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Preferences</h1>
      <PreferencesForm initialPreferences={preferences} />
      <BlacklistManager initialEntries={blacklistEntries} listings={listings} />
    </div>
  );
}
