/**
 * seed-test-account.mjs
 * One-shot, idempotent seed for a real end-to-end lookup test.
 *
 * Creates (or reuses, if already present):
 *   - a `games` row for Escape From Duckov
 *   - a `steam_accounts` row for ssp266 (password + Steam Guard shared_secret
 *     encrypted the same way app code does, via lib/encryption.ts's AES-256-GCM)
 *   - an `account_games` row linking them
 *   - an `orders` row (shopee_order_id "123") pointing at that link, verified
 *
 * Usage:
 *   DB_PASSWORD=xxx \
 *   SSP266_SHARED_SECRET=xxx \
 *   TEST_BUYER_ID=xxx \
 *   ACCOUNTS_ENCRYPTION_KEY=xxx \
 *   node scripts/seed-test-account.mjs
 *
 * Required env vars:
 *   DB_PASSWORD (or SUPABASE_DB_PASSWORD) — Supabase Postgres password
 *     (Dashboard → Settings → Database → Connection string)
 *   SSP266_SHARED_SECRET                  — ssp266's Steam Guard shared_secret (base64)
 *   TEST_BUYER_ID                         — a Shopee buyer ID string for the test order
 *   ACCOUNTS_ENCRYPTION_KEY               — same value already in .env.local, used to
 *                                            encrypt password/shared_secret so the app's
 *                                            own decrypt() can read them back
 *
 * Safe to re-run: uses check-then-insert for games/steam_accounts (no unique
 * constraint on those columns in 0001_init.sql) and ON CONFLICT for
 * account_games / orders (which do have unique constraints).
 */

import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, "..");

// ── Config ────────────────────────────────────────────────────────────────────
// Session pooler (IPv4-compatible) — direct connection only supports IPv6,
// which isn't resolvable from this network. See Supabase Connect > Session pooler.
const PROJECT_REF = "vwefthulbxqarttytvpl";
const DB_HOST      = "aws-0-ap-northeast-1.pooler.supabase.com";
const DB_PORT      = 5432;
const DB_NAME      = "postgres";
const DB_USER      = `postgres.${PROJECT_REF}`;
const DB_PASSWORD  = process.env.DB_PASSWORD ?? process.env.SUPABASE_DB_PASSWORD ?? "";

const SSP266_SHARED_SECRET  = process.env.SSP266_SHARED_SECRET ?? "";
const TEST_BUYER_ID         = process.env.TEST_BUYER_ID ?? "";
const ACCOUNTS_ENCRYPTION_KEY = process.env.ACCOUNTS_ENCRYPTION_KEY ?? "";

const GAME_TITLE       = "Escape From Duckov";
const GAME_STEAM_APPID = "3167020";
const ACCOUNT_USERNAME = "ssp266";
const ACCOUNT_PASSWORD = "<redacted>";
const ORDER_SHOPEE_ID  = "123";

const missing = [];
if (!DB_PASSWORD) missing.push("DB_PASSWORD (or SUPABASE_DB_PASSWORD)");
if (!SSP266_SHARED_SECRET) missing.push("SSP266_SHARED_SECRET");
if (!TEST_BUYER_ID) missing.push("TEST_BUYER_ID");
if (!ACCOUNTS_ENCRYPTION_KEY) missing.push("ACCOUNTS_ENCRYPTION_KEY");

if (missing.length) {
  console.error("\n❌  Missing required env var(s):\n");
  for (const m of missing) console.error(`   - ${m}`);
  console.error("\n   Example:");
  console.error(
    "   DB_PASSWORD=xxx SSP266_SHARED_SECRET=xxx TEST_BUYER_ID=xxx ACCOUNTS_ENCRYPTION_KEY=xxx node scripts/seed-test-account.mjs\n",
  );
  process.exit(1);
}

// ── Encryption (mirrors lib/encryption.ts exactly: AES-256-GCM via Web ─────────
// Crypto, base64(iv[12 bytes] || ciphertext)) so the app's own decrypt() can
// read these values back.
function getKeyMaterial() {
  return Uint8Array.from(Buffer.from(ACCOUNTS_ENCRYPTION_KEY, "base64"));
}

async function importKey() {
  const keyMaterial = getKeyMaterial();
  if (keyMaterial.length !== 32) {
    throw new Error("ACCOUNTS_ENCRYPTION_KEY must decode to 32 bytes");
  }
  return crypto.subtle.importKey("raw", keyMaterial, "AES-GCM", false, ["encrypt", "decrypt"]);
}

const IV_LENGTH = 12;

