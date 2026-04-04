// AES-256-GCM encryption for user credentials (Node.js / Next.js side).
// Mirrors supabase/functions/_shared/crypto/credentials.ts — same format,
// same key, interoperable ciphertext.

const IV_BYTES = 12;

function getKeyBytes(): Buffer {
  const raw = process.env.CREDENTIAL_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error("CREDENTIAL_ENCRYPTION_KEY environment variable is not set");
  }
  return Buffer.from(raw, "base64");
}

export async function encryptCredential(plaintext: string): Promise<string> {
  const keyBytes = getKeyBytes();
  const key = await crypto.subtle.importKey("raw", keyBytes, "AES-GCM", false, ["encrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const encoded = new TextEncoder().encode(plaintext);

  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded);

  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.length);

  return Buffer.from(combined).toString("base64");
}
