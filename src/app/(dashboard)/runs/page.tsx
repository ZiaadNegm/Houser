import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getRecentRuns } from "@/lib/repositories/runs";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatRunDate, formatDuration } from "@/lib/utils";
import { statusVariant } from "@/lib/domain/types";

export default async function RunsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let runs: Awaited<ReturnType<typeof getRecentRuns>> = [];
  if (user) {
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
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Time</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Trigger</TableHead>
              <TableHead>Listings Found</TableHead>
              <TableHead>Actions Taken</TableHead>
              <TableHead>Duration</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {runs.map((run) => {
              const { day, date, time } = formatRunDate(run.started_at);
              return (
                <TableRow key={run.id} className="cursor-pointer">
                  <TableCell className="text-sm">
                    <Link href={`/runs/${run.id}`} className="hover:underline">
                      {day} {date}, {time}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(run.status)}>{run.status}</Badge>
                  </TableCell>
                  <TableCell className="text-sm">{run.trigger_type === "cron" ? "Auto" : "Manual"}</TableCell>
                  <TableCell className="text-sm">{run.listings_found}</TableCell>
                  <TableCell className="text-sm">{run.actions_taken}</TableCell>
                  <TableCell className="text-sm">
                    {formatDuration(run.started_at, run.completed_at)}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
