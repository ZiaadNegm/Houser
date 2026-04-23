/**
 * Smoke test: hits real WoningNet API, runs fetchListings end-to-end, and prints
 * the raw vs kept counts plus the EenheidSoort distribution of anything that was
 * skipped. Used to verify the non-dwelling filter in parseListings() against the
 * live feed without having to kick off a full edge-function run.
 *
 * Run:
 *   deno run --allow-net --allow-read --allow-env \
 *     supabase/functions/_shared/woningnet/listings_smoke_test.ts
 *
 * Reads credentials from .env.local at project root.
 */

import { load } from "https://deno.land/std@0.224.0/dotenv/mod.ts";
import { login } from "./auth.ts";
import { fetchListings } from "./listings.ts";

await load({ envPath: ".env.local", export: true });

const email = Deno.env.get("WONINGNET_EMAIL");
const password = Deno.env.get("WONINGNET_PASSWORD");

if (!email || !password) {
  console.error("Missing WONINGNET_EMAIL or WONINGNET_PASSWORD in .env.local");
  Deno.exit(1);
}

console.log(`Logging in as ${email}...`);
const session = await login(email, password);
console.log("Login OK.\n");

const { result } = await fetchListings(session);

console.log(`raw=${result.rawCount}  kept=${result.listings.length}  skipped=${result.skippedNonDwellingCount}`);
console.log(`skipped breakdown: ${JSON.stringify(result.skippedUnitTypeBreakdown)}`);

// Sanity: kept count + skipped count should equal the raw count.
if (result.listings.length + result.skippedNonDwellingCount !== result.rawCount) {
  console.error(
    `FAIL: kept (${result.listings.length}) + skipped (${result.skippedNonDwellingCount}) != raw (${result.rawCount})`,
  );
  Deno.exit(1);
}
console.log("OK: kept + skipped == raw.");
