import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPreferences, savePreferences } from "@/lib/repositories/settings";
import type { UserPreferences } from "@/lib/domain/types";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const preferences = await getPreferences(supabase, user.id);
  return NextResponse.json(preferences);
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const raw = await req.json();

  // Sanitize: only keep known fields with correct types
  const body: UserPreferences = {
    maxRent: typeof raw.maxRent === "number" ? raw.maxRent : null,
    minRooms: typeof raw.minRooms === "number" ? raw.minRooms : null,
    maxPosition: typeof raw.maxPosition === "number" ? raw.maxPosition : null,
    preferredContractType: typeof raw.preferredContractType === "string" ? raw.preferredContractType : null,
    preferredNeighborhoods: Array.isArray(raw.preferredNeighborhoods)
      ? raw.preferredNeighborhoods.filter((v: unknown) => typeof v === "string")
      : [],
    preferredPropertyTypes: Array.isArray(raw.preferredPropertyTypes)
      ? raw.preferredPropertyTypes.filter((v: unknown) => typeof v === "string")
      : [],
  };

  try {
    await savePreferences(supabase, user.id, body);
    return NextResponse.json(body);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
