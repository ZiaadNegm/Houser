import type { WoningNetSession } from "./types.ts";
import { BASE_URL, USER_AGENT } from "./constants.ts";
import { extractCsrf, parseCookiesFromResponse } from "./auth.ts";

/**
 * Generic authenticated request to a WoningNet OutSystems endpoint.
 *
 * Builds the versioned request envelope, sends cookies + CSRF,
 * detects version staleness, and handles cookie rotation.
 *
 * All authenticated WoningNet calls (listings, apply, revoke) go through this.
 */
export async function woningNetFetch(
  session: WoningNetSession,
  endpoint: string,
  body: Record<string, unknown>,
  apiVersion: string,
  viewName: string,
): Promise<{ data: any; session: WoningNetSession }> {
  const url = `${BASE_URL}${endpoint}`;

  const requestBody = {
    versionInfo: {
      moduleVersion: session.moduleVersion,
      apiVersion,
    },
    viewName,
    ...body,
  };

  console.log(`[woningnet:client] POST ${endpoint}`);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=UTF-8",
      Accept: "application/json",
      "X-CSRFToken": session.csrfToken,
      "OutSystems-locale": "nl-NL",
      "User-Agent": USER_AGENT,
      Cookie: `nr1Users=${session.nr1Cookie}; nr2Users=${session.nr2Cookie}`,
    },
    body: JSON.stringify(requestBody),
    redirect: "manual",
  });

  if (!response.ok) {
    throw new Error(
      `WoningNet request failed: ${response.status} ${response.statusText}`,
    );
  }

  const responseJson = await response.json();

  // Version staleness check — throw, don't recover (MVP strategy)
  if (responseJson.versionInfo?.hasModuleVersionChanged === true) {
    throw new Error("WoningNet API version stale: module version changed");
  }
  if (responseJson.versionInfo?.hasApiVersionChanged === true) {
    throw new Error("WoningNet API version stale: API version changed");
  }

  // Cookie rotation — cookies can rotate on any request, not just login
  let updatedSession = session;
  const setCookies = response.headers.getSetCookie();
  const hasBothCookies =
    setCookies.some((c) => c.startsWith("nr1Users=")) &&
    setCookies.some((c) => c.startsWith("nr2Users="));

  if (hasBothCookies) {
    const { nr1, nr2 } = parseCookiesFromResponse(response);
    const newCsrf = extractCsrf(nr2);
    updatedSession = {
      ...session,
      nr1Cookie: nr1,
      nr2Cookie: nr2,
      csrfToken: newCsrf,
    };
    console.log("[woningnet:client] Session cookies rotated");
  }

  return { data: responseJson.data, session: updatedSession };
}
