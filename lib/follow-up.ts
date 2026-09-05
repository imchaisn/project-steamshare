/**
 * Post-delivery follow-up — the second, later message to a buyer whose order
 * was already delivered by the automated pipeline. It asks them to press
 * "Order Received" in Shopee and to leave a rating.
 *
 * This is the read end of the delivery pipeline, one day behind it:
 *   [webhook -> fulfillOrder -> deliverOnce]  ... 24h ...  [cron -> HERE]
 *
 * ── WHY THIS IS A SEPARATE, DELAYED PASS ─────────────────────────────────
 * Asking for five stars in the same breath as the credentials asks a buyer to
 * rate a login they have not tried yet. A day later they either are playing —
 * and the ask is fair — or they are not, and the message's "any issue,
 * message us here first" line pulls the complaint into chat instead of into a
 * one-star review. That routing is the commercial point of the message; do
 * not edit that line out.
 *
 * ── WHAT THIS MODULE MUST NEVER DO ───────────────────────────────────────
 * 1. NEVER offer anything in exchange for a rating. A discount, a voucher, a
 *    refund or a free game attached to a star request is an incentivised
 *    review under Shopee's policy and puts the listing at risk. Tested.
 * 2. NEVER restate a credential. The delivery message a day earlier is in the
 *    same chat thread and already carries the username and password; every
 *    extra copy is another permanent record of a SHARED account's password in
 *    a third-party log we cannot redact. buildFollowUpMessage() therefore
 *    takes an order id and nothing else, and the tests enforce that.
 * 3. NEVER message a buyer whose order a human created by hand. Rows with
 *    source <> AUTOMATED_ORDER_SOURCE belong to the admin who made them, same
 *    rule deliverOnce() follows in the webhook.
 *
 * ── SCHEMA DEPENDENCY ────────────────────────────────────────────────────
 * Everything here needs 0009_orders_follow_up.sql. Nothing here runs unless
 * SHOPEE_FOLLOW_UP is exactly "true", so deploying this code before that
 * migration is applied is inert rather than damaging — and the run summary
 * names the migration if the columns are missing, instead of failing with a
 * bare PostgREST error.
 *
 * Deliberately NOT wired into the webhook. The delivery path is the money
 * path: it turns a paid order into a redeemable row, and it currently works.
 * A follow-up is a nice-to-have that must not be able to break it, so it
 * shares no code with it and runs in its own request, a day later.
 */

import type { createAdminClient } from "@/utils/supabase/admin";

type AdminClient = ReturnType<typeof createAdminClient>;

/**
 * Every cross-module import in this file is deferred to call time, exactly as
 * lib/fulfillment.ts does and for the same reason: this repo's tests run on
 * bare `node --test`, which does not resolve the `@/` tsconfig path alias. A
 * static import would make the whole module unloadable by the test runner,
 * and the pure half — the buyer-visible message — is the half that most needs
 * testing. tsc still type-checks all of it.
 */
async function getAdminClient(): Promise<AdminClient> {
  const mod = await import("@/utils/supabase/admin");
  return mod.createAdminClient();
}

/**
 * How long after delivery the follow-up goes out. A buyer needs an evening
 * with the game before "did it work?" is a fair question.
 */
export const FOLLOW_UP_DELAY_HOURS = 24;

/**
 * How old an order may be before it is abandoned unfollowed.
 *
 * Shopee only lets a shop message a buyer within **30 days** of their order
 * (or 7 days of the buyer messaging first) — a manual resend outside that
 * fails `user_is_forbidden`, which is policy, not a bug. 25 days keeps a
 * margin for the gap between order and delivery, and stops a permanently
 * unsendable row from being retried every night forever.
 */
export const FOLLOW_UP_MAX_AGE_DAYS = 25;

/**
 * Give up after this many attempts on one order. The counter is incremented
 * on claim, so a row that fails for a structural reason (deleted buyer, chat
 * permission revoked) drops out of the query after three nights instead of
 * costing two Shopee API calls a night until it ages out.
 */
