import { NextResponse } from "next/server";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createClient } from "./server";

type AuthContext = { supabase: SupabaseClient; user: User };

/**
 * Wraps an API route handler with auth. Returns 401 if unauthenticated.
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

    return handler({ supabase, user }, req);
  };
}
