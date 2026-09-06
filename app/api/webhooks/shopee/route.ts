import { NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";
import {
  ShopeeApiError,
  describePaymentState,
  getOrderDetail,
  type ShopeeOrderDetail,
} from "@/lib/shopee-api";
import {
  AUTOMATED_ORDER_SOURCE,
  buildDeliveryMessage,
  fulfillOrder,
  type FulfilledGame,
} from "@/lib/fulfillment";
import { sendBuyerMessage } from "@/lib/shopee-chat";
import { shipOrder } from "@/lib/shopee-logistics";
// PRE-0014 FALLBACK — remove with lib/order-games-compat.ts once 0014 is applied.
import { isMissingOrderGames, warnLegacyMode } from "@/lib/order-games-compat";

/**
 * Shopee Push Mechanism (webhook) receiver. Public route — Shopee calls
 * this directly, with no session cookie and no x-api-secret. Auth is
 * Shopee's own per-request signature (§2.5 of the spec below), a DIFFERENT
 * mechanism from this app's authorized() helper — do not reuse it here.
 * See proxy.ts PUBLIC_PREFIXES.
 *
 * Spec source: Personal Assistant/research/2026-09-03-shopee-auth-and-push-mechanism-spec.md
 *
 * WHAT THIS ROUTE DOES, IN ORDER:
 *   1. Read the RAW body (the HMAC is over exact bytes — never re-serialize).
 *   2. Verify Shopee's signature.
 *   3. Log EVERY push to shopee_push_log, valid or not, BEFORE anything
 *      else. Shopee does not redeliver notifications missed while a
 *      subscription is disabled (spec §2.7), so that table — not this
 *      function's return value — is the reconciliation record of record.
 *   4. 401 on a bad signature.
 *   5. Auto-fulfilment (guarded, see autoFulfillEnabled() below):
 *      get_order_detail -> confirm paid -> fulfillOrder() -> chat the buyer
 *      -> mark it Shipped on Shopee's own side (guarded separately, see
 *      autoShipEnabled() — until this call exists an auto-fulfilled order
 *      sits in READY_TO_SHIP forever and risks Shopee auto-cancelling it for
 *      non-shipment, refunding a buyer who already has working credentials;
 *      see lib/shopee-logistics.ts for the sourced reasoning).
 *   6. 2xx with an EMPTY body on success, or Shopee retries (spec §2.6).
 *
 * The order-status enum this route once refused to guess is no longer
 * guessed here: lib/shopee-api.ts sources it and classifies with
 * describePaymentState(), which requires BOTH a recognised post-payment
 * status AND a pay_time before it will say "paid". An unrecognised status
 * comes back as "unknown_status" and is escalated, never optimistically
 * treated as paid. Read that module's comments before touching this one.
 */

/* ------------------------------------------------------------------------ */
/* Signature verification (unchanged — do not "simplify" this)               */
/* ------------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------------ */
/* THE RETRY DECISION — the most important design call in this file          */
/* ------------------------------------------------------------------------ */

/**
 * Shopee retries a push it considers failed at 300s / 1800s / 10800s, then
 * gives up. So the status code we return is not cosmetic: it is the only
 * automatic second chance this pipeline has, and it is also the only way to
 * cause a retry STORM. The rule we settled on:
 *
 *   ACK (2xx) whenever the order has been RECORDED, or whenever a retry
 *   provably cannot change the outcome.
 *
 *   NACK (5xx) only when we failed BEFORE writing an `orders` row AND an
 *   identical attempt later could plausibly succeed.
 *
 * Applied case by case:
 *
 *   - Fulfilment succeeded, chat send failed  -> ACK. The buyer's row exists
 *     and they can already redeem at gameshare.space with their Shopee Order
 *     ID; the un-sent message is recorded in order_games.delivery_error and
 *     that game line stays visible to the reconciliation query (delivered_at
 *     is null). Re-running the whole push to retry a chat message would
 *     re-drive Shopee API calls for an order that is already fulfilled — all
 *     cost, no benefit. THIS IS THE CASE REVIEWERS SHOULD CHECK FIRST.
 *   - no_mapping / no_capacity                -> ACK. Expected business
 *     outcomes, not crashes. A retry in five minutes cannot invent a
 *     shopee_listings row or an active Steam account; only a human can. They
 *     are console.error'd with an ACTION REQUIRED marker so they surface in
 *     Vercel logs, and shopee_push_log holds the raw payload for replay.
 *   - partial (multi-game, some served)       -> ACK, AND STILL SHIP. Some
 *     line items mapped and some did not, or a mapped game had no active
 *     account. Chaison's call 2026-09-06: deliver what we can rather than
 *     hold the whole order. A retry cannot fix the gap for the same reason
 *     no_mapping cannot, and NOT shipping would risk Shopee auto-cancelling
 *     an order whose buyer already holds working credentials for the games
 *     that DID land. Logged as ACTION REQUIRED with the exact gap.
 *   - Order not paid (UNPAID / PENDING / CANCELLED) -> ACK. Normal, not an
 *     error. Shopee sends a fresh push when the status changes; an unpaid
 *     order is not something to retry into.
 *   - Unrecognised order_status               -> NACK. Nothing was recorded,
 *     and this covers two recoverable shapes: a status that will settle on
 *     its own, and a recognised paid status whose pay_time had not yet been
 *     written. Bounded at three retries, and loudly logged either way.
 *   - get_order_detail failed (ANY kind)      -> NACK. Nothing was recorded.
 *     network/http/auth/not_found are all plausibly transient (a token
 *     re-authorization, or an order-propagation delay, resolves inside the
 *     retry window). "malformed" almost certainly is NOT transient and will
 *     fail identically three times — but we NACK it anyway, deliberately,
 *     because the asymmetry is one-sided: three redundant retries cost
 *     noise, whereas ACKing a lookup failure silently drops a PAID order,
 *     leaving a buyer with no `orders` row and therefore no way to redeem at
 *     all. We take the noisy side.
 *   - fulfillOrder() threw                    -> NACK. Database unreachable,
 *     or migration 0005's unique index missing. No row was written, so a
 *     retry after the migration lands is exactly what we want.
 *   - Delivery bookkeeping threw              -> ACK. The row exists; a
 *     failed status write must never trigger a retry storm.
 */
type PushOutcome = {
  /** true => 2xx empty body. false => 5xx, inviting Shopee's retry schedule. */
  ack: boolean;
  /** Short operator-facing reason. Logged; never contains a credential. */
  note: string;
};

/* ------------------------------------------------------------------------ */
/* Kill switch                                                               */
/* ------------------------------------------------------------------------ */

/**
 * Auto-fulfilment is OFF unless SHOPEE_AUTO_FULFILL is exactly "true".
 *
 * The schema this write path needs — 0005 (single-column unique index on
 * orders.shopee_order_id, without which the `ON CONFLICT` target is rejected
 * by Postgres as 42P10) and 0007/0008 (shopee_listings, plus buyer_username /
 * source / delivered_at / delivery_error / delivery_attempts) — was APPLIED
 * to production on 2026-09-05 and verified. The flag was turned ON the same
 * day, after the full pipeline had been proven end to end against a real
 * order.
 *
 * The switch remains because it is the difference between "an order is
 * recorded and a buyer is messaged automatically" and "a push is logged and a
 * human decides". With it off, an inbound push is verified, written to
 * shopee_push_log, and answered 200 — nothing is allocated, nothing is sent.
 * That is the state to return to if automated delivery ever starts doing the
 * wrong thing.
 *
 * Read per-request rather than at module scope. That is still worth doing —
 * it means no module-level cache has to be busted — but an earlier version of
 * this comment claimed it lets you flip the flag "without a redeploy", and
 * that is WRONG ON VERCEL and dangerous to believe in an incident.
 *
 * Vercel bakes environment variables into a deployment. Changing
 * SHOPEE_AUTO_FULFILL in the dashboard or via `vercel env` does NOT affect
 * the deployment already serving traffic. Someone trying to stop automated
 * fulfilment in a hurry would change the variable, see it updated, and still
 * be auto-delivering.
 *
 * TO ACTUALLY TURN AUTO-FULFILMENT OFF, both steps are required:
 *   1. vercel env rm SHOPEE_AUTO_FULFILL production --yes
 *      printf false | vercel env add SHOPEE_AUTO_FULFILL production
 *   2. vercel redeploy <current production url> --scope <team>
 * Then confirm: a signed push carrying an ordersn should answer 200 (logged,
 * not fulfilled) rather than 500.
 *
 * The FASTEST kill, if a redeploy is too slow or is failing, is to revoke the
 * shop authorization in the Shopee Console (App List -> Unlink). Without a
 * token, get_order_detail cannot succeed and nothing can be fulfilled or
 * delivered — at the cost of having to re-authorize afterwards.
 */
function autoFulfillEnabled(): boolean {
  return process.env.SHOPEE_AUTO_FULFILL === "true";
}

/**
 * A second, narrower kill switch for the "mark it Shipped on Shopee" step —
 * deliberately independent of SHOPEE_AUTO_FULFILL rather than folded into it.
 *
 * Reason: SHOPEE_AUTO_FULFILL already has a live, proven track record (an
 * `orders` row + a chat message, both idempotent and both exercised against
 * real orders since 2026-09-05). The ship_order call added alongside it is
 * new, and lib/shopee-logistics.ts documents two real unknowns — the exact
 * `tracking_number` value Shopee expects for a listing with no real carrier,
 * and whether `v2.logistics.get_shipping_parameter` would have demanded a
 * different shape (skipped deliberately, see that module's docblock). A
 * wrong guess here does not touch the money path (the buyer already has
 * their orders row and their credentials either way) — worst case is a
 * ship_order call that Shopee rejects, which is exactly what ship_error
 * surfaces. Splitting the switch means Chaison can keep delivery running
 * uninterrupted while turning shipping on for a single test order first.
 *
 * OFF by default, same Vercel-bakes-env-vars caveat as SHOPEE_AUTO_FULFILL
 * applies: flipping this in the dashboard needs a redeploy to actually take
 * effect on the deployment serving traffic.
 */
function autoShipEnabled(): boolean {
  return process.env.SHOPEE_AUTO_SHIP === "true";
}

/* ------------------------------------------------------------------------ */
/* Delivery — the exactly-once-per-order chat message                        */
/* ------------------------------------------------------------------------ */

type AdminClient = ReturnType<typeof createAdminClient>;

interface DeliveryInput {
  /** `order_games.id` — the latch lives on the GAME line, not the order. */
  orderGameId: string;
  orderRowId: string;
  orderSn: string;
  shopId?: number;
  gameTitle: string | null;
  steamUsername: string | null;
  /**
   * DECRYPTED account password, included in the buyer's message per the
   * 2026-09-05 decision (see buildDeliveryMessage in lib/fulfillment.ts).
   * Null-tolerant on purpose: no password means a message without one, never
   * a skipped delivery.
   */
  steamPassword: string | null;
  /**
   * The buyer's Shopee user id, which is the chat `to_id`. Comes straight
   * from get_order_detail. Null means we cannot address a chat message at
   * all — the order is still fulfilled and the buyer can still redeem.
   */
  buyerUserId: number | null;
}

/**
 * Send the buyer the delivery message FOR ONE GAME, at most once, ever.
 *
 * ── WHY THE LATCH IS PER-GAME ─────────────────────────────────────────────
 * Chaison's call, 2026-09-06: a multi-game order gets ONE MESSAGE PER GAME,
 * not one message listing them all. That decision is what forces the latch
 * onto `order_games.delivered_at` (migration 0014) instead of
 * `orders.delivered_at`. With a single order-level latch, the first game to
 * send would claim it and the remaining three would find it non-null and
 * silently skip — a four-game buyer would receive exactly one message. The
 * per-game latch also means one game's failed send cannot block the others:
 * each claims, sends, and keeps-or-releases independently.
 *
 * lib/shopee-chat.ts is explicitly stateless — "call it twice and it sends
 * twice" — so the exactly-once guarantee has to live here, and it has to be
 * enforced by the DATABASE, not by an in-process check: two Shopee retries
 * can be in flight in two different serverless instances at the same time.
 *
 * The protocol is unchanged, CLAIM -> SEND -> KEEP-OR-RELEASE:
 *
 *   1. Claim this game's delivery slot with a conditional update
 *      (`... where id = $1 and delivered_at is null`). Postgres serialises
 *      the two updates, so of two concurrent callers exactly one matches a
 *      row; the loser gets zero rows back and sends nothing. This is the
 *      whole idempotency guarantee for the message — do NOT replace it with
 *      a read-then-write, which races.
 *   2. Send.
 *   3. On success, or on an AMBIGUOUS failure (the send may have landed —
 *      lib/shopee-chat.ts sets `ambiguous` for client timeouts and HTTP 5xx),
 *      KEEP the latch so nothing ever auto-resends. A possibly-duplicate
 *      message is the worse outcome here, because the buyer can always
 *      redeem at gameshare.space with the Order ID they already have.
 *   4. On a PROVEN failure (nothing was delivered), RELEASE the latch back
 *      to null and record why in delivery_error. The row then reappears in
 *      0014's `order_games_undelivered_idx` (predicate: `delivered_at is
 *      null`) for a later reconciliation job or a manual resend.
 *
 * delivery_attempts is incremented read-then-write and so is APPROXIMATE
 * under concurrency. That is fine: it is a diagnostic counter, not the
 * latch. The latch is the `delivered_at is null` predicate in step 1.
 *
 * The `orders.source` gate still reads the ORDER, not the game line: whether
 * a human owns communication with this buyer is a property of the order.
 *
 * Never throws — the caller has already recorded the order, and a delivery
 * bookkeeping problem must not escalate into a Shopee retry.
 */
async function deliverGameOnce(
  supabase: AdminClient,
  {
    orderGameId,
    orderRowId,
    orderSn,
    shopId,
    gameTitle,
    steamUsername,
    steamPassword,
    buyerUserId,
  }: DeliveryInput,
): Promise<void> {
  // PRE-0014 FALLBACK: with no order_games table, the latch lives on `orders`
  // exactly as it did before, and the game handle IS the order row id.
  const legacyMode = orderGameId === orderRowId;
  const latchTable = legacyMode ? "orders" : "order_games";

  const [{ data: gameRow, error: gameError }, { data: orderRow, error: orderError }] =
    await Promise.all([
      supabase
        .from(latchTable)
        .select("id, delivered_at, delivery_attempts")
        .eq("id", orderGameId)
        .maybeSingle(),
      supabase.from("orders").select("id, source").eq("id", orderRowId).maybeSingle(),
    ]);

  if (gameError && isMissingOrderGames(gameError)) {
    warnLegacyMode("deliverGameOnce");
  }

  if (gameError || !gameRow || orderError || !orderRow) {
    console.error(
      `[shopee-webhook] could not read order_games row ${orderGameId} for ordersn=${orderSn} ` +
        `to decide on delivery: ${gameError?.message ?? orderError?.message ?? "row not found"}. ` +
        `The order IS recorded; only the chat message is affected.`,
    );
    return;
  }

  const game = gameRow as {
    id: string;
    delivered_at: string | null;
    delivery_attempts: number | null;
  };
  const order = orderRow as { id: string; source: string | null };

  if (game.delivered_at !== null) {
    // Either a previous push already delivered this game, or a previous
    // attempt was ambiguous and deliberately latched. Both mean "do not send
    // again".
    console.info(
      `[shopee-webhook] ordersn=${orderSn} game ${orderGameId} already has delivered_at set; ` +
        `not re-sending.`,
    );
    return;
  }

  if (order.source !== AUTOMATED_ORDER_SOURCE) {
    // A row an admin created by hand (orders.source defaults to 'manual').
    // The admin owns communication with that buyer and may already have
    // messaged them, so an automated message here would be a surprise
    // duplicate. Left deliberately un-latched so a human can still send.
    console.info(
      `[shopee-webhook] ordersn=${orderSn} resolves to a non-automated orders row ` +
        `(source=${order.source ?? "null"}); leaving buyer communication to the admin.`,
    );
    return;
  }

  if (!gameTitle || !steamUsername) {
    // buildDeliveryMessage takes plain strings on purpose: a message reading
    // "[Auto Delivery] null" must never reach a buyer. Record the gap
    // instead, and leave delivered_at null so it stays on the retry list.
    const missing = [!gameTitle ? "game title" : null, !steamUsername ? "steam username" : null]
      .filter(Boolean)
      .join(" and ");
    const detail =
      `Cannot build the delivery message for ordersn=${orderSn} game ${orderGameId}: ${missing} ` +
      `could not be resolved from the allocated account_games row. Fix the account/game data, ` +
      `then resend.`;
    console.error(`[shopee-webhook] ACTION REQUIRED — ${detail}`);
    await recordDeliveryError(supabase, orderGameId, detail, latchTable);
    return;
  }

  // ── 1. Claim ────────────────────────────────────────────────────────────
  const { data: claimed, error: claimError } = await supabase
    .from(latchTable)
    .update({
      delivered_at: new Date().toISOString(),
      delivery_attempts: (game.delivery_attempts ?? 0) + 1,
      delivery_error: null,
    })
    .eq("id", orderGameId)
    .is("delivered_at", null)
    .select("id");

  if (claimError) {
    console.error(
      `[shopee-webhook] failed to claim the delivery slot for ordersn=${orderSn} ` +
        `game ${orderGameId}: ${claimError.message}. Not sending — an unclaimed send ` +
        `could duplicate.`,
    );
    return;
  }
  if (!claimed || claimed.length === 0) {
    console.info(
      `[shopee-webhook] delivery slot for ordersn=${orderSn} game ${orderGameId} was claimed ` +
        `by a concurrent push; not sending.`,
    );
    return;
  }

  // ── 2. Send ─────────────────────────────────────────────────────────────
  const text = buildDeliveryMessage({ gameTitle, orderSn, steamUsername, steamPassword });
  // buyerUserId ?? undefined, not `?? 0`: sendBuyerMessage treats a missing id
  // as "fall back to the conversation lookup and fail with an actionable
  // message", whereas a 0 would be sent to Shopee and bounce as
  // "invalid_to_id", which reads like a bug in our signing rather than a
  // missing optional field.
  const result = await sendBuyerMessage({
    orderSn,
    text,
    shopId,
    buyerUserId: buyerUserId ?? undefined,
  });

  // ── 3 / 4. Keep or release the latch ────────────────────────────────────
  if (result.sent) {
    console.info(
      `[shopee-webhook] ordersn=${orderSn} game ${orderGameId} (${gameTitle}) delivered: ` +
        `${result.detail}`,
    );
    return;
  }

  if (result.ambiguous) {
    console.error(
      `[shopee-webhook] ordersn=${orderSn} game ${orderGameId} delivery AMBIGUOUS — latch KEPT, ` +
        `no auto-resend. A human should check the Shopee chat thread before resending. ` +
        `${result.detail}`,
    );
    await recordDeliveryError(supabase, orderGameId, result.detail, latchTable);
    return;
  }

  console.error(
    `[shopee-webhook] ordersn=${orderSn} game ${orderGameId} delivery failed (proven not sent) — ` +
      `releasing the latch so it can be resent. ${result.detail}`,
  );
  const { error: releaseError } = await supabase
    .from(latchTable)
    .update({ delivered_at: null, delivery_error: result.detail })
    .eq("id", orderGameId);

  if (releaseError) {
    console.error(
      `[shopee-webhook] ordersn=${orderSn} game ${orderGameId} was NOT delivered and the latch ` +
        `could not be released: ${releaseError.message}. This row will look delivered but is ` +
        `not — clear order_games.delivered_at by hand.`,
    );
  }
}

/**
 * Send every game on this order its own message, in display order.
 *
 * SEQUENTIAL, not Promise.all. Shopee's seller-chat endpoint is a rate-limited
 * third-party API and four simultaneous sends to one buyer is exactly the
 * shape that earns a 429 — which would arrive as an ambiguous failure and
 * latch three games as "possibly delivered" when nothing was sent. Four
 * sequential sends cost a little latency on a path that has already ACKed
 * nothing yet; a wrongly-latched game costs a buyer their credentials.
 *
 * Each game is independent: one failure does not stop the rest.
 */
async function deliverOrderGames(
  supabase: AdminClient,
  games: FulfilledGame[],
  common: Omit<
    DeliveryInput,
    "orderGameId" | "gameTitle" | "steamUsername" | "steamPassword"
  >,
): Promise<void> {
  for (const game of games) {
    await deliverGameOnce(supabase, {
      ...common,
      orderGameId: game.orderGameId,
      gameTitle: game.gameTitle,
      steamUsername: game.steamUsername,
      steamPassword: game.steamPassword,
    });
  }
}

/**
 * Record why delivery did not happen for ONE GAME, without touching the latch.
 * `detail` comes from lib/shopee-chat.ts, which pre-redacts credentials.
 */
async function recordDeliveryError(
  supabase: AdminClient,
  orderGameId: string,
  detail: string,
  table: "orders" | "order_games" = "order_games",
): Promise<void> {
  const { error } = await supabase
    .from(table)
    .update({ delivery_error: detail })
    .eq("id", orderGameId);

  if (error) {
    console.error(
      `[shopee-webhook] could not write delivery_error for order_games row ${orderGameId}: ${error.message}`,
    );
  }
}

/* ------------------------------------------------------------------------ */
/* Shipping — marking the order Shipped on Shopee's side, at most once      */
/* ------------------------------------------------------------------------ */

/**
 * Mark this order Shipped on Shopee at most once, ever.
 *
 * Same CLAIM -> CALL -> KEEP-OR-RELEASE protocol as deliverOnce() above, on
 * the new `orders.shipped_at` column from 0010_orders_auto_ship.sql, and for
 * the identical reason: two Shopee push retries can be in flight in two
 * different serverless instances at once, so the exactly-once guarantee has
 * to be enforced by the database, not by an in-process check.
 *
 * Independent of delivery: this runs even if the chat message failed to
 * send, because the buyer having credentials or not has no bearing on
 * whether Shopee thinks this order still needs shipping. It is gated
 * separately by requiring `orders.source = AUTOMATED_ORDER_SOURCE` (same
 * rule deliverOnce follows) so a human-created order is never touched.
 *
 * Never throws — the order and the delivery are already recorded; a shipping
 * bookkeeping problem must not escalate into a Shopee retry storm.
 */
async function shipOnce(
  supabase: AdminClient,
  { orderRowId, orderSn, shopId }: { orderRowId: string; orderSn: string; shopId?: number },
): Promise<void> {
  const { data: row, error: readError } = await supabase
    .from("orders")
    .select("id, source, shipped_at, ship_attempts")
    .eq("id", orderRowId)
    .maybeSingle();

  if (readError || !row) {
    console.error(
      `[shopee-webhook] could not read orders row ${orderRowId} for ordersn=${orderSn} ` +
        `to decide on shipping: ${readError?.message ?? "row not found"}. ` +
        `The order IS recorded and delivered; only the Shopee-side ship status is affected.`,
    );
    return;
  }

  const order = row as {
    id: string;
    source: string | null;
    shipped_at: string | null;
    ship_attempts: number | null;
  };

  if (order.shipped_at !== null) {
    console.info(
      `[shopee-webhook] ordersn=${orderSn} already has shipped_at set; not calling ship_order again.`,
    );
    return;
  }

  if (order.source !== AUTOMATED_ORDER_SOURCE) {
    // A row an admin created by hand. The admin owns this order end to end,
    // including whatever shipping state it needs in Seller Centre — an
    // automated ship_order call here would be an unexpected side effect on
    // an order this pipeline did not create.
    console.info(
      `[shopee-webhook] ordersn=${orderSn} resolves to a non-automated orders row ` +
        `(source=${order.source ?? "null"}); leaving shipping to the admin.`,
    );
    return;
  }

  // ── 1. Claim ────────────────────────────────────────────────────────────
  const { data: claimed, error: claimError } = await supabase
    .from("orders")
    .update({
      shipped_at: new Date().toISOString(),
      ship_attempts: (order.ship_attempts ?? 0) + 1,
      ship_error: null,
    })
    .eq("id", orderRowId)
    .is("shipped_at", null)
    .select("id");

  if (claimError) {
    console.error(
      `[shopee-webhook] failed to claim the ship slot for ordersn=${orderSn}: ` +
        `${claimError.message}. Not calling ship_order — an unclaimed call could duplicate.`,
    );
    return;
  }
  if (!claimed || claimed.length === 0) {
    console.info(
      `[shopee-webhook] ship slot for ordersn=${orderSn} was claimed by a ` +
        `concurrent push; not calling ship_order.`,
    );
    return;
  }

  // ── 2. Call ─────────────────────────────────────────────────────────────
  const result = await shipOrder({ orderSn, shopId });

  // ── 3 / 4. Keep or release the latch ────────────────────────────────────
  if (result.shipped) {
    console.info(`[shopee-webhook] ordersn=${orderSn} shipped: ${result.detail}`);
    return;
  }

  if (result.ambiguous) {
    console.error(
      `[shopee-webhook] ordersn=${orderSn} ship AMBIGUOUS — latch KEPT, no auto-retry. ` +
        `A human should check the order's status in Seller Centre before retrying. ${result.detail}`,
    );
    await recordShipError(supabase, orderRowId, result.detail);
    return;
  }

  console.error(
    `[shopee-webhook] ordersn=${orderSn} ship_order failed (proven not shipped) — releasing the ` +
      `latch so it can be retried. ${result.detail}`,
  );
  const { error: releaseError } = await supabase
    .from("orders")
    .update({ shipped_at: null, ship_error: result.detail })
    .eq("id", orderRowId);

  if (releaseError) {
    console.error(
      `[shopee-webhook] ordersn=${orderSn} was NOT shipped and the latch could not be ` +
        `released: ${releaseError.message}. This row will look shipped but is not — ` +
        `clear orders.shipped_at by hand.`,
    );
  }
}

/** Record why shipping did not happen, without touching the latch. */
async function recordShipError(
  supabase: AdminClient,
  orderRowId: string,
  detail: string,
): Promise<void> {
  const { error } = await supabase
    .from("orders")
    .update({ ship_error: detail })
    .eq("id", orderRowId);

  if (error) {
    console.error(
      `[shopee-webhook] could not write ship_error for order row ${orderRowId}: ${error.message}`,
    );
  }
}

/* ------------------------------------------------------------------------ */
/* The pipeline                                                              */
/* ------------------------------------------------------------------------ */

/**
 * ordersn -> paid? -> orders row -> buyer chat message.
 *
 * Returns a PushOutcome rather than throwing, so the status-code decision
 * documented above lives in exactly one place and stays auditable.
 */
async function runFulfillment(
  supabase: AdminClient,
  orderSn: string,
  shopId?: number,
): Promise<PushOutcome> {
  // ── Authoritative order facts, straight from Shopee ──────────────────────
  // The push payload's own `data.status` is deliberately NOT trusted for the
  // money decision: it is a single unverified enum value, it carries no
  // pay_time, and this pipeline gives away account access on "paid". We
  // re-ask Shopee and let lib/shopee-api.ts classify the answer.
  let detail: ShopeeOrderDetail;
  try {
    detail = await getOrderDetail(orderSn, shopId);
  } catch (err) {
    if (err instanceof ShopeeApiError) {
      console.error(
        `[shopee-webhook] get_order_detail failed for ordersn=${orderSn} ` +
          `kind=${err.kind} shopee_error=${err.shopeeError ?? "-"} ` +
          `request_id=${err.requestId ?? "-"} http=${err.httpStatus ?? "-"}: ${err.message}`,
      );
      return { ack: false, note: `order_detail_${err.kind}` };
    }
    console.error(
      `[shopee-webhook] get_order_detail threw an unexpected error for ordersn=${orderSn}: ` +
        `${err instanceof Error ? err.message : String(err)}`,
    );
    return { ack: false, note: "order_detail_unexpected" };
  }

  if (detail.buyerUsernameMasked) {
    // Worth its own log line: if Malaysian orders mask buyer_username, the
    // automated path has no usable second factor and orders.buyer_username
    // will be null for every automated row. lib/shopee-api.ts flags this as
    // the biggest open risk in the pipeline, and this is how we find out for
    // real. The raw masked value is buyer PII and is NOT logged.
    console.warn(
      `[shopee-webhook] Shopee MASKED buyer_username for ordersn=${orderSn}; storing null. ` +
        `Malaysian masking behaviour was unverified at build time — if this line appears, ` +
        `revisit the buyer-identification plan.`,
    );
  }

  // ── Is it actually paid? ─────────────────────────────────────────────────
  const state = describePaymentState(detail);
  if (state !== "paid") {
    if (state === "unknown_status") {
      console.error(
        `[shopee-webhook] ACTION REQUIRED — ordersn=${orderSn} returned an order_status ` +
          `lib/shopee-api.ts does not recognise as either paid or unpaid: ` +
          `"${detail.orderStatus}" (pay_time=${detail.payTime ?? "null"}). Refusing to ` +
          `deliver on a status we cannot classify. Returning 5xx so Shopee retries — the ` +
          `status (or a missing pay_time) may still settle. If this recurs, confirm the ` +
          `value against the Shopee docs and add it to the enum in lib/shopee-api.ts.`,
      );
      return { ack: false, note: "unknown_payment_state" };
    }
    // UNPAID / PENDING / CANCELLED. Entirely normal — log it and ACK. Shopee
    // pushes again when the status changes; an unpaid order is not an error
    // and must not be turned into one.
    console.info(
      `[shopee-webhook] ordersn=${orderSn} is ${state} (order_status=${detail.orderStatus}); ` +
        `nothing to fulfil.`,
    );
    return { ack: true, note: `not_paid_${state}` };
  }

  // ── Record the order (idempotent) ────────────────────────────────────────
  let fulfilled;
  try {
    fulfilled = await fulfillOrder({
      orderSn,
      buyerUsername: detail.buyerUsername,
      items: detail.items,
    });
  } catch (err) {
    console.error(
      `[shopee-webhook] fulfillOrder failed for ordersn=${orderSn}: ` +
        `${err instanceof Error ? err.message : String(err)}`,
    );
    return { ack: false, note: "fulfillment_write_failed" };
  }

  if (fulfilled.status === "no_mapping") {
    const bought = detail.items
      .map((i) => `item_id=${i.itemId} model_id=${i.modelId}`)
      .join("; ");
    console.error(
      `[shopee-webhook] ACTION REQUIRED — ordersn=${orderSn} is PAID but none of its items ` +
        `map to a game in shopee_listings. Bought: ${bought || "(no items)"}. The buyer has ` +
        `paid and has NO orders row, so they cannot redeem: add the mapping ` +
        `(scripts/seed-shopee-listings.mjs) and create the order manually. Returning 200 — ` +
        `a Shopee retry cannot create a mapping, only a human can.`,
    );
    return { ack: true, note: "no_mapping" };
  }

  if (fulfilled.status === "no_capacity") {
    console.error(
      `[shopee-webhook] ACTION REQUIRED — ordersn=${orderSn} is PAID and mapped, but no ` +
        `ACTIVE Steam account owns that game (out of stock, or every account is ` +
        `banned/recovering). The buyer has paid and has NO orders row: add stock, then ` +
        `create the order manually. Returning 200 — a Shopee retry cannot add stock.`,
    );
    return { ack: true, note: "no_capacity" };
  }

  // ── PARTIAL: some of what they paid for could not be served ─────────────
  // Chaison's call, 2026-09-06: deliver what we can and flag the rest, rather
  // than holding the whole order back. The buyer has already paid, and three
  // games delivered beats zero while a human adds the fourth.
  //
  // This deliberately does NOT change the ACK or the auto-ship decision.
  // NACKing would earn a Shopee retry that cannot invent a listing mapping or
  // an active account, and skipping the ship would risk Shopee auto-cancelling
  // an order whose buyer already holds working credentials for the games that
  // DID land. It is logged at ACTION REQUIRED so it surfaces in Vercel logs
  // and in scripts/reconcile-shopee-orders.mjs.
  if (fulfilled.status === "partial") {
    const gaps: string[] = [];
    if (fulfilled.unmatchedItems.length > 0) {
      gaps.push(
        `UNMAPPED ITEMS (add to shopee_listings): ` +
          fulfilled.unmatchedItems
            .map((i) => `item_id=${i.itemId} model_id=${i.modelId}`)
            .join("; "),
      );
    }
    if (fulfilled.unallocatedGameIds.length > 0) {
      gaps.push(
        `NO ACTIVE ACCOUNT (add stock): game_id=` +
          fulfilled.unallocatedGameIds.join(", game_id="),
      );
    }
    console.error(
      `[shopee-webhook] ACTION REQUIRED — ordersn=${orderSn} is PARTIALLY fulfilled: ` +
        `${fulfilled.games.length} of ${fulfilled.games.length + fulfilled.unmatchedItems.length + fulfilled.unallocatedGameIds.length} ` +
        `line(s) served. ${gaps.join(" | ")}. The buyer HAS paid for the rest — ` +
        `fix the gap, then add the missing game line(s) and message them. ` +
        `Delivering and shipping what we can; returning 200.`,
    );
  }

  // status is "created", "partial" or "already_exists" — the order IS
  // recorded. From here on the answer is ALWAYS 200: a chat problem must
  // never cost us a retry storm for an order that is already fulfilled.
  if (!fulfilled.orderRowId) {
    console.error(
      `[shopee-webhook] fulfillOrder reported ${fulfilled.status} for ordersn=${orderSn} ` +
        `but returned no order row id; skipping delivery.`,
    );
    return { ack: true, note: fulfilled.status };
  }

  if (fulfilled.games.length === 0) {
    console.error(
      `[shopee-webhook] ACTION REQUIRED — ordersn=${orderSn} has an orders row but NO game ` +
        `lines, so the buyer's lookup will answer "order not found". Check that migration ` +
        `0014 (order_games) is applied and add the game line(s) by hand.`,
    );
  }

  try {
    // One message per game, sequentially — Chaison's call 2026-09-06. See
    // deliverOrderGames() for why this is not Promise.all.
    await deliverOrderGames(supabase, fulfilled.games, {
      orderRowId: fulfilled.orderRowId,
      orderSn,
      shopId,
      // From get_order_detail, not from the push payload: the push carries no
      // buyer id, and this is the value that makes the chat message
      // addressable at all.
      buyerUserId: detail.buyerUserId,
    });
  } catch (err) {
    console.error(
      `[shopee-webhook] delivery bookkeeping threw for ordersn=${orderSn} (the order row ` +
        `EXISTS and the buyer can still redeem at gameshare.space): ` +
        `${err instanceof Error ? err.message : String(err)}`,
    );
  }

  // ── Mark it Shipped on Shopee's side ─────────────────────────────────────
  // Independent kill switch (see autoShipEnabled() docblock) and independent
  // of whether the chat message above succeeded — see shipOnce()'s docblock
  // for why those two are unrelated. Never allowed to change the ACK
  // decision below: a shipping bookkeeping problem must not turn into a
  // Shopee retry storm for an order that is already fulfilled and delivered.
  if (autoShipEnabled()) {
    try {
      await shipOnce(supabase, { orderRowId: fulfilled.orderRowId, orderSn, shopId });
    } catch (err) {
      console.error(
        `[shopee-webhook] ship bookkeeping threw for ordersn=${orderSn} (the order row ` +
          `EXISTS and is delivered; only the Shopee-side ship status is affected): ` +
          `${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  return { ack: true, note: fulfilled.status };
}

/* ------------------------------------------------------------------------ */
/* Handler                                                                   */
/* ------------------------------------------------------------------------ */

export async function POST(request: Request) {
  // MUST read raw text before any JSON parsing — Shopee's own doc warns the
  // signature is computed over the exact raw bytes, not a re-serialized body.
  const rawBody = await request.text();
  const authHeader = request.headers.get("Authorization") ?? "";

  // The base string is `<registered callback URL>|<raw body>` — this has to
  // be the EXACT string configured in the Console's "Set Push" callback URL
  // field, which may not equal this request's own URL (proxies, trailing
  // slashes, etc.). Falls back to request.url if not explicitly set, but
  // that fallback is a guess — set SHOPEE_PUSH_CALLBACK_URL once the
  // callback is registered in Console.
  const callbackUrl = process.env.SHOPEE_PUSH_CALLBACK_URL ?? request.url;

  /**
   * PUSHES ARE SIGNED WITH THE **PUSH** PARTNER KEY, NOT THE API PARTNER KEY.
   *
   * These are two genuinely different secrets and this code used to conflate
   * them, which would have made EVERY inbound push fail signature verification
   * and return 401 — a failure that looks exactly like a misconfigured callback
   * URL and is miserable to diagnose.
   *
   * Evidence (Console > Push Mechanism > Set Push, read 2026-09-05): that
   * screen has its own `Live Push Partner Key` field with a `Generate` button
   * beside it, and the test equivalent displays a value in a completely
   * different format from the API key —
   *   Push Partner Key : 64 hex chars, NO prefix      (Set Push screen)
   *   API  Partner Key : 64 chars, "shpk"-prefixed    (App Key screen)
   * (Formats only — no real key material belongs in this repo, which is public.)
   * Same app, same environment, different secrets. The API key signs outbound
   * calls we make to Shopee; the push key signs inbound calls Shopee makes to
   * us. This function only ever deals with the latter.
   *
   * The fallback to SHOPEE_PARTNER_KEY exists solely so this does not become a
   * hard outage on a deploy where the new variable has not been set yet — it
   * will simply keep failing verification the way it already does, rather than
   * throwing. It is NOT a correct value: if you are reading this because
   * pushes are 401ing, set SHOPEE_PUSH_PARTNER_KEY to the key generated in the
   * Console and the problem goes away.
   */
  const pushPartnerKey =
    process.env.SHOPEE_PUSH_PARTNER_KEY ?? process.env.SHOPEE_PARTNER_KEY ?? "";

  if (!process.env.SHOPEE_PUSH_PARTNER_KEY) {
    console.warn(
      "[shopee-webhook] SHOPEE_PUSH_PARTNER_KEY is not set; falling back to " +
        "SHOPEE_PARTNER_KEY, which is the API key and will NOT verify Shopee's push " +
        "signatures. Generate the push key in Console > Push Mechanism > Set Push > " +
        "Live Push Partner Key and set it, or every push will be rejected as 401.",
    );
  }

  const baseString = `${callbackUrl}|${rawBody}`;
  const expectedSig = pushPartnerKey ? await hmacSha256Hex(pushPartnerKey, baseString) : "";
  const signatureValid = Boolean(pushPartnerKey) && authHeader === expectedSig;

  let payload: {
    data?: { ordersn?: string; status?: string };
    shop_id?: number;
    code?: number;
  } = {};
  try {
    payload = JSON.parse(rawBody);
  } catch {
    // Log the unparseable body as-is below; don't throw before we've logged it.
  }

  const supabase = createAdminClient();
  const { error: logError } = await supabase.from("shopee_push_log").insert({
    push_code: payload.code ?? null,
    shop_id: payload.shop_id ?? null,
    ordersn: payload.data?.ordersn ?? null,
    order_status: payload.data?.status ?? null,
    signature_valid: signatureValid,
    raw_payload: (() => {
      try {
        return JSON.parse(rawBody);
      } catch {
        return { unparsed: rawBody };
      }
    })(),
  });

  if (logError) {
    // Not fatal to this request, but it IS a hole in the reconciliation
    // record (spec §2.7: Shopee never redelivers), so it must be visible
    // rather than swallowed the way it was before.
    console.error(
      `[shopee-webhook] failed to write shopee_push_log for ordersn=` +
        `${payload.data?.ordersn ?? "unknown"}: ${logError.message}`,
    );
  }

  if (!signatureValid) {
    /**
     * THE CONSOLE VERIFICATION DEADLOCK, AND WHY THIS IS SPLIT IN TWO.
     *
     * Console > Push Mechanism > Set Push has a "Verify" button that sends a
     * test push at this URL and REQUIRES a 2xx back before it will let the
     * callback be saved. Blanket-401ing an unverified signature therefore made
     * the callback impossible to register at all:
     *
     *   to save the callback  -> must return 2xx to the test push
     *   to return 2xx         -> signature must verify
     *   to verify a signature -> need the Live Push Partner Key
     *   to get that key       -> generate it on the page you cannot save
     *
     * Observed for real on 2026-09-05: "Failed Verification! Shopee have sent a
     * test push to this call back url, the response code we get from this
     * callback_url is not 2xx code."
     *
     * The split below breaks that loop WITHOUT weakening the thing that
     * actually matters. What protects this endpoint is not the status code we
     * return, it is that nothing downstream of here runs on an unverified
     * payload — an unsigned request can never reach runFulfillment(), never
     * allocates an account, and never messages a buyer. Both branches have
     * ALREADY been written to shopee_push_log above with signature_valid=false,
     * so neither is invisible.
     *
     *   - NO ordersn  -> 200. A verification handshake, or a push type this
     *     route does not handle. There is no order to lose, so a retry would
     *     achieve nothing, and answering 2xx is what lets the callback be
     *     registered in the first place.
     *
     *   - HAS an ordersn -> 401, exactly as before. This is a real order push
     *     whose signature we could not verify, which means either the push key
     *     is misconfigured or someone is forging order notifications at us.
     *     Both must fail LOUDLY: 401 makes Shopee retry on its 300s/1800s/
     *     10800s schedule, which is the window in which a wrong key can be
     *     corrected without losing the order. Silently 200ing this would
     *     recreate the silent-outage failure mode that cost us real buyer
     *     lookups on 2026-09-03 — the order would be dropped with nothing
     *     anywhere reporting a problem.
     */
    const orderSnOnUnverified = payload.data?.ordersn?.trim();

    if (!orderSnOnUnverified) {
      console.info(
        "[shopee-webhook] unsigned/unverifiable push carrying no ordersn — answering 200. " +
          "This is the expected path for the Console's 'Verify' handshake. Logged to " +
          "shopee_push_log with signature_valid=false.",
      );
      return new NextResponse(null, { status: 200 });
    }

    console.error(
      `[shopee-webhook] ACTION REQUIRED — push for ordersn=${orderSnOnUnverified} FAILED ` +
        `signature verification. Nothing was fulfilled. If this is not an attack, ` +
        `SHOPEE_PUSH_PARTNER_KEY is wrong or SHOPEE_PUSH_CALLBACK_URL does not byte-for-byte ` +
        `match the URL registered in Console (the HMAC is over '<callback url>|<raw body>'). ` +
        `Returning 401 so Shopee retries while you fix it.`,
    );
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  if (!autoFulfillEnabled()) {
    console.info(
      `[shopee-webhook] push for ordersn=${payload.data?.ordersn ?? "none"} logged; ` +
        `auto-fulfilment is DISABLED (set SHOPEE_AUTO_FULFILL=true only after migrations ` +
        `0005 and 0008 are applied).`,
    );
    return new NextResponse(null, { status: 200 });
  }

  const orderSn = payload.data?.ordersn?.trim();
  if (!orderSn) {
    // Not every push is about an order (`code` distinguishes push types; the
    // 0006 migration records 3 = Order Status Update). We gate on the
    // PRESENCE OF AN ORDERSN rather than on a hard-coded `code` value: the
    // code enum is only partially documented for us, and "carries an
    // ordersn" is exactly the set we can act on — no guessed constant. A
    // push without one is not an error, it is simply not ours to handle.
    return new NextResponse(null, { status: 200 });
  }

  const shopId = typeof payload.shop_id === "number" ? payload.shop_id : undefined;

  const outcome = await runFulfillment(supabase, orderSn, shopId);

  if (!outcome.ack) {
    // Deliberate non-2xx: nothing was recorded for this order and a retry can
    // still help. See the PushOutcome comment above for the full case
    // analysis. The body is for our own logs; Shopee reads only the status
    // code on the failure path.
    return NextResponse.json({ error: outcome.note }, { status: 500 });
  }

  // Per spec §2.6: 2xx + EMPTY body, or Shopee will treat this as a failed
  // delivery and retry (300s / 1800s / 10800s per the push's retry_strategy).
  return new NextResponse(null, { status: 200 });
}