export const MAX_FOLLOW_UP_ATTEMPTS = 3;

/** Orders examined per run. The cron fires daily; volume is a handful a day. */
const DEFAULT_BATCH_LIMIT = 25;

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

const SITE_URL = "https://www.gameshare.space";
const STEP_7_URL = `${SITE_URL}/tutorial#step-7`;

export interface FollowUpWindow {
  /** Follow up only on orders delivered at or before this instant (ISO). */
  readyBefore: string;
  /** …and at or after this one, so nothing near the contact limit is tried. */
  notOlderThan: string;
}

/** The two delivered_at bounds a row must sit between to be followed up. */
export function followUpWindow(now: Date): FollowUpWindow {
  return {
    readyBefore: new Date(now.getTime() - FOLLOW_UP_DELAY_HOURS * HOUR_MS).toISOString(),
    notOlderThan: new Date(now.getTime() - FOLLOW_UP_MAX_AGE_DAYS * DAY_MS).toISOString(),
  };
}

export interface FollowUpMessageInput {
  orderSn: string;
}

/**
 * Render the follow-up message.
 *
 * ── THE TEMPLATE IS CHAISON'S, VERBATIM ─────────────────────────────────
 * Chosen on 2026-09-05 from two drafts (this is the short one) and recorded
 * in docs/order-fulfillment-sop.md with its reasoning. Wording, emoji, line
 * breaks and the Malay line are reproduced exactly. Do not "tidy" them: the
 * BM line exists because a material share of buyers read it first, the button
 * names are quoted because they are literal Shopee UI labels in each
 * language, and the emoji are scan anchors in a chat client.
 */
export function buildFollowUpMessage({ orderSn }: FollowUpMessageInput): string {
  // A message reading "Order ID:" with nothing after it is worse than no
  // message at all — the buyer cannot tell which of their orders it is about.
  if (typeof orderSn !== "string" || orderSn.trim() === "") {
    throw new Error("buildFollowUpMessage requires a non-empty order id");
  }

  return [
    `[GameShare]`,
    `Order ID: ${orderSn.trim()}`,
    ``,
    `✅ All delivered — enjoy the game!`,
    ``,
    `If it's working, please tap "Order Received" in Shopee and leave us`,
    `a ⭐⭐⭐⭐⭐ 5-star rating. It really helps us out 🙏`,
    ``,
    `Kalau OK, tolong tekan "Pesanan Diterima" dan beri rating ⭐⭐⭐⭐⭐.`,
    ``,
    `⚠️ Any issue — message us here first, we'll sort it out.`,
    `   ${STEP_7_URL}`,
  ].join("\n");
}

export interface FollowUpRunSummary {
  /** Rows the query returned as eligible. */
  scanned: number;
  /** Follow-ups Shopee accepted. */
  sent: number;
  /** Claimed, then proven or ambiguously failed. */
  failed: number;
  /** Claimed, then released without sending (lost claim, claim error, …). */
  skipped: number;
  /** One line per order, safe to log and to return from the cron route. */
  details: string[];
}

interface PendingRow {
  id: string;
  shopee_order_id: string;
  delivered_at: string | null;
  follow_up_attempts: number | null;
}

/**
 * Send every follow-up that is due, at most once each, ever.
 *
 * The exactly-once protocol is the same CLAIM -> SEND -> KEEP-OR-RELEASE
 * used by deliverOnce() in app/api/webhooks/shopee/route.ts, and for the same
 * reason: two runs can overlap (a manual trigger during the nightly cron), so
 * the guarantee has to be enforced by the database, not by an in-process
 * check.
 *
 *   1. CLAIM with a conditional update (`where id = $1 and
 *      follow_up_sent_at is null`). Postgres serialises the two updates, so
 *      exactly one of two concurrent runners matches a row.
 *   2. SEND.
 *   3. KEEP the latch on success AND on an ambiguous failure — a possibly
 *      duplicate "please rate us" is a worse outcome than a missing one.
 *   4. RELEASE it only on a proven failure, so tomorrow's run retries it.
 *
 * Never throws: one bad row must not abort the batch, and nothing here is
 * load-bearing for a buyer who has already been delivered.
 *
 * NOT UNIT-TESTED, deliberately — every path talks to Supabase and to Shopee
 * and this repo has no test double for either (same boundary as fulfillOrder;
 * see lib/fulfillment.test.ts). The pure parts it delegates to —
 * buildFollowUpMessage() and followUpWindow() — carry the tests.
 */
