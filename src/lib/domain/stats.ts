import type { AutomationRun, UserPreferences } from "./types";

const TZ = "Europe/Amsterdam";

/** Total number of preference-based rules tracked by the dashboard. */
export const TOTAL_RULES = 6;

export function computeDashboardStats(
  runs: AutomationRun[],
  preferences: UserPreferences | null,
  totalRunCount: number,
): { appliedToday: number; activeRules: number; totalRuns: number } {
  // appliedToday: filter runs to today in Europe/Amsterdam, sum actions_taken for successful runs
  const now = new Date();
  const todayStr = now.toLocaleDateString("en-CA", { timeZone: TZ }); // YYYY-MM-DD
  const appliedToday = runs
    .filter((r) => {
      if (r.status !== "success") return false;
      const runDay = new Date(r.started_at).toLocaleDateString("en-CA", { timeZone: TZ });
      return runDay === todayStr;
    })
    .reduce((sum, r) => sum + (r.actions_taken ?? 0), 0);

  // activeRules: count non-null/non-empty/non-zero preference fields (max 6)
  let activeRules = 0;
  if (preferences) {
    if (preferences.maxRent != null && preferences.maxRent !== 0) activeRules++;
    if (preferences.minRooms != null && preferences.minRooms !== 0) activeRules++;
    if (preferences.maxPosition != null && preferences.maxPosition !== 0) activeRules++;
    if (preferences.preferredContractType != null && preferences.preferredContractType !== "") activeRules++;
    if (preferences.preferredNeighborhoods && preferences.preferredNeighborhoods.length > 0) activeRules++;
    if (preferences.preferredPropertyTypes && preferences.preferredPropertyTypes.length > 0) activeRules++;
  }

  return { appliedToday, activeRules, totalRuns: totalRunCount };
}