async function encrypt(plaintext) {
  const key = await importKey();
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const ciphertextBuf = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(plaintext));
  const combined = new Uint8Array(iv.length + ciphertextBuf.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertextBuf), iv.length);
  return Buffer.from(combined).toString("base64");
}

// ── Run via pg ────────────────────────────────────────────────────────────────
let pg;
try {
  pg = await import("pg");
} catch {
  console.log("📦  Installing pg (node-postgres)...");
  const { execSync } = await import("child_process");
  execSync("npm install pg --no-save", { cwd: PROJECT_ROOT, stdio: "inherit" });
  pg = await import("pg");
}

const { default: { Client } } = pg;

const client = new Client({
  host: DB_HOST,
  port: DB_PORT,
  database: DB_NAME,
  user: DB_USER,
  password: DB_PASSWORD,
  ssl: { rejectUnauthorized: false },
});

console.log(`\n🔌  Connecting to ${DB_HOST}...`);
await client.connect();
console.log("✅  Connected.\n");

try {
  await client.query("begin");

  // 1. games — find or insert (no unique constraint on title/steam_app_id)
  let { rows: gameRows } = await client.query(
    `select id from games where title = $1 and steam_app_id = $2 limit 1`,
    [GAME_TITLE, GAME_STEAM_APPID],
  );
  let gameId;
  if (gameRows.length) {
    gameId = gameRows[0].id;
    console.log(`⏭   games: reusing existing row (${gameId})`);
  } else {
    const { rows } = await client.query(
      `insert into games (title, steam_app_id) values ($1, $2) returning id`,
      [GAME_TITLE, GAME_STEAM_APPID],
    );
    gameId = rows[0].id;
    console.log(`✅  games: inserted (${gameId})`);
  }

  // 2. steam_accounts — find or insert (no unique constraint on username)
  let { rows: acctRows } = await client.query(
    `select id from steam_accounts where username = $1 limit 1`,
    [ACCOUNT_USERNAME],
  );
  let accountId;
  if (acctRows.length) {
    accountId = acctRows[0].id;
    console.log(`⏭   steam_accounts: reusing existing row (${accountId})`);
  } else {
    const passwordEnc = await encrypt(ACCOUNT_PASSWORD);
    const sharedSecretEnc = await encrypt(SSP266_SHARED_SECRET);
    const { rows } = await client.query(
      `insert into steam_accounts (username, password_enc, shared_secret_enc, status)
       values ($1, $2, $3, 'active') returning id`,
      [ACCOUNT_USERNAME, passwordEnc, sharedSecretEnc],
    );
    accountId = rows[0].id;
    console.log(`✅  steam_accounts: inserted (${accountId})`);
  }

  // 3. account_games — link them (unique (account_id, game_id))
  const { rows: linkRows } = await client.query(
    `insert into account_games (account_id, game_id)
     values ($1, $2)
     on conflict (account_id, game_id) do update set account_id = excluded.account_id
     returning id`,
    [accountId, gameId],
  );
  const accountGameId = linkRows[0].id;
  console.log(`✅  account_games: linked (${accountGameId})`);

  // 4. orders — verified test order (unique (shopee_order_id, shopee_buyer_id))
  const { rows: orderRows } = await client.query(
    `insert into orders (shopee_order_id, shopee_buyer_id, account_game_id, verified)
     values ($1, $2, $3, true)
     on conflict (shopee_order_id, shopee_buyer_id)
     do update set account_game_id = excluded.account_game_id, verified = true
     returning id`,
    [ORDER_SHOPEE_ID, TEST_BUYER_ID, accountGameId],
  );
  const orderId = orderRows[0].id;
  console.log(`✅  orders: seeded (${orderId})`);

  await client.query("commit");

  console.log("\n🎉  Seed complete.\n");
  console.log("   account_id       :", accountId);
  console.log("   game_id          :", gameId);
  console.log("   account_game_id  :", accountGameId);
  console.log("   order_id         :", orderId);
  console.log("   shopee_order_id  :", ORDER_SHOPEE_ID);
  console.log("   shopee_buyer_id  :", TEST_BUYER_ID);
  console.log("\n➡️  Next step: confirm a real end-to-end lookup works. Run the app");
  console.log("   locally (npm run dev) then POST to /api/lookup with:");
  console.log(`   { "buyerId": "${TEST_BUYER_ID}", "orderId": "${ORDER_SHOPEE_ID}" }`);
  console.log("   against http://localhost:3000/api/lookup and confirm a live Steam Guard code comes back.\n");
} catch (err) {
  await client.query("rollback");
  console.error("\n❌  Seed failed, rolled back:", err.message, "\n");
  process.exitCode = 1;
} finally {
  await client.end();
}
