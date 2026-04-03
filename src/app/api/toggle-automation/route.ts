import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  if (typeof body.enabled !== "boolean") {
    return NextResponse.json({ error: "Invalid body: enabled must be a boolean" }, { status: 400 });
  }

  const { error } = await supabase
    .from("profiles")
    .update({ automation_enabled: body.enabled })
    .eq("id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ automation_enabled: body.enabled });
}
