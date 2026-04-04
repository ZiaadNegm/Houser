import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { computeActionPlan } from "./decision.ts";
import type { ScoredListing } from "./domain_types.ts";

function listing(overrides: Partial<ScoredListing> = {}): ScoredListing {
  return {
    id: "1",
    address: "Test 1, Almere",
    neighborhood: "Test",
    postcode: "1234AB",
    position: 10,
    rooms: 2,
    rentNet: "500",
    energyLabel: "A",
    contractType: "Onbepaalde tijd",
    propertyType: "Portiekflat",
    deadline: "2099-12-31T07:00:00",
    hasApplied: false,
    canRevoke: true,
    totalApplicants: 100,
    owner: "TestCorp",
    score: 50,
    matchReasons: [],
    ...overrides,
  };
}

Deno.test("empty slots: apply top N candidates", () => {
  const scored = [
    listing({ id: "a", score: 80 }),
    listing({ id: "b", score: 60 }),
    listing({ id: "c", score: 40 }),
  ];
  const plan = computeActionPlan(scored, 2);
  assertEquals(plan.apply.length, 2);
  assertEquals(plan.apply[0].id, "a");
  assertEquals(plan.apply[1].id, "b");
  assertEquals(plan.revokeAndReplace.length, 0);
});

Deno.test("one slot available: apply best 1", () => {
  const scored = [
    listing({ id: "applied", score: 70, hasApplied: true }),
    listing({ id: "a", score: 80 }),
    listing({ id: "b", score: 60 }),
  ];
  const plan = computeActionPlan(scored, 2);
  assertEquals(plan.apply.length, 1);
  assertEquals(plan.apply[0].id, "a");
});

Deno.test("all full, no improvement: empty plan", () => {
  const scored = [
    listing({ id: "applied1", score: 80, hasApplied: true }),
    listing({ id: "applied2", score: 90, hasApplied: true }),
    listing({ id: "candidate", score: 50 }),
  ];
  const plan = computeActionPlan(scored, 2);
  assertEquals(plan.apply.length, 0);
  assertEquals(plan.revokeAndReplace.length, 0);
});

Deno.test("all full, one improvement: replace weakest", () => {
  const scored = [
    listing({ id: "applied-weak", score: 30, hasApplied: true }),
    listing({ id: "applied-strong", score: 90, hasApplied: true }),
    listing({ id: "candidate", score: 80 }),
  ];
  const plan = computeActionPlan(scored, 2);
  assertEquals(plan.apply.length, 0);
  assertEquals(plan.revokeAndReplace.length, 1);
  assertEquals(plan.revokeAndReplace[0].revoke.id, "applied-weak");
  assertEquals(plan.revokeAndReplace[0].applyTo.id, "candidate");
});

Deno.test("all full, multiple improvements: replace both", () => {
  const scored = [
    listing({ id: "applied1", score: 30, hasApplied: true }),
    listing({ id: "applied2", score: 40, hasApplied: true }),
    listing({ id: "cand1", score: 80 }),
    listing({ id: "cand2", score: 70 }),
  ];
  const plan = computeActionPlan(scored, 2);
  assertEquals(plan.apply.length, 0);
  assertEquals(plan.revokeAndReplace.length, 2);
  // Weakest applied (30) replaced by best candidate (80)
  assertEquals(plan.revokeAndReplace[0].revoke.id, "applied1");
  assertEquals(plan.revokeAndReplace[0].applyTo.id, "cand1");
  // Second weakest (40) replaced by second best (70)
  assertEquals(plan.revokeAndReplace[1].revoke.id, "applied2");
  assertEquals(plan.revokeAndReplace[1].applyTo.id, "cand2");
});

Deno.test("canRevoke=false: skip replacement", () => {
  const scored = [
    listing({ id: "applied", score: 30, hasApplied: true, canRevoke: false }),
    listing({ id: "candidate", score: 80 }),
  ];
  const plan = computeActionPlan(scored, 1);
  assertEquals(plan.apply.length, 0);
  assertEquals(plan.revokeAndReplace.length, 0);
});

Deno.test("past deadline: skip candidate", () => {
  const scored = [
    listing({ id: "expired", score: 80, deadline: "2020-01-01T07:00:00" }),
  ];
  const plan = computeActionPlan(scored, 2);
  assertEquals(plan.apply.length, 0);
  assertEquals(plan.skip.length, 1);
  assertEquals(plan.skip[0].reason, "Deadline passed");
});

Deno.test("already applied: not treated as candidate", () => {
  const scored = [
    listing({ id: "already", score: 80, hasApplied: true }),
  ];
  const plan = computeActionPlan(scored, 2);
  // Already applied goes to currentlyApplied, not candidates
  assertEquals(plan.apply.length, 0);
});

Deno.test("zero listings: empty plan", () => {
  const plan = computeActionPlan([], 2);
  assertEquals(plan.apply.length, 0);
  assertEquals(plan.revokeAndReplace.length, 0);
  assertEquals(plan.skip.length, 0);
});

Deno.test("tie score: don't replace (strictly better required)", () => {
  const scored = [
    listing({ id: "applied", score: 50, hasApplied: true }),
    listing({ id: "candidate", score: 50 }),
  ];
  const plan = computeActionPlan(scored, 1);
  assertEquals(plan.apply.length, 0);
  assertEquals(plan.revokeAndReplace.length, 0);
});
