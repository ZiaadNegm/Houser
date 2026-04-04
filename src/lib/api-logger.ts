/**
 * Structured error logging for API routes.
 * Handles Error instances, Supabase PostgrestError objects, and unknown types.
 * Returns the error message string so callers can use it in responses.
 */
export function logApiError(
  route: string,
  userId: string | undefined,
  err: unknown,
): string {
  let message: string;
  if (err instanceof Error) {
    message = err.message;
    console.error(`[${route}] user=${userId ?? "anon"} error="${message}"`);
    if (err.stack) console.error(`[${route}] stack:`, err.stack);
  } else if (typeof err === "object" && err !== null && "message" in err) {
    // Supabase PostgrestError: { message, details, hint, code }
    const pgErr = err as { message: string; code?: string; details?: string; hint?: string };
    message = pgErr.message;
    console.error(`[${route}] user=${userId ?? "anon"} error="${message}" code=${pgErr.code ?? "?"} details="${pgErr.details ?? ""}" hint="${pgErr.hint ?? ""}"`);
  } else {
    message = String(err);
    console.error(`[${route}] user=${userId ?? "anon"} error="${message}"`);
  }
  return message;
}
