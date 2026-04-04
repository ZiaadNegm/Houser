// AES-256-GCM encryption for user credentials.
// Key is read from CREDENTIAL_ENCRYPTION_KEY env var (base64-encoded 256-bit key).
// Storage format: base64( 12-byte IV || ciphertext || 16-byte authTag )

const IV_BYTES = 12;
const KEY_ENV = "CREDENTIAL_ENCRYPTION_KEY";

async function getKey(): Promise<CryptoKey> {
  const raw = Deno.env.get(KEY_ENV);
  if (!raw) {
    throw new Error(`${KEY_ENV} environment variable is not set`);
  }

  const keyBytes = Uint8Array.from(atob(raw), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey("raw", keyBytes, "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ]);
}

function toBase64(buffer: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)));
}

function fromBase64(b64: string): Uint8Array {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

export async function encryptCredential(plaintext: string): Promise<string> {
  const key = await getKey();
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const encoded = new TextEncoder().encode(plaintext);

  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoded,
  );

  // Concatenate IV || ciphertext (includes authTag appended by WebCrypto)
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.length);

  return toBase64(combined.buffer);
}

export async function decryptCredential(blob: string): Promise<string> {
  const key = await getKey();

  let combined: Uint8Array;
  try {
    combined = fromBase64(blob);
  } catch {
    throw new Error("Credential decryption failed — invalid ciphertext format");
  }

  if (combined.length <= IV_BYTES) {
    throw new Error("Credential decryption failed — ciphertext too short");
  }

  const iv = combined.slice(0, IV_BYTES);
  const ciphertext = combined.slice(IV_BYTES);

  try {
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      key,
      ciphertext,
    );
    return new TextDecoder().decode(decrypted);
  } catch {
    throw new Error(
      "Credential decryption failed — encryption key may have been rotated",
    );
  }
}

export function sanitizeError(message: string, secrets: string[]): string {
  let safe = message;
  for (const secret of secrets) {
    if (secret) safe = safe.replaceAll(secret, "[REDACTED]");
  }
  return safe;
}
