/**
 * ship-shopee-order.mjs
 * List Shopee orders sitting in READY_TO_SHIP, and optionally mark one shipped.
 *
 * Usage:
 *   node --env-file=.env.local scripts/ship-shopee-order.mjs                 # list only, no writes
 *   node --env-file=.env.local scripts/ship-shopee-order.mjs --ship 25...    # ship ONE order
 *
 * ── WHY THIS EXISTS ────────────────────────────────────────────────────────
 * The automated path (lib/shopee-logistics.ts + shipOnce() in the webhook) is
 * written and committed but cannot run yet: migration 0010 is unapplied,
 * SHOPEE_AUTO_SHIP is unset, and production is serving a build that predates
 * the feature. Meanwhile a real paid order sitting in READY_TO_SHIP is exposed
 * to Shopee's Auto Cancellation — a refund to a buyer who already has working
 * credentials. This is the manual stopgap for that, and it doubles as the
 * "watch ONE real order" confirmation CHECKPOINT.md asks for before the
 * automated version is trusted.
 *
 * It deliberately makes the IDENTICAL call the deployed code will make:
 * POST /api/v2/logistics/ship_order with
 *   { order_sn, non_integrated: { tracking_number: <the order_sn> } }
 * so whatever Shopee answers here is exactly what the automated path would
 * have got. A rejection is the useful outcome too: it names the field Shopee
 * actually wants, which is the one unverified thing in that module.
 *
 * Signing, token decryption and the API host are copied from
 * scripts/reconcile-shopee-orders.mjs, which is proven against this shop.
 */
import crypto from "node:crypto";

const args = process.argv.slice(2);
const shipIdx = args.indexOf("--ship");
const SHIP_SN = shipIdx === -1 ? null : args[shipIdx + 1];

const su = process.env.NEXT_PUBLIC_SUPABASE_URL;
const sk = process.env.SUPABASE_SERVICE_ROLE_KEY;
const pid = process.env.SHOPEE_PARTNER_ID;
const pkey = process.env.SHOPEE_PARTNER_KEY;
const HOST = "https://partner.shopeemobile.com";
const H = { apikey: sk, Authorization: "Bearer " + sk };

if (!su || !sk || !pid || !pkey) {
  console.error("Missing env: needs NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SHOPEE_PARTNER_ID, SHOPEE_PARTNER_KEY");
  process.exit(1);
}

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
if (!auth) {
  console.error("No row in shopee_auth — the shop authorization flow has not been completed.");
  process.exit(1);
}
const TOK = dec(auth.access_token_enc);
const SHOP = auth.shop_id;

function signedUrl(path) {
  const ts = Math.floor(Date.now() / 1000);
  const sig = crypto.createHmac("sha256", pkey).update(pid + path + ts + TOK + SHOP).digest("hex");
  const q = new URLSearchParams({
    partner_id: pid,
    timestamp: String(ts),
    access_token: TOK,
    shop_id: String(SHOP),
    sign: sig,
  });
  return { url: HOST + path + "?" + q.toString(), q };
}

async function get(path, extra = {}) {
  const { url, q } = signedUrl(path);
  for (const [k, v] of Object.entries(extra)) q.set(k, v);
  return (await fetch(HOST + path + "?" + q.toString())).json();
}

async function post(path, body) {
  const { url } = signedUrl(path);
  return (
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  ).json();
}

// ── Ship one order ──────────────────────────────────────────────────────────
if (SHIP_SN) {
  // tracking_number = the order_sn, matching buildTrackingNumber() in
  // lib/shopee-logistics.ts. Keep the two in step: if Shopee rejects this,
  // change TRACKING_NUMBER_STRATEGY there, not just here.
  const body = { order_sn: SHIP_SN, non_integrated: { tracking_number: SHIP_SN } };
  console.log(`\n📦  ship_order  ${SHIP_SN}`);
  console.log(`    body: ${JSON.stringify(body)}\n`);
  const res = await post("/api/v2/logistics/ship_order", body);
  console.log(JSON.stringify(res, null, 2));
  const ok = !res.error || res.error === "";
  console.log(ok ? "\n✅  Shopee accepted the ship call.\n" : "\n❌  Shopee REJECTED it — the error above is the real contract.\n");
  process.exit(ok ? 0 : 1);
}

// ── List what needs shipping ────────────────────────────────────────────────
const to = Math.floor(Date.now() / 1000);
const from = to - 14 * 24 * 3600; // Shopee caps the window at 15 days per call
const list = await get("/api/v2/order/get_order_list", {
  time_range_field: "create_time",
  time_from: String(from),
  time_to: String(to),
  page_size: "100",
  order_status: "READY_TO_SHIP",
});

if (list.error) {
  console.error("get_order_list failed:", JSON.stringify(list, null, 2));
  process.exit(1);
}

const sns = (list.response?.order_list ?? []).map((o) => o.order_sn);
console.log(`\nOrders in READY_TO_SHIP (last 14 days): ${sns.length}`);
if (!sns.length) {
  console.log("Nothing to ship.\n");
  process.exit(0);
}

const detail = await get("/api/v2/order/get_order_detail", {
  order_sn_list: sns.join(","),
  response_optional_fields: "buyer_username,item_list,pay_time,order_status",
});

for (const o of detail.response?.order_list ?? []) {
  const items = (o.item_list ?? []).map((i) => i.item_name).join(", ");
  const paid = o.pay_time ? new Date(o.pay_time * 1000).toISOString() : "unpaid";
  console.log(`  ${o.order_sn}  ${o.order_status}  paid=${paid}  ${o.buyer_username ?? ""}  ${items}`);
}
console.log(`\nTo ship one:  node --env-file=.env.local scripts/ship-shopee-order.mjs --ship <order_sn>\n`);
