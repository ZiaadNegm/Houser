import Link from "next/link";
import { AlertTriangle } from "lucide-react";

export function CredentialsBanner() {
  return (
    <div className="flex items-center gap-2 rounded-md bg-amber-100/60 border border-amber-200 px-3 py-2 text-xs text-amber-800">
      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
      <span>
        WoningNet credentials not configured.{" "}
        <Link href="/settings" className="font-medium underline underline-offset-2 hover:text-amber-950">
          Set up in Settings
        </Link>
      </span>
    </div>
  );
}
