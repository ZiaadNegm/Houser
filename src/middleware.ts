import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

// Public paths (login, register) also defined in lib/supabase/middleware.ts PUBLIC_PATHS — keep in sync.
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|login|register|api).*)"],
};
