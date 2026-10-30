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
 *       Also lists games that have stock but no Shopee listing (idle inventory),
 *       and UNLISTED items separately -- those cannot be bought, so they are not
 *       a delivery risk, but they are stock earning nothing.
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

async function itemIdsWithStatus(status) {
  const r = await shopee("/api/v2/product/get_item_list", {
    offset: "0",
    page_size: "100",
    item_status: status,
  });
  return (r?.item ?? []).map((i) => i.item_id);
}

// UNLIST items are fetched too, but kept apart from the coverage verdict:
// nobody can buy them, so they are not a delivery risk. They must not vanish
// from the report either. Before this they were invisible in BOTH halves --
// excluded from coverage for being unlisted, and dropped from idle inventory
// the moment someone added their mapping -- so an unlisted listing read as
// "handled" while earning nothing.
const itemIds = await itemIdsWithStatus("NORMAL");
const unlistedIds = await itemIdsWithStatus("UNLIST");
if (!itemIds.length && !unlistedIds.length) {
  console.log("\nNo listings on this shop.\n");
  process.exit(0);
}
const base = itemIds.length
  ? await shopee("/api/v2/product/get_item_base_info", { item_id_list: itemIds.join(",") })
  : { item_list: [] };

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

// ── PRE-ORDER AUDIT ────────────────────────────────────────────────────────
// Chaison's rule, 2026-09-07: a listing may be PRE-ORDER only while we hold no
// credentials for it. If a buyer can already be sent an order id, a username and a
// password, then pre-order is false — it suppresses conversion and misdescribes
// delivery on a listing that is in fact deliverable within 24h.
//
// `pre_order` arrives on get_item_base_info as { is_pre_order, days_to_ship } and was
// read by NOTHING in this repo: grep for pre_order / days_to_ship across scripts/ and
// lib/ returned zero hits on 2026-09-07. So this had no detector at all — the same
// silent shape as the unmapped-listing failure documented at the top of this file,
// where the only trace of a real buyer's broken order was a Vercel log line.
//
// "Deliverable" is deliberately the SAME condition the coverage verdict uses: at least
// one variation maps to a game with an ACTIVE account. Anything looser would flag a
// listing as wrongly-pre-order when it genuinely cannot ship.
// Pre-order is signalled TWO ways in this shop, and the API flag is the one nobody uses.
// FACT-V 2026-09-07: a full production run found ZERO listings carrying
// pre_order.is_pre_order, while eight carried a literal "[PRE-ORDER]" prefix in the item
// NAME instead. A detector that reads only the API field reports "all clear" while eight
// mislabelled listings sit there — a false negative, which is the worst kind of check.
// So both are treated as a pre-order claim.
const PRE_ORDER_IN_NAME = /\[\s*PRE[-\s]?ORDER\s*\]/i;
const isPreOrderItem = (item) =>
  item?.pre_order?.is_pre_order === true || PRE_ORDER_IN_NAME.test(item?.item_name ?? "");

