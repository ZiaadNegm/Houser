import { redirect } from "next/navigation";
import { getUser } from "@/lib/supabase/server";
import { AppSidebar } from "@/components/app-sidebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="flex h-screen">
      <AppSidebar userEmail={user.email ?? ""} />
      <main className="flex-1 overflow-auto p-6">{children}</main>
    </div>
  );
}
