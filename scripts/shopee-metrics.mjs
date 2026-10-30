/**
 * shopee-metrics.mjs
 * Pull the key sales, listing and Shopee Ads metrics in one READ-ONLY run.
 *
 * Usage:
 *   node --env-file=.env.local scripts/shopee-metrics.mjs [--days 14] [--out metrics.json]
 *
 * What it reads (all FACT-V 2026-09-13 — every call returned data on this shop):
 *   - product.get_item_list / get_item_base_info  live listings and names
 *   - product.get_item_extra_info                 per-listing views, sale, likes, rating
 *   - ads.get_total_balance                       Shopee Ads credit
 *   - ads.get_all_cpc_ads_daily_performance       shop-level daily ads: impressions, clicks,
 *                                                 spend, orders, GMV, ROAS
 *   - ads.get_product_level_campaign_id_list      product campaigns
 *   - ads.get_product_campaign_daily_performance  per-campaign daily results
 *   - ads.get_product_level_campaign_setting_info status, bidding, budget, ROAS target
 *   - account_health.get_shop_performance         response rate, shop rating, violations
 *   - Supabase order_games                        our own order lines per listing per day
 *                                                 (item id + timestamp only, no buyer data)
 *
 * What it CANNOT read. These are Seller Centre only (research/2026-09-13-shopee-metrics-playbook.md):
 *   visitors, conversion rate, add-to-cart, traffic sources, Top Keywords. Ask Chaison to export
 *   Business Insights and read the file with python -m markitdown.
 *
 * Known limits, 2026-09-13:
 *   - ads.get_recommended_keyword_list returned an EMPTY list for all 10 listings tried.
 *   - ads.get_gms_campaign_performance hit ads_rate_limit_total_api; get_gms_item_performance
 *     returned ads_error_param. GMV Max spend is therefore not broken out here: the shop-level
 *     daily totals include it, the product-campaign rows do not.
 *   - get_item_extra_info "sale" lags our own order count; trust order_games for recent orders.
 *
 * Writes nothing to Shopee. The only database write is the access-token refresh, copied verbatim
 * from scripts/shopee-listings.mjs: the refresh token rotates and must be stored back.
 * The repo is public: this prints listing names and numbers only, never tokens or credentials.
 */


import crypto from "node:crypto";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PARTNER_ID = process.env.SHOPEE_PARTNER_ID;
const PARTNER_KEY = process.env.SHOPEE_PARTNER_KEY;
const ENC_KEY = process.env.ACCOUNTS_ENCRYPTION_KEY;

const IS_SANDBOX = (process.env.SHOPEE_ENV ?? "sandbox") !== "live";
const SHOPEE_HOST =
  process.env.SHOPEE_API_HOST ??
  (IS_SANDBOX
    ? "https://openplatform.sandbox.test-stable.shopee.sg"
    : "https://partner.shopeemobile.com");

const missing = Object.entries({
  NEXT_PUBLIC_SUPABASE_URL: SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY,
  SHOPEE_PARTNER_ID: PARTNER_ID,
  SHOPEE_PARTNER_KEY: PARTNER_KEY,
  ACCOUNTS_ENCRYPTION_KEY: ENC_KEY,
})
  .filter(([, v]) => !v)
  .map(([k]) => k);

if (missing.length) {
  console.error(`\nMissing env var(s): ${missing.join(", ")}`);
  console.error("Run with:  node --env-file=.env.local scripts/shopee-listings.mjs\n");
  process.exit(1);
}

const H = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` };
const HJ = { ...H, "Content-Type": "application/json" };

const rest = async (path, init) => {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: H, ...init });
  const text = await res.text();
  if (!res.ok) throw new Error(`Supabase ${path} -> HTTP ${res.status}: ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
};

/**
 * Decrypt an AES-256-GCM value written by lib/encryption.ts, which stores
 * base64(iv || ciphertext || tag). node:crypto wants the 16-byte auth tag
 * separated out, whereas WebCrypto keeps it appended — hence the split.
 */
function decrypt(b64) {
  const combined = Buffer.from(b64, "base64");
  const iv = combined.subarray(0, 12);
  const rest_ = combined.subarray(12);
  const tag = rest_.subarray(rest_.length - 16);
  const body = rest_.subarray(0, rest_.length - 16);
  const d = crypto.createDecipheriv("aes-256-gcm", Buffer.from(ENC_KEY, "base64"), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(body), d.final()]).toString("utf8");
}