for (const item of base?.item_list ?? []) {
  console.log(`\n${(item.item_name ?? "").slice(0, 66)}`);
  console.log(`  item_id ${item.item_id}`);

  if (isPreOrderItem(item)) {
    console.log(`  PRE-ORDER  days_to_ship ${item.pre_order?.days_to_ship ?? "?"}`);
  }

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

// Hoisted out of the block below: the pre-order audit needs these too, and every
// mislabelled listing found on 2026-09-07 was UNLIST rather than NORMAL.
const un = unlistedIds.length
  ? await shopee("/api/v2/product/get_item_base_info", { item_id_list: unlistedIds.join(",") })
  : { item_list: [] };

if (unlistedIds.length) {
  console.log("\n" + "=".repeat(78));
  console.log("UNLISTED (not purchasable, earning nothing):");
  for (const item of un?.item_list ?? []) {
    const names = [
      ...new Set(
        mappings
          .filter((m) => m.item_id === item.item_id)
          .map((m) => m.games?.title)
          .filter(Boolean),
      ),
    ];
    // A mapping row alone does NOT mean the listing would deliver, and saying so here was a
    // real defect: this note was built from `mappings` and never consulted account status,
    // while the pre-order audit below DID filter on it. The same report therefore made two
    // contradictory statements about DELTARUNE and Ghost of Tsushima — both accounts are
    // `recovering` — and the more inviting of the two was the false one. Anyone working from
    // the UNLISTED list rather than the audit would have re-listed two undeliverable games.
    // Found by project-steamshare-5a, 2026-09-07.
    const deliverable = names.filter((t) => (stock.get(t) ?? []).length);
    const note = !names.length
      ? "UNMAPPED - map it before re-listing"
      : deliverable.length
        ? "mapped to " + deliverable.join(", ") + " - re-list and it delivers"
        : "mapped to " + names.join(", ") + " - NO ACTIVE ACCOUNT, *NOT* re-listable";
    console.log("  " + item.item_id + "  " + (item.item_name ?? "").slice(0, 40).padEnd(42) + note);
  }
}

console.log("\n" + "=".repeat(78));
console.log("PRE-ORDER CLAIM vs REALITY:");
console.log(
  "  Rule (Chaison, 2026-09-07): pre-order is ONLY for titles we hold no credentials for.",
);
console.log("  If a buyer can already be sent an order id, username and password, it is not");
console.log("  a pre-order — the label suppresses conversion and misdescribes delivery.");

// Deliverability is derived WITHOUT extra API calls: a listing is deliverable when one of
// its mapped games has an ACTIVE account, which is the same condition the coverage verdict
// above uses. Anything looser would flag a listing that genuinely cannot ship.
const gamesForItem = (itemId) => [
  ...new Set(
    mappings
      .filter((m) => m.item_id === itemId)
      .map((m) => m.games?.title)
      .filter(Boolean),
  ),
];

const preOrderWrong = []; // claims pre-order, but is deliverable today
const preOrderRight = []; // claims pre-order, and genuinely is not deliverable
// The INVERSE, and the more dangerous direction. Suggested by project-steamshare-65 after a
// shop-wide scan on 2026-09-07 found two of them: a listing that does NOT claim pre-order, is
// mapped to a real game, and has no working account behind it. It advertises order-now delivery
// it cannot make. Both found were UNLIST, so nothing was selling — but the failure only shows up
// once someone publishes, and by then a buyer has paid. Checking one direction and calling the
// audit done is how the first version of this detector missed all seven.
const claimsOrderNowCannotDeliver = [];

for (const [item, listed] of [
  ...(base?.item_list ?? []).map((i) => [i, true]),
  ...(un?.item_list ?? []).map((i) => [i, false]),
]) {
  const mappedGames = gamesForItem(item.item_id);
  const deliverable = mappedGames.filter((t) => (stock.get(t) ?? []).length);
  const row = {
    itemId: item.item_id,
    name: (item.item_name ?? "").slice(0, 52),
    games: deliverable.length ? deliverable : mappedGames,
    listed,
  };
  if (isPreOrderItem(item)) {
    (deliverable.length ? preOrderWrong : preOrderRight).push(row);
  } else if (mappedGames.length && !deliverable.length) {
    // Mapped but nothing active behind it. Unmapped items are NOT reported here — the
    // coverage section above already names them, and repeating them would bury this.
    claimsOrderNowCannotDeliver.push(row);
  }
}

if (!preOrderWrong.length && !preOrderRight.length) {
  console.log("\n  (nothing claims pre-order, by API flag or by title)");
}

if (preOrderWrong.length) {
  console.log(
    `\n  ❌ WRONGLY PRE-ORDER — ${preOrderWrong.length} listing(s) deliverable TODAY.`,
  );
  console.log("     Fix, per listing, in Seller Centre — Chaison only, no API call here does it:");
  console.log("       1. remove the [PRE-ORDER] prefix from the title");
  console.log("       2. clear the pre-order setting if it is set");
  console.log("       3. re-list it if it is UNLIST — an unlisted listing earns nothing");
  for (const p of preOrderWrong) {
    console.log(
      `       ${p.listed ? "LIVE  " : "UNLIST"} ${String(p.itemId).padEnd(13)} ` +
        `${p.name.padEnd(54)} -> ${p.games.join(", ")}`,
    );
  }
  console.log(
    "\n     Cross-check each against scripts/publish-readiness.mjs before re-listing: a game",
  );
  console.log(
    "     under 🔴 DO NOT LIST or ⚠️ VERIFY BEFORE LISTING stays down regardless of stock.",
  );
}

if (preOrderRight.length) {
  console.log(
    `\n  ✅ CORRECTLY PRE-ORDER — ${preOrderRight.length} listing(s) we cannot deliver yet.`,
  );
  for (const p of preOrderRight) {
    console.log(`       ${p.listed ? "LIVE  " : "UNLIST"} ${String(p.itemId).padEnd(13)} ${p.name}`);
  }
}

if (claimsOrderNowCannotDeliver.length) {
  console.log(
    `\n  ⚠️ CLAIMS ORDER-NOW BUT CANNOT DELIVER — ${claimsOrderNowCannotDeliver.length} listing(s).`,
  );
  console.log("     Mapped to a real game, no ACTIVE account behind it. A LIVE row here takes");
  console.log("     money it cannot serve; an UNLIST row does that the moment it is published.");
  for (const p of claimsOrderNowCannotDeliver) {
    console.log(
      `       ${p.listed ? "LIVE ❗" : "UNLIST"} ${String(p.itemId).padEnd(13)} ` +
        `${p.name.padEnd(54)} -> ${p.games.join(", ")}`,
    );
  }
}

console.log("\n" + "=".repeat(78));
console.log("GAMES WITH STOCK BUT NO SHOPEE LISTING (idle inventory):");
// A game counts as "listed" only if its mapping points at a NORMAL item.
// Mapping an UNLIST item does not make its stock sellable, and treating it as
// listed is what hid How to Fish from this report entirely.
const normalItemIds = new Set(itemIds);
const listedGames = new Set(
  mappings
    .filter((m) => normalItemIds.has(m.item_id))
    .map((m) => m.games?.title)
    .filter(Boolean),
);
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
