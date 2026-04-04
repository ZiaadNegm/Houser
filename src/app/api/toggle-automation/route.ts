import { NextResponse } from "next/server";
import { withAuth } from "@/lib/supabase/with-auth";
import { logApiError } from "@/lib/api-logger";

export const POST = withAuth(async ({ supabase, user }, req) => {
  const body = await req.json();
  if (typeof body.enabled !== "boolean") {
    return NextResponse.json({ error: "Invalid body: enabled must be a boolean" }, { status: 400 });
  }

  const { error } = await supabase
    .from("profiles")
    .update({ automation_enabled: body.enabled })
    .eq("id", user.id);

  if (error) {
    logApiError("toggle-automation", user.id, error);
    return NextResponse.json({ error: "Failed to update automation setting" }, { status: 500 });
  }

  return NextResponse.json({ automation_enabled: body.enabled });
});
