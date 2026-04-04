import { NextResponse } from "next/server";
import { withAuth } from "@/lib/supabase/with-auth";
import { logApiError } from "@/lib/api-logger";

export const POST = withAuth(async ({ supabase, user }) => {
  const { data: { session } } = await supabase.auth.getSession();

  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/run-automation`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session?.access_token}`,
          "apikey": process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        },
        body: JSON.stringify({ trigger_type: "manual" }),
      }
    );

    const data = await res.json();
    if (!res.ok) {
      console.error(`[trigger-run] user=${user.id} edge-function returned ${res.status}: ${JSON.stringify(data)}`);
      return NextResponse.json(data, { status: res.status });
    }
    return NextResponse.json(data);
  } catch (err) {
    logApiError("trigger-run", user.id, err);
    return NextResponse.json({ error: "Failed to trigger run" }, { status: 500 });
  }
});
