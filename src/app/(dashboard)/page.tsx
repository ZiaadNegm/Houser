import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getRecentRuns } from "@/lib/repositories/runs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TriggerRunButton } from "@/components/trigger-run-button";
import { SettingsToggle } from "@/components/settings-toggle";
import { ListingsTable } from "@/components/listings-table";
import { StatusDot } from "@/components/status-dot";
import { AttentionCards } from "@/components/attention-cards";
import { formatRunDate, formatDuration } from "@/lib/utils";
import type { AutomationRun } from "@/lib/domain/types";
import { sortListings } from "@/lib/domain/types";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: profile } = user
    ? await supabase
        .from("profiles")
        .select("automation_enabled")
        .eq("id", user.id)
        .single()
    : { data: null };

  let runs: AutomationRun[] = [];
  let loadError = false;
  let dryRunEnabled = true;
  if (user) {
    try {
      runs = await getRecentRuns(supabase, user.id, 10);
    } catch {
      loadError = true;
    }
    const { data: dryRunSetting } = await supabase
      .from("app_settings")
      .select("value")
      .eq("user_id", user.id)
      .eq("key", "dry_run")
      .single();
    dryRunEnabled = dryRunSetting?.value === false ? false : true;
  }

  const recentRuns = runs.slice(0, 7);
  const latestSuccessful = runs.find((r) => r.status === "success" && r.result_data);
  const listings = latestSuccessful?.result_data
    ? sortListings(latestSuccessful.result_data)
    : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <div className="flex items-center gap-3">
          <SettingsToggle endpoint="/api/dry-run" label="Dry run" initialEnabled={dryRunEnabled} />
          <SettingsToggle endpoint="/api/toggle-automation" label="Auto" initialEnabled={profile?.automation_enabled ?? false} />
          <TriggerRunButton />
        </div>
      </div>

      <AttentionCards loadError={loadError} runs={runs} />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          {recentRuns.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No runs yet. Trigger a run to get started.
            </p>
          ) : (
            <div className="space-y-1">
              {recentRuns.map((run) => {
                const { day, date, time } = formatRunDate(run.started_at);
                return (
                  <Link
                    key={run.id}
                    href={`/runs/${run.id}`}
                    className="flex items-center gap-3 rounded-md px-2 py-1.5 text-sm hover:bg-muted/50 transition-colors"
                  >
                    <StatusDot status={run.status} />
                    <span className="w-28 shrink-0 text-muted-foreground">
                      {day} {date}
                    </span>
                    <span className="w-12 shrink-0 text-muted-foreground">{time}</span>
                    <Badge variant="outline" className="text-xs">
                      {run.trigger_type === "cron" ? "Auto" : "Manual"}
                    </Badge>
                    <span className="text-muted-foreground">
                      {run.status === "success"
                        ? `${run.listings_found} listings${run.actions_taken > 0 ? `, ${run.actions_taken} actions` : ""}`
                        : "—"}
                    </span>
                    <span className="ml-auto text-muted-foreground">
                      {formatDuration(run.started_at, run.completed_at)}
                    </span>
                  </Link>
                );
              })}
              <div className="pt-2">
                <Link href="/runs" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                  View all runs
                </Link>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <ListingsTable
        listings={listings}
        title="Available Listings"
        subtitle={`${listings.length} listings from last successful run`}
      />
    </div>
  );
}
