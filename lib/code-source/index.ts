/**
 * getCodeForAccount — the one entry point app/api/lookup/route.ts calls.
 *
 * Resolves where a buyer's Steam Guard code comes from, in this order:
 *
 *   1. THE ORDER MAPPING. All of these websites are ours. If this buyer's
 *      order carries another of our sites plus that site's order id, the code
 *      is fetched from there. The username is identical on both sides, so the
 *      order id is the only thing that has to be carried across. This is the
 *      link Chaison specified, and it is authoritative: an explicit per-order
 *      mapping wins over anything inferred from the account, because there is
 *      nothing to infer and therefore nothing to infer wrongly.
 *
 *   2. THE ACCOUNT DEFAULT. An order with no mapping of its own falls back to
 *      the account's supplier fields. This exists because the automated Shopee
 *      pipeline inserts `orders` rows with no human in the loop
 *      (lib/fulfillment.ts) — without it, every auto-fulfilled order would
 *      arrive unmapped and serve nothing.
 *
 *   3. OUR OWN GUARD SEED. Minted offline, exactly as before.
 *
 * The isolation property this file protects: nothing here can make path 3
 * touch the network, and no supplier failure — outage, timeout, garbage body,
 * thrown exception — escapes as anything other than a CodeResult.
 */
import { decrypt } from "../encryption.ts";
import { cyberspaceFetch } from "./cyberspace.ts";
import { gamersfantasyFetch } from "./gamersfantasy.ts";
import {
  SUPPLIER_TIMEOUT_MS,
  isSupplierSite,
  totpCode,
  type CodeResult,
  type CodeSourceAccount,
  type SupplierFetch,
  type SupplierSite,
} from "./types.ts";

export interface CodeSourceDeps {
  decryptFn: (ciphertext: string) => Promise<string>;
  fetchers: Record<SupplierSite, SupplierFetch>;
  supplierEnabled: boolean;
}

/**
 * The per-order link: our order id -> (another of our sites, its order id).
 * Comes straight off the `orders` row via verifyShopeeOrder().
 */
export interface OrderSupplierMapping {
  supplierSite: string | null;
  supplierOrderId: string | null;
}

const DEFAULT_FETCHERS: Record<SupplierSite, SupplierFetch> = {
  "cyberspace.cyou": cyberspaceFetch,
  "gamersfantasy.my": gamersfantasyFetch,
};

/**
 * The kill switch. Read per request rather than at module load so the value
 * is not frozen into a warm lambda.
 *
 * NOTE (CHECKPOINT.md, "Turning auto-fulfilment OFF"): Vercel bakes env vars
 * into a deployment, so changing this in the dashboard is NOT sufficient on
 * its own — a redeploy is also required, or the running deployment keeps the
 * old value while the dashboard shows the new one.
 */
function supplierEnabledFromEnv(): boolean {
  return process.env.SUPPLIER_CODE_SOURCE === "true";
}

export async function getCodeForAccount(
  account: CodeSourceAccount,
  deps: Partial<CodeSourceDeps> = {},
  orderMapping?: OrderSupplierMapping | null,
): Promise<CodeResult> {
  const decryptFn = deps.decryptFn ?? decrypt;
  const fetchers = deps.fetchers ?? DEFAULT_FETCHERS;
  const supplierEnabled = deps.supplierEnabled ?? supplierEnabledFromEnv();

  // ── 1. The order mapping, if this order has one ──
  // A mapped order id is an explicit instruction, so it overrides the
  // account's own configuration — including an account that also happens to
  // hold one of our Guard seeds.
  const mappedOrderId = orderMapping?.supplierOrderId?.trim() || null;
  const mappedSite = orderMapping?.supplierSite?.trim() || null;

  // ── 2. Otherwise the account's default ──
  const site = mappedSite ?? account.supplier_site;
  const supplierOrderId = mappedOrderId ?? account.supplier_order_id;

  // An order carrying a mapping is a supplier lookup whatever the account says.
  const useSupplier =
    mappedOrderId !== null || account.code_source === "supplier";

  // ── 3. Our own seed ──
  if (!useSupplier) {
    return totpCode(account, decryptFn);
  }

  if (!supplierEnabled) return { ok: false, reason: "supplier_error" };

  if (!isSupplierSite(site) || !supplierOrderId || !supplierOrderId.trim()) {
    // Either no adapter exists for that site, or the mapping is incomplete.
    // Both are our configuration being wrong, not something the buyer can fix.
    return { ok: false, reason: "supplier_error" };
  }

  const fetcher = fetchers[site];
  if (!fetcher) return { ok: false, reason: "supplier_error" };

  try {
    return await fetcher({
      orderId: supplierOrderId.trim(),
      username: account.username,
      signal: AbortSignal.timeout(SUPPLIER_TIMEOUT_MS),
    });
  } catch {
    // Belt and braces: each adapter already catches its own failures, but a
    // throw from this layer would be a 500 on the money path.
    return { ok: false, reason: "supplier_error" };
  }
}

export type { CodeResult, CodeSourceAccount } from "./types.ts";
