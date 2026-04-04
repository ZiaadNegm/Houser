import { NextResponse } from "next/server";
import { withAuth } from "@/lib/supabase/with-auth";
import { logApiError } from "@/lib/api-logger";
import {
  getBlacklistEntries,
  addBlacklistEntry,
  removeBlacklistEntry,
  type BlacklistEntryType,
} from "@/lib/repositories/blacklist";

const VALID_TYPES: BlacklistEntryType[] = ["id", "street"];

export const GET = withAuth(async ({ supabase, user }) => {
  const entries = await getBlacklistEntries(supabase, user.id);
  return NextResponse.json(entries);
});

export const POST = withAuth(async ({ supabase, user }, req) => {
  const raw = await req.json();

  const type = typeof raw.type === "string" ? raw.type.trim() : "";
  if (!VALID_TYPES.includes(type as BlacklistEntryType)) {
    return NextResponse.json(
      { error: "type must be 'id' or 'street'" },
      { status: 400 }
    );
  }

  const value = typeof raw.value === "string" ? raw.value.trim() : "";
  if (!value) {
    return NextResponse.json(
      { error: "value must be a non-empty string" },
      { status: 400 }
    );
  }

  if (type === "street") {
    if (value.length < 3) {
      return NextResponse.json(
        { error: "Street name must be at least 3 characters" },
        { status: 400 }
      );
    }
    if (value.length > 100) {
      return NextResponse.json(
        { error: "Value must be 100 characters or fewer" },
        { status: 400 }
      );
    }
  }

  const label = typeof raw.label === "string" ? raw.label.trim() : "";

  try {
    const entry = await addBlacklistEntry(
      supabase,
      user.id,
      type as BlacklistEntryType,
      value,
      label
    );
    return NextResponse.json(entry);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";

    // Unique constraint violation — entry already exists, return it idempotently
    if (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as { code: string }).code === "23505"
    ) {
      const entries = await getBlacklistEntries(supabase, user.id);
      const existing = entries.find(
        (e) => e.type === type && e.value === value
      );
      if (existing) return NextResponse.json(existing);
    }

    if (message.startsWith("Blacklist limit reached")) {
      return NextResponse.json({ error: message }, { status: 400 });
    }

    logApiError("blacklist/POST", user.id, err);
    return NextResponse.json({ error: "Failed to add blacklist entry" }, { status: 500 });
  }
});

export const DELETE = withAuth(async ({ supabase, user }, req) => {
  const raw = await req.json();
  const entryId = typeof raw.entryId === "string" ? raw.entryId.trim() : "";
  if (!entryId) {
    return NextResponse.json(
      { error: "entryId must be a non-empty string" },
      { status: 400 }
    );
  }

  try {
    await removeBlacklistEntry(supabase, user.id, entryId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    logApiError("blacklist/DELETE", user.id, err);
    return NextResponse.json({ error: "Failed to remove blacklist entry" }, { status: 500 });
  }
});
