/**
 * getCodeForAccount — the one entry point app/api/lookup/route.ts calls.
 *
 * Routes an account to its code source. A TOTP account is served offline from
 * its own seed exactly as before; a supplier account is fetched from the
 * portal that holds it.
 *
 * The isolation property this file exists to protect: NOTHING here can make a
 * TOTP lookup touch the network, and no supplier failure — outage, timeout,
 * garbage body, thrown exception — can escape as anything other than a
 * CodeResult. The six accounts serving buyers today cannot be degraded by a
 * third party going down.
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
): Promise<CodeResult> {
  const decryptFn = deps.decryptFn ?? decrypt;
  const fetchers = deps.fetchers ?? DEFAULT_FETCHERS;
  const supplierEnabled = deps.supplierEnabled ?? supplierEnabledFromEnv();

  // Anything that is not exactly 'supplier' takes the TOTP path, so a legacy
  // row written before migration 0011 (code_source null) behaves exactly as
  // it did before this feature existed. Defaulting the other way would break
  // every live account the moment the column appeared.
  if (account.code_source !== "supplier") {
    return totpCode(account, decryptFn);
  }

  if (!supplierEnabled) return { ok: false, reason: "supplier_error" };

  if (!isSupplierSite(account.supplier_site) || !account.supplier_order_id) {
    // Migration 0011's CHECK makes this unreachable through normal writes;
    // an unknown site would also mean we have no adapter for it.
    return { ok: false, reason: "supplier_error" };
  }

  const fetcher = fetchers[account.supplier_site];
  if (!fetcher) return { ok: false, reason: "supplier_error" };

  try {
    return await fetcher({
      orderId: account.supplier_order_id,
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
