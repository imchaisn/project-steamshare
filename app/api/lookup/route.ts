import { NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { verifyShopeeOrder } from "@/lib/shopee";
import { decrypt } from "@/lib/encryption";
import { getCodeForAccount } from "@/lib/code-source";
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
  let body: { username?: string; orderId?: string } = {};
  try {
    body = (await request.json()) as { username?: string; orderId?: string };
  } catch {
    body = {};
  }
  const suppliedUsername = body.username;
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

  if (!suppliedUsername || !orderId) {
    return finish(
      "failure",
      NextResponse.json(
        { error: "orderId and username are required" },
        { status: 400 },
      ),
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

  // The supplied username must match the account this order resolves to.
  // Same generic error as a missing order, so this can't be used to probe
  // which usernames exist. Counted as a failure: repeatedly guessing the
  // username behind a known-good order id IS a brute force.
  if (
    account.username.trim().toLowerCase() !==
    suppliedUsername.trim().toLowerCase()
  ) {
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

  // EVERY check above this line is unchanged, and that ordering is the
  // security property that makes the branch below safe: a third-party
  // supplier is only ever contacted AFTER the caller has proven entitlement
  // — order verified, username matched, account active. By this point there
  // is nothing left to enumerate, so the specific messages returned by
  // failureResponseFor() leak nothing the generic NOT_FOUND was protecting.
  // The order mapping is passed in explicitly: if this GameShare order is
  // connected to another of our websites order id, that link decides where the
  // code comes from. Unmapped orders fall back to the accounts own default.
  const codeResult = await getCodeForAccount(account, {}, {
    supplierSite: verification.supplierSite,
    supplierOrderId: verification.supplierOrderId,
  });

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
    }),
  );
}
