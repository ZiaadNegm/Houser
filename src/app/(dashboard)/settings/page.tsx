import { createClient, getUser } from "@/lib/supabase/server";
import { CredentialsForm } from "@/components/credentials-form";

export default async function SettingsPage() {
  const user = await getUser();
  if (!user) return null;

  const supabase = await createClient();

  const { data: creds } = await supabase
    .from("user_credentials")
    .select("updated_at")
    .eq("user_id", user.id)
    .eq("provider", "woningnet")
    .maybeSingle();

  const credentialStatus = {
    configured: !!creds,
    updatedAt: creds?.updated_at ?? undefined,
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>
      <CredentialsForm initialStatus={credentialStatus} />
    </div>
  );
}
