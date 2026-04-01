import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { user_id, trigger_type = "manual" } = await req.json();

    if (!user_id) {
      return new Response(
        JSON.stringify({ error: "user_id is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

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

    // Phase B: WoningNet fetch, score, decide, act
    // For now, mark as success immediately

    const { data: completedRun, error: updateError } = await supabase
      .from("automation_runs")
      .update({
        status: "success",
        completed_at: new Date().toISOString(),
        listings_found: 0,
        actions_taken: 0,
      })
      .eq("id", run.id)
      .select()
      .single();

    if (updateError) throw updateError;

    return new Response(JSON.stringify(completedRun), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
