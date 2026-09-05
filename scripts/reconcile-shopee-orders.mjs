/**
 * reconcile-shopee-orders.mjs
 * Find PAID Shopee orders that never became an `orders` row — i.e. buyers who
 * paid and got nothing.
 *
 * Usage:
 *   node --env-file=.env.local scripts/reconcile-shopee-orders.mjs [days]
 *
 * `days` defaults to 14 and is capped at 14, because Shopee's order list API
 * only accepts a 15-day window per call.
 *
 * ── WHY THIS EXISTS ────────────────────────────────────────────────────────
 * This is the check that would have caught the 2026-09-05 Euro Truck Simulator
 * 2 order without a buyer having to complain.
 *
 * `no_mapping` (unmapped listing) and `no_capacity` (no active account owns the
 * game) both ACK the push with 200 by design — a Shopee retry cannot fix
 * either, only a human can — so the ONLY trace of a dropped order is a
 * console.error in the Vercel logs. Nobody watches those. Shopee's own order
 * list is the source of truth; our `orders` table is what should mirror it, and
 * this compares the two.
 *
 * Run it after every listing change, and on a schedule if you can. Anything it
 * prints with ❌ is a buyer who paid and is waiting.
 *
 * Exit code is 0 either way — this is a report, not a gate. Read the output.
 *
 * See also scripts/shopee-listings.mjs, which answers the same question from
 * the other end: "can this listing deliver at all?" rather than "did this
 * order deliver?".
 */
import crypto from "node:crypto";

const DAYS = Number(process.argv[2] ?? 14);

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
const TOK = dec(auth.access_token_enc);
const SHOP = auth.shop_id;

async function call(path, extra = {}) {
  const ts = Math.floor(Date.now() / 1000);
  const sig = crypto.createHmac("sha256", pkey).update(pid + path + ts + TOK + SHOP).digest("hex");
  const q = new URLSearchParams({
    partner_id: pid,
    timestamp: String(ts),
    access_token: TOK,
    shop_id: String(SHOP),
    sign: sig,
    ...extra,
  });
  return (await fetch(HOST + path + "?" + q)).json();
}

// Shopee caps the window at 15 days per call.
const to = Math.floor(Date.now() / 1000);
const from = to - Math.min(DAYS, 14) * 24 * 3600;
const list = await call("/api/v2/order/get_order_list", {
  time_range_field: "create_time",
  time_from: String(from),
  time_to: String(to),
  page_size: "100",
});
const sns = (list.response?.order_list ?? []).map((o) => o.order_sn);
console.log(`Shopee orders in last ${Math.min(DAYS, 14)} days: ${sns.length}`);
if (!sns.length) process.exit(0);

const detail = await call("/api/v2/order/get_order_detail", {
  order_sn_list: sns.join(","),
  response_optional_fields: "buyer_username,item_list,pay_time",
});

const mappings = await (
  await fetch(su + "/rest/v1/shopee_listings?select=item_id,model_id", { headers: H })
).json();
const mapped = new Set(mappings.map((m) => `${m.item_id}:${m.model_id}`));

const ours = await (
  await fetch(su + "/rest/v1/orders?select=shopee_order_id,delivered_at", { headers: H })
).json();
const have = new Map(ours.map((o) => [o.shopee_order_id, o.delivered_at]));

const PAID = new Set([
  "READY_TO_SHIP", "PROCESSED", "SHIPPED", "COMPLETED",
  "RETRY_SHIP", "TO_CONFIRM_RECEIVE", "TO_RETURN",
]);

let problems = 0;
for (const o of detail.response?.order_list ?? []) {
  const paid = PAID.has(o.order_status) && o.pay_time;
  const row = have.has(o.order_sn);
  const items = (o.item_list ?? []).map((i) => `${i.item_id}:${i.model_id}`);
  const anyMapped = items.some((k) => mapped.has(k));

  if (!paid) continue;

  if (!row) {
    problems++;
    console.log(`\n❌ PAID BUT NO ORDERS ROW: ${o.order_sn}  (${o.order_status})`);
    console.log(`   buyer=${o.buyer_username ?? "-"}`);
    for (const i of o.item_list ?? []) {
      console.log(
        `   item_id=${i.item_id} model_id=${i.model_id} mapped=${mapped.has(`${i.item_id}:${i.model_id}`) ? "YES" : "NO  <-- add to shopee_listings"}`,
      );
    }
    if (anyMapped) console.log(`   (mapping exists, so this is likely no_capacity or an API failure)`);
  } else if (have.get(o.order_sn) === null) {
    console.log(`\n⚠️  recorded but NOT DELIVERED: ${o.order_sn}`);
  }
}

console.log(problems === 0 ? "\n✅ every paid order has an orders row" : `\n${problems} paid order(s) need attention`);
