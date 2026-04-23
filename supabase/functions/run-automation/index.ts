import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { login } from "../_shared/woningnet/auth.ts";
import { fetchListings } from "../_shared/woningnet/listings.ts";
import { applyToListing, revokeApplication } from "../_shared/woningnet/actions.ts";
import { scoreListings } from "../_shared/scoring.ts";
import { filterBlacklisted, type BlacklistConfig } from "../_shared/blacklist_filter.ts";
import { computeActionPlan, MAX_SLOTS } from "../_shared/decision.ts";
import { DEFAULT_PREFERENCES } from "../_shared/domain_types.ts";
import type { UserPreferences, ScoredListing } from "../_shared/domain_types.ts";
import type { WoningNetSession, WoningNetListing } from "../_shared/woningnet/types.ts";
import { decryptCredential, sanitizeError } from "../_shared/crypto/credentials.ts";
import { resolveUserId, checkOverlap } from "./auth_helpers.ts";

// --- Types ---

type StepLog = {
  step: string;
  status: string;
  error?: string;
  ts: string;
  detail?: Record<string, unknown>;
};

interface RunContext {
  supabase: SupabaseClient;
  userId: string;
  runId: string;
  session?: WoningNetSession;
  listings?: WoningNetListing[];
  scored?: ScoredListing[];
  plan?: ReturnType<typeof computeActionPlan>;
  preferences: UserPreferences;
  blacklist: BlacklistConfig;
  dryRun: boolean;
  actionsCount: number;
  actionRecords: ActionRecord[];
  steps: StepLog[];
  secrets: string[];
}

interface ActionRecord {
  listing_id: string;
  address: string;
  action: string;
  status: string;
  error?: string;
}

// --- Helpers ---

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

// --- Pipeline steps ---

async function stepLogin(ctx: RunContext): Promise<RunContext> {
  // Fetch and decrypt user's WoningNet credentials from DB
  const { data: creds, error: credsError } = await ctx.supabase
    .from("user_credentials")
    .select("encrypted_credentials")
    .eq("user_id", ctx.userId)
    .eq("provider", "woningnet")
    .single();

  if (credsError || !creds) {
    throw new Error("WoningNet credentials not configured");
  }

  let email: string;
  let password: string;
  try {
    const decrypted = JSON.parse(await decryptCredential(creds.encrypted_credentials));
    email = decrypted.email;
    password = decrypted.password;
  } catch (err) {
    if (err instanceof Error && err.message.includes("decryption failed")) {
      throw err;
    }
    throw new Error("Credential decryption failed — encryption key may have been rotated");
  }

  const session = await login(email, password);
  return { ...ctx, session, secrets: [...ctx.secrets, email, password] };
}

type FetchMeta = {
  rawCount: number;
  skippedNonDwellingCount: number;
  skippedUnitTypeBreakdown: Record<string, number>;
};

async function stepFetchListings(ctx: RunContext): Promise<RunContext> {
  const { result, session } = await fetchListings(ctx.session!);
  const meta: FetchMeta = {
    rawCount: result.rawCount,
    skippedNonDwellingCount: result.skippedNonDwellingCount,
    skippedUnitTypeBreakdown: result.skippedUnitTypeBreakdown,
  };
  return { ...ctx, session, listings: result.listings, _fetchMeta: meta } as RunContext & { _fetchMeta: FetchMeta };
}

async function stepLoadSettings(ctx: RunContext): Promise<RunContext> {
  const { data } = await ctx.supabase
    .from("app_settings")
    .select("key, value")
    .eq("user_id", ctx.userId)
    .in("key", ["preferences", "dry_run"]);

  const rows = data ?? [];
  const prefsRow = rows.find((r: { key: string }) => r.key === "preferences");
  const dryRunRow = rows.find((r: { key: string }) => r.key === "dry_run");

  const preferences: UserPreferences = prefsRow?.value
    ? { ...DEFAULT_PREFERENCES, ...(prefsRow.value as Partial<UserPreferences>) }
    : { ...DEFAULT_PREFERENCES };

  const dryRun: boolean = dryRunRow?.value === false ? false : true; // default ON

  // Load blacklist from dedicated table — failure aborts the run (safety guardrail)
  const { data: blEntries, error: blError } = await ctx.supabase
    .from("blacklist_entries")
    .select("type, value")
    .eq("user_id", ctx.userId);

  if (blError) throw new Error("Blacklist fetch failed — aborting run (safety guardrail)");

  const blacklist: BlacklistConfig = {
    ids: (blEntries ?? []).filter((e: { type: string }) => e.type === "id").map((e: { value: string }) => e.value),
    streets: (blEntries ?? []).filter((e: { type: string }) => e.type === "street").map((e: { value: string }) => e.value),
  };

  return { ...ctx, preferences, blacklist, dryRun };
}

