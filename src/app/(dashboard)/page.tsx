import { createClient } from "@/lib/supabase/server";
import { getRecentRuns } from "@/lib/repositories/runs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TriggerRunButton } from "@/components/trigger-run-button";
import { AutomationToggle } from "@/components/automation-toggle";

interface Listing {
  id: string;
  address: string;
  position: number;
  rooms: number;
  rentNet: string;
  deadline: string;
  hasApplied: boolean;
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

  let runs: Awaited<ReturnType<typeof getRecentRuns>> = [];
  if (user) {
    try {
      runs = await getRecentRuns(supabase, user.id, 10);
    } catch {
      // Table may not exist yet during initial setup
    }
  }

  const totalRuns = runs.length;
  const lastRun = runs[0];
  const successCount = runs.filter((r) => r.status === "success").length;
  const failedCount = runs.filter((r) => r.status === "failed").length;

  const latestSuccessful = runs.find((r) => r.status === "success" && r.result_data);
  const listings: Listing[] = latestSuccessful?.result_data
    ? (latestSuccessful.result_data as Listing[]).sort((a, b) => a.position - b.position)
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

      {lastRun?.status === "failed" && lastRun.error_message && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-sm font-medium text-destructive">
              Last run failed: {lastRun.error_message}
            </p>
          </CardContent>
        </Card>
      )}

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
