import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { login } from "../_shared/woningnet/auth.ts";
import { fetchListings } from "../_shared/woningnet/listings.ts";

type StepLog = { step: string; status: string; error?: string; ts: string };

function sanitizeError(message: string, secrets: string[]): string {
  let safe = message;
  for (const secret of secrets) {
    if (secret) safe = safe.replaceAll(secret, "[REDACTED]");
  }
  return safe;
}

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ error: "Missing authorization" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

    const token = authHeader.replace("Bearer ", "");
    const { trigger_type = "manual", user_id: bodyUserId } = await req.json();

    // Dual auth: service-role calls pass user_id in body; user calls derive it from JWT
    let user_id: string;
    if (token === serviceRoleKey) {
      if (!bodyUserId) return jsonResponse({ error: "user_id required for service calls" }, 400);
      user_id = bodyUserId;
    } else {
      const authClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: `Bearer ${token}` } },
      });
      const { data: { user }, error: authError } = await authClient.auth.getUser(token);
      if (authError || !user?.id) return jsonResponse({ error: "Invalid or expired token" }, 401);
      user_id = user.id;
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Overlap check — reject if a recent run is still active
    const { data: activeRun } = await supabase
      .from("automation_runs")
      .select("id")
      .eq("user_id", user_id)
      .in("status", ["queued", "running"])
      .filter("started_at", "gt", new Date(Date.now() - 60000).toISOString())
      .limit(1)
      .maybeSingle();

    if (activeRun) return jsonResponse({ error: "Run already in progress", run_id: activeRun.id }, 409);

    // Create run record
    const { data: run, error: insertError } = await supabase
      .from("automation_runs")
      .insert({
        user_id,
        status: "running",
        trigger_type,
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError) throw insertError;

    const steps: StepLog[] = [];
    const email = Deno.env.get("WONINGNET_EMAIL");
    const password = Deno.env.get("WONINGNET_PASSWORD");

    if (!email || !password) {
      const msg = "WoningNet credentials not configured";
      steps.push({ step: "credentials_check", status: "failed", error: msg, ts: new Date().toISOString() });
      await supabase
        .from("automation_runs")
        .update({
          status: "failed",
          error_message: msg,
          step_log: steps,
          completed_at: new Date().toISOString(),
        })
        .eq("id", run.id);

      return jsonResponse({ error: msg }, 500);
    }

    const secrets = [email, password];
    let currentStep = "login";

    try {
      const session = await login(email, password);
      steps.push({ step: "login", status: "success", ts: new Date().toISOString() });

      currentStep = "fetch_listings";
      const { result } = await fetchListings(session);
      steps.push({ step: "fetch_listings", status: "success", ts: new Date().toISOString() });

      // Success — persist results
      const { data: completedRun, error: updateError } = await supabase
        .from("automation_runs")
        .update({
          status: "success",
          completed_at: new Date().toISOString(),
          listings_found: result.rawCount,
          actions_taken: 0,
          result_data: result.listings,
          step_log: steps,
        })
        .eq("id", run.id)
        .select()
        .single();

      if (updateError) throw updateError;

      return jsonResponse(completedRun);
    } catch (error) {
      const rawMessage = error instanceof Error ? error.message : "Unknown error";
      const safeMessage = sanitizeError(rawMessage, secrets);
      steps.push({ step: currentStep, status: "failed", error: safeMessage, ts: new Date().toISOString() });

      await supabase
        .from("automation_runs")
        .update({
          status: "failed",
          error_message: safeMessage,
          step_log: steps,
          completed_at: new Date().toISOString(),
        })
        .eq("id", run.id);

      return jsonResponse({ error: safeMessage }, 500);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return jsonResponse({ error: message }, 500);
  }
});
