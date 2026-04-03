import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

type AuthSuccess = { user_id: string };
type AuthError = { error: string; status: number };
type AuthResult = AuthSuccess | AuthError;

interface ResolveUserIdParams {
  token: string;
  serviceRoleKey: string;
  bodyUserId?: string;
  supabaseUrl: string;
  anonKey: string;
}

/**
 * Resolves user_id from either a service-role token (cron) or a user JWT (manual).
 * Returns { user_id } on success or { error, status } on failure.
 */
export async function resolveUserId(params: ResolveUserIdParams): Promise<AuthResult> {
  const { token, serviceRoleKey, bodyUserId, supabaseUrl, anonKey } = params;

  if (token === serviceRoleKey) {
    if (!bodyUserId) return { error: "user_id required for service calls", status: 400 };
    return { user_id: bodyUserId };
  }

  const authClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user }, error: authError } = await authClient.auth.getUser(token);
  if (authError || !user?.id) return { error: "Invalid or expired token", status: 401 };
  return { user_id: user.id };
}

/**
 * Checks for an active (queued/running) run started within the last 60 seconds.
 * Returns the active run row if found, null otherwise.
 */
export async function checkOverlap(
  supabase: SupabaseClient,
  user_id: string,
): Promise<{ id: string } | null> {
  const { data } = await supabase
    .from("automation_runs")
    .select("id")
    .eq("user_id", user_id)
    .in("status", ["queued", "running"])
    .filter("started_at", "gt", new Date(Date.now() - 60000).toISOString())
    .limit(1)
    .maybeSingle();

  return data;
}
