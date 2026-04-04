import { NextResponse } from "next/server";
import { withAuth } from "@/lib/supabase/with-auth";
import { logApiError } from "@/lib/api-logger";
import { storeWoningNetCredentials } from "@/lib/repositories/credentials";

export const POST = withAuth(async ({ supabase, user }, request) => {
  const body = await request.json();
  const { email, password } = body;

  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
  }

  if (typeof email !== "string" || !/^[^@]+@[^@]+\.[^@]+$/.test(email)) {
    return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
  }

  try {
    await storeWoningNetCredentials(supabase, user.id, email, password);
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = logApiError("credentials", user.id, err);
    const isMissingKey = message.includes("CREDENTIAL_ENCRYPTION_KEY");
    return NextResponse.json(
      { error: isMissingKey ? "Server encryption not configured" : "Failed to store credentials" },
      { status: 500 },
    );
  }
});
