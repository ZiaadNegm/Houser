import {
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { resolveUserId, checkOverlap } from "./auth_helpers.ts";

// ---------------------------------------------------------------------------
// resolveUserId
// ---------------------------------------------------------------------------

const SERVICE_ROLE_KEY = "test-service-role-key";
const BASE_PARAMS = {
  serviceRoleKey: SERVICE_ROLE_KEY,
  supabaseUrl: "http://localhost:54321",
  anonKey: "test-anon-key",
};

Deno.test("resolveUserId - service role token with user_id returns success", async () => {
  const result = await resolveUserId({
    ...BASE_PARAMS,
    token: SERVICE_ROLE_KEY,
    bodyUserId: "user-123",
  });
  assertEquals(result, { user_id: "user-123" });
});

Deno.test("resolveUserId - service role token without user_id returns 400", async () => {
  const result = await resolveUserId({
    ...BASE_PARAMS,
    token: SERVICE_ROLE_KEY,
    bodyUserId: undefined,
  });
  assertEquals(result, { error: "user_id required for service calls", status: 400 });
});

Deno.test("resolveUserId - service role token with empty string user_id returns 400", async () => {
  const result = await resolveUserId({
    ...BASE_PARAMS,
    token: SERVICE_ROLE_KEY,
    bodyUserId: "",
  });
  assertEquals(result, { error: "user_id required for service calls", status: 400 });
});

// For JWT-based auth we'd need to mock createClient + auth.getUser.
// Since that requires stubbing an ESM import from esm.sh, we test the
// service-role path thoroughly here and rely on integration tests for
// the JWT path (it calls Supabase auth which we can't easily mock in
// Deno without a test server).

// ---------------------------------------------------------------------------
// checkOverlap
// ---------------------------------------------------------------------------

// Minimal chainable mock that simulates the Supabase query builder.
// Each method returns `this` to support chaining, and `maybeSingle`
// resolves with the configured data.
function mockSupabaseClient(returnData: { id: string } | null) {
  const chain = {
    from: () => chain,
    select: () => chain,
    eq: () => chain,
    in: () => chain,
    filter: () => chain,
    limit: () => chain,
    maybeSingle: () => Promise.resolve({ data: returnData, error: null }),
  };
  // deno-lint-ignore no-explicit-any
  return chain as any;
}

Deno.test("checkOverlap - returns null when no active run", async () => {
  const client = mockSupabaseClient(null);
  const result = await checkOverlap(client, "user-123");
  assertEquals(result, null);
});

Deno.test("checkOverlap - returns active run when one exists", async () => {
  const activeRun = { id: "run-456" };
  const client = mockSupabaseClient(activeRun);
  const result = await checkOverlap(client, "user-123");
  assertEquals(result, { id: "run-456" });
});

// ---------------------------------------------------------------------------
// Integration: resolveUserId + checkOverlap together
// ---------------------------------------------------------------------------

Deno.test("full flow - service role auth + no overlap = proceed", async () => {
  const authResult = await resolveUserId({
    ...BASE_PARAMS,
    token: SERVICE_ROLE_KEY,
    bodyUserId: "user-abc",
  });
  assertEquals("user_id" in authResult, true);
  if (!("user_id" in authResult)) return;

  const client = mockSupabaseClient(null);
  const overlap = await checkOverlap(client, authResult.user_id);
  assertEquals(overlap, null);
});

Deno.test("full flow - service role auth + active overlap = blocked", async () => {
  const authResult = await resolveUserId({
    ...BASE_PARAMS,
    token: SERVICE_ROLE_KEY,
    bodyUserId: "user-abc",
  });
  assertEquals("user_id" in authResult, true);
  if (!("user_id" in authResult)) return;

  const client = mockSupabaseClient({ id: "existing-run" });
  const overlap = await checkOverlap(client, authResult.user_id);
  assertEquals(overlap, { id: "existing-run" });
});