async function stepScore(ctx: RunContext): Promise<RunContext> {
  const { filtered, removed } = filterBlacklisted(ctx.listings!, ctx.blacklist);
  const scored = scoreListings(filtered, ctx.preferences);

  if (removed.length > 0) {
    console.log(
      `[pipeline:score] Blacklist filtered ${removed.length} listing(s): ${removed.map((r) => `${r.address} (${r.matchedBy}=${r.matchedValue})`).join(", ")}`,
    );
  }

  return { ...ctx, scored, _blacklistRemoved: removed } as RunContext & { _blacklistRemoved: typeof removed };
}

async function stepDecide(ctx: RunContext): Promise<RunContext> {
  const plan = computeActionPlan(ctx.scored!, MAX_SLOTS);

  console.log(
    `[pipeline:decide] apply=${plan.apply.length} replace=${plan.revokeAndReplace.length} skip=${plan.skip.length}`,
  );

  return { ...ctx, plan };
}

// --- Execute helpers ---

interface ActionState {
  session: WoningNetSession;
  actions: ActionRecord[];
  count: number;
}

async function runAction(
  state: ActionState,
  listing: ScoredListing,
  actionType: string,
  actionFn: (session: WoningNetSession, id: string) => Promise<{ success: boolean; errorMessage: string; session: WoningNetSession }>,
  secrets: string[],
): Promise<{ state: ActionState; success: boolean }> {
  try {
    const result = await actionFn(state.session, listing.id);
    const status = result.success ? "success" : "failed";
    state.actions.push({ listing_id: listing.id, address: listing.address, action: actionType, status, error: result.errorMessage || undefined });
    return { state: { ...state, session: result.session, count: state.count + (result.success ? 1 : 0) }, success: result.success };
  } catch (err) {
    const msg = sanitizeError(err instanceof Error ? err.message : "Unknown error", secrets);
    state.actions.push({ listing_id: listing.id, address: listing.address, action: actionType, status: "failed", error: msg });
    return { state, success: false };
  }
}

function buildDryRunRecords(plan: ReturnType<typeof computeActionPlan>): ActionRecord[] {
  const actions: ActionRecord[] = [];
  for (const l of plan.apply) {
    actions.push({ listing_id: l.id, address: l.address, action: "apply", status: "dry_run" });
  }
  for (const { revoke, applyTo } of plan.revokeAndReplace) {
    actions.push({ listing_id: revoke.id, address: revoke.address, action: "revoke", status: "dry_run" });
    actions.push({ listing_id: applyTo.id, address: applyTo.address, action: "apply", status: "dry_run" });
  }
  return actions;
}

async function stepExecute(ctx: RunContext): Promise<RunContext> {
  const plan = ctx.plan!;

  if (ctx.dryRun) {
    const actions = buildDryRunRecords(plan);
    console.log(`[pipeline:execute] dry run — ${actions.length} actions logged, none executed`);
    return { ...ctx, actionsCount: 0, actionRecords: actions };
  }

  let state: ActionState = { session: ctx.session!, actions: [], count: 0 };

  for (const listing of plan.apply) {
    const result = await runAction(state, listing, "apply", applyToListing, ctx.secrets);
    state = result.state;
  }

  for (const { revoke, applyTo } of plan.revokeAndReplace) {
    const revokeResult = await runAction(state, revoke, "revoke", revokeApplication, ctx.secrets);
    state = revokeResult.state;

    if (!revokeResult.success) {
      state.actions.push({ listing_id: applyTo.id, address: applyTo.address, action: "apply_skipped", status: "skipped", error: "Revoke failed" });
      continue;
    }

    const applyResult = await runAction(state, applyTo, "apply", applyToListing, ctx.secrets);
    state = applyResult.state;
  }

  return { ...ctx, session: state.session, actionsCount: state.count, actionRecords: state.actions };
}

async function stepVerify(ctx: RunContext): Promise<RunContext> {
  if (ctx.dryRun || ctx.actionsCount === 0) {
    // Nothing to verify — use pre-action scored listings
    return ctx;
  }

  try {
    const { result, session } = await fetchListings(ctx.session!);
    // Re-score the verified listings
    const { filtered: verifiedFiltered } = filterBlacklisted(result.listings, ctx.blacklist);
    const verified = scoreListings(verifiedFiltered, ctx.preferences);
    return { ...ctx, session, scored: verified, listings: result.listings };
  } catch (err) {
    console.warn(`[pipeline:verify] re-fetch failed, using pre-action data: ${err}`);
    return ctx;
  }
}

