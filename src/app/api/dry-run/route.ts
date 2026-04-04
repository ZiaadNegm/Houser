import { NextResponse } from "next/server";
import { withAuth } from "@/lib/supabase/with-auth";

export const GET = withAuth(async ({ supabase, user }) => {
  const { data } = await supabase
    .from("app_settings")
    .select("value")
    .eq("user_id", user.id)
    .eq("key", "dry_run")
    .single();

  const enabled = data?.value === false ? false : true;
  return NextResponse.json({ enabled });
});

export const POST = withAuth(async ({ supabase, user }, req) => {
  const body = await req.json();
  if (typeof body.enabled !== "boolean") {
    return NextResponse.json({ error: "Invalid body: enabled must be a boolean" }, { status: 400 });
  }

  const { error } = await supabase
    .from("app_settings")
    .upsert(
      {
        user_id: user.id,
        key: "dry_run",
        value: body.enabled,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,key" },
    );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ enabled: body.enabled });
});
