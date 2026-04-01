import { createClient } from "@/lib/supabase/server";
import { getRecentRuns } from "@/lib/repositories/runs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TriggerRunButton } from "@/components/trigger-run-button";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let runs: Awaited<ReturnType<typeof getRecentRuns>> = [];
  if (user) {
    try {
      runs = await getRecentRuns(supabase, user.id, 5);
    } catch {
      // Table may not exist yet during initial setup
    }
  }

  const totalRuns = runs.length;
  const lastRun = runs[0];
  const successCount = runs.filter((r) => r.status === "success").length;
  const failedCount = runs.filter((r) => r.status === "failed").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <TriggerRunButton />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Recent Runs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{totalRuns}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Last Run
            </CardTitle>
          </CardHeader>
          <CardContent>
            {lastRun ? (
              <Badge variant={lastRun.status === "success" ? "default" : "destructive"}>
                {lastRun.status}
              </Badge>
            ) : (
              <p className="text-sm text-muted-foreground">No runs yet</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Successful
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{successCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Failed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{failedCount}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
