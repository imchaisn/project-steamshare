/**
 * HMAC-SHA-256 cookie signing/verification using the Web Crypto API.
 * Works in both the Edge runtime (middleware) and the Node.js runtime
 * (Route Handlers). No Node-only imports.
 */

export const COOKIE_NAME = "steamshare_auth";
export const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

const enc = new TextEncoder();

function hex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function unhex(str: string): ArrayBuffer {
  const pairs = str.match(/.{2}/g);
  if (!pairs) return new ArrayBuffer(0);
  const arr = new Uint8Array(pairs.map((h) => parseInt(h, 16)));
  return arr.buffer as ArrayBuffer;
}

async function importKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

/** Create a signed cookie value: `v1.<timestamp>.<hmac_hex>` */
export async function signSession(secret: string): Promise<string> {
  const payload = `v1.${Date.now()}`;
  const key = await importKey(secret);
  const sigBuf = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  return `${payload}.${hex(sigBuf)}`;
}

/**
 * Verify a signed cookie value.
 * Returns true if the HMAC is valid. Does not enforce expiry —
 * the 30-day Max-Age on the cookie handles that browser-side.
 */
export async function verifySession(
  value: string,
  secret: string,
): Promise<boolean> {
  const lastDot = value.lastIndexOf(".");
  if (lastDot === -1) return false;

  const payload = value.slice(0, lastDot);
  const sigHex = value.slice(lastDot + 1);

  try {
    const key = await importKey(secret);
    return await crypto.subtle.verify(
      "HMAC",
      key,
      unhex(sigHex),
      enc.encode(payload),
    );
  } catch {
    return false;
  }
}

/** Verify the x-api-secret header for programmatic callers. */
export function verifyApiSecret(headerValue: string | null): boolean {
  const expected = process.env.API_SECRET;
  if (!expected || !headerValue) return false;
  return headerValue === expected;
}