export async function sendPendingFollowUps(options?: {
  now?: Date;
  limit?: number;
}): Promise<FollowUpRunSummary> {
  const now = options?.now ?? new Date();
  const limit = options?.limit ?? DEFAULT_BATCH_LIMIT;
  const summary: FollowUpRunSummary = { scanned: 0, sent: 0, failed: 0, skipped: 0, details: [] };

  const supabase = await getAdminClient();
  const { AUTOMATED_ORDER_SOURCE } = await import("./fulfillment");
  const { readyBefore, notOlderThan } = followUpWindow(now);

  // The `is("follow_up_sent_at", null)` predicate is repeated verbatim from
  // 0009's partial index (`where follow_up_sent_at is null`) on purpose —
  // that is what lets the planner use it. Extra filters on top are fine.
  const { data, error } = await supabase
    .from("orders")
    .select("id, shopee_order_id, delivered_at, follow_up_attempts")
    .is("follow_up_sent_at", null)
    .eq("source", AUTOMATED_ORDER_SOURCE)
    .not("delivered_at", "is", null)
    .lte("delivered_at", readyBefore)
    .gte("delivered_at", notOlderThan)
    .lt("follow_up_attempts", MAX_FOLLOW_UP_ATTEMPTS)
    .order("delivered_at", { ascending: true })
    .limit(limit);

  if (error) {
    // 42703 is Postgres "undefined column". The only way to see it here is a
    // deploy that landed ahead of its migration, so say so rather than
    // surfacing a bare PostgREST string.
    const missingColumn = error.code === "42703" || /column .* does not exist/i.test(error.message);
    const detail = missingColumn
      ? `orders is missing the follow-up columns — apply ` +
        `supabase/migrations/0009_orders_follow_up.sql before enabling SHOPEE_FOLLOW_UP. ` +
        `(${error.message})`
      : `Failed to read pending follow-ups: ${error.message}`;
    console.error(`[follow-up] ${detail}`);
    summary.details.push(detail);
    return summary;
  }

  const rows = (data ?? []) as PendingRow[];
  summary.scanned = rows.length;

  for (const row of rows) {
    try {
      await followUpOnce(supabase, row, now, summary);
    } catch (err) {
      // Defensive: followUpOnce is written not to throw, but a single
      // unexpected row must not cost the rest of the batch.
      const detail = `${row.shopee_order_id}: unexpected error — ${
        err instanceof Error ? err.message : String(err)
      }`;
      console.error(`[follow-up] ${detail}`);
      summary.failed += 1;
      summary.details.push(detail);
    }
  }

  return summary;
}

