/**
 * The contract every code source satisfies.
 *
 * Until 2026-09-06 there was exactly one way to obtain a Steam Guard code:
 * mint it locally from a shared_secret we own. Some accounts instead live on
 * another of OUR OWN websites, which holds the seed — their code arrives over
 * HTTP. The username and password are identical across our sites; only the
 * order id differs, which is why an order carries the other site's order id. This module is the seam between
 * those two worlds, so app/api/lookup/route.ts contains one branch rather
 * than two parallel flows.
 */
import { generateSteamGuardCode } from "../totp.ts";

export type CodeSource = "totp" | "supplier";
export type SupplierSite = "cyberspace.cyou" | "gamersfantasy.my";

/**
 * Why a code could not be produced.
 *
 *   not_ready      — the supplier has no code yet because nobody has attempted
 *                    the Steam login. This is CORRECT BEHAVIOUR, not a fault:
 *                    the login attempt is what makes Steam email the code in
 *                    the first place. The buyer fixes it by logging in.
 *   expired        — the site issued a code and it timed out.
 *   limit_reached  — the site caps how many times ONE order id may be
 *                    redeemed, and this order has hit that cap. Only a reset
 *                    on their side clears it; waiting does nothing. Observed
 *                    live 2026-09-06 as {"code":"305","title":"REACHED LIMIT"}.
 *   supplier_error — anything else: network, timeout, unparseable body,
 *                    misconfigured account, our own stale data.
 *
 * These three exist because they map to three DIFFERENT things the buyer
 * should do. Collapsing them would send a buyer who needs to log into Steam
 * to Shopee chat instead.
 */
export type CodeFailureReason =
  | "not_ready"
  | "expired"
  | "limit_reached"
  | "supplier_error";

export type CodeResult =
  | { ok: true; code: string }
  | { ok: false; reason: CodeFailureReason };

/** The columns of steam_accounts this layer needs. */
export interface CodeSourceAccount {
  username: string;
  code_source: string | null;
  supplier_site: string | null;
  supplier_order_id: string | null;
  shared_secret_enc: string | null;
}

export type SupplierFetch = (args: {
  orderId: string;
  username: string;
  signal: AbortSignal;
}) => Promise<CodeResult>;

/**
 * How long another of our sites gets to answer.
 *
 * MEASURED, not guessed (2026-09-06, live against a real Ghost of Tsushima
 * order on cyberspace.cyou):
 *
 *   homepage GET (CSRF handshake) :  160-221 ms
 *   POST /guide_code              : 5376-5556 ms   <- the site's own work
 *   TOTAL                         : 5536-5777 ms
 *
 * The endpoint is simply slow — it appears to wait on the Guard email — and
 * the CSRF handshake is a rounding error beside it, which is why the token is
 * still fetched per request rather than cached.
 *
 * This was 5000 ms and it failed EVERY real lookup: the abort fired at 5011 ms,
 * just before the site answered, and the buyer got a 503 while a valid code
 * was in flight. 15000 gave roughly 2.5x the observed worst case.
 *
 * RAISED to 20000 on 2026-09-06 to make room for gamersfantasy.my's not-ready
 * retry window (RETRY_BUDGET_MS in ./gamersfantasy.ts, 15 s) plus one final
 * request/response inside it. Without the extra headroom this abort would fire
 * mid-retry and turn a clear "not ready, log in and try again" into a raw
 * abort surfaced as a generic supplier_error.
 *
 * Must stay comfortably below the route's maxDuration (35 s on
 * app/api/lookup/route.ts) so OUR timeout fires first and the buyer gets our
 * own message rather than a platform error page.
 */
export const SUPPLIER_TIMEOUT_MS = 20000;

const SUPPLIER_SITES: readonly string[] = [
  "cyberspace.cyou",
  "gamersfantasy.my",
];

export function isSupplierSite(value: string | null): value is SupplierSite {
  return value !== null && SUPPLIER_SITES.includes(value);
}

/**
 * The original path, unchanged in behaviour: mint the code offline from the
 * account's own seed. Never touches the network, so no supplier outage can
 * degrade it. This property is why the whole feature is strictly additive to
 * current reliability.
 *
 * `decryptFn` is injected so tests run without ACCOUNTS_ENCRYPTION_KEY.
 */
export async function totpCode(
  account: CodeSourceAccount,
  decryptFn: (ciphertext: string) => Promise<string>,
): Promise<CodeResult> {
  if (!account.shared_secret_enc) {
    // Migration 0011's CHECK constraint makes this unreachable through normal
    // writes. Handled rather than thrown because an unhandled throw is a 500
    // for a buyer who already paid, and a 500 tells them nothing at all.
    return { ok: false, reason: "supplier_error" };
  }
  const sharedSecret = await decryptFn(account.shared_secret_enc);
  return { ok: true, code: await generateSteamGuardCode(sharedSecret) };
}
