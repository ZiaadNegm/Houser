import { createClient, getUser } from "@/lib/supabase/server";
import { getRecentRuns } from "@/lib/repositories/runs";
import { RunList } from "@/components/run-list";
import type { AutomationRun } from "@/lib/domain/types";

export default async function RunsPage() {
  const user = await getUser();

  let runs: AutomationRun[] = [];
  if (user) {
    const supabase = await createClient();
    try {
      runs = await getRecentRuns(supabase, user.id);
    } catch {
      // Table may not exist yet
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Automation Runs</h1>

      {runs.length === 0 ? (
        <p className="text-muted-foreground">
          No runs yet. Trigger a run from the dashboard to get started.
        </p>
      ) : (
        <RunList runs={runs} />
      )}
    </div>
  );
}
