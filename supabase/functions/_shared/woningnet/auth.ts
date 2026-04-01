import type { WoningNetSession } from "./types.ts";
import { API_VERSIONS, BASE_URL, USER_AGENT } from "./constants.ts";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const LOGIN_PATH =
  "/screenservices/DAKWP/Onboarding/Home/ActionLoginServer";
const MODULE_VERSION_PATH = "/moduleservices/moduleversioninfo";

// ---------------------------------------------------------------------------
// extractCsrf
// ---------------------------------------------------------------------------

/**
 * Extract the CSRF token (`crf` field) from a raw nr2Users cookie value.
 *
 * The cookie value looks like: `crf=T6C+9iB49TLra4jEsMeSckDMNhQ=;uid=0;unm=`
 * It may arrive URL-encoded from the Set-Cookie header.
 */
export function extractCsrf(nr2CookieValue: string): string {
  const decoded = decodeURIComponent(nr2CookieValue);
  const segments = decoded.split(";");

  for (const segment of segments) {
    const trimmed = segment.trim();
    if (trimmed.startsWith("crf=")) {
      return trimmed.slice(4); // everything after "crf="
    }
  }

  throw new Error("CSRF token not found in nr2Users cookie");
}

// ---------------------------------------------------------------------------
// parseCookiesFromResponse
// ---------------------------------------------------------------------------

/**
 * Extract nr1Users and nr2Users cookie values from Set-Cookie response headers.
 *
 * Handles cookie values that contain `=` (e.g. base64 CSRF tokens) by
 * splitting on the first `=` only.
 */
export function parseCookiesFromResponse(response: Response): {
  nr1: string;
  nr2: string;
} {
  const setCookies = response.headers.getSetCookie();

  let nr1: string | undefined;
  let nr2: string | undefined;

  for (const header of setCookies) {
    // Strip cookie attributes (Path, HttpOnly, etc.) — take everything before first "; "
    const cookiePart = header.split("; ")[0];

    // Split name=value on first "=" only (value may contain "=")
    const eqIndex = cookiePart.indexOf("=");
    if (eqIndex === -1) continue;

    const name = cookiePart.slice(0, eqIndex);
    const value = cookiePart.slice(eqIndex + 1);

    if (name === "nr1Users") nr1 = value;
    if (name === "nr2Users") nr2 = value;
  }

  if (nr1 === undefined) {
    throw new Error("Missing nr1Users cookie in response");
  }
  if (nr2 === undefined) {
    throw new Error("Missing nr2Users cookie in response");
  }

  return { nr1, nr2 };
}

// ---------------------------------------------------------------------------
// initSession
// ---------------------------------------------------------------------------

/**
 * Initialize an anonymous WoningNet session.
 *
 * Fires two parallel requests:
 * 1. Anonymous POST to the login endpoint → anonymous cookies + CSRF
 * 2. GET module version token
 */
async function initSession(): Promise<{
  nr1: string;
  nr2: string;
  csrf: string;
  moduleVersion: string;
}> {
  console.log("[woningnet:auth] Initializing anonymous session...");

  const [anonResponse, versionResponse] = await Promise.all([
    fetch(`${BASE_URL}${LOGIN_PATH}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=UTF-8",
        Accept: "application/json",
        "User-Agent": USER_AGENT,
      },
      body: "{}",
      redirect: "manual",
    }),
    fetch(`${BASE_URL}${MODULE_VERSION_PATH}`, {
      headers: { "User-Agent": USER_AGENT },
    }),
  ]);

  // The anonymous POST returns 403 "Invalid Login" — this is expected.
  // We only care about the Set-Cookie headers it returns.
  if (!versionResponse.ok) {
    throw new Error(
      `Module version fetch failed: ${versionResponse.status} ${versionResponse.statusText}`,
    );
  }

  const { nr1, nr2 } = parseCookiesFromResponse(anonResponse);
  const csrf = extractCsrf(nr2);

  const versionJson = await versionResponse.json();
  const moduleVersion: string = versionJson.versionToken;
  if (!moduleVersion) {
    throw new Error("Module version token not found in response");
  }

  console.log(
    `[woningnet:auth] Anonymous session initialized, module version: ${moduleVersion}`,
  );

  return { nr1, nr2, csrf, moduleVersion };
}

// ---------------------------------------------------------------------------
// login
// ---------------------------------------------------------------------------

/**
 * Perform a full WoningNet login: init anonymous session → authenticate.
 *
 * Credentials are passed explicitly — the caller reads them from env vars.
 * Returns an authenticated WoningNetSession ready for subsequent API calls.
 */
export async function login(
  email: string,
  password: string,
): Promise<WoningNetSession> {
  const { nr1, nr2, csrf, moduleVersion } = await initSession();

  console.log(`[woningnet:auth] Logging in...`);

  const loginPayload = {
    versionInfo: {
      moduleVersion,
      apiVersion: API_VERSIONS.login,
    },
    viewName: "Onboarding.Home",
    inputParameters: {
      Gebruikersnaam: email,
      Wachtwoord: password,
      SwvClient: "7",
      IsVanContactformulier: false,
      ReturnUrl: "",
      WoningAanbodPublicatie: "",
      IsKlantContactCode: false,
      ClientInputLastUrl: "",
      IsIngelogdBlijven: false,
      RequestId_In: "0",
      Request_In: "",
    },
  };

  const loginResponse = await fetch(`${BASE_URL}${LOGIN_PATH}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=UTF-8",
      Accept: "application/json",
      "X-CSRFToken": csrf,
      "OutSystems-locale": "nl-NL",
      "User-Agent": USER_AGENT,
      Cookie: `nr1Users=${nr1}; nr2Users=${nr2}`,
    },
    body: JSON.stringify(loginPayload),
    redirect: "manual",
  });

  if (!loginResponse.ok && loginResponse.status !== 302) {
    throw new Error(
      `Login request failed: ${loginResponse.status} ${loginResponse.statusText}`,
    );
  }

  const responseJson = await loginResponse.json();

  if (responseJson.data?.IsNaarWoningOverzicht !== true) {
    throw new Error("Login failed: WoningNet did not confirm redirect");
  }

  // Cookies rotate after login — extract the new ones
  const { nr1: newNr1, nr2: newNr2 } =
    parseCookiesFromResponse(loginResponse);
  const newCsrf = extractCsrf(newNr2);

  console.log(`[woningnet:auth] Login successful for ${email}`);

  return {
    nr1Cookie: newNr1,
    nr2Cookie: newNr2,
    csrfToken: newCsrf,
    moduleVersion,
  };
}
