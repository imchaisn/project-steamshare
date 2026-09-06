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
import { getCachedCode, invalidateCachedCode, setCachedCode } from "./cache.ts";
import { cyberspaceFetch } from "./cyberspace.ts";
import { gamersfantasyFetch, resolveCurrentAccount as resolveGamersfantasyAccount } from "./gamersfantasy.ts";
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
  /**
   * Skip the cache and go to the site for the newest code.
   *
   * For when the buyer has attempted a fresh Steam login and a NEWER code now
   * exists — the cached one is genuinely stale, not merely repeated. This
   * ALWAYS spends a redemption, so it is opt-in per request rather than the
   * default: the cache exists precisely because most repeat presses want the
   * same value they already had.
   */
  forceRefresh: boolean;
}

/**
 * What getCodeForAccount did, alongside what it returned.
 *
 * `hitSite` is the field the ledger depends on: only a real request to the
 * other site spends a redemption, so a cache hit must never be counted. Get
 * this wrong and the remaining-redemption count silently drifts.
 */
export interface CodeLookup {
  result: CodeResult;
  hitSite: boolean;
  site: SupplierSite | null;
  supplierOrderId: string | null;
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
 * Where a code fetch (or a credentials resolve) should target, worked out
 * ONCE and shared by lookupCode and resolveDisplayCredentials below, so the
 * order-mapping-wins-over-account-default rule can't drift between the two.
 */
function resolveSupplierTarget(
  account: CodeSourceAccount,
  orderMapping?: OrderSupplierMapping | null,
): { useSupplier: boolean; site: string | null; supplierOrderId: string | null } {
  const mappedOrderId = orderMapping?.supplierOrderId?.trim() || null;
  const mappedSite = orderMapping?.supplierSite?.trim() || null;
  // The order's mapping is read as ONE UNIT, never field by field — see the
  // long comment on this same rule in lookupCode below.
  const orderHasMapping = mappedSite !== null || mappedOrderId !== null;

  return {
    useSupplier: orderHasMapping || account.code_source === "supplier",
    site: orderHasMapping ? mappedSite : account.supplier_site,
    supplierOrderId: orderHasMapping ? mappedOrderId : account.supplier_order_id,
  };
}

export interface DisplayCredentials {
  username: string;
  password: string;
}

type CredentialResolver = (
  orderId: string,
  signal: AbortSignal,
) => Promise<DisplayCredentials | null>;

/**
 * Only gamersfantasy.my has one: it's the only supplier confirmed to pool
 * several accounts behind one order id (see local/websites/gamersfantasy.my.md
 * — order 2609069D9MXVAP alone has at least 5). cyberspace.cyou has been
 * repeatedly confirmed to hold one stable account per order id, so its
 * stored steam_accounts row is already current — resolving it live would
 * just spend a network round trip to learn what we already know. Add an
 * entry here only when the same pooling behaviour is confirmed elsewhere.
 */
const CREDENTIAL_RESOLVERS: Partial<Record<SupplierSite, CredentialResolver>> = {
  "gamersfantasy.my": resolveGamersfantasyAccount,
};

/**
 * The credentials shown to a buyer BEFORE any code fetch (`/api/lookup`'s
 * `phase: "credentials"`). Returns null when the stored `steam_accounts` row
 * can be trusted as-is — the TOTP path, an unmapped supplier, or a supplier
 * with no resolver above — so the caller's existing fallback to
 * account.username / account.password_enc is exactly right for those.
 *
 * Only resolves for the supplier branch, and only when one exists in
 * CREDENTIAL_RESOLVERS: this closes the gap where a buyer could be SHOWN one
 * pooled account but have the code fetch (which already resolves fresh —
 * see gamersfantasy.ts) target a DIFFERENT one, because the two were
 * resolved at different moments against a pool that can change between them.
 *
 * Costs no redemption: every resolver here calls a free order-lookup action,
 * never the paid code-fetch action.
 */
export async function resolveDisplayCredentials(
  account: CodeSourceAccount,
  orderMapping: OrderSupplierMapping | null | undefined,
  deps: Partial<{
    resolvers: Partial<Record<SupplierSite, CredentialResolver>>;
    supplierEnabled: boolean;
  }> = {},
): Promise<DisplayCredentials | null> {
  const resolvers = deps.resolvers ?? CREDENTIAL_RESOLVERS;
  const supplierEnabled = deps.supplierEnabled ?? supplierEnabledFromEnv();

  const { useSupplier, site, supplierOrderId } = resolveSupplierTarget(account, orderMapping);
  if (!useSupplier || !supplierEnabled) return null;
  if (!isSupplierSite(site) || !supplierOrderId || !supplierOrderId.trim()) return null;

  const resolver = resolvers[site];
  if (!resolver) return null;

  try {
    return await resolver(supplierOrderId.trim(), AbortSignal.timeout(SUPPLIER_TIMEOUT_MS));
  } catch {
    return null;
  }
}

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

/**
 * The detailed form. Returns the code AND whether a redemption was spent.
 * getCodeForAccount() wraps this for callers that only want the code.
 */
export async function lookupCode(
  account: CodeSourceAccount,
  deps: Partial<CodeSourceDeps> = {},
  orderMapping?: OrderSupplierMapping | null,
): Promise<CodeLookup> {
  const decryptFn = deps.decryptFn ?? decrypt;
  const fetchers = deps.fetchers ?? DEFAULT_FETCHERS;
  const supplierEnabled = deps.supplierEnabled ?? supplierEnabledFromEnv();
  const forceRefresh = deps.forceRefresh ?? false;

  // ── 1 & 2. The order mapping if it has one, else the account's default ──
  // A mapped order id is an explicit instruction, so it overrides the
  // account's own configuration — including an account that also happens to
  // hold one of our Guard seeds. Shared with resolveDisplayCredentials below
  // so the two can never resolve to different targets.
  const { useSupplier, site, supplierOrderId } = resolveSupplierTarget(account, orderMapping);

  // ── 3. Our own seed ──
  const miss = (reason: "supplier_error") => ({
    result: { ok: false as const, reason },
    hitSite: false,
    site: null,
    supplierOrderId: null,
  });

  if (!useSupplier) {
    return {
      result: await totpCode(account, decryptFn),
      hitSite: false,
      site: null,
      supplierOrderId: null,
    };
  }

  if (!supplierEnabled) return miss("supplier_error");

  if (!isSupplierSite(site) || !supplierOrderId || !supplierOrderId.trim()) {
    // Either no adapter exists for that site, or the mapping is incomplete.
    // Both are our configuration being wrong, not something the buyer can fix.
    return miss("supplier_error");
  }

  const fetcher = fetchers[site];
  if (!fetcher) return miss("supplier_error");

  const trimmedOrderId = supplierOrderId.trim();

  // Serve a recently fetched code rather than spending another redemption.
  // Safe because the value is a single emailed Guard code, not a rotating
  // TOTP: the site returns the same string on every request until it expires,
  // so a repeat press learns nothing new. See ./cache.ts.
  if (forceRefresh) {
    // The buyer asked for the newest code, so the held value is stale by
    // definition. Drop it before fetching, so a failure cannot leave the old
    // one to be served again.
    invalidateCachedCode(site, trimmedOrderId);
  } else {
    const cached = getCachedCode(site, trimmedOrderId);
    if (cached) {
      return {
        result: { ok: true, code: cached },
        hitSite: false, // no redemption spent
        site,
        supplierOrderId: trimmedOrderId,
      };
    }
  }

  try {
    const result = await fetcher({
      orderId: trimmedOrderId,
      username: account.username,
      signal: AbortSignal.timeout(SUPPLIER_TIMEOUT_MS),
    });
    // ONLY successes are cached. Caching a not-ready would strand a buyer who
    // has just logged in — their next press is exactly when their state
    // changes, and it must reach the site.
    if (result.ok) setCachedCode(site, trimmedOrderId, result.code);
    return { result, hitSite: true, site, supplierOrderId: trimmedOrderId };
  } catch {
    // Belt and braces: each adapter already catches its own failures, but a
    // throw from this layer would be a 500 on the money path. The request did
    // reach the site, so it still counts as a redemption.
    return {
      result: { ok: false, reason: "supplier_error" },
      hitSite: true,
      site,
      supplierOrderId: trimmedOrderId,
    };
  }
}

/** Convenience wrapper for callers that only need the code. */
export async function getCodeForAccount(
  account: CodeSourceAccount,
  deps: Partial<CodeSourceDeps> = {},
  orderMapping?: OrderSupplierMapping | null,
): Promise<CodeResult> {
  return (await lookupCode(account, deps, orderMapping)).result;
}

export type { CodeResult, CodeSourceAccount } from "./types.ts";
