/**
 * Shopee Open Platform V2 — authorization, token exchange/refresh, and
 * request signing. Web Crypto API only (same convention as lib/auth.ts) so
 * this runs in both Edge and Node runtimes.
 *
 * Every host, path, param name and sign formula here is sourced verbatim
 * from Shopee's own current docs — see
 * Personal Assistant/research/2026-09-03-shopee-auth-and-push-mechanism-spec.md
 * for the full citations. Where that spec flagged a genuine unresolved
 * ambiguity, it's called out below rather than silently resolved.
 */

import { createAdminClient } from "@/utils/supabase/admin";
import { encrypt, decrypt } from "@/lib/encryption";

const enc = new TextEncoder();

function hex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function hmacSha256Hex(key: string, message: string): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sigBuf = await crypto.subtle.sign("HMAC", cryptoKey, enc.encode(message));
  return hex(sigBuf);
}

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set`);
  return v;
}

const IS_SANDBOX = (process.env.SHOPEE_ENV ?? "sandbox") !== "live";

/**
 * Host for the browser-facing /auth (and /cancel_auth) redirect link.
 *
 * SPEC AMBIGUITY, not resolved here: Shopee's own guide 20 table displays
 * `open.sandbox.test-stable.shopee.com` but the underlying <a href> on that
 * same cell — and the doc's own runnable worked example — uses
 * `open.test-stable.shopee.com` (no `sandbox.`). A *different* Shopee doc
 * (Sandbox Testing V2) uses the other host in ITS worked example. Defaulting
 * to the no-`sandbox.` host below because it's the one Shopee's own runnable
 * example actually uses, but this MUST be confirmed against the real link
 * the Console hands out for this app before relying on it — override via
 * SHOPEE_AUTH_HOST if the Console disagrees.
 */
const AUTH_HOST =
  process.env.SHOPEE_AUTH_HOST ??
  (IS_SANDBOX ? "https://open.test-stable.shopee.com" : "https://open.shopee.com");

/** Token-exchange host — unambiguous across every source checked. */
const TOKEN_HOST = IS_SANDBOX
  ? "https://openplatform.sandbox.test-stable.shopee.sg"
  : "https://partner.shopeemobile.com";

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

/** Public-API sign: partner_id + api_path + timestamp. Used for token exchange/refresh. */
async function signPublic(path: string): Promise<{ timestamp: number; sign: string }> {
  const partnerId = requireEnv("SHOPEE_PARTNER_ID");
  const partnerKey = requireEnv("SHOPEE_PARTNER_KEY");
  const timestamp = nowSeconds();
  const base = `${partnerId}${path}${timestamp}`;
  return { timestamp, sign: await hmacSha256Hex(partnerKey, base) };
}

/**
 * Shop-API sign: partner_id + api_path + timestamp + access_token + shop_id.
 * Every authenticated call AFTER token exchange (Order API, push config,
 * etc.) uses this formula, not signPublic().
 */
export async function signShopRequest(
  path: string,
  accessToken: string,
  shopId: number,
): Promise<{ timestamp: number; sign: string }> {
  const partnerId = requireEnv("SHOPEE_PARTNER_ID");
  const partnerKey = requireEnv("SHOPEE_PARTNER_KEY");
  const timestamp = nowSeconds();
  const base = `${partnerId}${path}${timestamp}${accessToken}${shopId}`;
  return { timestamp, sign: await hmacSha256Hex(partnerKey, base) };
}

/**
 * Build the shop-authorization link a human clicks through in a browser.
 * Current (non-legacy) method — NO sign/timestamp on this URL. (Guide 20
 * ships a legacy code-demo that DOES sign this link via the `redirect`
 * param instead of `redirect_uri` — confirmed legacy by the doc's own
 * cross-reference. Don't use that formula here.)
 */
export function generateAuthUrl(redirectUri: string, state?: string): string {
  const partnerId = requireEnv("SHOPEE_PARTNER_ID");
  const params = new URLSearchParams({
    partner_id: partnerId,
    auth_type: "seller",
    redirect_uri: redirectUri,
    response_type: "code",
  });
  if (state) params.set("state", state);
  return `${AUTH_HOST}/auth?${params.toString()}`;
}

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expire_in: number;
  error?: string;
  message?: string;
}

/** Exchange the one-time `code` (from the auth redirect) for tokens. */
export async function exchangeCodeForToken(
  code: string,
  shopId: number,
): Promise<{ accessToken: string; refreshToken: string; expireIn: number }> {
  const path = "/api/v2/auth/token/get";
  const { timestamp, sign } = await signPublic(path);
  const partnerId = requireEnv("SHOPEE_PARTNER_ID");
  const url = `${TOKEN_HOST}${path}?partner_id=${partnerId}&timestamp=${timestamp}&sign=${sign}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, shop_id: shopId, partner_id: Number(partnerId) }),
  });
  const data = (await res.json()) as TokenResponse;
  if (data.error) {
    throw new Error(`Shopee GetAccessToken failed: ${data.error} — ${data.message}`);
  }
  return { accessToken: data.access_token, refreshToken: data.refresh_token, expireIn: data.expire_in };
}

