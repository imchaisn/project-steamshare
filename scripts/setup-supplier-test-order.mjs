/**
 * setup-supplier-test-order.mjs — build one end-to-end test order that pulls
 * its Steam code from another of our websites.
 *
 * Creates (idempotently) the game, the Steam account, the account-game link,
 * and the `orders` row carrying the mapping:
 *
 *     our order id  ->  (other website, that website's order id)
 *
 * then tells you the two values to paste into the lookup form.
 *
 * CONTAINS NO CREDENTIALS. Reads them from local/websites/<domain>.md, which is
 * gitignored. This file is tracked and the repo is PUBLIC.
 *
 * Writes through PostgREST with the service-role key, because the direct DB
 * password is broken (CHECKPOINT.md open item 1).
 *
 * Usage:
 *   node scripts/setup-supplier-test-order.mjs --username <steam username> \
 *        [--order-id GHOST-TEST-001] [--game "Ghost of Tsushima"] [--dry-run]
 *
 * Env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ACCOUNTS_ENCRYPTION_KEY
 */

import { readFileSync, readdirSync } from "fs";
import { join } from "path";

const args = process.argv.slice(2);
const flag = (name, fallback = null) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? fallback : args[i + 1];
};
const DRY = args.includes("--dry-run");

const USERNAME = flag("username");
const OUR_ORDER_ID = flag("order-id", "GHOST-TEST-001");
const THEIR_ORDER_ID_OVERRIDE = flag("their-order-id");
const SITE_OVERRIDE = flag("site");
const WEBSITES_DIR = process.env.WEBSITES_DIR ?? "local/websites";
const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const ENC_KEY = process.env.ACCOUNTS_ENCRYPTION_KEY ?? "";

if (!USERNAME) {
  console.error("\n--username is required (the Steam username on the other site)\n");
  process.exit(1);
}
const missing = [];
if (!ENC_KEY) missing.push("ACCOUNTS_ENCRYPTION_KEY");
if (!SUPABASE_URL) missing.push("NEXT_PUBLIC_SUPABASE_URL");
if (!SERVICE_KEY) missing.push("SUPABASE_SERVICE_ROLE_KEY");
if (missing.length) {
  console.error(`\nMissing env var(s): ${missing.join(", ")}\n`);
  process.exit(1);
}

