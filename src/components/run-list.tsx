"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatRunDate, formatDuration, formatDeadline } from "@/lib/utils";
import { statusVariant, listingUrl, listingImageUrl, STEP_LABELS, sortListings } from "@/lib/domain/types";
import type { AutomationRun, StepLogEntry, ListingWithScore } from "@/lib/domain/types";


function RunDetail({ run }: { run: AutomationRun }) {
  const steps = (run.step_log ?? []) as StepLogEntry[];
  const sorted = sortListings(run.result_data ?? []);
  const hasScores = sorted.some((l) => l.score != null);
  const topListings = sorted.slice(0, 5);

  return (
    <div className="px-4 pb-4 pt-1 space-y-3">
      {/* Steps summary */}
      {steps.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {steps.map((step, i) => (
            <span
              key={i}
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${
                step.status === "success"
                  ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                  : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
              }`}
            >
              {STEP_LABELS[step.step] ?? step.step}
            </span>
          ))}
        </div>
      )}

      {/* Top listings */}
      {topListings.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground font-medium">
            Top listings ({sorted.length} total)
          </p>
          {topListings.map((l) => {
            const imgSrc = l.hasApplied ? listingImageUrl(l.imageUrl ?? "", 120, 80) : "";
            return (
              <a
                key={l.id}
                href={listingUrl(l.id)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 text-xs py-1 hover:bg-muted/50 rounded px-1 -mx-1"
              >
                {imgSrc && (
                  <img src={imgSrc} alt="" className="h-10 w-16 rounded object-cover shrink-0" />
                )}
                <span className="font-medium truncate flex-1">{l.address}</span>
                {hasScores && <span className="text-muted-foreground w-8 text-right">{l.score}</span>}
                <span className="text-muted-foreground w-8 text-right">#{l.position}</span>
                <span className="text-muted-foreground w-16 text-right">&euro;{l.rentNet}</span>
                <span className="text-muted-foreground w-16 text-right">til {formatDeadline(l.deadline)}</span>
                {l.hasApplied && <Badge variant="default" className="text-[10px] px-1.5 py-0">Applied</Badge>}
              </a>
            );
          })}
        </div>
      )}

      {/* Error message */}
      {run.error_message && (
        <p className="text-xs text-destructive">{run.error_message}</p>
      )}

      {/* Link to full detail */}
      <Link
        href={`/runs/${run.id}`}
        className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline underline-offset-2"
      >
        View full detail
        <ChevronRight className="h-3 w-3" />
      </Link>
    </div>
  );
}

export function RunList({ runs }: { runs: AutomationRun[] }) {
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    // First run expanded by default
    return runs.length > 0 ? new Set([runs[0].id]) : new Set();
  });

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="divide-y rounded-md border">
      {runs.map((run) => {
        const { day, date, time } = formatRunDate(run.started_at);
        const isOpen = expanded.has(run.id);

        return (
          <div key={run.id}>
            <button
              onClick={() => toggle(run.id)}
              className="flex w-full items-center gap-3 px-4 py-3 text-sm text-left hover:bg-muted/50 transition-colors"
            >
              <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? "rotate-90" : ""}`} />
              <span className="w-36 shrink-0">{day} {date}, {time}</span>
              <Badge variant={statusVariant(run.status)}>{run.status}</Badge>
              <Badge variant="outline" className="text-xs">
                {run.trigger_type === "cron" ? "Auto" : "Manual"}
              </Badge>
              <span className="text-muted-foreground">
                {run.listings_found} listings
                {run.actions_taken > 0 && `, ${run.actions_taken} actions`}
              </span>
              <span className="ml-auto text-muted-foreground">
                {formatDuration(run.started_at, run.completed_at)}
              </span>
            </button>
            {isOpen && <RunDetail run={run} />}
          </div>
        );
      })}
    </div>
  );
}
