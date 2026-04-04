import { NextResponse } from "next/server";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createClient } from "./server";
import { logApiError } from "@/lib/api-logger";

type AuthContext = { supabase: SupabaseClient; user: User };

/**
 * Wraps an API route handler with auth. Returns 401 if unauthenticated.
 * Also catches unhandled errors so they always get logged.
 */
export function withAuth(
  handler: (ctx: AuthContext, req: Request) => Promise<NextResponse>
) {
  return async (req: Request) => {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
      return await handler({ supabase, user }, req);
    } catch (err) {
      logApiError("api/unhandled", user.id, err);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
  };
}
