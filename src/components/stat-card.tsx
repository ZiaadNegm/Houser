import { Card, CardContent } from "@/components/ui/card";

export function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <Card size="sm">
      <CardContent className="flex flex-col items-center justify-center py-2">
        <span className="text-3xl font-bold">{value}</span>
        <span className="text-xs text-muted-foreground">{label}</span>
      </CardContent>
    </Card>
  );
}
