// SYNC: keep in sync with supabase/functions/_shared/blacklist_filter.ts

import type { WoningNetListing } from "./types";

export interface BlacklistConfig {
  ids: string[];
  streets: string[];
}

export interface BlacklistRemoval {
  listingId: string;
  address: string;
  matchedBy: "id" | "street";
  matchedValue: string;
}

export function filterBlacklisted(
  listings: WoningNetListing[],
  blacklist: BlacklistConfig
): { filtered: WoningNetListing[]; removed: BlacklistRemoval[] } {
  if (blacklist.ids.length === 0 && blacklist.streets.length === 0) {
    return { filtered: listings, removed: [] };
  }

  const idSet = new Set(blacklist.ids);
  const streetPatterns = blacklist.streets.map((s) => s.toLowerCase());
  const filtered: WoningNetListing[] = [];
  const removed: BlacklistRemoval[] = [];

  for (const l of listings) {
    if (idSet.has(l.id)) {
      removed.push({ listingId: l.id, address: l.address, matchedBy: "id", matchedValue: l.id });
    } else {
      const addrLower = l.address.toLowerCase();
      const streetMatch = streetPatterns.find((s) => addrLower.includes(s));
      if (streetMatch) {
        removed.push({ listingId: l.id, address: l.address, matchedBy: "street", matchedValue: streetMatch });
      } else {
        filtered.push(l);
      }
    }
  }

  return { filtered, removed };
}
