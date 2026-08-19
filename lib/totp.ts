/**
 * Steam Guard mobile authenticator code generation.
 * HMAC-SHA1 TOTP (RFC 6238 shape, 30s window) rendered through Steam's
 * own 26-character alphabet instead of decimal digits.
 */

const STEAM_GUARD_ALPHABET = "23456789BCDFGHJKMNPQRTVWXY";
const TIME_STEP_SECONDS = 30;
const CODE_LENGTH = 5;

async function importHmacKey(secretBytes: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    secretBytes,
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );
}

/**
 * Generate the current Steam Guard code for a given base64-encoded
 * shared_secret. `unixTimeSec` defaults to now; pass it explicitly in tests.
 */
export async function generateSteamGuardCode(
  sharedSecretB64: string,
  unixTimeSec: number = Date.now() / 1000,
): Promise<string> {
  const secretBytes = new Uint8Array(Buffer.from(sharedSecretB64, "base64"));
  const timeCounter = Math.floor(unixTimeSec / TIME_STEP_SECONDS);

  const timeBuf = new ArrayBuffer(8);
  const timeView = new DataView(timeBuf);
  timeView.setUint32(0, 0, false); // high 32 bits, always 0 for realistic timestamps
  timeView.setUint32(4, timeCounter, false);

  const key = await importHmacKey(secretBytes);
  const hmacBuf = await crypto.subtle.sign("HMAC", key, timeBuf);
  const hmac = new Uint8Array(hmacBuf);

  const offset = hmac[19]! & 0x0f;
  let fullCode =
    ((hmac[offset]! & 0x7f) << 24) |
    ((hmac[offset + 1]! & 0xff) << 16) |
    ((hmac[offset + 2]! & 0xff) << 8) |
    (hmac[offset + 3]! & 0xff);

  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += STEAM_GUARD_ALPHABET[fullCode % STEAM_GUARD_ALPHABET.length];
    fullCode = Math.floor(fullCode / STEAM_GUARD_ALPHABET.length);
  }
  return code;
}
