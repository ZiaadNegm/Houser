import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getBlacklist, addToBlacklist, removeFromBlacklist } from "@/lib/repositories/blacklist";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const blacklist = await getBlacklist(supabase, user.id);
  return NextResponse.json(blacklist);
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
}

export async function DELETE(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
}