// ── Encryption: mirrors lib/encryption.ts (AES-256-GCM, base64(iv||ct)) ──
async function encrypt(plaintext) {
  const km = Uint8Array.from(Buffer.from(ENC_KEY, "base64"));
  if (km.length !== 32) throw new Error("ACCOUNTS_ENCRYPTION_KEY must decode to 32 bytes");
  const key = await crypto.subtle.importKey("raw", km, "AES-GCM", false, ["encrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const buf = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv }, key, new TextEncoder().encode(plaintext),
  );
  const out = new Uint8Array(iv.length + buf.byteLength);
  out.set(iv, 0);
  out.set(new Uint8Array(buf), iv.length);
  return Buffer.from(out).toString("base64");
}

// ── Find this username in local/websites/ ──
function findAccount(username) {
  for (const f of readdirSync(WEBSITES_DIR).filter(
    (n) => n.endsWith(".md") && n !== "README.md" && !n.endsWith("-contract.md"),
  )) {
    const domain = f.replace(/\.md$/, "");
    const lines = readFileSync(join(WEBSITES_DIR, f), "utf8").split(/\r?\n/);
    let headers = null;
    let rotationOrderId = null;
    for (const line of lines) {
      if (line.startsWith("#")) { headers = null; rotationOrderId = null; continue; }
      const m = line.match(/Order ID\s+`([^`]+)`/i);
      if (m) { rotationOrderId = m[1]; continue; }
      if (!line.trim().startsWith("|")) continue;
      if (/^\|[\s|:-]+\|$/.test(line.trim())) continue;
      const cells = line.split("|").slice(1, -1).map((c) => c.trim().replace(/^`|`$/g, ""));
      if (!headers) { headers = cells.map((c) => c.toLowerCase()); continue; }
      const get = (n) => {
        const i = headers.findIndex((h) => h.includes(n));
        return i === -1 ? "" : (cells[i] ?? "");
      };
      if (get("username").toLowerCase() !== username.toLowerCase()) continue;
      return {
        site: domain,
        theirOrderId: get("order id") || rotationOrderId,
        username: get("username"),
        password: get("password"),
        game: get("game") || "Untitled",
      };
    }
  }
  return null;
}

const acct = findAccount(USERNAME);
if (!acct) {
  console.error(`\nNo account "${USERNAME}" found in ${WEBSITES_DIR}/*.md\n`);
  process.exit(1);
}
if (THEIR_ORDER_ID_OVERRIDE) acct.theirOrderId = THEIR_ORDER_ID_OVERRIDE;
if (SITE_OVERRIDE) acct.site = SITE_OVERRIDE;

// Refuse early rather than letting migration 0011's CHECK constraint reject the
// insert with a raw Postgres error. A supplier account with no order id can
// fetch nothing, so there is nothing useful to create. Pool tables carry the
// order id in the prose above them rather than in a column, hence the flag.
if (!acct.theirOrderId) {
  console.error(
    `
No order id for "${acct.username}" in ${WEBSITES_DIR}, and none given.
` +
      `Pass --their-order-id <id on their site>.
`,
  );
  process.exit(1);
}

const GAME_TITLE = flag("game", acct.game.replace(/\s*\(.*\)\s*$/, "").trim());

const headers = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  "Content-Type": "application/json",
  Prefer: "return=representation",
};
const rest = (t) => `${SUPABASE_URL}/rest/v1/${t}`;

console.log(`\nWill create:`);
console.log(`  game            : ${GAME_TITLE}`);
console.log(`  steam account   : ${acct.username}`);
console.log(`  other website   : ${acct.site}`);
console.log(`  their order id  : ${acct.theirOrderId}`);
console.log(`  OUR order id    : ${OUR_ORDER_ID}`);
if (DRY) { console.log(`\n--dry-run: nothing written.\n`); process.exit(0); }

// ── Preflight: do the migrations exist? ──
const probe = await fetch(`${rest("orders")}?select=supplier_order_id&limit=1`, { headers });
if (!probe.ok) {
  const body = await probe.text();
  console.error("\n=== MIGRATIONS NOT APPLIED ===");
  console.error(body.slice(0, 200));
  console.error(
    "\nApply supabase/migrations/0011_steam_accounts_code_source.sql and\n" +
      "0012_orders_supplier_mapping.sql in the Supabase SQL editor first.\n" +
      "The direct DB password does not work (CHECKPOINT.md open item 1), so\n" +
      "scripts/run-migrations.mjs cannot do it.\n",
  );
  process.exit(1);
}

async function upsert(table, match, payload) {
  const q = Object.entries(match).map(([k, v]) => `${k}=eq.${encodeURIComponent(v)}`).join("&");
  const found = await (await fetch(`${rest(table)}?select=id&${q}`, { headers })).json();
  if (Array.isArray(found) && found.length) {
    const res = await fetch(`${rest(table)}?id=eq.${found[0].id}`, {
      method: "PATCH", headers, body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`${table} update: ${await res.text()}`);
    return found[0].id;
  }
  const res = await fetch(rest(table), {
    method: "POST", headers, body: JSON.stringify({ ...match, ...payload }),
  });
  if (!res.ok) throw new Error(`${table} insert: ${await res.text()}`);
  return (await res.json())[0].id;
}

const gameId = await upsert("games", { title: GAME_TITLE }, { steam_app_id: "0" });
console.log(`  game id         : ${gameId}`);

const accountId = await upsert(
  "steam_accounts",
  { username: acct.username },
  {
    password_enc: await encrypt(acct.password),
    code_source: "supplier",
    supplier_site: acct.site,
    supplier_order_id: acct.theirOrderId,
    status: "active",
  },
);
console.log(`  account id      : ${accountId}`);

const accountGameId = await upsert(
  "account_games",
  { account_id: accountId, game_id: gameId },
  {},
);
console.log(`  account_game id : ${accountGameId}`);

const orderId = await upsert(
  "orders",
  { shopee_order_id: OUR_ORDER_ID },
  {
    account_game_id: accountGameId,
    verified: true,
    // THE MAPPING — our order id connected to that website's order id.
    supplier_site: acct.site,
    supplier_order_id: acct.theirOrderId,
  },
);
console.log(`  order id        : ${orderId}`);

// The game line (migration 0014). NOT optional: the buyer lookup resolves the
// code source from order_games.supplier_site/supplier_order_id, not from the
// order, so an order written without one answers "order not found" and a
// mapping written only on the order changes nothing for the buyer.
const existingLines = await (
  await fetch(`${rest("order_games")}?select=id&order_id=eq.${orderId}`, { headers })
).json();
if (Array.isArray(existingLines) && existingLines.length) {
  const res = await fetch(`${rest("order_games")}?id=eq.${existingLines[0].id}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({
      account_game_id: accountGameId,
      supplier_site: acct.site,
      supplier_order_id: acct.theirOrderId,
    }),
  });
  if (!res.ok) throw new Error(`order_games update: ${await res.text()}`);
} else {
  const res = await fetch(rest("order_games"), {
    method: "POST",
    headers,
    body: JSON.stringify({
      order_id: orderId,
      account_game_id: accountGameId,
      supplier_site: acct.site,
      supplier_order_id: acct.theirOrderId,
      position: 0,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    if (/order_games|42P01|schema cache/.test(body)) {
      throw new Error(
        `order_games insert failed: ${body}
   Apply supabase/migrations/0014_order_games.sql first.`,
      );
    }
    throw new Error(`order_games insert: ${body}`);
  }
}
console.log(`  game line       : written`);

console.log(`\nDone. Test it:\n`);
console.log(`  curl -sS https://www.gameshare.space/api/lookup \\`);
console.log(`    -H "Content-Type: application/json" \\`);
console.log(`    -H "x-api-secret: $API_SECRET" \\`);
console.log(
  `    -d '{"orderId":"${OUR_ORDER_ID}","username":"${acct.username}"}'\n`,
);
console.log(`Requires SUPPLIER_CODE_SOURCE=true in Vercel production AND a redeploy.\n`);