// --- Pipeline runner ---

interface PipelineStep {
  name: string;
  fn: (ctx: RunContext) => Promise<RunContext>;
  /** Extra detail to extract from context after step completes */
  detail?: (ctx: RunContext) => Record<string, unknown>;
}

const pipeline: PipelineStep[] = [
  {
    name: "login",
    fn: stepLogin,
  },
  {
    name: "fetch_listings",
    fn: stepFetchListings,
    detail: (ctx) => {
      const meta = (ctx as RunContext & { _fetchMeta?: FetchMeta })._fetchMeta;
      return {
        listings_fetched: ctx.listings?.length ?? 0,
        raw_count: meta?.rawCount ?? 0,
        skipped_non_dwelling_count: meta?.skippedNonDwellingCount ?? 0,
        skipped_unit_type_breakdown: meta?.skippedUnitTypeBreakdown ?? {},
      };
    },
  },
  {
    name: "load_settings",
    fn: stepLoadSettings,
    detail: (ctx) => ({ dry_run: ctx.dryRun }),
  },
  {
    name: "score_listings",
    fn: stepScore,
    detail: (ctx) => ({
      listings_scored: (ctx.scored ?? []).slice(0, 5).map((s) => ({
        id: s.id, address: s.address, score: s.score,
        reason: s.matchReasons.join("; "),
      })),
      blacklist_filtered: (ctx as RunContext & { _blacklistRemoved?: unknown[] })._blacklistRemoved ?? [],
    }),
  },
  {
    name: "decide",
    fn: stepDecide,
    detail: (ctx) => ({
      to_apply: ctx.plan?.apply?.length ?? 0,
      to_replace: ctx.plan?.revokeAndReplace?.length ?? 0,
      dry_run: ctx.dryRun,
    }),
  },
  {
    name: "execute",
    fn: stepExecute,
    detail: (ctx) => ({
      actions: ctx.actionRecords.length > 0 ? ctx.actionRecords : undefined,
    }),
  },
  {
    name: "verify",
    fn: stepVerify,
  },
];

async function runPipeline(ctx: RunContext): Promise<RunContext> {
  let current = ctx;

  for (const step of pipeline) {
    try {
      current = await step.fn(current);
      const detail = step.detail?.(current);
      current.steps.push({
        step: step.name,
        status: "success",
        ts: new Date().toISOString(),
        ...(detail ? { detail } : {}),
      });
    } catch (err) {
      const rawMsg = err instanceof Error ? err.message : "Unknown error";
      const safeMsg = sanitizeError(rawMsg, current.secrets);
      current.steps.push({
        step: step.name,
        status: "failed",
        error: safeMsg,
        ts: new Date().toISOString(),
      });
      throw new PipelineError(safeMsg, step.name);
    }
  }

  return current;
}

class PipelineError extends Error {
  constructor(message: string, public step: string) {
    super(message);
    this.name = "PipelineError";
  }
}

// --- Main handler ---

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

    // Build initial context
    const ctx: RunContext = {
      supabase,
      userId: user_id,
      runId: run.id,
      preferences: { ...DEFAULT_PREFERENCES },
      blacklist: { ids: [], streets: [] },
      dryRun: true, // safe default, overridden by loadSettings
      actionsCount: 0,
      actionRecords: [],
      steps: [],
      secrets: [],
    };

    try {
      const result = await runPipeline(ctx);

      // Persist final results
      const { data: completedRun, error: updateError } = await supabase
        .from("automation_runs")
        .update({
          status: "success",
          completed_at: new Date().toISOString(),
          listings_found: result.listings?.length ?? 0,
          actions_taken: result.actionsCount,
          result_data: result.scored ?? result.listings,
          step_log: result.steps,
        })
        .eq("id", run.id)
        .select()
        .single();

      if (updateError) throw updateError;
      return jsonResponse(completedRun);
    } catch (error) {
      const rawMessage = error instanceof Error ? error.message : "Unknown error";
      const safeMessage = sanitizeError(rawMessage, ctx.secrets);

      await supabase
        .from("automation_runs")
        .update({
          status: "failed",
          error_message: safeMessage,
          step_log: ctx.steps,
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