async function followUpOnce(
  supabase: AdminClient,
  row: PendingRow,
  now: Date,
  summary: FollowUpRunSummary,
): Promise<void> {
  const orderSn = row.shopee_order_id;

  // ── 1. Claim ────────────────────────────────────────────────────────────
  const { data: claimed, error: claimError } = await supabase
    .from("orders")
    .update({
      follow_up_sent_at: now.toISOString(),
      follow_up_attempts: (row.follow_up_attempts ?? 0) + 1,
      follow_up_error: null,
    })
    .eq("id", row.id)
    .is("follow_up_sent_at", null)
    .select("id");

  if (claimError) {
    const detail = `${orderSn}: could not claim the follow-up slot (${claimError.message}); not sending.`;
    console.error(`[follow-up] ${detail}`);
    summary.skipped += 1;
    summary.details.push(detail);
    return;
  }
  if (!claimed || claimed.length === 0) {
    const detail = `${orderSn}: follow-up slot already claimed by a concurrent run; not sending.`;
    console.info(`[follow-up] ${detail}`);
    summary.skipped += 1;
    summary.details.push(detail);
    return;
  }

  // ── 2. Who is this addressed to? ────────────────────────────────────────
  // Re-read from Shopee rather than from our own row: `orders` has never
  // stored a buyer user id (0008 made shopee_buyer_id nullable precisely
  // because the automated path has none), and adding that write to the
  // fulfilment insert would have put a new schema dependency in the money
  // path. One extra call on a daily batch of a handful of orders is the
  // cheaper trade by a wide margin.
  let buyerUserId: number | null = null;
  try {
    const { getOrderDetail } = await import("./shopee-api");
    const detail = await getOrderDetail(orderSn);
    buyerUserId = detail.buyerUserId;
  } catch (err) {
    const detail = `${orderSn}: could not read the order detail to find the buyer (${
      err instanceof Error ? err.message : String(err)
    }); released for a later run.`;
    console.error(`[follow-up] ${detail}`);
    await releaseLatch(supabase, row.id, detail, summary, "failed");
    return;
  }

  if (buyerUserId === null) {
    const detail = `${orderSn}: Shopee returned no buyer_user_id, so the follow-up cannot be addressed. Nothing was sent.`;
    console.error(`[follow-up] ${detail}`);
    await releaseLatch(supabase, row.id, detail, summary, "failed");
    return;
  }

  // ── 3. Send ─────────────────────────────────────────────────────────────
  const { sendBuyerMessage } = await import("./shopee-chat");
  const result = await sendBuyerMessage({
    orderSn,
    text: buildFollowUpMessage({ orderSn }),
    buyerUserId,
  });

  // ── 4. Keep or release ──────────────────────────────────────────────────
  if (result.sent) {
    console.info(`[follow-up] ${orderSn} sent: ${result.detail}`);
    summary.sent += 1;
    summary.details.push(`${orderSn}: sent`);
    return;
  }

  if (result.ambiguous) {
    // Latch KEPT. A duplicate "please rate us" is worse than a missing one.
    const detail = `${orderSn}: AMBIGUOUS — latch kept, no retry. ${result.detail}`;
    console.error(`[follow-up] ${detail}`);
    await recordError(supabase, row.id, detail);
    summary.failed += 1;
    summary.details.push(detail);
    return;
  }

  const detail = `${orderSn}: proven not sent — released for a later run. ${result.detail}`;
  console.error(`[follow-up] ${detail}`);
  await releaseLatch(supabase, row.id, detail, summary, "failed");
}

/** Put the row back on tomorrow's list, recording why it is there. */
async function releaseLatch(
  supabase: AdminClient,
  orderRowId: string,
  detail: string,
  summary: FollowUpRunSummary,
  bucket: "failed" | "skipped",
): Promise<void> {
  const { error } = await supabase
    .from("orders")
    .update({ follow_up_sent_at: null, follow_up_error: detail })
    .eq("id", orderRowId);

  if (error) {
    console.error(
      `[follow-up] could not release the follow-up latch on order row ${orderRowId}: ` +
        `${error.message}. It will look followed-up but is not; clear ` +
        `orders.follow_up_sent_at by hand if it matters.`,
    );
  }

  summary[bucket] += 1;
  summary.details.push(detail);
}

/** Record why, without touching the latch. */
async function recordError(
  supabase: AdminClient,
  orderRowId: string,
  detail: string,
): Promise<void> {
  const { error } = await supabase
    .from("orders")
    .update({ follow_up_error: detail })
    .eq("id", orderRowId);

  if (error) {
    console.error(
      `[follow-up] could not write follow_up_error for order row ${orderRowId}: ${error.message}`,
    );
  }
}
