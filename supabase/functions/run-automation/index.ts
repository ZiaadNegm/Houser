import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { login } from "../_shared/woningnet/auth.ts";
import { fetchListings } from "../_shared/woningnet/listings.ts";
import { decryptCredential, sanitizeError } from "../_shared/crypto/credentials.ts";
import { resolveUserId, checkOverlap } from "./auth_helpers.ts";

type StepLog = { step: string; status: string; error?: string; ts: string };

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
    const authResult = await resolveUserId({
      token,
      serviceRoleKey,
      bodyUserId,
      supabaseUrl,
      anonKey,
    });
    if ("error" in authResult) return jsonResponse({ error: authResult.error }, authResult.status);
    const user_id = authResult.user_id;

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Overlap check — reject if a recent run is still active
    const overlap = await checkOverlap(supabase, user_id);
    if (overlap) return jsonResponse({ error: "Run already in progress", run_id: overlap.id }, 409);

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

    // Fetch and decrypt user's WoningNet credentials from DB
    const { data: creds, error: credsError } = await supabase
      .from("user_credentials")
      .select("encrypted_credentials")
      .eq("user_id", user_id)
      .eq("provider", "woningnet")
      .single();

    if (credsError || !creds) {
      const msg = "WoningNet credentials not configured";
      steps.push({ step: "credentials_fetch", status: "failed", error: msg, ts: new Date().toISOString() });
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

    let email: string;
    let password: string;
    try {
      const decrypted = JSON.parse(await decryptCredential(creds.encrypted_credentials));
      email = decrypted.email;
      password = decrypted.password;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Credential decryption failed";
      steps.push({ step: "credentials_decrypt", status: "failed", error: msg, ts: new Date().toISOString() });
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

    steps.push({ step: "credentials_fetch", status: "success", ts: new Date().toISOString() });
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
