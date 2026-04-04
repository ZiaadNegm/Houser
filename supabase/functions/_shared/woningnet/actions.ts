import type { WoningNetSession } from "./types.ts";
import { woningNetFetch } from "./client.ts";
import { API_VERSIONS } from "./constants.ts";

const APPLY_ENDPOINT =
  "/screenservices/DAKWP/HuisDetails/InHetKortEnPositie/ActionVerwerkReactie";
const REVOKE_ENDPOINT =
  "/screenservices/DAKWP/HuisDetails/InHetKortEnPositie/ActionReactieIntrekken";
const VIEW_NAME = "HuisDetails.HuisDetails";

export interface ActionResult {
  success: boolean;
  errorMessage: string;
  session: WoningNetSession;
}

/**
 * Apply to a WoningNet listing.
 * Single-step operation — no confirmation needed (verified 2026-04-04).
 */
export async function applyToListing(
  session: WoningNetSession,
  listingId: string,
): Promise<ActionResult> {
  const body = {
    inputParameters: {
      ToonMijNietMeer: false,
      PublicatieId: listingId,
      SamenwerkingsverbandId: "7",
    },
  };

  const { data, session: updatedSession } = await woningNetFetch(
    session,
    APPLY_ENDPOINT,
    body,
    API_VERSIONS.apply,
    VIEW_NAME,
  );

  const success = data?.Result?.IsSuccess === true;
  const errorMessage = data?.Result?.ErrorMessage ?? "";

  console.log(
    `[woningnet:actions] apply ${listingId}: ${success ? "success" : `failed (${errorMessage})`}`,
  );

  return { success, errorMessage, session: updatedSession };
}

/**
 * Revoke an existing application on a WoningNet listing.
 */
export async function revokeApplication(
  session: WoningNetSession,
  listingId: string,
): Promise<ActionResult> {
  const body = {
    inputParameters: {
      PublicatieId: listingId,
      SamenwerkingsverbandId: "7",
    },
  };

  const { data, session: updatedSession } = await woningNetFetch(
    session,
    REVOKE_ENDPOINT,
    body,
    API_VERSIONS.revoke,
    VIEW_NAME,
  );

  const success = data?.Result?.IsSuccess === true;
  const errorMessage = data?.Result?.ErrorMessage ?? "";

  console.log(
    `[woningnet:actions] revoke ${listingId}: ${success ? "success" : `failed (${errorMessage})`}`,
  );

  return { success, errorMessage, session: updatedSession };
}
