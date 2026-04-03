import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getRecentRuns } from "@/lib/repositories/runs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TriggerRunButton } from "@/components/trigger-run-button";
import { AutomationToggle } from "@/components/automation-toggle";
import { formatRunDate, formatDuration, formatRelativeTime } from "@/lib/utils";
import type { AutomationRun, Listing } from "@/lib/domain/types";
import { STEP_LABELS } from "@/lib/domain/types";

function analyzeFailures(runs: AutomationRun[]) {
  const lastRun = runs[0];
  const lastFive = runs.slice(0, 5);
  const failedInLastFive = lastFive.filter((r) => r.status === "failed");

  const lastRunFailed = lastRun?.status === "failed" ? lastRun : null;

  const failurePattern =
    failedInLastFive.length > 1
      ? {
          count: failedInLastFive.length,
          total: lastFive.length,
          errors: [...new Set(failedInLastFive.map((r) => r.error_message).filter(Boolean))],
        }
      : null;

  const stuckRun = runs.find((r) => {
    if (r.status !== "running" && r.status !== "queued") return false;
    const elapsed = Date.now() - new Date(r.started_at).getTime();
    return elapsed > 10 * 60 * 1000; // 10 minutes
  });

  return { lastRunFailed, failurePattern, stuckRun };
}

function getFailedStep(run: AutomationRun): string | null {
  if (!run.step_log) return null;
  const failed = run.step_log.find((s) => s.status === "failed");
  return failed?.step ?? null;
}

function statusDot(status: string) {
  const color =
    status === "success"
      ? "bg-green-500"
      : status === "failed"
        ? "bg-red-500"
        : "bg-yellow-500";
  return <span className={`inline-block h-2 w-2 rounded-full ${color}`} />;
}

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
  if (user) {
    try {
      runs = await getRecentRuns(supabase, user.id, 10);
    } catch {
      loadError = true;
    }
  }

  const recentRuns = runs.slice(0, 7);
  const { lastRunFailed, failurePattern, stuckRun } = analyzeFailures(runs);
  const hasAttention = lastRunFailed || failurePattern || stuckRun || loadError;

  const latestSuccessful = runs.find((r) => r.status === "success" && r.result_data);
  const listings: Listing[] = latestSuccessful?.result_data
    ? (latestSuccessful.result_data as unknown as Listing[]).sort((a, b) => a.position - b.position)
    : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <div className="flex items-center gap-3">
          <AutomationToggle initialEnabled={profile?.automation_enabled ?? false} />
          <TriggerRunButton />
        </div>
      </div>

      {/* Attention Needed */}
      {hasAttention && (
        <div className="space-y-3">
          {loadError && (
            <Card className="border-destructive/50 bg-red-50 dark:bg-red-950/20">
              <CardContent className="pt-6">
                <p className="text-sm font-medium text-destructive">
                  Could not load recent runs. The database may be unreachable.
                </p>
              </CardContent>
            </Card>
          )}

          {stuckRun && (
            <Card className="border-amber-500/50 bg-amber-50 dark:bg-amber-950/20">
              <CardContent className="pt-6">
                <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
                  Run started {formatRelativeTime(stuckRun.started_at)} and hasn&apos;t completed
                </p>
              </CardContent>
            </Card>
          )}

          {lastRunFailed && (() => {
            const failedStep = getFailedStep(lastRunFailed);
            return (
              <Card className="border-destructive/50 bg-red-50 dark:bg-red-950/20">
                <CardContent className="pt-6">
                  <p className="text-sm font-medium text-destructive">
                    {failedStep
                      ? `${STEP_LABELS[failedStep] ?? failedStep} failed`
                      : "Last run failed"}{" "}
                    {formatRelativeTime(lastRunFailed.started_at)}
                    {lastRunFailed.error_message && `: ${lastRunFailed.error_message}`}
                  </p>
                </CardContent>
              </Card>
            );
          })()}

          {failurePattern && !lastRunFailed && (
            <Card className="border-amber-500/50 bg-amber-50 dark:bg-amber-950/20">
              <CardContent className="pt-6 space-y-1">
                <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
                  {failurePattern.count} of last {failurePattern.total} runs failed
                </p>
                {failurePattern.errors.map((err, i) => (
                  <p key={i} className="text-xs text-amber-600 dark:text-amber-500">{err}</p>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Recent Activity */}
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
                    {statusDot(run.status)}
                    <span className="w-28 shrink-0 text-muted-foreground">
                      {day} {date}
                    </span>
                    <span className="w-12 shrink-0 text-muted-foreground">{time}</span>
                    <Badge variant="outline" className="text-xs">
                      {run.trigger_type === "cron" ? "Auto" : "Manual"}
                    </Badge>
                    <span className="text-muted-foreground">
                      {run.status === "success" ? `${run.listings_found} listings` : "—"}
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

      {/* Listings */}
      {listings.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Available Listings</CardTitle>
            <p className="text-sm text-muted-foreground">
              {listings.length} listings from last successful run
            </p>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Address</TableHead>
                  <TableHead className="text-right">Position</TableHead>
                  <TableHead className="text-right">Rooms</TableHead>
                  <TableHead className="text-right">Rent</TableHead>
                  <TableHead>Deadline</TableHead>
                  <TableHead>Applied</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {listings.map((listing) => (
                  <TableRow key={listing.id}>
                    <TableCell className="font-medium">{listing.address}</TableCell>
                    <TableCell className="text-right">{listing.position}</TableCell>
                    <TableCell className="text-right">{listing.rooms}</TableCell>
                    <TableCell className="text-right">{listing.rentNet}</TableCell>
                    <TableCell>{listing.deadline}</TableCell>
                    <TableCell>
                      {listing.hasApplied && (
                        <Badge variant="default">Applied</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
