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
 *   expired        — the supplier issued a code and it timed out.
 *   supplier_error — anything else: network, timeout, unparseable body,
 *                    misconfigured account, our own stale data.
 *
 * These three exist because they map to three DIFFERENT things the buyer
 * should do. Collapsing them would send a buyer who needs to log into Steam
 * to Shopee chat instead.
 */
export type CodeFailureReason = "not_ready" | "expired" | "supplier_error";

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
 * A supplier portal gets 5 seconds. A buyer is waiting and Vercel bills wall
 * time, so a hanging third party must not hold the request open — it fails
 * fast into supplier_error instead.
 */
export const SUPPLIER_TIMEOUT_MS = 5000;

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
