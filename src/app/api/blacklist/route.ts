import { NextResponse } from "next/server";
import { withAuth } from "@/lib/supabase/with-auth";
import { getBlacklist, addToBlacklist, removeFromBlacklist } from "@/lib/repositories/blacklist";

export const GET = withAuth(async ({ supabase, user }) => {
  const blacklist = await getBlacklist(supabase, user.id);
  return NextResponse.json(blacklist);
});

export const POST = withAuth(async ({ supabase, user }, req) => {
  const raw = await req.json();
  const listingId = typeof raw.listingId === "string" ? raw.listingId.trim() : "";
  if (!listingId) {
    return NextResponse.json({ error: "listingId must be a non-empty string" }, { status: 400 });
  }

  try {
    const updated = await addToBlacklist(supabase, user.id, listingId);
    return NextResponse.json(updated);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
});

export const DELETE = withAuth(async ({ supabase, user }, req) => {
  const raw = await req.json();
  const listingId = typeof raw.listingId === "string" ? raw.listingId.trim() : "";
  if (!listingId) {
    return NextResponse.json({ error: "listingId must be a non-empty string" }, { status: 400 });
  }

  try {
    const updated = await removeFromBlacklist(supabase, user.id, listingId);
    return NextResponse.json(updated);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
});
