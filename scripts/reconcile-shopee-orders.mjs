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

// A Map, not a Set: counting DISTINCT GAMES on an order needs the game_id,
// so that two listings for one title are not counted as two games owed.
const mappings = await (
  await fetch(su + "/rest/v1/shopee_listings?select=item_id,model_id,game_id", {
    headers: H,
  })
).json();
const mapped = new Map(mappings.map((m) => [`${m.item_id}:${m.model_id}`, m.game_id]));

const ours = await (
  await fetch(su + "/rest/v1/orders?select=id,shopee_order_id", { headers: H })
).json();
const have = new Map(ours.map((o) => [o.shopee_order_id, o.id]));

// Game lines per order (migration 0014). An order can carry SEVERAL games —
// Shopee splits a cart by shop, not by item — so "does an orders row exist?"
// is no longer the whole question. "Does it have a line for every game they
// paid for, and is each one delivered?" is.
const gameLines = await (
  await fetch(su + "/rest/v1/order_games?select=order_id,delivered_at", { headers: H })
).json();
const linesByOrder = new Map();
// Whether the multi-game checks below can run at all. If order_games is not
// readable, EVERY order looks like it has zero game lines — which would print
// a SHORT-DELIVERED alarm for every healthy order in the shop. A reconciler
// that cries wolf on all 15 orders is worse than one that admits it cannot
// see, so the multi-game checks are skipped rather than run on bad data.
const canCheckGames = Array.isArray(gameLines);
if (canCheckGames) {
  for (const g of gameLines) {
    if (!linesByOrder.has(g.order_id)) linesByOrder.set(g.order_id, []);
    linesByOrder.get(g.order_id).push(g);
  }
} else {
  console.log(
    "\n⚠️  Could not read order_games — migration 0014 is probably not applied.\n" +
      "   Running order-level checks ONLY. Short-delivered multi-game orders\n" +
      "   cannot be detected until 0014 lands.\n",
  );
}

const PAID = new Set([
  "READY_TO_SHIP", "PROCESSED", "SHIPPED", "COMPLETED",
  "RETRY_SHIP", "TO_CONFIRM_RECEIVE", "TO_RETURN",
]);

let problems = 0;
for (const o of detail.response?.order_list ?? []) {
  const paid = PAID.has(o.order_status) && o.pay_time;
  if (!paid) continue;

  const orderRowId = have.get(o.order_sn);
  const itemList = o.item_list ?? [];

  // How many DISTINCT games did they actually pay for? Deduped by game_id,
  // matching matchItemsToGames() in lib/fulfillment.ts: two listings for one
  // title are one allocation, not two.
  const paidGameIds = new Set();
  const unmappedItems = [];
  for (const i of itemList) {
    const gameId =
      mapped.get(`${i.item_id}:${i.model_id}`) ?? mapped.get(`${i.item_id}:0`);
    if (gameId) paidGameIds.add(gameId);
    else unmappedItems.push(i);
  }

  if (!orderRowId) {
    problems++;
    console.log(`\n❌ PAID BUT NO ORDERS ROW: ${o.order_sn}  (${o.order_status})`);
    console.log(`   buyer=${o.buyer_username ?? "-"}`);
    for (const i of itemList) {
      const isMapped =
        mapped.has(`${i.item_id}:${i.model_id}`) || mapped.has(`${i.item_id}:0`);
      console.log(
        `   item_id=${i.item_id} model_id=${i.model_id} mapped=${isMapped ? "YES" : "NO  <-- add to shopee_listings"}`,
      );
    }
    if (paidGameIds.size > 0) {
      console.log(`   (mapping exists, so this is likely no_capacity or an API failure)`);
    }
    continue;
  }

  // ── THE MULTI-GAME CHECK ────────────────────────────────────────────────
  // This is what the old `items.some(...)` version could not see: an order
  // where SOME items mapped looked completely healthy, so a buyer who paid
  // for four games and received one showed up here as fine.
  if (!canCheckGames) continue;
  const lines = linesByOrder.get(orderRowId) ?? [];
  if (paidGameIds.size > lines.length) {
    problems++;
    console.log(
      `\n❌ SHORT-DELIVERED: ${o.order_sn} — paid for ${paidGameIds.size} game(s), ` +
        `has ${lines.length} game line(s)`,
    );
    console.log(`   buyer=${o.buyer_username ?? "-"}`);
    if (unmappedItems.length) {
      for (const i of unmappedItems) {
        console.log(
          `   UNMAPPED item_id=${i.item_id} model_id=${i.model_id}  <-- add to shopee_listings`,
        );
      }
    } else {
      console.log(`   all items map, so the gap is stock: no ACTIVE account for a game`);
    }
    continue;
  }

  if (unmappedItems.length > 0) {
    problems++;
    console.log(`\n❌ UNMAPPED ITEMS on an otherwise-fulfilled order: ${o.order_sn}`);
    for (const i of unmappedItems) {
      console.log(
        `   item_id=${i.item_id} model_id=${i.model_id}  <-- add to shopee_listings, then top the buyer up`,
      );
    }
    continue;
  }

  const undelivered = lines.filter((l) => l.delivered_at === null);
  if (undelivered.length > 0) {
    console.log(
      `\n⚠️  recorded but ${undelivered.length} of ${lines.length} game(s) NOT DELIVERED: ${o.order_sn}`,
    );
  }
}

// The success line must not overstate what was actually checked — that is the
// exact failure mode this script exists to prevent.
console.log(
  problems > 0
    ? `\n${problems} paid order(s) need attention`
    : canCheckGames
      ? "\n✅ every paid order has an orders row and a game line for every game bought"
      : "\n✅ every paid order has an orders row (game lines NOT checked — see the warning above)",
);
