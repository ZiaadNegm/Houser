import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { encryptCredential } from "@/lib/crypto/credentials";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { email, password } = body;

  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
  }

  try {
    const encrypted = await encryptCredential(JSON.stringify({ email, password }));

    const { error } = await supabase
      .from("user_credentials")
      .upsert(
        {
          user_id: user.id,
          provider: "woningnet",
          encrypted_credentials: encrypted,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,provider" },
      );

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Credential storage failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Failed to store credentials" }, { status: 500 });
  }
}
