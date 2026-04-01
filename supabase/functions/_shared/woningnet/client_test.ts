import {
  assertEquals,
  assertRejects,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { woningNetFetch } from "./client.ts";
import type { WoningNetSession } from "./types.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TEST_SESSION: WoningNetSession = {
  nr1Cookie: "test-nr1",
  nr2Cookie: "crf%3DtestCsrf%3Buid%3D0%3Bunm%3D",
  csrfToken: "testCsrf",
  moduleVersion: "testModuleVersion",
};

const TEST_ENDPOINT = "/screenservices/DAKWP/Test/Action";
const TEST_BODY = { inputParameters: { foo: "bar" } };
const TEST_API_VERSION = "testApiVersion";
const TEST_VIEW_NAME = "Test.Action";

/** Stub globalThis.fetch for the duration of a test. */
function withFetch(
  stubFn: (url: string | URL | Request, init?: RequestInit) => Promise<Response>,
  testFn: () => Promise<void>,
): () => Promise<void> {
  return async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = stubFn as typeof globalThis.fetch;
    try {
      await testFn();
    } finally {
      globalThis.fetch = originalFetch;
    }
  };
}

/** Build a stubbed Response with optional Set-Cookie headers and JSON body. */
function stubResponse(
  body: Record<string, unknown>,
  setCookies?: string[],
  status = 200,
): Response {
  const headers = new Headers();
  headers.set("Content-Type", "application/json");
  if (setCookies) {
    for (const cookie of setCookies) {
      headers.append("Set-Cookie", cookie);
    }
  }
  return new Response(JSON.stringify(body), { status, headers });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

// Normal response with data, no version changes, no cookie rotation
Deno.test(
  "woningNetFetch - returns data and unchanged session on happy path",
  withFetch(
    async () =>
      stubResponse({ data: { listings: [1, 2, 3] }, versionInfo: {} }),
    async () => {
      const result = await woningNetFetch(
        TEST_SESSION,
        TEST_ENDPOINT,
        TEST_BODY,
        TEST_API_VERSION,
        TEST_VIEW_NAME,
      );
      assertEquals(result.data, { listings: [1, 2, 3] });
      assertEquals(result.session, TEST_SESSION);
    },
  ),
);

// Response includes new Set-Cookie headers — session should update
Deno.test(
  "woningNetFetch - updates session when cookies rotate",
  withFetch(
    async () =>
      stubResponse(
        { data: { ok: true }, versionInfo: {} },
        [
          "nr1Users=new-nr1-value; Path=/; HttpOnly; Secure",
          "nr2Users=crf%3DnewCsrfToken%3Buid%3D123%3Bunm%3Duser%40test.com; Path=/; Secure",
        ],
      ),
    async () => {
      const result = await woningNetFetch(
        TEST_SESSION,
        TEST_ENDPOINT,
        TEST_BODY,
        TEST_API_VERSION,
        TEST_VIEW_NAME,
      );
      assertEquals(result.session.nr1Cookie, "new-nr1-value");
      assertEquals(
        result.session.nr2Cookie,
        "crf%3DnewCsrfToken%3Buid%3D123%3Bunm%3Duser%40test.com",
      );
      assertEquals(result.session.csrfToken, "newCsrfToken");
      assertEquals(result.session.moduleVersion, TEST_SESSION.moduleVersion);
    },
  ),
);

// WoningNet signals a module version redeploy
Deno.test(
  "woningNetFetch - throws on module version stale",
  withFetch(
    async () =>
      stubResponse({
        data: {},
        versionInfo: { hasModuleVersionChanged: true, hasApiVersionChanged: false },
      }),
    async () => {
      await assertRejects(
        () =>
          woningNetFetch(
            TEST_SESSION,
            TEST_ENDPOINT,
            TEST_BODY,
            TEST_API_VERSION,
            TEST_VIEW_NAME,
          ),
        Error,
        "module version changed",
      );
    },
  ),
);

// WoningNet signals an endpoint-specific API version change
Deno.test(
  "woningNetFetch - throws on API version stale",
  withFetch(
    async () =>
      stubResponse({
        data: {},
        versionInfo: { hasModuleVersionChanged: false, hasApiVersionChanged: true },
      }),
    async () => {
      await assertRejects(
        () =>
          woningNetFetch(
            TEST_SESSION,
            TEST_ENDPOINT,
            TEST_BODY,
            TEST_API_VERSION,
            TEST_VIEW_NAME,
          ),
        Error,
        "API version changed",
      );
    },
  ),
);

// Server returns a non-200 HTTP status
Deno.test(
  "woningNetFetch - throws on HTTP error",
  withFetch(
    async () => stubResponse({}, undefined, 500),
    async () => {
      await assertRejects(
        () =>
          woningNetFetch(
            TEST_SESSION,
            TEST_ENDPOINT,
            TEST_BODY,
            TEST_API_VERSION,
            TEST_VIEW_NAME,
          ),
        Error,
        "WoningNet request failed",
      );
    },
  ),
);
