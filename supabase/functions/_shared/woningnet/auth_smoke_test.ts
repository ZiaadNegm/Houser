/**
 * Smoke test: hits real WoningNet API to validate the full auth flow.
 *
 * Run:
 *   deno run --allow-net --allow-read --allow-env supabase/functions/_shared/woningnet/auth_smoke_test.ts
 *
 * Reads credentials from .env.local at project root.
 */

import { load } from "https://deno.land/std@0.224.0/dotenv/mod.ts";
import { login } from "./auth.ts";

// Load .env.local from project root
await load({ envPath: ".env.local", export: true });

const email = Deno.env.get("WONINGNET_EMAIL");
const password = Deno.env.get("WONINGNET_PASSWORD");

if (!email || !password) {
  console.error("Missing WONINGNET_EMAIL or WONINGNET_PASSWORD in .env.local");
  Deno.exit(1);
}

console.log(`\nAttempting login for ${email}...\n`);

try {
  const session = await login(email, password);
  console.log("--- Login successful ---");
  console.log(`  nr1Cookie:     ${session.nr1Cookie.slice(0, 30)}...`);
  console.log(`  nr2Cookie:     ${session.nr2Cookie.slice(0, 30)}...`);
  console.log(`  csrfToken:     ${session.csrfToken}`);
  console.log(`  moduleVersion: ${session.moduleVersion}`);
} catch (err) {
  console.error("--- Login failed ---");
  console.error(err instanceof Error ? err.message : err);
  Deno.exit(1);
}
