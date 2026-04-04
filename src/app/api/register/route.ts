import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyWoningNetCredentials } from "@/lib/woningnet/auth";
import { storeWoningNetCredentials } from "@/lib/repositories/credentials";

function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function POST(request: Request) {
  const body = await request.json();
  const { email, password, woningnetEmail, woningnetPassword } = body;

  if (!email || !password || !woningnetEmail || !woningnetPassword) {
    return NextResponse.json(
      { error: "All fields are required" },
      { status: 400 },
    );
  }

  // 1. Verify WoningNet credentials
  const verification = await verifyWoningNetCredentials(woningnetEmail, woningnetPassword);
  if (!verification.valid) {
    return NextResponse.json(
      { error: verification.error },
      { status: 400 },
    );
  }

  // 2. Create Supabase user
  const supabase = createServiceClient();
  const { data: userData, error: createError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (createError) {
    if (createError.message.toLowerCase().includes("already")) {
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 409 },
      );
    }
    console.error("User creation failed:", createError.message);
    return NextResponse.json(
      { error: "Failed to create account" },
      { status: 500 },
    );
  }

  // 3. Store WoningNet credentials
  try {
    await storeWoningNetCredentials(supabase, userData.user.id, woningnetEmail, woningnetPassword);
  } catch (err) {
    console.error("Credential storage failed:", err instanceof Error ? err.message : err);
    return NextResponse.json(
      {
        success: true,
        warning: "Account created but credential storage failed. Add your WoningNet credentials in Settings.",
      },
      { status: 200 },
    );
  }

  return NextResponse.json({ success: true });
}
