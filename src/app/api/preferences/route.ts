import { NextResponse } from "next/server";
import { withAuth } from "@/lib/supabase/with-auth";
import { getPreferences, savePreferences } from "@/lib/repositories/settings";
import { logApiError } from "@/lib/api-logger";
import type { UserPreferences } from "@/lib/domain/types";

export const GET = withAuth(async ({ supabase, user }) => {
  const preferences = await getPreferences(supabase, user.id);
  return NextResponse.json(preferences);
});

export const POST = withAuth(async ({ supabase, user }, req) => {
  const raw = await req.json();

  // --- Bounds validation ---
  const errors: string[] = [];
  if (typeof raw.maxRent === "number" && raw.maxRent <= 0) {
    errors.push("maxRent must be positive");
  }
  if (typeof raw.minRooms === "number" && (!Number.isInteger(raw.minRooms) || raw.minRooms <= 0)) {
    errors.push("minRooms must be a positive integer");
  }
  if (typeof raw.maxPosition === "number" && (!Number.isInteger(raw.maxPosition) || raw.maxPosition <= 0)) {
    errors.push("maxPosition must be a positive integer");
  }
  if (Array.isArray(raw.preferredNeighborhoods) && raw.preferredNeighborhoods.length > 50) {
    errors.push("preferredNeighborhoods must have at most 50 items");
  }
  if (Array.isArray(raw.preferredPropertyTypes) && raw.preferredPropertyTypes.length > 20) {
    errors.push("preferredPropertyTypes must have at most 20 items");
  }
  if (errors.length > 0) {
    return NextResponse.json({ error: errors.join("; ") }, { status: 400 });
  }

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
    logApiError("preferences/POST", user.id, err);
    return NextResponse.json({ error: "Failed to save preferences" }, { status: 500 });
  }
});
