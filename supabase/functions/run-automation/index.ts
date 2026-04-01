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

Deno.serve(async (req) => {
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

    // Validate the caller's identity via JWT
    const token = authHeader.replace("Bearer ", "");
    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: { user }, error: authError } = await authClient.auth.getUser(token);

    const { trigger_type = "manual" } = await req.json();

    // Use the authenticated user's ID — never trust client-supplied user_id
    const user_id = user?.id;
    if (authError || !user_id) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired token" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

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

      return new Response(
        JSON.stringify({ error: msg }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
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

      return new Response(JSON.stringify(completedRun), {
        headers: { "Content-Type": "application/json" },
      });
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

      return new Response(
        JSON.stringify({ error: safeMessage }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
