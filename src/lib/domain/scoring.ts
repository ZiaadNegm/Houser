import type { WoningNetListing, UserPreferences, ScoredListing } from "./types";

// --- Helpers ---

export function parseRentToNumber(rentNet: string): number | null {
  // Handles Dutch formats: "€ 1.250,00", "€ 850,00", "€850", "850"
  // Dots are thousands separators, comma is decimal separator
  const cleaned = rentNet.replace(/[€\s]/g, "").replace(/\./g, "").replace(",", ".");
  const num = parseFloat(cleaned);
  return Number.isFinite(num) ? num : null;
}

// --- Scoring rules engine ---

interface ScoringRule {
  name: string;
  weight: number;
  score: (listing: WoningNetListing, prefs: UserPreferences) => {
    points: number; // 0-100
    reason: string | null;
  };
}

const rules: ScoringRule[] = [
  {
    name: "position",
    weight: 1.0,
    score: (listing) => {
      // Lower position = better. Position 1 → 100, position 100+ → ~0
      const points = Math.max(0, 100 - (listing.position - 1));
      return {
        points,
        reason: points > 0 ? `Position ${listing.position}` : null,
      };
    },
  },
  {
    name: "rent",
    weight: 0.3,
    score: (listing, prefs) => {
      if (prefs.maxRent == null) return { points: 50, reason: null };
      const rent = parseRentToNumber(listing.rentNet);
      if (rent == null) return { points: 50, reason: null };
      if (rent <= prefs.maxRent) {
        return { points: 100, reason: `Rent ${listing.rentNet} within budget` };
      }
      return { points: 0, reason: `Rent ${listing.rentNet} over budget` };
    },
  },
  {
    name: "rooms",
    weight: 0.3,
    score: (listing, prefs) => {
      if (prefs.minRooms == null) return { points: 50, reason: null };
      if (listing.rooms >= prefs.minRooms) {
        return { points: 100, reason: `${listing.rooms} rooms (min ${prefs.minRooms})` };
      }
      return { points: 0, reason: `Only ${listing.rooms} rooms (need ${prefs.minRooms})` };
    },
  },
  {
    name: "neighborhood",
    weight: 0.2,
    score: (listing, prefs) => {
      if (prefs.preferredNeighborhoods.length === 0) return { points: 50, reason: null };
      const match = prefs.preferredNeighborhoods.some(
        (n) => n.toLowerCase() === listing.neighborhood.toLowerCase()
      );
      if (match) {
        return { points: 100, reason: `Preferred neighborhood: ${listing.neighborhood}` };
      }
      return { points: 0, reason: null };
    },
  },
  {
    name: "contractType",
    weight: 0.2,
    score: (listing, prefs) => {
      if (prefs.preferredContractType == null) return { points: 50, reason: null };
      if (listing.contractType.toLowerCase() === prefs.preferredContractType.toLowerCase()) {
        return { points: 100, reason: `Preferred contract: ${listing.contractType}` };
      }
      return { points: 0, reason: null };
    },
  },
  {
    name: "propertyType",
    weight: 0.2,
    score: (listing, prefs) => {
      if (!prefs.preferredPropertyTypes || prefs.preferredPropertyTypes.length === 0) {
        return { points: 50, reason: null };
      }
      const match = prefs.preferredPropertyTypes.some(
        (t) => t.toLowerCase() === listing.propertyType.toLowerCase()
      );
      if (match) {
        return { points: 100, reason: `Preferred type: ${listing.propertyType}` };
      }
      return { points: 0, reason: null };
    },
  },
  {
    name: "maxPosition",
    weight: 0.3,
    score: (listing, prefs) => {
      if (prefs.maxPosition == null) return { points: 50, reason: null };
      if (listing.position <= prefs.maxPosition) {
        return { points: 100, reason: `Position ${listing.position} within limit (max ${prefs.maxPosition})` };
      }
      return { points: 0, reason: `Position ${listing.position} exceeds limit (max ${prefs.maxPosition})` };
    },
  },
];

// --- Public API ---

export function filterBlacklisted(
  listings: WoningNetListing[],
  blacklistIds: string[]
): WoningNetListing[] {
  if (blacklistIds.length === 0) return listings;
  const set = new Set(blacklistIds);
  return listings.filter((l) => !set.has(l.id));
}

export function scoreListings(
  listings: WoningNetListing[],
  preferences: UserPreferences
): ScoredListing[] {
  const totalWeight = rules.reduce((sum, r) => sum + r.weight, 0);

  return listings
    .map((listing) => {
      let weightedSum = 0;
      const matchReasons: string[] = [];

      for (const rule of rules) {
        const { points, reason } = rule.score(listing, preferences);
        weightedSum += points * rule.weight;
        if (reason) matchReasons.push(reason);
      }

      const score = Math.round(weightedSum / totalWeight);
      return { ...listing, score, matchReasons };
    })
    .sort((a, b) => b.score - a.score);
}

export function scoreAndRank(
  listings: WoningNetListing[],
  preferences: UserPreferences,
  blacklist: string[]
): ScoredListing[] {
  const filtered = filterBlacklisted(listings, blacklist);
  return scoreListings(filtered, preferences);
}
