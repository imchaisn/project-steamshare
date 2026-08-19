/**
 * AES-256-GCM encryption for secrets at rest (Steam account passwords,
 * Steam Guard shared_secrets). Web Crypto API only — runs in both
 * Edge and Node runtimes.
 */

function getKeyMaterial(): Uint8Array {
  const b64 = process.env.ACCOUNTS_ENCRYPTION_KEY;
  if (!b64) throw new Error("ACCOUNTS_ENCRYPTION_KEY is not set");
  return Uint8Array.from(Buffer.from(b64, "base64"));
}

async function importKey(): Promise<CryptoKey> {
  const keyMaterial = getKeyMaterial();
  if (keyMaterial.length !== 32) {
    throw new Error("ACCOUNTS_ENCRYPTION_KEY must decode to 32 bytes");
  }
  return crypto.subtle.importKey("raw", keyMaterial, "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ]);
}

const IV_LENGTH = 12; // bytes, standard for AES-GCM

/** Encrypt plaintext. Returns base64(iv || ciphertext). */
export async function encrypt(plaintext: string): Promise<string> {
  const key = await importKey();
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const ciphertextBuf = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(plaintext),
  );
  const combined = new Uint8Array(iv.length + ciphertextBuf.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertextBuf), iv.length);
  return Buffer.from(combined).toString("base64");
}

/** Decrypt a value produced by encrypt(). Throws if tampered or malformed. */
export async function decrypt(ciphertext: string): Promise<string> {
  const key = await importKey();
  const combined = Buffer.from(ciphertext, "base64");
  if (combined.length <= IV_LENGTH) {
    throw new Error("Ciphertext too short to contain an IV");
  }
  const iv = combined.subarray(0, IV_LENGTH);
  const data = combined.subarray(IV_LENGTH);
  const plaintextBuf = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    data,
  );
  return new TextDecoder().decode(plaintextBuf);
}
