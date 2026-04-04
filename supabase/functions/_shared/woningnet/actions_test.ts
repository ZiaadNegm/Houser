import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { applyToListing, revokeApplication } from "./actions.ts";
import { API_VERSIONS } from "./constants.ts";
import type { WoningNetSession } from "./types.ts";
import * as client from "./client.ts";

const mockSession: WoningNetSession = {
  nr1Cookie: "test-nr1",
  nr2Cookie: "test-nr2",
  csrfToken: "test-csrf",
  moduleVersion: "test-module-version",
};

// --- Test helpers ---

function mockWoningNetFetch(
  // deno-lint-ignore no-explicit-any
  response: { data: any; session: WoningNetSession },
) {
  const original = client.woningNetFetch;
  let capturedArgs: { endpoint: string; body: Record<string, unknown>; apiVersion: string; viewName: string } | null = null;

  // deno-lint-ignore no-explicit-any
  (client as any).woningNetFetch = async (
    _session: WoningNetSession,
    endpoint: string,
    body: Record<string, unknown>,
    apiVersion: string,
    viewName: string,
  ) => {
    capturedArgs = { endpoint, body, apiVersion, viewName };
    return response;
  };

  return {
    get capturedArgs() { return capturedArgs; },
    restore() { (client as any).woningNetFetch = original; },
  };
}

// --- applyToListing tests ---

Deno.test("applyToListing: IsSuccess=true returns success", async () => {
  const mock = mockWoningNetFetch({
    data: { Result: { IsSuccess: true, ErrorMessage: "", StatusCode: 0 } },
    session: { ...mockSession, csrfToken: "rotated" },
  });

  try {
    const result = await applyToListing(mockSession, "353920");
    assertEquals(result.success, true);
    assertEquals(result.errorMessage, "");
    assertEquals(result.session.csrfToken, "rotated");
  } finally {
    mock.restore();
  }
});

Deno.test("applyToListing: IsSuccess=false returns failure with message", async () => {
  const mock = mockWoningNetFetch({
    data: { Result: { IsSuccess: false, ErrorMessage: "Deadline verlopen", StatusCode: 1 } },
    session: mockSession,
  });

  try {
    const result = await applyToListing(mockSession, "123");
    assertEquals(result.success, false);
    assertEquals(result.errorMessage, "Deadline verlopen");
  } finally {
    mock.restore();
  }
});

Deno.test("applyToListing: Result undefined returns failure", async () => {
  const mock = mockWoningNetFetch({
    data: {},
    session: mockSession,
  });

  try {
    const result = await applyToListing(mockSession, "123");
    assertEquals(result.success, false);
  } finally {
    mock.restore();
  }
});

Deno.test("applyToListing: passes correct endpoint and params", async () => {
  const mock = mockWoningNetFetch({
    data: { Result: { IsSuccess: true, ErrorMessage: "", StatusCode: 0 } },
    session: mockSession,
  });

  try {
    await applyToListing(mockSession, "353920");
    assertEquals(mock.capturedArgs!.endpoint, "/screenservices/DAKWP/HuisDetails/InHetKortEnPositie/ActionVerwerkReactie");
    assertEquals(mock.capturedArgs!.apiVersion, API_VERSIONS.apply);
    assertEquals(mock.capturedArgs!.viewName, "HuisDetails.HuisDetails");
    assertEquals(mock.capturedArgs!.body, {
      inputParameters: { ToonMijNietMeer: false, PublicatieId: "353920", SamenwerkingsverbandId: "7" },
    });
  } finally {
    mock.restore();
  }
});

// --- revokeApplication tests ---

Deno.test("revokeApplication: IsSuccess=true returns success", async () => {
  const mock = mockWoningNetFetch({
    data: { Result: { IsSuccess: true, ErrorMessage: "", StatusCode: 0 } },
    session: { ...mockSession, csrfToken: "rotated" },
  });

  try {
    const result = await revokeApplication(mockSession, "353920");
    assertEquals(result.success, true);
    assertEquals(result.errorMessage, "");
    assertEquals(result.session.csrfToken, "rotated");
  } finally {
    mock.restore();
  }
});

Deno.test("revokeApplication: passes correct endpoint and params", async () => {
  const mock = mockWoningNetFetch({
    data: { Result: { IsSuccess: true, ErrorMessage: "", StatusCode: 0 } },
    session: mockSession,
  });

  try {
    await revokeApplication(mockSession, "353920");
    assertEquals(mock.capturedArgs!.endpoint, "/screenservices/DAKWP/HuisDetails/InHetKortEnPositie/ActionReactieIntrekken");
    assertEquals(mock.capturedArgs!.apiVersion, API_VERSIONS.revoke);
    assertEquals(mock.capturedArgs!.viewName, "HuisDetails.HuisDetails");
    assertEquals(mock.capturedArgs!.body, {
      inputParameters: { PublicatieId: "353920", SamenwerkingsverbandId: "7" },
    });
  } finally {
    mock.restore();
  }
});
