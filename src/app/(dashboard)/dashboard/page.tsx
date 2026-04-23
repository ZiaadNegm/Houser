import Link from "next/link";
import { createClient, getUser } from "@/lib/supabase/server";
import { getRecentRuns, getTotalRunCount } from "@/lib/repositories/runs";
import { getPreferences } from "@/lib/repositories/settings";
import { getBlacklistEntries } from "@/lib/repositories/blacklist";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ListingsTable } from "@/components/listings-table";
import { AutoApplyStatus } from "@/components/auto-apply-status";
import { StatCard } from "@/components/stat-card";
import { AttentionCards } from "@/components/attention-cards";
import { CredentialsBanner } from "@/components/credentials-banner";
import { computeDashboardStats, TOTAL_RULES } from "@/lib/domain/stats";
import { formatRunDate } from "@/lib/utils";
import type { AutomationRun } from "@/lib/domain/types";
import { sortListings, capitalizeStatus, statusVariant } from "@/lib/domain/types";

export default async function DashboardPage() {
  const user = await getUser();
  if (!user) return null;

  const supabase = await createClient();

  const [{ data: profile }, { data: credentials }, runs, { data: dryRunSetting }, preferences, totalCount, blacklistEntries] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("automation_enabled")
        .eq("id", user.id)
        .single(),
      supabase
        .from("user_credentials")
        .select("id")
        .eq("user_id", user.id)
        .eq("provider", "woningnet")
        .maybeSingle(),
      getRecentRuns(supabase, user.id, 10).catch(
        () => [] as AutomationRun[]
      ),
      supabase
        .from("app_settings")
        .select("value")
        .eq("user_id", user.id)
        .eq("key", "dry_run")
        .single(),
      getPreferences(supabase, user.id),
      getTotalRunCount(supabase, user.id).catch(() => 0),
      getBlacklistEntries(supabase, user.id).catch(() => []),
    ]);

  const dryRunEnabled = dryRunSetting?.value !== false;
  const recentRuns = runs.slice(0, 7);
  const latestSuccessful = runs.find((r) => r.status === "success" && r.result_data);
  const listings = latestSuccessful?.result_data
    ? sortListings(latestSuccessful.result_data)
    : [];

  const stats = computeDashboardStats(runs, preferences, totalCount);
  const blockedIds = new Set(
    blacklistEntries.filter((e) => e.type === "id").map((e) => e.value)
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 flex-wrap">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        {profile?.automation_enabled && !credentials && (
          <CredentialsBanner />
        )}
      </div>

      <AttentionCards loadError={false} runs={runs} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: Auto-Apply + Listings */}
        <div className="lg:col-span-2 space-y-6">
          <AutoApplyStatus
            automationEnabled={profile?.automation_enabled ?? false}
            dryRunEnabled={dryRunEnabled}
          />
          <ListingsTable
            listings={listings}
            title="Recently Applied Listings"
            subtitle={`${listings.length} listings from last successful run`}
            blockedIds={blockedIds}
          />
        </div>

        {/* Right column: Stats + Recent Activity */}
        <div className="space-y-6">
          <div className="grid grid-cols-3 gap-3 lg:grid-cols-1 lg:gap-3">
            <StatCard label="Applied Today" value={stats.appliedToday} />
            <StatCard label="Active Rules" value={`${stats.activeRules} / ${TOTAL_RULES}`} />
            <StatCard label="Total Runs" value={stats.totalRuns} />
          </div>

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
              <div className="space-y-3">
                {recentRuns.map((run) => {
                  const { time } = formatRunDate(run.started_at);
                  const trigger = run.trigger_type === "cron" ? "Auto" : "Manual";
                  const description =
                    run.status === "success"
                      ? `${trigger} run completed. ${run.listings_found} listings processed.${run.actions_taken > 0 ? ` ${run.actions_taken} actions taken.` : ""}`
                      : run.status === "failed"
                        ? `${trigger} run failed.${run.error_message ? ` ${run.error_message}` : ""}`
                        : `${trigger} run ${run.status}.`;

                  return (
                    <Link
                      key={run.id}
                      href={`/runs/${run.id}`}
                      prefetch={false}
                      className="flex items-start gap-3 rounded-md px-2 py-2 text-sm hover:bg-muted/50 transition-colors"
                    >
                      <span className="w-10 shrink-0 text-muted-foreground text-xs pt-0.5">{time}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
                      </div>
                      <Badge
                        variant={statusVariant(run.status)}
                        className="shrink-0 text-[10px]"
                      >
                        {capitalizeStatus(run.status)}
                      </Badge>
                    </Link>
                  );
                })}
                <div className="pt-1">
                  <Link href="/runs" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                    View all runs
                  </Link>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
        </div>
      </div>
    </div>
  );
}
