import { NextResponse } from "next/server";
import { withAuth } from "@/lib/supabase/with-auth";
import { storeWoningNetCredentials } from "@/lib/repositories/credentials";

export const POST = withAuth(async ({ supabase, user }, request) => {
  const body = await request.json();
  const { email, password } = body;

  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
  }

  try {
    await storeWoningNetCredentials(supabase, user.id, email, password);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Credential storage failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Failed to store credentials" }, { status: 500 });
  }
});