/** Refresh a shop's access token. The refresh_token is single-use and rotates on every call. */
export async function refreshShopToken(
  refreshToken: string,
  shopId: number,
): Promise<{ accessToken: string; refreshToken: string; expireIn: number }> {
  const path = "/api/v2/auth/access_token/get";
  const { timestamp, sign } = await signPublic(path);
  const partnerId = requireEnv("SHOPEE_PARTNER_ID");
  const url = `${TOKEN_HOST}${path}?partner_id=${partnerId}&timestamp=${timestamp}&sign=${sign}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refreshToken, partner_id: Number(partnerId), shop_id: shopId }),
  });
  const data = (await res.json()) as TokenResponse;
  if (data.error) {
    throw new Error(`Shopee RefreshAccessToken failed: ${data.error} — ${data.message}`);
  }
  return { accessToken: data.access_token, refreshToken: data.refresh_token, expireIn: data.expire_in };
}

/** Persist tokens for a shop, AES-256-GCM encrypted at rest (same as steam_accounts). */
export async function saveShopToken(
  shopId: number,
  accessToken: string,
  refreshToken: string,
  expireInSeconds: number,
): Promise<void> {
  const supabase = createAdminClient();
  const now = Date.now();
  const accessExpiresAt = new Date(now + expireInSeconds * 1000).toISOString();
  // refresh_token validity is fixed at 30 days per spec §1.6, independent of expire_in.
  const refreshExpiresAt = new Date(now + 30 * 24 * 60 * 60 * 1000).toISOString();

  const { error } = await supabase.from("shopee_auth").upsert({
    shop_id: shopId,
    access_token_enc: await encrypt(accessToken),
    refresh_token_enc: await encrypt(refreshToken),
    access_token_expires_at: accessExpiresAt,
    refresh_token_expires_at: refreshExpiresAt,
    updated_at: new Date(now).toISOString(),
  });
  if (error) throw new Error(`Failed to save Shopee token: ${error.message}`);
}

interface StoredShopToken {
  shopId: number;
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: Date;
  refreshTokenExpiresAt: Date;
}

/**
 * Read + decrypt the stored token row. Steamshare runs a single shop today,
 * so with no shopId given this returns the one row on file — pass shopId
 * explicitly if that ever changes.
 */
export async function getStoredShopToken(shopId?: number): Promise<StoredShopToken | null> {
  const supabase = createAdminClient();
  let query = supabase.from("shopee_auth").select("*");
  query = shopId ? query.eq("shop_id", shopId) : query.limit(1);
  const { data, error } = await query.maybeSingle();
  if (error || !data) return null;

  return {
    shopId: data.shop_id,
    accessToken: await decrypt(data.access_token_enc),
    refreshToken: await decrypt(data.refresh_token_enc),
    accessTokenExpiresAt: new Date(data.access_token_expires_at),
    refreshTokenExpiresAt: new Date(data.refresh_token_expires_at),
  };
}

/**
 * Returns a currently-valid access token for shop-scoped API calls,
 * transparently refreshing if it's within 15 minutes of expiry (the
 * access_token window is only 4h, so calls that don't check this will
 * intermittently fail auth for no visible reason).
 *
 * NOTE: refresh_token is single-use and rotates on every refresh call
 * (spec §1.6) — concurrent callers of this function will race and can
 * invalidate each other's refresh. Fine for Steamshare's current traffic;
 * revisit with a lock/single-writer job if refresh calls ever overlap.
 */
export async function getValidAccessToken(shopId?: number): Promise<string> {
  const stored = await getStoredShopToken(shopId);
  if (!stored) {
    throw new Error(
      "No Shopee shop token on file — complete the authorization flow first (see /api/admin/shopee/auth-url).",
    );
  }

  const bufferMs = 15 * 60 * 1000;
  if (stored.accessTokenExpiresAt.getTime() - Date.now() > bufferMs) {
    return stored.accessToken;
  }

  const refreshed = await refreshShopToken(stored.refreshToken, stored.shopId);
  await saveShopToken(stored.shopId, refreshed.accessToken, refreshed.refreshToken, refreshed.expireIn);
  return refreshed.accessToken;
}
