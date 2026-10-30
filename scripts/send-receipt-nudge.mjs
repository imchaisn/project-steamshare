/**
 * send-receipt-nudge.mjs
 * List delivered Shopee orders that have not been asked for "Order Received" +
 * a rating, and optionally send that ask to ONE of them.
 *
 * Usage:
 *   node --env-file=.env.local scripts/send-receipt-nudge.mjs                  # list only, no writes
 *   node --env-file=.env.local scripts/send-receipt-nudge.mjs --vouchers       # also dump live shop vouchers
 *   node --env-file=.env.local scripts/send-receipt-nudge.mjs --send 260908... # send to ONE order
 *
 * ── WHY THIS EXISTS ────────────────────────────────────────────────────────
 * The automated nudge (buildReceiptNudgeMessage() in lib/fulfillment.ts, fired
 * from the webhook after the last delivery message) is committed but NOT
 * DEPLOYED. Orders that were delivered before the deploy will therefore never
 * be nudged by the pipeline at all — the webhook only nudges on the same
 * invocation that delivers, and those deliveries are already latched.
 *
 * So this is the manual backfill for orders that fell in that gap. It sends the
 * IDENTICAL text the deployed code will send, by importing
 * buildReceiptNudgeMessage() rather than restating it — if the two ever drift,
 * that is a bug, not a nuance.
 *
 * ── IT SENDS ONE MESSAGE PER INVOCATION, ON PURPOSE ────────────────────────
 * There is no bulk mode and no --all. Every send here is a real message to a
 * real customer and cannot be unsent. Naming the order_sn each time is the
 * confirmation step.
 *
 * ── IT WRITES NO LATCH ─────────────────────────────────────────────────────
 * There is no orders.receipt_nudge_sent_at column (see CHECKPOINT.md — the DB
 * password is stale, so no migration can be applied unattended). Re-running
 * --send on the same order WILL send a second message. The listing output is
 * the only record; read it before you send.
 *
 * Signing, token decryption and the API host are copied from
 * scripts/reconcile-shopee-orders.mjs, which is proven against this shop.
 */
import crypto from "node:crypto";
import { buildReceiptNudgeMessage } from "../lib/fulfillment.ts";

const args = process.argv.slice(2);
const sendIdx = args.indexOf("--send");
const SEND_SN = sendIdx === -1 ? null : args[sendIdx + 1];
const WANT_VOUCHERS = args.includes("--vouchers");

const su = process.env.NEXT_PUBLIC_SUPABASE_URL;
const sk = process.env.SUPABASE_SERVICE_ROLE_KEY;
const pid = process.env.SHOPEE_PARTNER_ID;
const pkey = process.env.SHOPEE_PARTNER_KEY;
const HOST = "https://partner.shopeemobile.com";
const H = { apikey: sk, Authorization: "Bearer " + sk };

function dec(b64) {
  const c = Buffer.from(b64, "base64");
  const iv = c.subarray(0, 12);
  const r = c.subarray(12);
  const tag = r.subarray(r.length - 16);
  const body = r.subarray(0, r.length - 16);
  const d = crypto.createDecipheriv(
    "aes-256-gcm",
    Buffer.from(process.env.ACCOUNTS_ENCRYPTION_KEY, "base64"),
    iv,
  );
  d.setAuthTag(tag);
  return Buffer.concat([d.update(body), d.final()]).toString("utf8");
}

const [auth] = await (
  await fetch(su + "/rest/v1/shopee_auth?select=shop_id,access_token_enc", { headers: H })
).json();
const shopId = auth.shop_id;
const token = dec(auth.access_token_enc);

function call(path, params = {}, body) {
  const ts = Math.floor(Date.now() / 1000);
  const base = `${pid}${path}${ts}${token}${shopId}`;
  const sign = crypto.createHmac("sha256", pkey).update(base).digest("hex");
  const q = new URLSearchParams({
    partner_id: pid,
    timestamp: ts,
    access_token: token,
    shop_id: shopId,
    sign,
    ...params,
  });
  const init = body
    ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
    : {};
  return fetch(`${HOST}${path}?${q}`, init).then((r) => r.json());
}

// ── Which orders are delivered? ────────────────────────────────────────────
const orders = await (
  await fetch(
    su + "/rest/v1/orders?select=shopee_order_id,buyer_username,created_at,source&order=created_at.desc&limit=25",
    { headers: H },
  )
).json();

const games = await (
  await fetch(su + "/rest/v1/order_games?select=order_id,delivered_at", { headers: H })
).json();

console.log(`shop_id ${shopId}\n`);
console.log("Recent orders (source=shopee_push only):");
const real = orders.filter((o) => o.source === "shopee_push");
for (const o of real) {
  console.log(`  ${o.shopee_order_id}  ${o.buyer_username ?? "—"}  ${o.created_at}`);
}

if (WANT_VOUCHERS) {
  const v = await call("/api/v2/voucher/get_voucher_list", {
    page_no: "1",
    page_size: "50",
    status: "all",
  });
  console.log("\nVOUCHERS:", JSON.stringify(v, null, 1).slice(0, 4000));
}

// ── Order detail for each real order (buyer_user_id lives here) ────────────
const detail = {};
for (const o of real) {
  const d = await call("/api/v2/order/get_order_detail", {
    order_sn_list: o.shopee_order_id,
    response_optional_fields: "buyer_user_id,buyer_username,item_list,total_amount,order_status",
  });
  const row = d?.response?.order_list?.[0];
  detail[o.shopee_order_id] = row;
  console.log(
    `\n${o.shopee_order_id}: status=${row?.order_status} total=${row?.total_amount} buyer_user_id=${row?.buyer_user_id}` +
      (d.error ? `  ERROR ${d.error} ${d.message}` : ""),
  );
  for (const it of row?.item_list ?? []) console.log(`    - ${it.item_name} @ ${it.model_discounted_price}`);
}

if (!SEND_SN) {
  console.log("\n(list only — pass --send <order_sn> to actually send)");
  process.exit(0);
}

// ── Send ───────────────────────────────────────────────────────────────────
const row = detail[SEND_SN];
if (!row) {
  console.error(`\n${SEND_SN} is not in the recent-order list above. Refusing to send.`);
  process.exit(1);
}

const text = buildReceiptNudgeMessage({ orderSn: SEND_SN });
console.log(`\n--- sending to buyer_user_id ${row.buyer_user_id} (${row.buyer_username}) ---`);
console.log(text);
console.log("---");

const to_id = Number(row.buyer_user_id);
const sendText = () =>
  call("/api/v2/sellerchat/send_message", {}, { to_id, message_type: "text", content: { text } });

let res = await sendText();

// Same fallback the deployed path uses (lib/shopee-chat-order-context.ts): a
// shop cannot open a conversation with a plain text message. Send the order
// card first, then retry. This is what rescued a real order's delivery.
if (res.error === "first_chat_without_order_info") {
  console.log("\nfirst_chat_without_order_info — sending order card, then retrying text");
  const card = await call(
    "/api/v2/sellerchat/send_message",
    {},
    { to_id, message_type: "order", content: { order_sn: SEND_SN } },
  );
  console.log("ORDER CARD:", JSON.stringify(card));
  res = await sendText();
}

console.log("\nSHOPEE RESPONSE:", JSON.stringify(res));
process.exit(res.error ? 1 : 0);
