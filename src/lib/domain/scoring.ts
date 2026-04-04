import type { WoningNetListing, UserPreferences, ScoredListing } from "./types";
import { filterBlacklisted, type BlacklistConfig } from "./blacklist-filter";

export type { BlacklistConfig } from "./blacklist-filter";
export { filterBlacklisted } from "./blacklist-filter";

// --- Helpers ---

export function parseRentToNumber(rentNet: string): number | null {
  const cleaned = rentNet.replace(/[€\s]/g, "").replace(/\./g, "").replace(",", ".");
  const num = parseFloat(cleaned);
  return Number.isFinite(num) ? num : null;
}

// --- Scoring rules engine ---
//
// Rules are declarative configs. Each declares a type and field accessors.
// The evaluator handles the if-null-return-50 / threshold / membership patterns.
//
// To add a rule: append one object to the `rules` array. No custom function needed
// unless the scoring logic doesn't fit the standard types.

interface BaseRule {
  name: string;
  weight: number;
}

interface GradientRule extends BaseRule {
  type: "gradient";
  /** Extract numeric value from listing (lower = better) */
  getValue: (l: WoningNetListing) => number;
  /** Max value that scores 100. Values above score 0. */
  max: number;
  format: (value: number) => string;
}

interface ThresholdMaxRule extends BaseRule {
  type: "threshold_max";
  getValue: (l: WoningNetListing) => number | null;
  getLimit: (p: UserPreferences) => number | null;
  format: (value: number | null, limit: number) => { pass: string; fail: string };
}

interface ThresholdMinRule extends BaseRule {
  type: "threshold_min";
  getValue: (l: WoningNetListing) => number;
  getLimit: (p: UserPreferences) => number | null;
  format: (value: number, limit: number) => { pass: string; fail: string };
}

interface MembershipRule extends BaseRule {
  type: "membership";
  getValue: (l: WoningNetListing) => string;
  getList: (p: UserPreferences) => string[];
  format: (value: string) => string;
}

interface MembershipSingleRule extends BaseRule {
  type: "membership_single";
  getValue: (l: WoningNetListing) => string;
  getPreferred: (p: UserPreferences) => string | null;
  format: (value: string) => string;
}

interface CustomRule extends BaseRule {
  type: "custom";
  score: (listing: WoningNetListing, prefs: UserPreferences) => { points: number; reason: string | null };
}

type ScoringRule = GradientRule | ThresholdMaxRule | ThresholdMinRule | MembershipRule | MembershipSingleRule | CustomRule;

function evaluateRule(rule: ScoringRule, listing: WoningNetListing, prefs: UserPreferences): { points: number; reason: string | null } {
  switch (rule.type) {
    case "gradient": {
      const value = rule.getValue(listing);
      const points = Math.max(0, Math.round(100 * (1 - (value - 1) / rule.max)));
      return { points, reason: points > 0 ? rule.format(value) : null };
    }
    case "threshold_max": {
      const limit = rule.getLimit(prefs);
      if (limit == null) return { points: 50, reason: null };
      const value = rule.getValue(listing);
      if (value == null) return { points: 50, reason: null };
      const msgs = rule.format(value, limit);
      return value <= limit
        ? { points: 100, reason: msgs.pass }
        : { points: 0, reason: msgs.fail };
    }
    case "threshold_min": {
      const limit = rule.getLimit(prefs);
      if (limit == null) return { points: 50, reason: null };
      const value = rule.getValue(listing);
      const msgs = rule.format(value, limit);
      return value >= limit
        ? { points: 100, reason: msgs.pass }
        : { points: 0, reason: msgs.fail };
    }
    case "membership": {
      const list = rule.getList(prefs);
      if (list.length === 0) return { points: 50, reason: null };
      const value = rule.getValue(listing);
      const match = list.some((item) => item.toLowerCase() === value.toLowerCase());
      return match
        ? { points: 100, reason: rule.format(value) }
        : { points: 0, reason: null };
    }
    case "membership_single": {
      const preferred = rule.getPreferred(prefs);
      if (preferred == null) return { points: 50, reason: null };
      const value = rule.getValue(listing);
      return value.toLowerCase() === preferred.toLowerCase()
        ? { points: 100, reason: rule.format(value) }
        : { points: 0, reason: null };
    }
    case "custom":
      return rule.score(listing, prefs);
  }
}

const rules: ScoringRule[] = [
  {
    name: "position",
    weight: 1.0,
    type: "gradient",
    getValue: (l) => l.position,
    max: 100,
    format: (v) => `Position ${v}`,
  },
  {
    name: "rent",
    weight: 0.3,
    type: "threshold_max",
    getValue: (l) => parseRentToNumber(l.rentNet),
    getLimit: (p) => p.maxRent,
    format: (_, limit) => ({
      pass: `Rent within budget (max ${limit})`,
      fail: `Rent over budget (max ${limit})`,
    }),
  },
  {
    name: "rooms",
    weight: 0.3,
    type: "threshold_min",
    getValue: (l) => l.rooms,
    getLimit: (p) => p.minRooms,
    format: (v, limit) => ({
      pass: `${v} rooms (min ${limit})`,
      fail: `Only ${v} rooms (need ${limit})`,
    }),
  },
  {
    name: "neighborhood",
    weight: 0.2,
    type: "membership",
    getValue: (l) => l.neighborhood,
    getList: (p) => p.preferredNeighborhoods,
    format: (v) => `Preferred neighborhood: ${v}`,
  },
  {
    name: "contractType",
    weight: 0.2,
    type: "membership_single",
    getValue: (l) => l.contractType,
    getPreferred: (p) => p.preferredContractType,
    format: (v) => `Preferred contract: ${v}`,
  },
  {
    name: "propertyType",
    weight: 0.2,
    type: "membership",
    getValue: (l) => l.propertyType,
    getList: (p) => p.preferredPropertyTypes ?? [],
    format: (v) => `Preferred type: ${v}`,
  },
  {
    name: "maxPosition",
    weight: 0.3,
    type: "threshold_max",
    getValue: (l) => l.position,
    getLimit: (p) => p.maxPosition,
    format: (v, limit) => ({
      pass: `Position ${v} within limit (max ${limit})`,
      fail: `Position ${v} exceeds limit (max ${limit})`,
    }),
  },
];

// --- Public API ---

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
        const { points, reason } = evaluateRule(rule, listing, preferences);
        weightedSum += points * rule.weight;
        if (reason) matchReasons.push(reason);
      }

      const score = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 50;
      return { ...listing, score, matchReasons };
    })
    .sort((a, b) => b.score - a.score);
}

export function scoreAndRank(
  listings: WoningNetListing[],
  preferences: UserPreferences,
  blacklist: BlacklistConfig
): ScoredListing[] {
  const { filtered } = filterBlacklisted(listings, blacklist);
  return scoreListings(filtered, preferences);
}
