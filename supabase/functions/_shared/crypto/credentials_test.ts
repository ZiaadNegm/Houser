import {
  assertEquals,
  assertNotEquals,
  assertRejects,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { decryptCredential, encryptCredential } from "./credentials.ts";

// Generate a random 256-bit key for tests
const testKey = btoa(
  String.fromCharCode(
    ...crypto.getRandomValues(new Uint8Array(32)),
  ),
);

function withKey(
  key: string | undefined,
  fn: () => Promise<void>,
): () => Promise<void> {
  return async () => {
    const original = Deno.env.get("CREDENTIAL_ENCRYPTION_KEY");
    if (key !== undefined) {
      Deno.env.set("CREDENTIAL_ENCRYPTION_KEY", key);
    } else {
      Deno.env.delete("CREDENTIAL_ENCRYPTION_KEY");
    }
    try {
      await fn();
    } finally {
      if (original !== undefined) {
        Deno.env.set("CREDENTIAL_ENCRYPTION_KEY", original);
      } else {
        Deno.env.delete("CREDENTIAL_ENCRYPTION_KEY");
      }
    }
  };
}

// Encrypt then decrypt produces original plaintext
Deno.test(
  "roundtrip — encrypt then decrypt returns original",
  withKey(testKey, async () => {
    const plaintext = JSON.stringify({
      email: "test@example.com",
      password: "hunter2!@#$%^&*()",
    });
    const encrypted = await encryptCredential(plaintext);
    const decrypted = await decryptCredential(encrypted);
    assertEquals(decrypted, plaintext);
  }),
);

// Decrypt with wrong key throws
Deno.test(
  "wrong key — decrypt fails with descriptive error",
  withKey(testKey, async () => {
    const encrypted = await encryptCredential("secret data");

    // Switch to a different key
    const wrongKey = btoa(
      String.fromCharCode(
        ...crypto.getRandomValues(new Uint8Array(32)),
      ),
    );
    Deno.env.set("CREDENTIAL_ENCRYPTION_KEY", wrongKey);

    await assertRejects(
      () => decryptCredential(encrypted),
      Error,
      "encryption key may have been rotated",
    );
  }),
);

// Missing key throws
Deno.test(
  "missing key — encrypt throws",
  withKey(undefined, async () => {
    await assertRejects(
      () => encryptCredential("anything"),
      Error,
      "CREDENTIAL_ENCRYPTION_KEY environment variable is not set",
    );
  }),
);

// Two encryptions of the same plaintext produce different ciphertext (unique IV)
Deno.test(
  "unique IV — same plaintext produces different ciphertext",
  withKey(testKey, async () => {
    const plaintext = "same input twice";
    const a = await encryptCredential(plaintext);
    const b = await encryptCredential(plaintext);
    assertNotEquals(a, b);
  }),
);
