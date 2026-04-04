import type { SupabaseClient } from "@supabase/supabase-js";
import { encryptCredential } from "@/lib/crypto/credentials";

export async function storeWoningNetCredentials(
  supabase: SupabaseClient,
  userId: string,
  email: string,
  password: string,
): Promise<void> {
  const encrypted = await encryptCredential(
    JSON.stringify({ email, password }),
  );

  const { error } = await supabase
    .from("user_credentials")
    .upsert(
      {
        user_id: userId,
        provider: "woningnet",
        encrypted_credentials: encrypted,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,provider" },
    );

  if (error) throw error;
}
