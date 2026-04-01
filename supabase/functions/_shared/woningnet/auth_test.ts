import {
  assertEquals,
  assertThrows,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { extractCsrf, parseCookiesFromResponse } from "./auth.ts";

// ---------------------------------------------------------------------------
// extractCsrf
// ---------------------------------------------------------------------------

// Anonymous cookie with base64 CSRF containing "=" and "+"
Deno.test("extractCsrf - extracts CSRF from anonymous cookie", () => {
  const value = "crf=T6C+9iB49TLra4jEsMeSckDMNhQ=;uid=0;unm=";
  assertEquals(extractCsrf(value), "T6C+9iB49TLra4jEsMeSckDMNhQ=");
});

// Authenticated cookie with uid and email populated
Deno.test("extractCsrf - extracts CSRF from authenticated cookie", () => {
  const value = "crf=abc123;uid=1590177;unm=user@email.com";
  assertEquals(extractCsrf(value), "abc123");
});

// Cookie value arrives percent-encoded from Set-Cookie header
Deno.test("extractCsrf - handles URL-encoded input", () => {
  const value = "crf%3DT6C%2B9iB49TLra4jEsMeSckDMNhQ%3D%3Buid%3D0%3Bunm%3D";
  assertEquals(extractCsrf(value), "T6C+9iB49TLra4jEsMeSckDMNhQ=");
});

// Segments separated by "; " (with space) instead of just ";"
Deno.test("extractCsrf - handles spaces around segments", () => {
  const value = "crf=token123; uid=0; unm=";
  assertEquals(extractCsrf(value), "token123");
});

// Cookie exists but has no crf field
Deno.test("extractCsrf - throws on missing crf field", () => {
  assertThrows(
    () => extractCsrf("uid=0;unm=test@test.com"),
    Error,
    "CSRF token not found",
  );
});

// Completely empty cookie value
Deno.test("extractCsrf - throws on empty string", () => {
  assertThrows(() => extractCsrf(""), Error, "CSRF token not found");
});

// ---------------------------------------------------------------------------
// parseCookiesFromResponse
// ---------------------------------------------------------------------------

/** Helper to build a Response with Set-Cookie headers. */
function mockResponse(...setCookies: string[]): Response {
  // Response constructor doesn't support multiple Set-Cookie headers directly.
  // Use the Headers API which does support appending multiple values.
  const headers = new Headers();
  for (const cookie of setCookies) {
    headers.append("Set-Cookie", cookie);
  }
  return new Response(null, { headers });
}

// Both nr1Users and nr2Users present with typical cookie attributes
Deno.test("parseCookiesFromResponse - extracts both cookies", () => {
  const res = mockResponse(
    "nr1Users=lid=Anonymous;tuu=0; Path=/; HttpOnly; Secure",
    "nr2Users=crf=abc123;uid=0;unm=; Path=/",
  );
  const { nr1, nr2 } = parseCookiesFromResponse(res);
  assertEquals(nr1, "lid=Anonymous;tuu=0");
  assertEquals(nr2, "crf=abc123;uid=0;unm=");
});

// Cookie values contain "=" from base64 — must split name=value on first "=" only
Deno.test("parseCookiesFromResponse - handles base64 = in cookie value", () => {
  const res = mockResponse(
    "nr1Users=lid=abc;hmc=x+y/z==; Path=/; HttpOnly",
    "nr2Users=crf=T6C+9iB49TLra4jEsMeSckDMNhQ=;uid=0;unm=; Path=/",
  );
  const { nr1, nr2 } = parseCookiesFromResponse(res);
  assertEquals(nr1, "lid=abc;hmc=x+y/z==");
  assertEquals(nr2, "crf=T6C+9iB49TLra4jEsMeSckDMNhQ=;uid=0;unm=");
});

// Response only has nr2Users — nr1Users missing
Deno.test("parseCookiesFromResponse - throws on missing nr1Users", () => {
  const res = mockResponse("nr2Users=crf=abc;uid=0;unm=; Path=/");
  assertThrows(
    () => parseCookiesFromResponse(res),
    Error,
    "Missing nr1Users",
  );
});

// Response only has nr1Users — nr2Users missing
Deno.test("parseCookiesFromResponse - throws on missing nr2Users", () => {
  const res = mockResponse(
    "nr1Users=lid=Anonymous; Path=/; HttpOnly",
  );
  assertThrows(
    () => parseCookiesFromResponse(res),
    Error,
    "Missing nr2Users",
  );
});

// Response has no Set-Cookie headers at all
Deno.test("parseCookiesFromResponse - throws when no cookies at all", () => {
  const res = new Response(null);
  assertThrows(
    () => parseCookiesFromResponse(res),
    Error,
    "Missing nr1Users",
  );
});
