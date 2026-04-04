import { Card, CardContent } from "@/components/ui/card";
import { formatRelativeTime } from "@/lib/utils";
import type { AutomationRun } from "@/lib/domain/types";
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
    return elapsed > 10 * 60 * 1000;
  });

  return { lastRunFailed, failurePattern, stuckRun };
}

function getFailedStep(run: AutomationRun): string | null {
  if (!run.step_log) return null;
  const failed = run.step_log.find((s) => s.status === "failed");
  return failed?.step ?? null;
}

export function AttentionCards({
  loadError,
  runs,
}: {
  loadError: boolean;
  runs: AutomationRun[];
}) {
  const { lastRunFailed, failurePattern, stuckRun } = analyzeFailures(runs);
  const hasAttention = lastRunFailed || failurePattern || stuckRun || loadError;

  if (!hasAttention) return null;

  return (
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
  );
}
