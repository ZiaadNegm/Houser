import { NextResponse } from "next/server";
import { withAuth } from "@/lib/supabase/with-auth";
import { getPreferences, savePreferences } from "@/lib/repositories/settings";
import type { UserPreferences } from "@/lib/domain/types";

export const GET = withAuth(async ({ supabase, user }) => {
  const preferences = await getPreferences(supabase, user.id);
  return NextResponse.json(preferences);
});

export const POST = withAuth(async ({ supabase, user }, req) => {
  const raw = await req.json();

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
    const { logApiError } = await import("@/lib/api-logger");
    logApiError("preferences/POST", user.id, err);
    return NextResponse.json({ error: "Failed to save preferences" }, { status: 500 });
  }
});
