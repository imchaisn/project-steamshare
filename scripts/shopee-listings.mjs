/**
 * shopee-listings.mjs
 * Answer one question: "if a buyer purchases this listing right now, do they
 * get their game automatically?" — and fix it when the answer is no.
 *
 * Usage (both forms read credentials from .env.local via --env-file):
 *
 *   node --env-file=.env.local scripts/shopee-listings.mjs
 *       Coverage report. Every live Shopee listing and variation, whether it
 *       maps to one of our games, and whether that game has an active account.
 *       Also lists games that have stock but no Shopee listing (idle inventory).
 *
 *   node --env-file=.env.local scripts/shopee-listings.mjs --map <item_id> <model_id> <steam_app_id>
 *       Add or re-point one mapping. Use model_id 0 for a listing with no
 *       variations. steam_app_id must already exist in `games`.
 *
 * ── WHY THIS EXISTS ────────────────────────────────────────────────────────
 * NOTHING about a new Shopee listing is automatic. `shopee_listings` is the
 * only thing that can tell a paid order which of our games it is for — a
 * Shopee order names an item_id, never a game — and it is maintained by hand.
 *
 * An unmapped listing fails in the worst possible way: silently, and only for
 * the buyer. fulfillOrder() returns `no_mapping`, the webhook ACKs with 200
 * (correctly — a Shopee retry cannot invent a mapping, only a human can), and
 * the sole trace is a console.error in the Vercel logs. On 2026-09-05 a real
 * buyer paid for a Euro Truck Simulator 2 listing created after the mappings
 * were seeded, and nothing anywhere raised its hand.
 *
 * So: RUN THE REPORT AFTER EVERY LISTING CHANGE. A ❌ line is a listing that
 * takes money and delivers nothing.
 *
 * ── WHY IT DOES NOT AUTO-MAP ───────────────────────────────────────────────
 * Matching a Shopee item to one of our games by NAME is deliberately not
 * implemented. Item names are marketing copy that gets edited constantly
 * ("[Steam] Euro Truck Simulator 2 ETS2 PC Game | Shared Account | ..."), and
 * a wrong guess hands a buyer the wrong game — strictly worse than a loud
 * failure. The report tells you what is missing; a human decides what it means.
 *
 * ── WHY NOT scripts/seed-shopee-listings.mjs ───────────────────────────────
 * That script connects to Postgres directly with DB_PASSWORD, which stopped
 * working on 2026-09-05 (see CHECKPOINT open item 1). This one goes through
 * PostgREST with the service-role key, which is the same credential the app
 * itself uses and is known good. Both write the same table.
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

const [authRow] = await rest("shopee_auth?select=shop_id,access_token_enc");
if (!authRow) {
  console.error("\nNo authorized Shopee shop on file. Complete the authorization flow first.\n");
  process.exit(1);
}
const ACCESS_TOKEN = decrypt(authRow.access_token_enc);
const SHOP_ID = authRow.shop_id;

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

/* ── --map mode ─────────────────────────────────────────────────────────── */

