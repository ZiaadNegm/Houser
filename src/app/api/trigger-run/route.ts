import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createRun, completeRun } from "@/lib/repositories/runs";

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Create a run record
    const run = await createRun(supabase, user.id, "manual");

    // Phase B: this is where the Edge Function would be called
    // For now, simulate a successful run immediately
    const completedRun = await completeRun(supabase, run.id, "success", {
      listings_found: 0,
      actions_taken: 0,
    });

    return NextResponse.json(completedRun);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
