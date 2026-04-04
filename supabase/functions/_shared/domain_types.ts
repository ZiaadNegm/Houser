// SYNC: keep in sync with src/lib/domain/types.ts
// These types are mirrored here because Deno edge functions can't import from src/.

import type { WoningNetListing } from "./woningnet/types.ts";

export interface UserPreferences {
  maxRent: number | null;
  minRooms: number | null;
  preferredNeighborhoods: string[];
  preferredContractType: string | null;
  preferredPropertyTypes: string[];
  maxPosition: number | null;
}

export const DEFAULT_PREFERENCES: UserPreferences = {
  maxRent: null,
  minRooms: null,
  preferredNeighborhoods: [],
  preferredContractType: null,
  preferredPropertyTypes: [],
  maxPosition: null,
};

export interface ScoredListing extends WoningNetListing {
  score: number;
  matchReasons: string[];
}
