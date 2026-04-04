import Link from "next/link";
import { notFound } from "next/navigation";
import { Check, X } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getRunById } from "@/lib/repositories/runs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ListingsTable } from "@/components/listings-table";
import { formatRunDate, formatDuration } from "@/lib/utils";
import type { StepLogEntry, ActionRecord } from "@/lib/domain/types";
import { STEP_LABELS, statusVariant, listingUrl, sortListings } from "@/lib/domain/types";

function actionBadgeVariant(status: string) {
  switch (status) {
    case "success":
      return "default" as const;
    case "failed":
      return "destructive" as const;
    case "dry_run":
      return "outline" as const;
    default:
      return "secondary" as const;
  }
}

function ActionSubItems({ actions }: { actions: ActionRecord[] }) {
  return (
    <div className="mt-2 space-y-1">
      {actions.map((a, i) => (
        <div key={i} className="flex items-center gap-2 text-xs">
          <Badge variant={actionBadgeVariant(a.status)} className="text-[10px] px-1.5 py-0">
            {a.action}
          </Badge>
          <a href={listingUrl(a.listing_id)} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground truncate underline-offset-2 hover:underline">
            {a.address}
          </a>
          {a.status === "failed" && a.error && (
            <span className="text-destructive truncate">{a.error}</span>
          )}
        </div>
      ))}
    </div>
  );
}

function StepTimeline({ steps, runStartedAt }: { steps: StepLogEntry[]; runStartedAt: string }) {
  const runStart = new Date(runStartedAt).getTime();

  return (
    <div className="relative space-y-0">
      {steps.map((step, i) => {
        const offsetMs = new Date(step.ts).getTime() - runStart;
        const offsetSeconds = Math.round(offsetMs / 1000);
        const isLast = i === steps.length - 1;

        return (
          <div key={i} className="relative flex gap-3 pb-6">
            {/* Timeline line */}
            {!isLast && (
              <div className="absolute left-[7px] top-4 h-full w-px bg-border" />
            )}

            {/* Status dot */}
            <div className="relative z-10 mt-1 flex-shrink-0">
              {step.status === "success" ? (
                <div className="flex h-4 w-4 items-center justify-center rounded-full bg-green-500 text-white">
                  <Check className="h-2.5 w-2.5" />
                </div>
              ) : step.status === "failed" ? (
                <div className="flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-white">
                  <X className="h-2.5 w-2.5" />
                </div>
              ) : (
                <div className="h-4 w-4 rounded-full border-2 border-muted-foreground bg-background" />
              )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">
                  {STEP_LABELS[step.step] ?? step.step}
                </span>
                <span className="text-xs text-muted-foreground">+{offsetSeconds}s</span>
                {step.detail?.dry_run && step.step === "execute" && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">Dry run</Badge>
                )}
              </div>
              {step.error && (
                <p className="mt-1 text-sm text-destructive">{step.error}</p>
              )}
              {step.detail?.listings_fetched != null && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {step.detail.listings_fetched} listings fetched
                </p>
              )}
              {step.detail?.to_apply != null && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {step.detail.to_apply} to apply, {step.detail.to_replace ?? 0} to replace
                </p>
              )}
              {step.detail?.actions && step.detail.actions.length > 0 && (
                <ActionSubItems actions={step.detail.actions} />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function RunDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) notFound();

  const run = await getRunById(supabase, user.id, id);
  if (!run) notFound();

  const { day, date, time } = formatRunDate(run.started_at);
  const duration = formatDuration(run.started_at, run.completed_at);
  const steps = (run.step_log ?? []) as StepLogEntry[];

  const listings = run.result_data ? sortListings(run.result_data) : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Link href="/runs" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
          Runs
        </Link>
        <span className="text-sm text-muted-foreground">/</span>
        <span className="text-sm">{day} {date}</span>
      </div>

      {/* Run Summary */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Run Summary</CardTitle>
            <Badge variant={statusVariant(run.status)}>{run.status}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-5">
            <div>
              <p className="text-muted-foreground">Started</p>
              <p className="font-medium">{day} {date}, {time}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Duration</p>
              <p className="font-medium">{duration}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Trigger</p>
              <p className="font-medium">{run.trigger_type === "cron" ? "Automatic" : "Manual"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Listings Found</p>
              <p className="font-medium">{run.listings_found}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Actions Taken</p>
              <p className="font-medium">{run.actions_taken}</p>
            </div>
          </div>

          {run.error_message && (
            <div className="mt-4 rounded-md border border-destructive/50 bg-red-50 p-3 dark:bg-red-950/20">
              <p className="text-sm text-destructive">{run.error_message}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Step Timeline */}
      {steps.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Steps</CardTitle>
          </CardHeader>
          <CardContent>
            <StepTimeline steps={steps} runStartedAt={run.started_at} />
          </CardContent>
        </Card>
      )}

      <ListingsTable
        listings={listings}
        title="Listings"
        subtitle={`${listings.length} listings fetched in this run`}
      />
    </div>
  );
}
