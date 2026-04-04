"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatRunDate, formatDuration } from "@/lib/utils";
import { statusVariant, capitalizeStatus, listingImageUrl, sortListings } from "@/lib/domain/types";
import type { AutomationRun, ListingWithScore } from "@/lib/domain/types";

function appliedCount(run: AutomationRun): number {
  return (run.result_data ?? []).filter((l) => l.hasApplied).length;
}

function appliedThumbnails(run: AutomationRun): ListingWithScore[] {
  return sortListings(run.result_data ?? []).filter((l) => l.hasApplied).slice(0, 6);
}

function LatestRunCard({ run }: { run: AutomationRun }) {
  const { day, date, time } = formatRunDate(run.started_at);
  const duration = formatDuration(run.started_at, run.completed_at);
  const applied = appliedCount(run);
  const thumbs = appliedThumbnails(run);

  return (
    <Link href={`/runs/${run.id}`} className="block group">
      <Card className="transition-shadow group-hover:shadow-md">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">
              Latest Run: {day} {date}, {time}
            </CardTitle>
            <Badge variant={statusVariant(run.status)}>{capitalizeStatus(run.status)}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span>Duration: {duration}</span>
            <span>
              Applied to {applied} out of {run.listings_found} listings found
            </span>
          </div>

          {thumbs.length > 0 && (
            <div className="flex gap-2 overflow-hidden">
              {thumbs.map((l) => {
                const src = listingImageUrl(l.imageUrl ?? "", 120, 80);
                return src ? (
                  <img
                    key={l.id}
                    src={src}
                    alt={l.address}
                    className="h-12 w-18 rounded object-cover shrink-0"
                  />
                ) : null;
              })}
            </div>
          )}

          {run.error_message && (
            <p className="text-xs text-destructive">{run.error_message}</p>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}

function TimelineItem({ run }: { run: AutomationRun }) {
  const { day, date, time } = formatRunDate(run.started_at);
  const applied = appliedCount(run);
  const thumbs = appliedThumbnails(run);

  return (
    <Link href={`/runs/${run.id}`} className="block group">
      <div className="relative flex gap-4 pb-8 last:pb-0">
        {/* Vertical line */}
        <div className="absolute left-[7px] top-4 bottom-0 w-px bg-border group-last:hidden" />

        {/* Dot */}
        <div className="relative z-10 mt-1.5 flex-shrink-0">
          <div
            className={`h-4 w-4 rounded-full border-2 ${
              run.status === "success"
                ? "border-primary bg-primary"
                : run.status === "failed"
                  ? "border-destructive bg-destructive"
                  : "border-muted-foreground bg-background"
            }`}
          />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 space-y-1 rounded-lg p-2 -mt-1 transition-colors group-hover:bg-muted/50">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium">
              {day} {date}, {time}
            </span>
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
              {run.trigger_type === "cron" ? "Auto" : "Manual"}
            </Badge>
            <Badge variant={statusVariant(run.status)} className="text-[10px] px-1.5 py-0">
              {capitalizeStatus(run.status)}
            </Badge>
          </div>

          <p className="text-xs text-muted-foreground">
            {run.listings_found} listings found, {applied} applied
          </p>

          {thumbs.length > 0 && (
            <div className="flex gap-1.5 overflow-hidden pt-1">
              {thumbs.map((l) => {
                const src = listingImageUrl(l.imageUrl ?? "", 120, 80);
                return src ? (
                  <img
                    key={l.id}
                    src={src}
                    alt={l.address}
                    className="h-10 w-16 rounded object-cover shrink-0"
                  />
                ) : null;
              })}
            </div>
          )}

          {run.error_message && (
            <p className="text-xs text-destructive">{run.error_message}</p>
          )}
        </div>
      </div>
    </Link>
  );
}

export function RunList({ runs }: { runs: AutomationRun[] }) {
  if (runs.length === 0) return null;

  const [latest, ...rest] = runs;

  return (
    <div className="space-y-6">
      <LatestRunCard run={latest} />

      {rest.length > 0 && (
        <div className="pl-1">
          {rest.map((run) => (
            <TimelineItem key={run.id} run={run} />
          ))}
        </div>
      )}
    </div>
  );
}
