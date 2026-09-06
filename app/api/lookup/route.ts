import { NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { verifyShopeeOrder } from "@/lib/shopee";
import { decrypt } from "@/lib/encryption";
import { lookupCode } from "@/lib/code-source";
import { logSupplierFetch } from "@/lib/code-source/log";
import { failureResponseFor } from "@/lib/code-source/outcome";
import {
  checkRateLimit,
  getClientIp,
  isRateLimitExempt,
  recordLookupAttempt,
  type LookupOutcome,
} from "@/lib/rate-limit";

/**
 * A lookup that goes to one of our other websites takes ~5.5 s there (measured
 * 2026-09-06), plus our own DB reads. The platform default would kill the
 * function mid-flight and return ITS error page, losing both the buyer-facing
 * message and the rate-limit outcome we record. 30 s leaves SUPPLIER_TIMEOUT_MS
 * (15 s) room to fire first, so every failure is still one we shaped.
 *
 * Costs nothing on the common path: a code minted from our own Guard seed
 * never touches the network and returns in milliseconds.
 */
export const maxDuration = 30;

/** Same generic message for every non-resolving lookup, so it can't be used to probe. */
const NOT_FOUND = "Order not found or not verified";

export async function POST(request: Request) {
  const ip = getClientIp(request);
  // Admin/programmatic callers holding API_SECRET skip the limiter entirely
  // and leave no counters behind. See lib/rate-limit.ts, escape hatch #1.
  const exempt = isRateLimitExempt(request);

  // Parse the body BEFORE the limiter, so the order id can be used as the
  // primary rate-limit key. A malformed body simply yields no order key and
  // is limited on IP alone.
  let body: { orderId?: string; refresh?: boolean } = {};
  try {
    body = (await request.json()) as { orderId?: string; refresh?: boolean };
  } catch {
    body = {};
  }
  const orderId = body.orderId;

  /** Record this attempt's outcome, then return the response. */
  const finish = async (outcome: LookupOutcome, response: NextResponse) => {
    if (!exempt) await recordLookupAttempt({ ip, orderId, outcome });
    return response;
  };

  if (!exempt) {
    const rateLimit = await checkRateLimit({ ip, orderId });
    if (!rateLimit.allowed) {
      const message =
        rateLimit.limitedBy === "order"
          ? "Too many lookups for this order. Please wait a few minutes and try again, or contact support."
          : "Too many attempts from your network. Please wait a few minutes and try again, or contact support.";
      return finish(
        "blocked",
        NextResponse.json(
          { error: message },
          {
            status: 429,
            headers: {
              "Retry-After": String(rateLimit.retryAfterSeconds ?? 60),
            },
          },
        ),
      );
    }
  }

  if (!orderId) {
    return finish(
      "failure",
      NextResponse.json({ error: "orderId is required" }, { status: 400 }),
    );
  }

  const verification = await verifyShopeeOrder(orderId);
  if (!verification.verified || !verification.accountGameId) {
    return finish(
      "failure",
      NextResponse.json({ error: NOT_FOUND }, { status: 404 }),
    );
  }

  const supabase = createAdminClient();
  const { data: accountGame, error: agError } = await supabase
    .from("account_games")
    .select("account_id")
    .eq("id", verification.accountGameId)
    .maybeSingle();

  if (agError || !accountGame) {
    return finish(
      "failure",
      NextResponse.json({ error: NOT_FOUND }, { status: 404 }),
    );
  }

  const { data: account, error: accountError } = await supabase
    .from("steam_accounts")
    .select(
      "id, username, password_enc, shared_secret_enc, status, code_source, supplier_site, supplier_order_id",
    )
    .eq("id", accountGame.account_id)
    .maybeSingle();

  if (accountError || !account) {
    return finish(
      "failure",
      NextResponse.json({ error: NOT_FOUND }, { status: 404 }),
    );
  }

  if (account.status !== "active") {
    // The order is genuine — this buyer is hitting an ops problem, not
    // enumerating. Recorded at the light weight.
    return finish(
      "unavailable",
      NextResponse.json(
        { error: "Account temporarily unavailable, contact support" },
        { status: 403 },
      ),
    );
  }

  // Chaison's call, 2026-09-06: the lookup is now order-id-only. Until this
  // point a supplied username had to match the account before a supplier was
  // ever contacted — that check is now GONE. Knowing (or guessing) a GameShare
  // order id alone is sufficient to pull that account's password and code;
  // nothing here still requires proof the caller is the actual buyer.
  // Order verified + account active still gate the branch below, so it isn't
  // fully open — but the specific messages from failureResponseFor() below
  // are no longer protected from anyone who has an order id, only from
  // someone with neither. The order mapping is passed in explicitly: if this GameShare order is
  // connected to another of our websites order id, that link decides where the
  // code comes from. Unmapped orders fall back to the accounts own default.
  //
  // `refresh` is the buyer saying "I logged in again, give me the NEWEST code".
  // It bypasses the cache and therefore always spends a redemption, which is
  // why it is opt-in: an ordinary press should be free when the value has not
  // changed. See lib/code-source/cache.ts.
  const lookup = await lookupCode(
    account,
    { forceRefresh: body.refresh === true },
    {
      supplierSite: verification.supplierSite,
      supplierOrderId: verification.supplierOrderId,
    },
  );
  const codeResult = lookup.result;

  // Ledger: one row per REAL request to the other site. A cache hit is not
  // recorded, because it spent nothing — counting it would hide how many
  // redemptions an order has left. Never throws; the buyer already has their
  // code by this point.
  let ledger: { changed: boolean | null; spent: number | null } = {
    changed: null,
    spent: null,
  };
  if (lookup.hitSite && lookup.site && lookup.supplierOrderId) {
    ledger = await logSupplierFetch({
      orderId: verification.orderId,
      supplierSite: lookup.site,
      supplierOrderId: lookup.supplierOrderId,
      result: codeResult,
    });
  }

  if (!codeResult.ok) {
    // Never "failure": see lib/code-source/outcome.ts. Recording these at the
    // heavy weight would lock a waiting buyer out after six retries.
    const { outcome, status, error } = failureResponseFor(codeResult.reason);
    return finish(outcome, NextResponse.json({ error }, { status }));
  }

  // Decrypted only once a code is actually in hand, so a supplier outage does
  // not needlessly decrypt a credential we are not about to serve.
  const password = await decrypt(account.password_enc);

  await supabase.from("code_access_log").insert({
    order_id: verification.orderId,
    ip,
  });

  return finish(
    "success",
    NextResponse.json({
      username: account.username,
      password,
      code: codeResult.code,
      // Whether this differs from the last code we served for this order, so
      // the page can tell a buyer "this is the same code as before" rather
      // than leaving them wondering why nothing looks new. Null when the code
      // came from cache or is not from another of our sites.
      codeChanged: ledger.changed,
    }),
  );
}
