import type { ScoredListing } from "./domain_types.ts";

export const MAX_SLOTS = 2;

export interface ActionPlan {
  apply: ScoredListing[];
  revokeAndReplace: Array<{ revoke: ScoredListing; applyTo: ScoredListing }>;
  skip: Array<{ listing: ScoredListing; reason: string }>;
}

function isDeadlinePast(deadline: string): boolean {
  const ts = new Date(deadline).getTime();
  if (Number.isNaN(ts)) return true; // unparseable → treat as expired
  return ts < Date.now();
}

/**
 * Compute which actions to take given scored listings and a slot limit.
 *
 * Pure function — no I/O. Testable with synthetic data.
 *
 * Algorithm:
 *   1. Partition into currently-applied vs candidates
 *   2. Fill empty slots with top candidates
 *   3. Replace occupied slots when a strictly better candidate exists
 *
 *   ┌─────────────────────────────┐
 *   │ scored listings             │
 *   │  ├── applied (hasApplied)   │──▶ revoke targets (if outscored)
 *   │  └── candidates (!applied) │──▶ apply targets
 *   └─────────────────────────────┘
 */
export function computeActionPlan(
  scored: ScoredListing[],
  maxSlots: number = MAX_SLOTS,
): ActionPlan {
  const plan: ActionPlan = { apply: [], revokeAndReplace: [], skip: [] };

  const currentlyApplied = scored.filter((l) => l.hasApplied);
  const candidates = scored.filter((l) => {
    if (l.hasApplied) return false;
    if (isDeadlinePast(l.deadline)) {
      plan.skip.push({ listing: l, reason: "Deadline passed" });
      return false;
    }
    return true;
  });

  // --- Fill empty slots ---
  const emptySlots = Math.max(0, maxSlots - currentlyApplied.length);
  const toApply = candidates.slice(0, emptySlots); // candidates already sorted by score desc
  plan.apply = toApply;

  // Track which candidates are claimed
  const claimed = new Set(toApply.map((l) => l.id));

  // --- Revoke-and-replace ---
  // Sort applied by score ascending (weakest first) for replacement
  const appliedSorted = [...currentlyApplied].sort((a, b) => a.score - b.score);

  for (const applied of appliedSorted) {
    if (!applied.canRevoke) continue;

    // Find best unclaimed candidate that strictly outscores this applied listing
    const better = candidates.find((c) => !claimed.has(c.id) && c.score > applied.score);
    if (better) {
      plan.revokeAndReplace.push({ revoke: applied, applyTo: better });
      claimed.add(better.id);
    }
  }

  return plan;
}
