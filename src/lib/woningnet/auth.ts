import type { WoningNetSession } from "./types";
import { API_VERSIONS, BASE_URL, USER_AGENT } from "./constants";

const LOGIN_PATH =
  "/screenservices/DAKWP/Onboarding/Home/ActionLoginServer";
const MODULE_VERSION_PATH = "/moduleservices/moduleversioninfo";

export function extractCsrf(nr2CookieValue: string): string {
  const decoded = decodeURIComponent(nr2CookieValue);
  const segments = decoded.split(";");

  for (const segment of segments) {
    const trimmed = segment.trim();
    if (trimmed.startsWith("crf=")) {
      return trimmed.slice(4);
    }
  }

  throw new Error("CSRF token not found in nr2Users cookie");
}

export function parseCookiesFromResponse(response: Response): {
  nr1: string;
  nr2: string;
} {
  const setCookies = response.headers.getSetCookie();

  let nr1: string | undefined;
  let nr2: string | undefined;

  for (const header of setCookies) {
    const cookiePart = header.split("; ")[0];
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

async function initSession(): Promise<{
  nr1: string;
  nr2: string;
  csrf: string;
  moduleVersion: string;
}> {
  console.log("[WoningNet] initSession: fetching anonymous session and module version");
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

  console.log("[WoningNet] initSession: anon response status=%d, version response status=%d", anonResponse.status, versionResponse.status);
  console.log("[WoningNet] initSession: anon set-cookie count=%d", anonResponse.headers.getSetCookie().length);

  if (!versionResponse.ok) {
    throw new Error(
      `Module version fetch failed: ${versionResponse.status} ${versionResponse.statusText}`,
    );
  }

  const { nr1, nr2 } = parseCookiesFromResponse(anonResponse);
  const csrf = extractCsrf(nr2);
  console.log("[WoningNet] initSession: got cookies and csrf, csrf length=%d", csrf.length);

  const versionJson = await versionResponse.json();
  const moduleVersion: string = versionJson.versionToken;
  if (!moduleVersion) {
    throw new Error("Module version token not found in response");
  }

  console.log("[WoningNet] initSession: moduleVersion=%s", moduleVersion);
  return { nr1, nr2, csrf, moduleVersion };
}

export async function login(
  email: string,
  password: string,
): Promise<WoningNetSession> {
  const { nr1, nr2, csrf, moduleVersion } = await initSession();

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

  console.log("[WoningNet] login: sending login request for email=%s", email);
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

  console.log("[WoningNet] login: response status=%d, set-cookie count=%d", loginResponse.status, loginResponse.headers.getSetCookie().length);

  if (!loginResponse.ok && loginResponse.status !== 302) {
    const body = await loginResponse.text();
    console.error("[WoningNet] login: unexpected status=%d, body=%s", loginResponse.status, body.slice(0, 500));
    throw new Error(
      `Login request failed: ${loginResponse.status} ${loginResponse.statusText}`,
    );
  }

  const responseJson = await loginResponse.json();
  console.log("[WoningNet] login: IsNaarWoningOverzicht=%s, response keys=%s", responseJson.data?.IsNaarWoningOverzicht, Object.keys(responseJson.data ?? {}).join(","));

  if (responseJson.data?.IsNaarWoningOverzicht !== true) {
    console.error("[WoningNet] login: redirect not confirmed, data=%s", JSON.stringify(responseJson.data ?? {}).slice(0, 500));
    throw new Error("Login failed: WoningNet did not confirm redirect");
  }

  const { nr1: newNr1, nr2: newNr2 } =
    parseCookiesFromResponse(loginResponse);
  const newCsrf = extractCsrf(newNr2);
  console.log("[WoningNet] login: success, got authenticated session");

  return {
    nr1Cookie: newNr1,
    nr2Cookie: newNr2,
    csrfToken: newCsrf,
    moduleVersion,
  };
}

export async function verifyWoningNetCredentials(
  email: string,
  password: string,
): Promise<{ valid: true } | { valid: false; error: string }> {
  try {
    await login(email, password);
    return { valid: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[WoningNet] Credential verification failed:", message);
    if (message.includes("Login failed") || message.includes("Login request failed")) {
      return { valid: false, error: "Invalid WoningNet credentials" };
    }
    return { valid: false, error: "Could not verify credentials. Please try again later." };
  }
}
