"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "Dashboard" },
  { href: "/runs", label: "Runs" },
];

export function AppSidebar({ userEmail }: { userEmail: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="flex w-56 flex-col border-r bg-sidebar text-sidebar-foreground">
      <div className="p-4">
        <h2 className="text-lg font-semibold">WoningNet DAK</h2>
      </div>
      <Separator />
      <nav className="flex-1 p-2">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "block rounded-md px-3 py-2 text-sm transition-colors",
              pathname === item.href
                ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                : "hover:bg-sidebar-accent/50"
            )}
          >
            {item.label}
          </Link>
        ))}
      </nav>
      <Separator />
      <div className="p-4 space-y-2">
        <p className="text-xs text-muted-foreground truncate">{userEmail}</p>
        <Button variant="outline" size="sm" className="w-full" onClick={handleSignOut}>
          Sign out
        </Button>
      </div>
    </aside>
  );
}