/** Inverse of decrypt() — same base64(iv || ciphertext || tag) layout lib/encryption.ts writes. */
function encrypt(plain) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", Buffer.from(ENC_KEY, "base64"), iv);
  const body = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return Buffer.concat([iv, body, c.getAuthTag()]).toString("base64");
}

const [authRow] = await rest(
  "shopee_auth?select=shop_id,access_token_enc,refresh_token_enc,access_token_expires_at,refresh_token_expires_at",
);
if (!authRow) {
  console.error("\nNo authorized Shopee shop on file. Complete the authorization flow first.\n");
  process.exit(1);
}
const SHOP_ID = authRow.shop_id;
let ACCESS_TOKEN = decrypt(authRow.access_token_enc);

/**
 * Refresh the stored access_token when it is spent.
 *
 * WHY: the access_token window is only 4 hours. lib/shopee-auth.ts refreshes
 * transparently, so the running app never notices — but this script used to
 * call Shopee with whatever token the row happened to hold. Any run more than
 * 4h after the last app-side refresh died on "invalid_acceess_token" (Shopee's
 * spelling, not ours), which reads like a broken authorization rather than a
 * routine expiry and sends you to the Console to re-authorize for nothing.
 *
 * The refresh_token is single-use and ROTATES on every call, so the new pair
 * must be written back or the next run is locked out for real. That also means
 * this races the app if both refresh at once — acceptable at current volume,
 * the same caveat getValidAccessToken() documents.
 */