const args = process.argv.slice(2);
if (args[0] === "--map") {
  const [, itemId, modelId, steamAppId] = args;
  if (!itemId || modelId === undefined || !steamAppId) {
    console.error("\nusage: --map <item_id> <model_id> <steam_app_id>   (model_id 0 = no variations)\n");
    process.exit(1);
  }
  // Digits-only: Shopee ids exceed 2^53, so they are kept as strings the whole
  // way through and never parsed into a JS number.
  for (const [name, v] of [["item_id", itemId], ["model_id", modelId], ["steam_app_id", steamAppId]]) {
    if (!/^\d+$/.test(v)) {
      console.error(`\n${name} must be digits only, got ${JSON.stringify(v)}\n`);
      process.exit(1);
    }
  }

  const [game] = await rest(`games?select=id,title&steam_app_id=eq.${steamAppId}`);
  if (!game) {
    console.error(
      `\nNo game with steam_app_id=${steamAppId}. Add the game (and an account that owns it) first —\n` +
        "mapping a listing to a game nobody owns just turns no_mapping into no_capacity.\n",
    );
    process.exit(1);
  }

  await fetch(`${SUPABASE_URL}/rest/v1/shopee_listings?on_conflict=item_id,model_id`, {
    method: "POST",
    headers: { ...HJ, Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify([{ item_id: itemId, model_id: modelId, game_id: game.id }]),
  }).then(async (r) => {
    if (!r.ok) throw new Error(`upsert failed HTTP ${r.status}: ${(await r.text()).slice(0, 300)}`);
  });

  console.log(`\nMapped item ${itemId} / model ${modelId} -> ${game.title}\n`);
  console.log("Re-run without --map to confirm it now shows as deliverable.\n");
  process.exit(0);
}

/* ── report mode ────────────────────────────────────────────────────────── */

const list = await shopee("/api/v2/product/get_item_list", {
  offset: "0",
  page_size: "100",
  item_status: "NORMAL",
});
const itemIds = (list?.item ?? []).map((i) => i.item_id);
if (!itemIds.length) {
  console.log("\nNo NORMAL listings on this shop.\n");
  process.exit(0);
}
const base = await shopee("/api/v2/product/get_item_base_info", {
  item_id_list: itemIds.join(","),
});

const mappings = await rest("shopee_listings?select=item_id,model_id,games(title)");
const mapped = new Map(mappings.map((m) => [`${m.item_id}:${m.model_id}`, m.games?.title]));

const accountGames = await rest(
  "account_games?select=games(title),steam_accounts(username,status)",
);
const stock = new Map();
for (const ag of accountGames) {
  if (ag.steam_accounts?.status !== "active") continue;
  const title = ag.games?.title;
  stock.set(title, [...(stock.get(title) ?? []), ag.steam_accounts.username]);
}

console.log("\nSHOPEE LISTING COVERAGE");
console.log("=".repeat(78));

let broken = 0;
for (const item of base?.item_list ?? []) {
  console.log(`\n${(item.item_name ?? "").slice(0, 66)}`);
  console.log(`  item_id ${item.item_id}`);

  const models = item.has_model
    ? (await shopee("/api/v2/product/get_model_list", { item_id: String(item.item_id) }))?.model ?? []
    : [{ model_id: 0, model_name: "(no variations)" }];

  for (const m of models) {
    const game = mapped.get(`${item.item_id}:${m.model_id}`);
    const accounts = game ? (stock.get(game) ?? []) : [];
    let verdict;
    if (!game) {
      verdict = "UNMAPPED - a purchase here delivers NOTHING";
      broken++;
    } else if (!accounts.length) {
      verdict = `mapped to ${game} but NO ACTIVE ACCOUNT - no_capacity`;
      broken++;
    } else {
      verdict = `OK  ${game} -> ${accounts.join(", ")}`;
    }
    console.log(
      `    ${String(m.model_id).padEnd(15)} ${String(m.model_name).slice(0, 22).padEnd(24)} ${verdict}`,
    );
  }
  // Courtesy spacing; this loop is one call per item and shops are small.
  await new Promise((s) => setTimeout(s, 250));
}

console.log("\n" + "=".repeat(78));
console.log("GAMES WITH STOCK BUT NO SHOPEE LISTING (idle inventory):");
const listedGames = new Set([...mapped.values()].filter(Boolean));
let idle = 0;
for (const [title, accounts] of stock) {
  if (!listedGames.has(title)) {
    console.log(`  ${title.padEnd(26)} ${accounts.join(", ")}`);
    idle++;
  }
}
if (!idle) console.log("  (none)");

console.log("");
if (broken) {
  console.log(`${broken} variation(s) cannot auto-deliver. Fix each with:`);
  console.log("  node --env-file=.env.local scripts/shopee-listings.mjs --map <item_id> <model_id> <steam_app_id>\n");
  process.exitCode = 1;
} else {
  console.log("Every live listing can auto-deliver.\n");
}
