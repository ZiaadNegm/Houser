import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";

export function CredentialsBanner() {
  return (
    <Card className="border-yellow-500/50 bg-yellow-500/5">
      <CardContent className="py-3 text-sm">
        WoningNet credentials not configured. Automation runs will fail until you{" "}
        <Link href="/settings" className="font-medium underline underline-offset-2 hover:text-foreground">
          enter your login details in Settings
        </Link>
        .
      </CardContent>
    </Card>
  );
}
