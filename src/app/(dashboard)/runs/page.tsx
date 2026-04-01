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

function formatDuration(startedAt: string, completedAt: string | null): string {
  if (!completedAt) return "—";
  const ms = new Date(completedAt).getTime() - new Date(startedAt).getTime();
  const seconds = Math.round(ms / 1000);
  return `${seconds}s`;
}

function statusVariant(status: string) {
  switch (status) {
    case "success":
      return "default" as const;
    case "failed":
      return "destructive" as const;
    default:
      return "secondary" as const;
  }
}

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
            {runs.map((run) => (
              <TableRow key={run.id}>
                <TableCell className="text-sm">
                  {new Date(run.started_at).toLocaleString()}
                </TableCell>
                <TableCell>
                  <Badge variant={statusVariant(run.status)}>{run.status}</Badge>
                </TableCell>
                <TableCell className="text-sm">{run.trigger_type}</TableCell>
                <TableCell className="text-sm">{run.listings_found}</TableCell>
                <TableCell className="text-sm">{run.actions_taken}</TableCell>
                <TableCell className="text-sm">
                  {formatDuration(run.started_at, run.completed_at)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