async function refreshAccessToken() {
  const path = "/api/v2/auth/access_token/get";
  const ts = Math.floor(Date.now() / 1000);
  // Public-API sign: partner_id + path + timestamp. No access_token, no shop_id.
  const sign = crypto
    .createHmac("sha256", PARTNER_KEY)
    .update(PARTNER_ID + path + ts)
    .digest("hex");
  const url = `${SHOPEE_HOST}${path}?partner_id=${PARTNER_ID}&timestamp=${ts}&sign=${sign}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      refresh_token: decrypt(authRow.refresh_token_enc),
      partner_id: Number(PARTNER_ID),
      shop_id: SHOP_ID,
    }),
  });
  const data = await res.json();
  if (data.error) {
    throw new Error(
      `Shopee token refresh failed: ${data.error} — ${data.message ?? ""}` +
        " | If the refresh_token is past its 30 days, re-authorize the shop in the Console.",
    );
  }
  const now = Date.now();
  await rest("shopee_auth?shop_id=eq." + SHOP_ID, {
    method: "PATCH",
    headers: { ...HJ, Prefer: "return=minimal" },
    body: JSON.stringify({
      access_token_enc: encrypt(data.access_token),
      refresh_token_enc: encrypt(data.refresh_token),
      access_token_expires_at: new Date(now + data.expire_in * 1000).toISOString(),
      refresh_token_expires_at: new Date(now + 30 * 24 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date(now).toISOString(),
    }),
  });
  ACCESS_TOKEN = data.access_token;
  console.log("Shopee access_token refreshed (the stored one had expired).");
}

// 15-minute buffer, matching getValidAccessToken() in lib/shopee-auth.ts.
if (new Date(authRow.access_token_expires_at).getTime() - Date.now() < 15 * 60 * 1000) {
  await refreshAccessToken();
}

/** Shop-scoped call. Sign formula: partner_id + path + timestamp + token + shop_id. */
async function shopee(path, extra = {}) {
  const ts = Math.floor(Date.now() / 1000);
  const sign = crypto
    .createHmac("sha256", PARTNER_KEY)
    .update(PARTNER_ID + path + ts + ACCESS_TOKEN + SHOP_ID)
    .digest("hex");
  const q = new URLSearchParams({
    partner_id: PARTNER_ID,
    timestamp: String(ts),
    access_token: ACCESS_TOKEN,
    shop_id: String(SHOP_ID),
    sign,
    ...extra,
  });
  const json = await (await fetch(`${SHOPEE_HOST}${path}?${q}`)).json();
  if (json.error) throw new Error(`Shopee ${path}: ${json.error} — ${json.message ?? ""}`);
  return json.response;
}

/* ── metrics ────────────────────────────────────────────────────────────── */

import fs from "node:fs";

const argv = process.argv.slice(2);
const argVal = (flag, dflt) => {
  const i = argv.indexOf(flag);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : dflt;
};
const DAYS = Number(argVal("--days", "14"));
const OUT = argVal("--out", null);

const result = { pulled_at: new Date().toISOString(), days: DAYS, access: {} };

async function tryCall(label, path, params) {
  try {
    const r = await shopee(path, params);
    result.access[label] = "ok";
    return r;
  } catch (e) {
    result.access[label] = String(e.message).slice(0, 200);
    return null;
  }
}

const pad = (n) => String(n).padStart(2, "0");
const dmy = (d) => `${pad(d.getUTCDate())}-${pad(d.getUTCMonth() + 1)}-${d.getUTCFullYear()}`;
const endDate = new Date(Date.now() - 24 * 3600 * 1000); // yesterday; today is partial
const startDate = new Date(Date.now() - DAYS * 24 * 3600 * 1000);

// Live listings and names
const liveIds = [];
for (let offset = 0; ; offset += 100) {
  const r = await tryCall("product.get_item_list", "/api/v2/product/get_item_list", {
    offset: String(offset), page_size: "100", item_status: "NORMAL",
  });
  liveIds.push(...(r?.item ?? []).map((i) => i.item_id));
  if (!r?.has_next_page) break;
}
const names = new Map();
for (let i = 0; i < liveIds.length; i += 50) {
  const b = await tryCall("product.get_item_base_info", "/api/v2/product/get_item_base_info", {
    item_id_list: liveIds.slice(i, i + 50).join(","),
  });
  for (const it of b?.item_list ?? []) names.set(String(it.item_id), it.item_name ?? "");
}

// Per-listing counters
result.listings = [];
for (let i = 0; i < liveIds.length; i += 50) {
  const r = await tryCall("product.get_item_extra_info", "/api/v2/product/get_item_extra_info", {
    item_id_list: liveIds.slice(i, i + 50).join(","),
  });
  for (const it of r?.item_list ?? []) result.listings.push({ name: names.get(String(it.item_id)), ...it });
}

// Ads
result.ads_balance = await tryCall("ads.get_total_balance", "/api/v2/ads/get_total_balance", {});
result.ads_daily = await tryCall("ads.get_all_cpc_ads_daily_performance",
  "/api/v2/ads/get_all_cpc_ads_daily_performance", { start_date: dmy(startDate), end_date: dmy(endDate) });

const campaigns = [];
for (let offset = 0; ; offset += 50) {
  const r = await tryCall("ads.get_product_level_campaign_id_list",
    "/api/v2/ads/get_product_level_campaign_id_list", { ad_type: "all", offset: String(offset), limit: "50" });
  campaigns.push(...(r?.campaign_list ?? []));
  if (!r?.has_next_page) break;
}
result.campaigns = [];
if (campaigns.length) {
  const idList = campaigns.slice(0, 100).map((c) => c.campaign_id).join(",");
  const perf = await tryCall("ads.get_product_campaign_daily_performance",
    "/api/v2/ads/get_product_campaign_daily_performance",
    { start_date: dmy(startDate), end_date: dmy(endDate), campaign_id_list: idList });
  const settings = await tryCall("ads.get_product_level_campaign_setting_info",
    "/api/v2/ads/get_product_level_campaign_setting_info", { campaign_id_list: idList, info_type_list: "1,2,3,4" });
  const settingById = new Map((settings?.campaign_list ?? []).map((c) => [String(c.campaign_id), c]));
  for (const c of perf?.campaign_list ?? []) {
    const t = { impression: 0, clicks: 0, expense: 0, broad_order: 0, broad_gmv: 0 };
    for (const m of c.metrics_list ?? []) for (const k of Object.keys(t)) t[k] += m[k] ?? 0;
    const setting = settingById.get(String(c.campaign_id));
    const s = setting?.common_info ?? {};
    result.campaigns.push({
      campaign_id: c.campaign_id, name: c.ad_name, status: s.campaign_status, bidding: s.bidding_method,
      budget: s.campaign_budget, roas_target: setting?.auto_bidding_info?.roas_target, totals: t,
    });
  }
}

// Shop health
result.shop_performance = await tryCall("account_health.get_shop_performance",
  "/api/v2/account_health/get_shop_performance", {});

// Our own order lines (item id + timestamp only)
try {
  const rows = await rest(
    `order_games?select=shopee_item_id,created_at&shopee_item_id=not.is.null&created_at=gte.${startDate.toISOString()}&limit=10000`,
  );
  const perItem = {};
  const perDay = {};
  for (const r of rows) {
    perItem[String(r.shopee_item_id)] = (perItem[String(r.shopee_item_id)] ?? 0) + 1;
    perDay[r.created_at.slice(0, 10)] = (perDay[r.created_at.slice(0, 10)] ?? 0) + 1;
  }
  result.orders = { lines: rows.length, per_day: perDay, per_item: perItem };
  result.access["db.order_games"] = "ok";
} catch (e) {
  result.access["db.order_games"] = String(e.message).slice(0, 200);
}

if (OUT) fs.writeFileSync(OUT, JSON.stringify(result, null, 1));

// ── report ──
const money = (n) => `RM${(n ?? 0).toFixed(2)}`;
console.log(`\nSHOPEE METRICS · last ${DAYS} days (${dmy(startDate)} → ${dmy(endDate)}) · ${liveIds.length} live listings`);
console.log("\nAccess:", Object.entries(result.access).map(([k, v]) => `${k}=${v === "ok" ? "ok" : "FAIL"}`).join(" "));

const days = Array.isArray(result.ads_daily) ? result.ads_daily : [];
const sum = (k) => days.reduce((a, d) => a + (d[k] ?? 0), 0);
const spend = sum("expense");
const clicks = sum("clicks");
const imp = sum("impression");
const ord = sum("broad_order");
const gmv = sum("broad_gmv");
console.log(`\nADS  balance ${money(result.ads_balance?.total_balance)} · impressions ${imp} · clicks ${clicks} · CTR ${imp ? ((100 * clicks) / imp).toFixed(2) : 0}%`);
console.log(`     spend ${money(spend)} · CPC ${clicks ? money(spend / clicks) : "-"} · orders ${ord} · click→order ${clicks ? ((100 * ord) / clicks).toFixed(1) : 0}% · GMV ${money(gmv)} · ROAS ${spend ? (gmv / spend).toFixed(2) : "-"} · cost/order ${ord ? money(spend / ord) : "-"}`);
for (const c of result.campaigns) {
  const t = c.totals;
  console.log(`     ${String(c.status).padEnd(8)} ${c.bidding}/roas_target ${c.roas_target} · spend ${money(t.expense)} · clicks ${t.clicks} · orders ${t.broad_order} · ${String(c.name).slice(0, 50)}`);
}

console.log("\nLISTINGS (lifetime views / sale counter) — views with no sales = page problem; no views = discovery problem");
for (const l of [...result.listings].sort((a, b) => (b.views ?? 0) - (a.views ?? 0))) {
  const recent = result.orders?.per_item?.[String(l.item_id)] ?? 0;
  console.log(`  ${String(l.views ?? 0).padStart(5)} views · ${String(l.sale ?? 0).padStart(3)} sold · ${String(recent).padStart(3)} order lines ${DAYS}d · ★${l.rating_star ?? 0} (${l.comment_count ?? 0}) · ${String(l.name).slice(0, 60)}`);
}

const sp = result.shop_performance;
if (sp) {
  console.log("\nSHOP HEALTH (current vs target)");
  for (const m of sp.metric_list ?? []) {
    if (m.current_period === null || m.current_period === undefined) continue;
    const v = m.current_period;
    const t = m.target?.value;
    const cmp = m.target?.comparator;
    const pass = { "<": v < t, "<=": v <= t, ">": v > t, ">=": v >= t }[cmp];
    console.log(`  ${pass ? "ok  " : "FAIL"} ${m.metric_name.padEnd(34)} ${v} (target ${cmp} ${t})`);
  }
}
if (result.orders) console.log(`\nORDER LINES (${DAYS}d): ${result.orders.lines} · per day ${JSON.stringify(result.orders.per_day)}`);
